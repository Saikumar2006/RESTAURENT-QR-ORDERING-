const prisma = require("../config/db");
const env = require("../config/env");
const { hashPassword } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const roleService = require("./roleService");
const { getSaasPaymentProvider } = require("./saasPaymentProvider");
const catalog = require("./subscriptionCatalog");

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "restaurant";
}

async function uniqueSlug(tx, name) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  while (await tx.restaurant.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addBillingPeriod(date, period) {
  const months = { MONTHLY: 1, "3_MONTHS": 3, "6_MONTHS": 6, YEARLY: 12 }[period];
  if (!months) throw new ApiError(400, "Invalid subscription billing period.");
  const day = date.getUTCDate();
  const next = new Date(date);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

async function ensureEmailAvailable(email) {
  const existingUser = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existingUser) throw new ApiError(409, "This email already has an account. Sign in or contact support.");
  const existingPending = await prisma.pendingOnboarding.findUnique({ where: { emailClaim: email } });
  if (existingPending && existingPending.expiresAt > new Date()) throw new ApiError(409, "An onboarding session for this email is already in progress.");
  if (existingPending) await prisma.pendingOnboarding.update({ where: { id: existingPending.id }, data: { emailClaim: null, passwordHash: null, status: "EXPIRED" } });
}

async function createRestaurantFromPending(tx, pending, { subscriptionStatus, period, amount, startsAt, endsAt, trialEndsAt }) {
  if (!pending.passwordHash) throw new ApiError(409, "This onboarding session has expired. Please start again.");
  const slug = await uniqueSlug(tx, pending.restaurantName);
  const restaurant = await tx.restaurant.create({
    data: { name: pending.restaurantName, slug, cuisineType: pending.cuisineType || null, currency: pending.currency },
  });
  const owner = await tx.user.create({
    data: {
      restaurantId: restaurant.id,
      name: pending.adminName,
      email: pending.adminEmail,
      passwordHash: pending.passwordHash,
      role: "ADMIN",
    },
  });
  await roleService.ensureRestaurantRoles(restaurant.id, tx);
  const subscription = await tx.subscription.create({
    data: {
      restaurantId: restaurant.id,
      pendingOnboardingId: pending.id,
      planKey: pending.planKey,
      billingPeriod: period,
      amount,
      currency: pending.currency,
      status: subscriptionStatus,
      startsAt,
      endsAt,
      trialEndsAt: trialEndsAt || null,
    },
  });
  await tx.pendingOnboarding.update({
    where: { id: pending.id },
    data: { status: "ACTIVATED", restaurantId: restaurant.id, emailClaim: null, passwordHash: null },
  });
  await tx.platformAdminAuditLog.create({
    data: {
      targetRestaurantId: restaurant.id,
      action: "subscription.onboarding_activated",
      metadata: JSON.stringify({ planKey: pending.planKey, status: subscriptionStatus, billingPeriod: period }),
    },
  });
  return { restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug }, owner: { id: owner.id, email: owner.email }, subscription };
}

async function startTrial(input) {
  if (!env.subscriptionTrialDays) throw new ApiError(503, "A free trial is not currently configured.");
  const email = input.adminEmail.trim().toLowerCase();
  await ensureEmailAvailable(email);
  const passwordHash = await hashPassword(input.adminPassword);
  const now = new Date();
  const expiresAt = addDays(now, env.subscriptionPendingMinutes / (24 * 60));
  const trialEndsAt = addDays(now, env.subscriptionTrialDays);
  let pending = null;
  try {
    pending = await prisma.pendingOnboarding.create({
      data: {
        restaurantName: input.restaurantName.trim(), cuisineType: input.cuisineType?.trim() || null,
        adminName: input.adminName.trim(), adminEmail: email, emailClaim: email, passwordHash,
        planKey: input.planKey, billingPeriod: "TRIAL", amount: 0, currency: "INR", expiresAt,
      },
    });
    const activated = await prisma.$transaction((tx) => createRestaurantFromPending(tx, pending, {
      subscriptionStatus: "TRIALING", period: "TRIAL", amount: 0, startsAt: now, endsAt: trialEndsAt, trialEndsAt,
    }), { timeout: 15000 });
    return activated;
  } catch (error) {
    if (pending) await prisma.pendingOnboarding.update({ where: { id: pending.id }, data: { status: "FAILED", emailClaim: null, passwordHash: null } }).catch(() => {});
    if (error.code === "P2002") throw new ApiError(409, "An onboarding session for this email already exists.");
    throw error;
  }
}

async function createCheckout(input) {
  const pricing = catalog.parsePricing();
  const providerStatus = catalog.getProviderStatus();
  if (!pricing.configured) throw new ApiError(503, "Subscription prices are not configured yet.");
  if (!providerStatus.ready) throw new ApiError(503, "Subscription checkout is not configured yet.");
  const amount = pricing.prices[input.planKey]?.[input.billingPeriod];
  if (!amount) throw new ApiError(400, "That plan and billing period are not available.");
  const email = input.adminEmail.trim().toLowerCase();
  await ensureEmailAvailable(email);
  const passwordHash = await hashPassword(input.adminPassword);
  const now = new Date();
  const expiresAt = addDays(now, env.subscriptionPendingMinutes / (24 * 60));
  let pending;
  try {
    pending = await prisma.pendingOnboarding.create({
      data: {
        restaurantName: input.restaurantName.trim(), cuisineType: input.cuisineType?.trim() || null,
        adminName: input.adminName.trim(), adminEmail: email, emailClaim: email, passwordHash,
        planKey: input.planKey, billingPeriod: input.billingPeriod, amount, currency: "INR", expiresAt,
      },
    });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "An onboarding session for this email already exists.");
    throw error;
  }

  let providerOrder;
  try {
    providerOrder = await getSaasPaymentProvider().createOrder({
      amount, currency: pending.currency, receipt: `svaadya_${pending.id.replace(/-/g, "").slice(0, 24)}`,
    });
    await prisma.subscriptionPayment.create({
      data: {
        pendingOnboardingId: pending.id, provider: "razorpay", providerOrderId: providerOrder.id,
        amount, currency: pending.currency, status: "PENDING",
      },
    });
  } catch (error) {
    await prisma.pendingOnboarding.update({ where: { id: pending.id }, data: { status: "FAILED", emailClaim: null, passwordHash: null } }).catch(() => {});
    throw error;
  }
  return {
    onboardingId: pending.id, provider: "razorpay", providerOrderId: providerOrder.id,
    amountMinor: providerOrder.amount, currency: providerOrder.currency,
    keyId: env.saasRazorpayKeyId, expiresAt: pending.expiresAt,
  };
}

async function getCurrentSubscription(restaurantId, database = prisma) {
  const subscription = await database.subscription.findFirst({
    where: { restaurantId }, orderBy: { createdAt: "desc" },
    select: { id: true, planKey: true, billingPeriod: true, amount: true, currency: true, status: true, startsAt: true, endsAt: true, trialEndsAt: true, graceEndsAt: true },
  });
  return subscription ? { subscription, catalog: catalog.getPublicCatalog() } : { subscription: null, catalog: catalog.getPublicCatalog() };
}

async function createRenewalCheckout(restaurantId, billingPeriod) {
  const subscription = await prisma.subscription.findFirst({ where: { restaurantId }, orderBy: { createdAt: "desc" } });
  if (!subscription) throw new ApiError(404, "No subscription is associated with this restaurant.");
  if (subscription.status === "CANCELLED" || subscription.status === "GRANDFATHERED") throw new ApiError(409, "This subscription cannot be renewed here.");
  const pricing = catalog.parsePricing();
  if (!pricing.configured || !catalog.getProviderStatus().ready) throw new ApiError(503, "Subscription renewal is not configured yet.");
  const amount = pricing.prices[subscription.planKey]?.[billingPeriod];
  if (!amount) throw new ApiError(400, "That billing period is not available for this plan.");
  const pending = await prisma.subscriptionPayment.findFirst({ where: { subscriptionId: subscription.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (pending && pending.providerOrderId && pending.billingPeriod === billingPeriod && Date.now() - pending.createdAt.getTime() < env.subscriptionPendingMinutes * 60 * 1000) {
    return { providerOrderId: pending.providerOrderId, amountMinor: Math.round(pending.amount * 100), currency: pending.currency, keyId: env.saasRazorpayKeyId, planKey: subscription.planKey, billingPeriod: pending.billingPeriod };
  }
  if (pending) await prisma.subscriptionPayment.update({ where: { id: pending.id }, data: { status: "FAILED", failureCode: "checkout_expired" } });
  const provider = getSaasPaymentProvider();
  const providerOrder = await provider.createOrder({ amount, currency: subscription.currency, receipt: `renew_${subscription.id.slice(0, 24)}` });
  await prisma.subscriptionPayment.create({
    data: { subscriptionId: subscription.id, provider: provider.name, providerOrderId: providerOrder.id, amount, currency: subscription.currency, billingPeriod, status: "PENDING" },
  });
  return { providerOrderId: providerOrder.id, amountMinor: providerOrder.amount, currency: providerOrder.currency, keyId: env.saasRazorpayKeyId, planKey: subscription.planKey, billingPeriod };
}

async function completePaidOnboarding({ providerOrderId, providerPaymentId, providerSignature, paymentEntity, eventId }) {
  const provider = getSaasPaymentProvider();
  if (provider.name !== "razorpay") throw new ApiError(503, "Subscription payments are unavailable.");
  const payment = await prisma.subscriptionPayment.findUnique({ where: { providerOrderId }, include: { pendingOnboarding: true, subscription: true } });
  if (!payment || (!payment.pendingOnboarding && !payment.subscription)) return { ignored: true };
  if (payment.status === "PAID") return { alreadyProcessed: true, restaurantId: payment.pendingOnboarding?.restaurantId || payment.subscription?.restaurantId };

  if (paymentEntity) {
    if (paymentEntity.order_id !== payment.providerOrderId
      || paymentEntity.currency !== payment.currency
      || Number(paymentEntity.amount) !== Math.round(payment.amount * 100)
      || (paymentEntity.status && paymentEntity.status !== "captured")) {
      throw new ApiError(400, "Subscription payment does not match the pending checkout.");
    }
  } else {
    const valid = await provider.verifyPayment({ providerOrderId, providerPaymentId, providerSignature });
    if (!valid) throw new ApiError(400, "Subscription payment signature could not be verified.");
    const providerPayment = await provider.fetchPayment(providerPaymentId);
    if (providerPayment.order_id !== payment.providerOrderId
      || providerPayment.currency !== payment.currency
      || Number(providerPayment.amount) !== Math.round(payment.amount * 100)
      || providerPayment.status !== "captured") {
      throw new ApiError(409, "The payment provider has not confirmed this captured subscription payment.");
    }
  }

  return prisma.$transaction(async (tx) => {
    if (eventId) {
      try {
        await tx.billingWebhookEvent.create({ data: { provider: "razorpay", eventId, processingStatus: "RECEIVED" } });
      } catch (error) {
        if (error.code === "P2002") return { alreadyProcessed: true };
        throw error;
      }
    }
    const claimed = await tx.subscriptionPayment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "PAID", providerPaymentId },
    });
    if (claimed.count !== 1) return { alreadyProcessed: true };
    if (payment.subscriptionId) {
      const currentSubscription = await tx.subscription.findUnique({ where: { id: payment.subscriptionId } });
      if (!currentSubscription || currentSubscription.restaurantId !== payment.subscription.restaurantId) throw new ApiError(409, "The subscription changed during renewal.");
      const now = new Date();
      const renewalStart = currentSubscription.endsAt && currentSubscription.endsAt > now ? currentSubscription.endsAt : now;
      const renewed = await tx.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          status: "ACTIVE", amount: payment.amount, billingPeriod: payment.billingPeriod,
          startsAt: currentSubscription.startsAt, endsAt: addBillingPeriod(renewalStart, payment.billingPeriod), graceEndsAt: null,
        },
      });
      await tx.platformAdminAuditLog.create({ data: { targetRestaurantId: renewed.restaurantId, action: "subscription.renewed", metadata: JSON.stringify({ planKey: renewed.planKey, billingPeriod: renewed.billingPeriod }) } });
      if (eventId) await tx.billingWebhookEvent.update({ where: { provider_eventId: { provider: "razorpay", eventId } }, data: { processingStatus: "PROCESSED", processedAt: new Date() } });
      return { renewed: true, endsAt: renewed.endsAt };
    }
    const pending = await tx.pendingOnboarding.findUnique({ where: { id: payment.pendingOnboardingId } });
    if (!pending || pending.status !== "PENDING_PAYMENT" || pending.expiresAt <= new Date()) {
      await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "FAILED", failureCode: "onboarding_expired" } });
      return { paidButNotActivated: true, requiresSupport: true };
    }
    const result = await createRestaurantFromPending(tx, pending, {
      subscriptionStatus: "ACTIVE", period: pending.billingPeriod, amount: pending.amount,
      startsAt: new Date(), endsAt: addBillingPeriod(new Date(), pending.billingPeriod),
    });
    await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { subscriptionId: result.subscription.id } });
    if (eventId) await tx.billingWebhookEvent.update({ where: { provider_eventId: { provider: "razorpay", eventId } }, data: { processingStatus: "PROCESSED", processedAt: new Date() } });
    return { activated: true, restaurant: result.restaurant };
  }, { timeout: 15000 });
}

async function verifyCheckout(input) {
  return completePaidOnboarding({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    providerSignature: input.providerSignature,
  });
}

async function processFailedWebhook(providerOrderId, eventId) {
  return prisma.$transaction(async (tx) => {
    try {
      await tx.billingWebhookEvent.create({ data: { provider: "razorpay", eventId, processingStatus: "RECEIVED" } });
    } catch (error) {
      if (error.code === "P2002") return { alreadyProcessed: true };
      throw error;
    }
    const payment = await tx.subscriptionPayment.findUnique({ where: { providerOrderId }, include: { pendingOnboarding: true, subscription: true } });
    if (!payment || payment.status !== "PENDING") {
      await tx.billingWebhookEvent.update({ where: { provider_eventId: { provider: "razorpay", eventId } }, data: { processingStatus: "IGNORED", processedAt: new Date() } });
      return { ignored: true };
    }
    await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "FAILED", failureCode: "provider_payment_failed" } });
    if (payment.pendingOnboarding) {
      await tx.pendingOnboarding.update({ where: { id: payment.pendingOnboarding.id }, data: { status: "FAILED", emailClaim: null, passwordHash: null } });
    } else if (payment.subscription) {
      const laterPaidAttempt = await tx.subscriptionPayment.findFirst({
        where: { subscriptionId: payment.subscription.id, status: "PAID", createdAt: { gt: payment.createdAt } },
        select: { id: true },
      });
      if (!laterPaidAttempt) {
        const graceEndsAt = env.subscriptionGraceDays ? addDays(new Date(), env.subscriptionGraceDays) : null;
        await tx.subscription.update({
          where: { id: payment.subscription.id },
          data: { status: graceEndsAt ? "PAST_DUE" : "EXPIRED", graceEndsAt },
        });
        await tx.platformAdminAuditLog.create({ data: { targetRestaurantId: payment.subscription.restaurantId, action: "subscription.renewal_failed", metadata: JSON.stringify({ graceEndsAt }) } });
      }
    }
    await tx.billingWebhookEvent.update({ where: { provider_eventId: { provider: "razorpay", eventId } }, data: { processingStatus: "PROCESSED", processedAt: new Date() } });
    return { processed: true, status: "FAILED" };
  });
}

async function handleWebhook(rawBody, signature, payload, eventId) {
  const provider = getSaasPaymentProvider();
  if (provider.name !== "razorpay" || !provider.verifyWebhookSignature(rawBody, signature)) {
    throw new ApiError(400, "Invalid subscription webhook signature.");
  }
  const entity = payload.payload?.payment?.entity;
  if (!eventId) throw new ApiError(400, "Subscription webhook is missing its event identifier.");
  if (payload.event === "payment.failed") {
    if (!entity?.order_id) throw new ApiError(400, "Subscription webhook is missing its provider order identifier.");
    return processFailedWebhook(entity.order_id, eventId);
  }
  if (payload.event !== "payment.captured") return { ignored: true };
  if (!entity?.order_id || !entity?.id) throw new ApiError(400, "Subscription webhook is missing required identifiers.");
  return completePaidOnboarding({ providerOrderId: entity.order_id, providerPaymentId: entity.id, paymentEntity: entity, eventId });
}

async function expireSubscriptions(database = prisma, now = new Date()) {
  const [trials, active, pastDue] = await Promise.all([
    database.subscription.updateMany({ where: { status: "TRIALING", trialEndsAt: { lte: now } }, data: { status: "EXPIRED" } }),
    database.subscription.updateMany({ where: { status: "ACTIVE", endsAt: { lte: now } }, data: { status: "EXPIRED" } }),
    database.subscription.updateMany({ where: { status: "PAST_DUE", graceEndsAt: { lte: now } }, data: { status: "EXPIRED" } }),
  ]);
  await database.pendingOnboarding.updateMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lte: now } },
    data: { status: "EXPIRED", emailClaim: null, passwordHash: null },
  });
  return { expired: trials.count + active.count + pastDue.count };
}

module.exports = { startTrial, createCheckout, getCurrentSubscription, createRenewalCheckout, verifyCheckout, handleWebhook, expireSubscriptions, addBillingPeriod };
