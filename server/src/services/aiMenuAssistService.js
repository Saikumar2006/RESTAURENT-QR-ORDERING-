const prisma = require("../config/db");
const env = require("../config/env");

async function getStatus(restaurantId) {
  const subscription = await prisma.subscription.findFirst({ where: { restaurantId }, orderBy: { createdAt: "desc" }, select: { planKey: true, status: true, endsAt: true, trialEndsAt: true, graceEndsAt: true } });
  const now = new Date();
  const entitled = subscription && ["ACTIVE", "TRIALING", "PAST_DUE", "GRANDFATHERED"].includes(subscription.status)
    && (subscription.status === "GRANDFATHERED" || (subscription.status === "ACTIVE" && subscription.endsAt && subscription.endsAt > now)
      || (subscription.status === "TRIALING" && subscription.trialEndsAt > now)
      || (subscription.status === "PAST_DUE" && subscription.graceEndsAt > now));
  const providerConfigured = env.aiProvider !== "unconfigured" && Boolean(env.aiApiKey);
  return {
    premiumPlan: subscription?.planKey === "PREMIUM" && Boolean(entitled),
    providerConfigured,
    available: false,
    reason: !subscription || subscription.planKey !== "PREMIUM" ? "premium_plan_required"
      : !providerConfigured ? "ai_provider_not_configured" : "provider_adapter_not_enabled",
  };
}

module.exports = { getStatus };
