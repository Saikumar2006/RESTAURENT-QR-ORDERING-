const env = require("../config/env");

const PLAN_KEYS = ["BASIC", "STANDARD", "PREMIUM"];
const PERIODS = ["MONTHLY", "3_MONTHS", "6_MONTHS", "YEARLY"];
const FEATURES = {
  BASIC: ["QR ordering", "Menu and table management", "Order inbox"],
  STANDARD: ["Everything in Basic", "Staff roles", "Reports and promotions"],
  PREMIUM: ["Everything in Standard", "Inventory controls", "AI assisted menu entry (provider setup required)"],
};

function parsePricing(raw = env.subscriptionPricingJson) {
  if (!raw) return { configured: false, prices: {}, error: "pricing_not_configured" };
  let source;
  try { source = JSON.parse(raw); } catch { return { configured: false, prices: {}, error: "pricing_invalid" }; }
  if (!source || typeof source !== "object" || Array.isArray(source)) return { configured: false, prices: {}, error: "pricing_invalid" };

  const prices = {};
  for (const plan of PLAN_KEYS) {
    const input = source[plan] || source[plan.toLowerCase()];
    if (!input || typeof input !== "object") continue;
    prices[plan] = {};
    for (const period of PERIODS) {
      const amount = Number(input[period] ?? input[period.toLowerCase()]);
      if (Number.isFinite(amount) && amount > 0 && amount <= 100000000) prices[plan][period] = amount;
    }
    if (!Object.keys(prices[plan]).length) delete prices[plan];
  }
  return { configured: PLAN_KEYS.every((plan) => PERIODS.every((period) => prices[plan]?.[period])), prices, error: null };
}

function getProviderStatus() {
  const ready = env.saasPaymentProvider === "razorpay"
    && Boolean(env.saasRazorpayKeyId && env.saasRazorpayKeySecret && env.saasRazorpayWebhookSecret);
  return { ready, provider: ready ? "razorpay" : null, mode: ready ? "configured" : "unconfigured" };
}

function getPublicCatalog() {
  const pricing = parsePricing();
  const provider = getProviderStatus();
  return {
    currency: "INR",
    checkoutAvailable: pricing.configured && provider.ready,
    trial: { available: env.subscriptionTrialDays > 0, days: env.subscriptionTrialDays },
    plans: PLAN_KEYS.map((key) => ({
      key,
      name: key[0] + key.slice(1).toLowerCase(),
      features: FEATURES[key],
      prices: pricing.prices[key] || {},
    })),
    configuration: {
      pricingConfigured: pricing.configured,
      paymentProviderConfigured: provider.ready,
      checkoutAvailable: pricing.configured && provider.ready,
      legalDetailsConfigured: Boolean(env.companyLegalName && env.companySupportEmail && env.companyAddress && env.companyRegistrationNumber),
    },
    companySupportEmail: env.companySupportEmail || null,
    companyLegalName: env.companyLegalName || null,
    companyAddress: env.companyAddress || null,
    companyRegistrationNumber: env.companyRegistrationNumber || null,
  };
}

module.exports = { PLAN_KEYS, PERIODS, FEATURES, parsePricing, getProviderStatus, getPublicCatalog };
