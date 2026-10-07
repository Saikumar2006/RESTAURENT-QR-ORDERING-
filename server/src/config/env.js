require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return value.trim();
}

function normalizeOrigin(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

const nodeEnv = required("NODE_ENV", "development");
const redisUrl = required("REDIS_URL", "");
const defaultProductionOrigin = "https://restaurant-qr-ordering.onrender.com";
const serverUrl = required(
  "SERVER_URL",
  nodeEnv === "production" ? defaultProductionOrigin : "http://localhost:4000"
);
// In production this app is a single process — Express builds and serves
// the client itself (see server.js), so CLIENT_URL and SERVER_URL are
// normally the same deployed domain. If CLIENT_URL isn't explicitly set in
// production, fall back to the public Render origin instead of the dev
// localhost URL — otherwise every QR code printed encodes an unreachable
// localhost link with no error anywhere to signal it.
const clientUrlFallback = nodeEnv === "production" ? serverUrl : "http://localhost:5173";
const clientUrl = required("CLIENT_URL", clientUrlFallback);
const googleClientId = required("GOOGLE_CLIENT_ID", "");
const googleClientSecret = required("GOOGLE_CLIENT_SECRET", "");
const googleCallbackUrl = required("GOOGLE_CALLBACK_URL", `${serverUrl}/api/auth/google/callback`);
const whatsappPhoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID", "");
const whatsappBusinessAccountId = required("WHATSAPP_BUSINESS_ACCOUNT_ID", "");
const whatsappAccessToken = required("WHATSAPP_ACCESS_TOKEN", "");
const whatsappOtpTemplateName = required("WHATSAPP_OTP_TEMPLATE_NAME", "");
const whatsappApiVersion = required("WHATSAPP_API_VERSION", "");

if (nodeEnv === "production" && !googleCallbackUrl.startsWith("https://")) {
  throw new Error("GOOGLE_CALLBACK_URL must use HTTPS in production");
}

// CORS/socket.io origins. Same-origin deploys only ever need CLIENT_URL
// itself. Split deploys (e.g. React on Cloudflare Pages, API on
// Railway/Render) can additionally set ALLOWED_ORIGINS to a comma-separated
// list — e.g. "https://order.example.com,https://order-preview.pages.dev" —
// so PR/preview deploys on Pages aren't locked out.
const allowedOrigins = (() => {
  const set = new Set();
  const localDevOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
  ];

  for (const value of [clientUrl, serverUrl, required("ALLOWED_ORIGINS", "")]) {
    for (const item of String(value).split(",")) {
      const normalized = normalizeOrigin(item);
      if (!normalized || normalized === "*") continue;
      set.add(normalized);
    }
  }

  if (nodeEnv !== "production") {
    for (const origin of localDevOrigins) {
      set.add(normalizeOrigin(origin));
    }
  }

  return [...set].sort();
})();

module.exports = {
  nodeEnv,
  port: parseInt(required("PORT", "4000"), 10),
  databaseUrl: required("DATABASE_URL", "file:./dev.db"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: required("JWT_EXPIRES_IN", "8h"),
  paymentProvider: required("PAYMENT_PROVIDER", "mock"), // "mock" | "razorpay"
  razorpayKeyId: required("RAZORPAY_KEY_ID", ""),
  razorpayKeySecret: required("RAZORPAY_KEY_SECRET", ""),
  razorpayWebhookSecret: required("RAZORPAY_WEBHOOK_SECRET", ""),
  messagingProvider: required("MESSAGING_PROVIDER", "mock"), // "mock" | "twilio"
  googleClientId,
  googleClientSecret,
  googleCallbackUrl,
  whatsappPhoneNumberId,
  whatsappBusinessAccountId,
  whatsappAccessToken,
  whatsappOtpTemplateName,
  whatsappApiVersion,
  twilioAccountSid: required("TWILIO_ACCOUNT_SID", ""),
  twilioAuthToken: required("TWILIO_AUTH_TOKEN", ""),
  // Twilio's own format, e.g. "whatsapp:+14155238886" and "+14155550123"
  twilioWhatsappFrom: required("TWILIO_WHATSAPP_FROM", ""),
  twilioSmsFrom: required("TWILIO_SMS_FROM", ""),
  storageProvider: required("STORAGE_PROVIDER", "local"), // "local" | "supabase"
  supabaseUrl: required("SUPABASE_URL", ""),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", ""),
  supabaseStorageBucket: required("SUPABASE_STORAGE_BUCKET", "menu-images"),
  forceHttps: required("FORCE_HTTPS", "true") !== "false",
  clientUrl,
  allowedOrigins,
  serverUrl,
  redisUrl: redisUrl || undefined,
  logLevel: required("LOG_LEVEL", "info"),
  normalizeOrigin,
};
