const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const { otpSendSchema } = require("../src/validators/schemas");

process.env.JWT_SECRET = "test-only-secret-with-enough-entropy";
process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-id";
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "test-business-id";
process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
process.env.WHATSAPP_OTP_TEMPLATE_NAME = "authentication_code";
process.env.WHATSAPP_API_VERSION = "v22.0";

const records = [];
let nextId = 1;
let deliveredCodes = [];
let deliveryError = null;

function matches(record, where) {
  if (where.id && record.id !== where.id) return false;
  if (where.phone && record.phone !== where.phone) return false;
  if (where.verified !== undefined && record.verified !== where.verified) return false;
  if (where.invalidatedAt === null && record.invalidatedAt !== null) return false;
  if (where.createdAt?.gte && record.createdAt < where.createdAt.gte) return false;
  if (where.expiresAt?.gt && record.expiresAt <= where.expiresAt.gt) return false;
  if (where.attempts?.lt !== undefined && record.attempts >= where.attempts.lt) return false;
  if (where.codeHash && record.codeHash !== where.codeHash) return false;
  return true;
}

function createDatabaseMock() {
  const phoneOtp = {
    async findFirst({ where, orderBy }) {
      const found = records
        .filter((record) => matches(record, where))
        .sort((a, b) => (orderBy?.createdAt === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
      return found[0] || null;
    },
    async count({ where }) {
      return records.filter((record) => matches(record, where)).length;
    },
    async create({ data }) {
      const record = {
        id: String(nextId++),
        attempts: 0,
        verified: false,
        verifiedAt: null,
        invalidatedAt: null,
        createdAt: new Date(),
        ...data,
      };
      records.push(record);
      return record;
    },
    async updateMany({ where, data }) {
      const found = records.filter((record) => matches(record, where));
      for (const record of found) applyUpdate(record, data);
      return { count: found.length };
    },
    async update({ where, data }) {
      const record = records.find((item) => item.id === where.id);
      if (!record) throw new Error("record not found");
      applyUpdate(record, data);
      return record;
    },
  };
  return {
    phoneOtp,
    async $transaction(callback) {
      return callback({ phoneOtp });
    },
  };
}

function applyUpdate(record, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      record[key] += value.increment;
    } else {
      record[key] = value;
    }
  }
}

const prismaPath = require.resolve("../src/config/db");
const authPath = require.resolve("../src/utils/auth");
const whatsappPath = require.resolve("../src/services/whatsappService");
const tablePath = require.resolve("../src/services/tableService");
let otpService;

beforeEach(() => {
  records.length = 0;
  nextId = 1;
  deliveredCodes = [];
  deliveryError = null;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: createDatabaseMock() };
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: { signPhoneVerificationToken: (phone) => `verified:${phone}` },
  };
  require.cache[whatsappPath] = {
    id: whatsappPath,
    filename: whatsappPath,
    loaded: true,
    exports: {
      assertConfigured() {},
      async sendWhatsAppOtp(phone, code) {
        if (deliveryError) throw deliveryError;
        deliveredCodes.push({ phone, code });
      },
    },
  };
  require.cache[tablePath] = {
    id: tablePath,
    filename: tablePath,
    loaded: true,
    exports: { async resolveRestaurantBySlug() { return { id: "restaurant-id" }; } },
  };
  delete require.cache[require.resolve("../src/services/otpService")];
  otpService = require("../src/services/otpService");
});

test("generates six digits and normalizes international phone numbers", () => {
  assert.match(otpService.generateCode(), /^\d{6}$/);
  assert.equal(otpService.normalizePhone("919876543210"), "+919876543210");
  assert.equal(otpService.normalizePhone("+919876543210"), "+919876543210");
  assert.equal(otpSendSchema.safeParse({ phone: "+919876543210" }).success, true);
  assert.equal(otpSendSchema.safeParse({ phone: "12" }).success, false);
});

test("stores only an HMAC and sends the code through the platform provider", async () => {
  const result = await otpService.sendOtp("spice-garden", "919876543210");
  assert.deepEqual(result, { sent: true, channel: "whatsapp", phone: "+919876543210" });
  assert.equal(deliveredCodes.length, 1);
  assert.equal(deliveredCodes[0].phone, "+919876543210");
  assert.match(deliveredCodes[0].code, /^\d{6}$/);
  assert.notEqual(records[0].codeHash, deliveredCodes[0].code);
  assert.equal(records[0].phone, "+919876543210");
});

test("wrong code increments attempts and a correct code can only be used once", async () => {
  await otpService.sendOtp("spice-garden", "+919876543210");
  const code = deliveredCodes[0].code;

  await assert.rejects(otpService.verifyOtp("+919876543210", "000000"), { status: 400 });
  assert.equal(records[0].attempts, 1);

  const result = await otpService.verifyOtp("919876543210", code);
  assert.deepEqual(result, { phoneVerificationToken: "verified:+919876543210" });
  assert.equal(records[0].verified, true);
  assert.ok(records[0].verifiedAt instanceof Date);
  await assert.rejects(otpService.verifyOtp("+919876543210", code), { status: 400 });
});

test("expired codes and codes at the attempt limit are rejected", async () => {
  await otpService.sendOtp("spice-garden", "+919876543210");
  records[0].expiresAt = new Date(Date.now() - 1);
  await assert.rejects(otpService.verifyOtp("+919876543210", deliveredCodes[0].code), /expired/);

  await otpService.sendOtp("spice-garden", "+14155550123");
  records[1].attempts = 5;
  await assert.rejects(otpService.verifyOtp("+14155550123", deliveredCodes[1].code), { status: 429 });
});

test("enforces resend cooldown, hourly phone limits, and invalidates a previous code", async () => {
  await otpService.sendOtp("spice-garden", "+919876543210");
  await assert.rejects(otpService.sendOtp("spice-garden", "+919876543210"), { status: 429 });

  records[0].createdAt = new Date(Date.now() - 61_000);
  await otpService.sendOtp("spice-garden", "+919876543210");
  assert.ok(records[0].invalidatedAt instanceof Date);
  await assert.rejects(otpService.verifyOtp("+919876543210", deliveredCodes[0].code), { status: 400 });

  for (let i = 0; i < 5; i += 1) {
    records.push({
      id: `rate-limit-${i}`,
      phone: "+14155550123",
      codeHash: "unused",
      attempts: 0,
      verified: false,
      verifiedAt: null,
      invalidatedAt: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    });
  }
  await assert.rejects(otpService.sendOtp("spice-garden", "+14155550123"), { status: 429 });
});

test("invalidates an OTP when provider delivery fails", async () => {
  deliveryError = new Error("provider failure");
  await assert.rejects(otpService.sendOtp("spice-garden", "+919876543210"), /provider failure/);
  assert.ok(records[0].invalidatedAt instanceof Date);
});
