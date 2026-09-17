const crypto = require("crypto");
const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { signPhoneVerificationToken } = require("../utils/auth");
const messagingService = require("./messagingService");
const tableService = require("./tableService");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends for the same phone
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashCode(code, phone) {
  // Salted with the phone number so the same code for two different phones
  // doesn't hash identically — low-value target either way given the
  // short expiry + attempt cap, but costs nothing to do properly.
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

async function sendOtp(slug, phone) {
  const restaurant = await tableService.resolveRestaurantBySlug(slug);

  const recent = await prisma.phoneOtp.findFirst({
    where: { phone, createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    throw new ApiError(429, "Please wait a moment before requesting another code.");
  }

  const code = generateCode();
  await prisma.phoneOtp.create({
    data: {
      phone,
      codeHash: hashCode(code, phone),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const result = await messagingService.sendMessage({
    restaurantId: restaurant.id,
    phone,
    body: `Your verification code for ${restaurant.name} is ${code}. It expires in 5 minutes. Do not share this code.`,
    purpose: "otp",
    preferredChannel: restaurant.notificationChannel,
  });

  if (!result.success) {
    throw new ApiError(502, "Couldn't send the verification code. Please try again in a moment.");
  }
  return { sent: true, channel: result.channel };
}

async function verifyOtp(phone, code) {
  const otp = await prisma.phoneOtp.findFirst({
    where: { phone, verified: false },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    throw new ApiError(400, "No verification code found for this number. Please request a new one.");
  }
  if (otp.expiresAt < new Date()) {
    throw new ApiError(400, "This code has expired. Please request a new one.");
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Please request a new code.");
  }

  if (!crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashCode(code, phone)))) {
    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  await prisma.phoneOtp.update({ where: { id: otp.id }, data: { verified: true } });
  const token = signPhoneVerificationToken(phone);
  return { phoneVerificationToken: token };
}

module.exports = { sendOtp, verifyOtp };
