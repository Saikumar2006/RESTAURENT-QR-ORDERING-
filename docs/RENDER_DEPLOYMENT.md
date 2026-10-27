# Render deployment

The checked-in Render service uses the repository root, `/health` for liveness, this build command, and this start command:

```text
npm install --include=dev --prefix server && npm install --prefix client && npm run db:migrate:safe --prefix server
npm start
```

The server package `prestart` generates Prisma Client and builds the React client. It does not run `db push` or the RBAC backfill. The migration gate runs during Render's build; a failed migration prevents that build from deploying. Do not set the Render start command to `prisma db push`, `prisma migrate dev`, or `rbac:backfill`.

## Production migration prerequisites

The current application changes include three new additive Prisma migrations:

- `20261027000000_platform_rbac`
- `20261027000001_inventory_and_language`
- `20261027000002_subscription_lifecycle`

They have not been applied to production. Before a deployment that applies them:

1. Create and verify a Neon backup/restore point.
2. Review the production `_prisma_migrations` history and compare the live schema with all pending migrations.
3. Run the aggregate-only duplicate and identifier checks described in [PRODUCTION_PRISMA_MIGRATION.md](PRODUCTION_PRISMA_MIGRATION.md); no production database was queried for this change.
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
