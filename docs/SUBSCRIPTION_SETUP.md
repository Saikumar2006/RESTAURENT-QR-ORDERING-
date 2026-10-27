# Subscription onboarding and billing setup

Svaadya subscription billing uses its own `Subscription`, `SubscriptionPayment`, `PendingOnboarding`, and `BillingWebhookEvent` records. It does not write restaurant food orders or `Payment` rows. SaaS billing also uses separate `SAAS_RAZORPAY_*` credentials; do not reuse food-order payment secrets.

## Current default behavior

- Plan prices are unset, trial and grace periods are zero, and the SaaS payment provider defaults to `unconfigured`.
- With those defaults, pricing is shown as pending, new checkout and trial creation are disabled, and no new restaurant can be publicly created through the retired `POST /api/restaurants` endpoint.
- Existing restaurants without a subscription remain available as legacy workspaces. New subscription entitlements are checked on tenant API requests. Expired tenants can still load `/api/auth/me` and the subscription recovery endpoints.
- Payment failure on a renewal moves the subscription to `PAST_DUE` only when `SAAS_GRACE_DAYS` is positive. Otherwise it becomes `EXPIRED`. A five-minute worker expires trials, periods, grace periods, and pending onboarding records.
- Renewal payment is initiated manually by the restaurant owner. Automatic recurring charges are not implemented.
- The legal pages intentionally remain marked as drafts until owner details and approved wording are supplied.
- Premium AI menu autofill remains disabled. The selected AI provider and credentials have not been supplied, and no provider adapter is enabled.

## Required configuration

Set these through the production secret/configuration manager, never in browser variables:

- `SAAS_PLAN_PRICING_JSON`: complete INR price matrix for `BASIC`, `STANDARD`, `PREMIUM`; each plan needs positive numeric values for `MONTHLY`, `3_MONTHS`, `6_MONTHS`, and `YEARLY`. Checkout stays disabled until the full matrix is valid.
- `SAAS_PAYMENT_PROVIDER=razorpay`, `SAAS_RAZORPAY_KEY_ID`, `SAAS_RAZORPAY_KEY_SECRET`, and `SAAS_RAZORPAY_WEBHOOK_SECRET`: use an approved Svaadya billing account and production credentials only after test-mode verification.
- `SAAS_TRIAL_DAYS`: `0` to `30`; `SAAS_GRACE_DAYS`: `0` to `30`; `SAAS_PENDING_MINUTES`: `5` to `120`.
- `COMPANY_LEGAL_NAME`, `COMPANY_SUPPORT_EMAIL`, `COMPANY_ADDRESS`, and `COMPANY_REGISTRATION_NUMBER`: owner-provided facts; obtain legal review of terms and privacy wording before publishing.
- `AI_PROVIDER` and `AI_API_KEY`: keep unset until the provider, privacy terms, supported request format, and provider adapter are approved.
- `PLATFORM_SUPER_ADMIN_EMAILS`: comma-separated owner-controlled accounts for bootstrap Super Admin access.

The `SAAS_PLAN_PRICING_JSON` JSON structure is:

```json
{
  "BASIC": { "MONTHLY": 0, "3_MONTHS": 0, "6_MONTHS": 0, "YEARLY": 0 },
  "STANDARD": { "MONTHLY": 0, "3_MONTHS": 0, "6_MONTHS": 0, "YEARLY": 0 },
  "PREMIUM": { "MONTHLY": 0, "3_MONTHS": 0, "6_MONTHS": 0, "YEARLY": 0 }
}
```

The zeros above are shape-only placeholders and are rejected by the server. Replace them with owner-approved prices before enabling checkout.

## Webhook and recovery

Configure the approved provider to send `payment.captured` and `payment.failed` events to:

```text
https://<production-host>/api/billing/webhook
```

Razorpay event signatures are verified against the raw request bytes. Stable event IDs are stored under a unique `(provider, eventId)` constraint, provider order/payment identifiers are unique, and payment claims use a database compare-and-set. Browser completion also verifies the signature and fetches the provider payment to confirm captured state, amount, currency, and order ID. Duplicate events are safe to retry. A payment captured after its pending onboarding window expires is recorded for support reconciliation and does not create an unverified tenant account.

Send `payment.captured` and `payment.failed` in provider test mode to a staging deployment first. Confirm duplicate delivery, delayed delivery, mismatched amount/order rejection, and an expired onboarding case before production activation. Provider approval and live credentials are external prerequisites; this repository does not establish that approval or a live connection.

## Migration and Render lifecycle

The migration files are additive and have not been applied to a database by this implementation. Render uses `npm run db:migrate:safe --prefix server` during the build, before the application start. The safe gate requires a verified backup (`MIGRATION_BACKUP_CONFIRMED=true`), checks migration history and the existing order/payment unique-key data, then invokes `prisma migrate deploy`. If the database has no migration history, set `MIGRATION_BASELINE_CONFIRMED=true` only after an operator reviewed the live schema against the complete migration history. Do not set either confirmation before the backup/schema review.

The runtime `prestart` only generates Prisma Client and builds the client; it does not run `db push` or the RBAC backfill. After a successful schema migration and backup review, run `npm run rbac:backfill --prefix server` as a deliberate operator task to reconcile system-role permission links for existing tenants. Custom roles are preserved. This command has not been run against production.

Do not run `prisma db push --accept-data-loss`, `prisma migrate dev` against production, or destructive cleanup to make a migration pass. If the migration gate reports duplicate identifiers or an unexpected schema state, stop and review the findings; no automatic merge/delete remediation is provided.
