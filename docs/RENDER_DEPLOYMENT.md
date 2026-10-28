# Render deployment

The checked-in `render.yaml` declares the repository root, `/health` for liveness, this build command, and this start command:

```text
npm install --include=dev --prefix server && npm install --prefix client && npm run db:migrate:safe --prefix server
npm start
```

Render dashboard settings can override `render.yaml`. Always confirm the effective build and start commands in the Render service settings and deploy logs. The observed override `npm install && npm run install:all && npm run build` does **not** run migrations: root `install:all` only installs dependencies, root `build` only builds the client, and `npm start` invokes `server` `prestart`, which only generates Prisma Client and builds the client. With that override, no Prisma migration runs before the server starts.

The server package `prestart` does not run `db push`, migrations, or the RBAC backfill. The checked-in migration gate runs during Render's build only when that command is actually configured. Do not set the Render start command to `prisma db push`, `prisma migrate dev`, or `rbac:backfill`.

## Production migration prerequisites

The repository currently contains nine versioned migrations. The subscription tables are created by:

- `20261027000002_subscription_lifecycle`

That migration creates `PendingOnboarding`, `Subscription`, `SubscriptionPayment`, and `BillingWebhookEvent`. It expects the earlier `Restaurant` and `PlatformAdminAuditLog` tables; the latter is created by `20261027000000_platform_rbac`. The following `20261027000003_platform_restaurant_invites` migration alters `Subscription.endsAt`, so it depends on the subscription migration. Production migration history and table state must be checked read-only before choosing the pending migration set. Before a deployment that applies them:

1. Create and verify a Neon backup/restore point.
2. Review the production `_prisma_migrations` history and compare the live schema with all pending migrations.
3. Run the aggregate-only duplicate and identifier checks described in [PRODUCTION_PRISMA_MIGRATION.md](PRODUCTION_PRISMA_MIGRATION.md).
4. Set `MIGRATION_BACKUP_CONFIRMED=true` only after that review. For a database with no migration history, also set `MIGRATION_BASELINE_CONFIRMED=true` only after the baseline has been verified.
5. Remove confirmation values after the reviewed deployment. Review the Render build and `/health/ready` before routing traffic.

The migration gate checks duplicate order/payment identifiers and expected PostgreSQL unique-index catalog state before it runs `prisma migrate deploy`. It prints aggregate counts only. It does not merge, delete, truncate, or repair data. If a duplicate or schema mismatch is found, stop and review; no production data was changed by this implementation.

After successful schema migration and backup review, existing tenant role links may be reconciled through the explicit operator command:

```text
npm run rbac:backfill --prefix server
```

This command is not run during startup. It updates code-defined system role permissions and legacy role links; custom roles are preserved. Review its scope before running against production.

## Health and configuration

- `/health` reports process liveness. `/health/ready` checks the database and reports Redis as `ok`, `degraded`, or `disabled`.
- `DATABASE_URL` is the app connection; `DIRECT_URL` is used by Prisma migrations.
- Redis is optional. Configure `REDIS_URL` and TLS settings only on the server.
- Render environment entries for SaaS prices/credentials, trial/grace duration, company legal details, AI selection, and Super Admin bootstrap are placeholders. Defaults keep paid signup and AI inactive.
- Svaadya subscription billing uses `SAAS_RAZORPAY_*` and `/api/billing/webhook`, separately from restaurant order-payment credentials and `/api/payments/webhook`.
- Swiggy/Zomato remain disconnected until an approved partner API, credentials, webhook specification and test approval are provided.
- Do not put database, payment, storage, messaging, AI, or provider secrets in client build variables or source control.

No Render deployment, production database query/migration, or live provider verification was performed during this implementation.
