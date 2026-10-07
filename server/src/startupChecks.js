const env = require("./config/env");

const INSECURE_DEFAULT_JWT_SECRET = "dev-secret-change-me";

// Runs once at boot. Throws (crashing startup loudly, which is the point)
// rather than warning-and-continuing — a silently-insecure production
// deploy is worse than one that refuses to start until it's fixed.
function assertProductionSafety() {
  if (env.nodeEnv !== "production") return;

  const problems = [];

  if (!env.jwtSecret || env.jwtSecret === INSECURE_DEFAULT_JWT_SECRET) {
    problems.push(
      "JWT_SECRET is missing or still set to the insecure default. Generate a real one, " +
        'e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`, ' +
        "and set it in your host's environment variables."
    );
  }
  if (env.jwtSecret && env.jwtSecret.length < 32) {
    problems.push("JWT_SECRET is shorter than 32 characters — use a longer random value.");
  }
  const rawAllowedOrigins = String(process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (rawAllowedOrigins.includes("*")) {
    problems.push("ALLOWED_ORIGINS must not contain '*' in production; use explicit origins only.");
  }
  if (env.paymentProvider === "razorpay" && (!env.razorpayKeyId || !env.razorpayKeySecret)) {
    problems.push("PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET aren't set.");
  }
  if (env.messagingProvider === "twilio" && (!env.twilioAccountSid || !env.twilioAuthToken)) {
    problems.push("MESSAGING_PROVIDER=twilio but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN aren't set.");
  }
  const whatsappConfig = [
    env.whatsappPhoneNumberId,
    env.whatsappBusinessAccountId,
    env.whatsappAccessToken,
    env.whatsappOtpTemplateName,
    env.whatsappApiVersion,
  ];
  if (whatsappConfig.some(Boolean) && whatsappConfig.some((value) => !value)) {
    problems.push(
      "Platform WhatsApp OTP configuration is incomplete. Set WHATSAPP_PHONE_NUMBER_ID, " +
        "WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_OTP_TEMPLATE_NAME, " +
        "and WHATSAPP_API_VERSION together."
    );
  }
  if (env.whatsappApiVersion && !/^v\d+\.\d+$/.test(env.whatsappApiVersion)) {
    problems.push("WHATSAPP_API_VERSION must use the Meta Graph API format, for example v22.0.");
  }

  if (problems.length > 0) {
    console.error("\nRefusing to start in production with unsafe configuration:\n");
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error("");
    process.exit(1);
  }
}

module.exports = { assertProductionSafety };
