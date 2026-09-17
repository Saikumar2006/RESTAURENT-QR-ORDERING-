require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

const nodeEnv = required("NODE_ENV", "development");
const serverUrl = required("SERVER_URL", "http://localhost:4000");
// In production this app is a single process — Express builds and serves
// the client itself (see server.js), so CLIENT_URL and SERVER_URL are
// normally the same deployed domain. If CLIENT_URL isn't explicitly set in
// production, fall back to SERVER_URL instead of the dev default
// (localhost:5173) — otherwise every QR code printed encodes an
// unreachable localhost link with no error anywhere to signal it.
const clientUrlFallback = nodeEnv === "production" ? serverUrl : "http://localhost:5173";
const clientUrl = required("CLIENT_URL", clientUrlFallback);

// CORS/socket.io origins. Same-origin deploys only ever need CLIENT_URL
// itself. Split deploys (e.g. React on Cloudflare Pages, API on
// Railway/Render) can additionally set ALLOWED_ORIGINS to a comma-separated
// list — e.g. "https://order.example.com,https://order-preview.pages.dev" —
// so PR/preview deploys on Pages aren't locked out.
const allowedOrigins = [
  clientUrl,
  ...required("ALLOWED_ORIGINS", "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

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
  logLevel: required("LOG_LEVEL", "info"),
};
