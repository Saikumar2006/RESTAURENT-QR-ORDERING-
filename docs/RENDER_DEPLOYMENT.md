# Render deployment

The Render web service uses root directory `.`, builds with `npm install --prefix server && npm install --prefix client`, starts with `npm start`, and uses `/health` as liveness. Existing required values include DATABASE_URL and JWT_SECRET plus configured product integrations. Redis is optional and configured only on the server as `REDIS_URL`; optional settings are `REDIS_TLS_ENABLED`, `REDIS_KEY_PREFIX`, `REDIS_CONNECT_TIMEOUT_MS`, and `REDIS_OPERATION_TIMEOUT_MS`. Render YAML marks REDIS_URL unsynchronized; provision a managed Redis instance and paste its private connection URL in the dashboard. Do not put credentials in source control.

`/health` reports process liveness. `/health/ready` queries PostgreSQL and reports cache as ok/degraded/disabled; Redis degradation does not make readiness fail while the database is healthy. Confirm readiness after deploy and inspect sanitized dependency events in Render logs.

Schema additions are additive, but `prestart` runs Prisma `db push` and role backfill. Before production, apply against a staging copy, inspect the schema diff, verify legacy ADMIN/STAFF role mapping, and take a database backup. Roll back by redeploying the prior application version; retain additive RBAC tables/columns unless a reviewed separate cleanup is approved. Do not run seed/reset in production. Redis can be disconnected to return to DB-backed cache reads and local rate limits; expect reduced cross-instance rate-limit and socket coordination.

No Render deploy, production migration, database connection, or managed Redis connection was executed during this implementation.

## Order, payment, and messaging configuration

The unified-order migration `20261014000000_unified_order_sources` is additive and follows the existing `20261009000000_restaurant_rbac` migration. Use a database backup and staging copy before the existing `prestart` schema sync/backfill runs. Existing Render environment values are preserved by the dashboard; remove any old `PAYMENT_PROVIDER=mock` or `MESSAGING_PROVIDER=mock` values before deploying because mock integrations are development-only. With either provider unset, online payment and outbound order notifications report unavailable and do not simulate success.

Razorpay production requires `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Add the official webhook URL `/api/payments/webhook` to the provider dashboard. These are currently platform-level credentials; no restaurant linked-account routing is implemented. Customer OTP uses Meta variables `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_OTP_TEMPLATE_NAME`, and `WHATSAPP_API_VERSION`; sender and template approval are prerequisites. Swiggy/Zomato require partner approval, credentials, official webhook specifications, and sandbox testing; both remain disconnected. Never put these values in client build variables or docs.
