-- Separate SaaS subscription billing from restaurant food-order payments.
-- The migration is additive: it does not alter existing order/payment data.
ALTER TABLE "PlatformAdminAuditLog"
  ADD COLUMN IF NOT EXISTS "targetRestaurantId" TEXT;

CREATE TABLE IF NOT EXISTS "PendingOnboarding" (
  "id" TEXT NOT NULL,
  "restaurantName" TEXT NOT NULL,
  "cuisineType" TEXT,
  "adminName" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "emailClaim" TEXT,
  "passwordHash" TEXT,
  "planKey" TEXT NOT NULL,
  "billingPeriod" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "restaurantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PendingOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PendingOnboarding_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "pendingOnboardingId" TEXT,
  "planKey" TEXT NOT NULL,
  "billingPeriod" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3),
  "graceEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Subscription_pendingOnboardingId_fkey"
    FOREIGN KEY ("pendingOnboardingId") REFERENCES "PendingOnboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "pendingOnboardingId" TEXT,
  "subscriptionId" TEXT,
  "provider" TEXT NOT NULL,
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionPayment_pendingOnboardingId_fkey"
    FOREIGN KEY ("pendingOnboardingId") REFERENCES "PendingOnboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT;

CREATE TABLE IF NOT EXISTS "BillingWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "errorCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingOnboarding_emailClaim_key" ON "PendingOnboarding"("emailClaim");
CREATE INDEX IF NOT EXISTS "PendingOnboarding_status_expiresAt_idx" ON "PendingOnboarding"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "PendingOnboarding_adminEmail_createdAt_idx" ON "PendingOnboarding"("adminEmail", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_pendingOnboardingId_key" ON "Subscription"("pendingOnboardingId");
CREATE INDEX IF NOT EXISTS "Subscription_restaurantId_status_endsAt_idx" ON "Subscription"("restaurantId", "status", "endsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_providerOrderId_key" ON "SubscriptionPayment"("providerOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_providerPaymentId_key" ON "SubscriptionPayment"("providerPaymentId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_pendingOnboardingId_status_idx" ON "SubscriptionPayment"("pendingOnboardingId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_createdAt_idx" ON "SubscriptionPayment"("subscriptionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingWebhookEvent_provider_eventId_key" ON "BillingWebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "BillingWebhookEvent_processingStatus_receivedAt_idx" ON "BillingWebhookEvent"("processingStatus", "receivedAt");
