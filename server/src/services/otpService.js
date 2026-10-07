const crypto = require("crypto");
const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { signPhoneVerificationToken } = require("../utils/auth");
const env = require("../config/env");
const whatsappService = require("./whatsappService");
const tableService = require("./tableService");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends for the same phone
const SEND_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 5 sends per phone per hour
const MAX_SENDS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function normalizePhone(phone) {
  const digits = phone.replace(/^\+/, "");
  return `+${digits}`;
}

function hashCode(code, phone) {
  return crypto.createHmac("sha256", env.jwtSecret).update(`${phone}:${code}`).digest("hex");
}

async function sendOtp(slug, phone) {
  await tableService.resolveRestaurantBySlug(slug);
  phone = normalizePhone(phone);
  whatsappService.assertConfigured();

  const now = new Date();
  const code = generateCode();
  let otp;
  try {
    otp = await prisma.$transaction(async (tx) => {
      const recent = await tx.phoneOtp.findFirst({
        where: { phone, createdAt: { gte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
        orderBy: { createdAt: "desc" },
      });
      if (recent) {
        throw new ApiError(429, "Please wait a moment before requesting another code.");
      }
      const sendCount = await tx.phoneOtp.count({
        where: { phone, createdAt: { gte: new Date(now.getTime() - SEND_LIMIT_WINDOW_MS) } },
      });
      if (sendCount >= MAX_SENDS_PER_WINDOW) {
        throw new ApiError(429, "Too many verification code requests. Please try again later.");
      }

      await tx.phoneOtp.updateMany({
        where: { phone, verified: false, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      return tx.phoneOtp.create({
        data: {
          phone,
          codeHash: hashCode(code, phone),
          expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error.code === "P2034") {
      throw new ApiError(429, "Please wait a moment before requesting another code.");
    }
    throw error;
  }

  try {
    await whatsappService.sendWhatsAppOtp(phone, code);
  } catch (error) {
    await prisma.phoneOtp.update({
      where: { id: otp.id },
      data: { invalidatedAt: new Date() },
    });
    throw error;
  }

  return { sent: true, channel: "whatsapp", phone };
}

async function verifyOtp(phone, code) {
  phone = normalizePhone(phone);
  const now = new Date();
  const otp = await prisma.phoneOtp.findFirst({
    where: { phone, verified: false, invalidatedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    throw new ApiError(400, "No verification code found for this number. Please request a new one.");
  }
  if (otp.expiresAt <= now) {
    throw new ApiError(400, "This code has expired. Please request a new one.");
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Please request a new code.");
  }

  const expectedHash = Buffer.from(otp.codeHash, "hex");
  const submittedHash = Buffer.from(hashCode(code, phone), "hex");
  if (expectedHash.length !== submittedHash.length || !crypto.timingSafeEqual(expectedHash, submittedHash)) {
    await prisma.phoneOtp.updateMany({
      where: {
        id: otp.id,
        verified: false,
        invalidatedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  const consumed = await prisma.phoneOtp.updateMany({
    where: {
      id: otp.id,
      verified: false,
      invalidatedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: MAX_ATTEMPTS },
      codeHash: otp.codeHash,
    },
    data: { verified: true, verifiedAt: now },
  });
  if (consumed.count !== 1) {
    throw new ApiError(400, "This code is no longer valid. Please request a new one.");
  }
  const token = signPhoneVerificationToken(phone);
  return { phoneVerificationToken: token };
}

module.exports = { sendOtp, verifyOtp, generateCode, normalizePhone };
