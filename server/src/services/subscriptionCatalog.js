const env = require("../config/env");

const PLAN_KEYS = ["STARTER", "GROWTH", "PREMIUM"];
const LEGACY_ALIASES = {
  BASIC: "STARTER",
  STANDARD: "GROWTH",
  PREMIUM: "PREMIUM",
};

const PERIODS = ["MONTHLY", "3_MONTHS", "6_MONTHS", "YEARLY"];
const GST_PERCENT = 18;

// Approved feature matrix based on real Svaadya platform capabilities
const FEATURES = {
  STARTER: [
    "Dynamic QR code digital menu & tables",
    "Live real-time order inbox & kitchen flow",
    "Up to 15 tables floor management",
    "Unlimited categories & menu items",
    "Daily sales summary & order history",
    "Standard email support",
  ],
  GROWTH: [
    "Everything in Starter",
    "Up to 50 tables floor management",
    "Role-based staff access control (RBAC)",
    "Coupons & promotional discount engine",
    "Advanced hourly analytics & trend reports",
    "Custom branding, logo & theme colors",
    "Priority support",
  ],
  PREMIUM: [
    "Everything in Growth",
    "Unlimited tables management",
    "Full inventory tracking & low-stock alerts",
    "Recipe component auto-stock deduction",
    "Supplier management & purchase invoicing",
    "AI assisted menu entry & descriptions",
    "WhatsApp order updates & OTP messaging",
    "Dedicated account manager",
  ],
};

// Default pricing approved in Phase 2
const DEFAULT_PRICING = {
  STARTER: {
    MONTHLY: 799,
    "3_MONTHS": 2277, // ~5% discount
    "6_MONTHS": 4315, // ~10% discount
    YEARLY: 7670,     // ~20% discount
  },
  GROWTH: {
    MONTHLY: 1199,
    "3_MONTHS": 3417,
    "6_MONTHS": 6475,
    YEARLY: 11510,
  },
  PREMIUM: {
    MONTHLY: 2599,
    "3_MONTHS": 7407,
    "6_MONTHS": 14035,
    YEARLY: 24950,
  },
};

// In-memory runtime override (allows Super Admin dynamic updates)
let dynamicPricingOverride = null;

function normalizePlanKey(key) {
  if (!key) return "STARTER";
  const upper = String(key).toUpperCase();
  return LEGACY_ALIASES[upper] || (PLAN_KEYS.includes(upper) ? upper : "STARTER");
}

function parsePricing(raw = env.subscriptionPricingJson) {
  if (raw === "") return { configured: false, prices: {}, error: "pricing_not_configured" };
  let source;
  if (typeof raw === "string" && raw) {
    try { source = JSON.parse(raw); } catch { return { configured: false, prices: {}, error: "pricing_invalid" }; }
    if (!source || typeof source !== "object" || Array.isArray(source)) return { configured: false, prices: {}, error: "pricing_invalid" };
  } else if (dynamicPricingOverride) {
    source = dynamicPricingOverride;
  } else if (!raw && !env.subscriptionPricingJson) {
    source = DEFAULT_PRICING;
  } else {
    return { configured: false, prices: {}, error: "pricing_not_configured" };
  }

  const prices = {};
  const allTiers = ["STARTER", "GROWTH", "PREMIUM", "BASIC", "STANDARD"];
  for (const plan of allTiers) {
    const canonical = normalizePlanKey(plan);
    const input = source[plan] || source[plan.toLowerCase()] || source[canonical] || source[canonical.toLowerCase()];
    if (!input || typeof input !== "object") continue;
    prices[plan] = {};
    for (const period of PERIODS) {
      const amount = Number(input[period] ?? input[period.toLowerCase()]);
      if (Number.isFinite(amount) && amount > 0 && amount <= 100000000) {
        prices[plan][period] = amount;
      }
    }
  }

  if (prices.STARTER && !prices.BASIC) prices.BASIC = prices.STARTER;
  if (prices.GROWTH && !prices.STANDARD) prices.STANDARD = prices.GROWTH;
  if (prices.BASIC && !prices.STARTER) prices.STARTER = prices.BASIC;
  if (prices.STANDARD && !prices.GROWTH) prices.GROWTH = prices.STANDARD;

  const configured = PLAN_KEYS.every((plan) => PERIODS.every((period) => Boolean(prices[plan]?.[period])));
  return { configured, prices, error: null };
}

function updateDynamicPricing(newPricing) {
  if (!newPricing || typeof newPricing !== "object") {
    throw new Error("Invalid pricing payload");
  }
  const validated = {};
  for (const plan of PLAN_KEYS) {
    const planInput = newPricing[plan] || newPricing[plan.toLowerCase()];
    if (!planInput) continue;
    validated[plan] = {};
    for (const period of PERIODS) {
      const amt = Number(planInput[period] ?? planInput[period.toLowerCase()]);
      if (Number.isFinite(amt) && amt > 0) {
        validated[plan][period] = amt;
      } else if (DEFAULT_PRICING[plan]?.[period]) {
        validated[plan][period] = DEFAULT_PRICING[plan][period];
      }
    }
  }
  dynamicPricingOverride = { ...DEFAULT_PRICING, ...validated };
  return parsePricing();
}

function getProviderStatus() {
  const ready = env.saasPaymentProvider === "razorpay"
    && Boolean(env.saasRazorpayKeyId && env.saasRazorpayKeySecret && env.saasRazorpayWebhookSecret);
  return {
    ready,
    provider: ready ? "razorpay" : null,
    mode: ready ? "configured" : "unconfigured",
  };
}

function calculateBill(planKey, billingPeriod) {
  const normPlan = normalizePlanKey(planKey);
  const { prices } = parsePricing();
  const subtotal = prices[normPlan]?.[billingPeriod] || DEFAULT_PRICING[normPlan]?.[billingPeriod] || 799;
  const gst = Math.round(subtotal * (GST_PERCENT / 100) * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  return {
    planKey: normPlan,
    billingPeriod,
    subtotal,
    gstRatePercent: GST_PERCENT,
    gst,
    total,
    currency: "INR",
  };
}

function getPublicCatalog() {
  const pricing = parsePricing();
  const provider = getProviderStatus();
  return {
    currency: "INR",
    taxRatePercent: GST_PERCENT,
    checkoutAvailable: pricing.configured && provider.ready,
    trial: { available: env.subscriptionTrialDays > 0, days: env.subscriptionTrialDays },
    plans: PLAN_KEYS.map((key) => ({
      key,
      name: key[0] + key.slice(1).toLowerCase(),
      features: FEATURES[key],
      prices: pricing.prices[key] || DEFAULT_PRICING[key],
    })),
    configuration: {
      pricingConfigured: pricing.configured,
      paymentProviderConfigured: provider.ready,
      checkoutAvailable: pricing.configured && provider.ready,
      legalDetailsConfigured: Boolean(env.companyLegalName && env.companySupportEmail && env.companyAddress && env.companyRegistrationNumber),
    },
    companySupportEmail: env.companySupportEmail || "svaadyarestro@gmail.com",
    companyLegalName: env.companyLegalName || null,
    companyAddress: env.companyAddress || null,
    companyRegistrationNumber: env.companyRegistrationNumber || null,
  };
}

module.exports = {
  PLAN_KEYS,
  PERIODS,
  FEATURES,
  DEFAULT_PRICING,
  GST_PERCENT,
  normalizePlanKey,
  parsePricing,
  updateDynamicPricing,
  calculateBill,
  getProviderStatus,
  getPublicCatalog,
};
