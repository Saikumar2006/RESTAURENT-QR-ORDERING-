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
  if (env.paymentProvider === "razorpay" && (!env.razorpayKeyId || !env.razorpayKeySecret)) {
    problems.push("PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET aren't set.");
  }
  if (env.messagingProvider === "twilio" && (!env.twilioAccountSid || !env.twilioAuthToken)) {
    problems.push("MESSAGING_PROVIDER=twilio but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN aren't set.");
  }

  if (problems.length > 0) {
    console.error("\nRefusing to start in production with unsafe configuration:\n");
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error("");
    process.exit(1);
  }
}

module.exports = { assertProductionSafety };
