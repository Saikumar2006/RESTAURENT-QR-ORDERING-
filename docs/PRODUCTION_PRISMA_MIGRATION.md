# Production Prisma migration and duplicate review

## Current deployment behavior

Render runs `npm start`, which invokes npm's `prestart` hook. The old hook ran `npx prisma db push` and the RBAC backfill on every server boot. `db push` compares the schema to the live database and can apply schema changes without a reviewed migration history; the unique indexes can fail when existing values collide. The RBAC backfill also updates users' `roleId` values on every boot.

The proposed unique indexes already exist in the versioned migration `server/prisma/migrations/20261014000000_unified_order_sources/migration.sql`. The Prisma schema declares all three corresponding keys. This migration is additive and creates indexes; it does not delete or rewrite orders or payments. It uses ordinary `CREATE UNIQUE INDEX`, which takes a stronger lock and can block writes while the index is built. Prisma does not generate `CONCURRENTLY` variants automatically; this is a multi-statement migration, and a concurrent index build cannot run inside a transaction. Do not insert `CREATE INDEX CONCURRENTLY` into this migration without rehearsing the exact Prisma 5.22 execution behavior. For large tables, schedule an operator-managed maintenance window and monitor Neon before applying.

Prisma migration history was not present in the repository (`migration_lock.toml` was missing). This patch adds the PostgreSQL provider lock file. The Render build migration command refuses to proceed if there is no migration history unless `MIGRATION_BASELINE_CONFIRMED=true` has been explicitly set after reviewing the production schema and the existing additive migrations.

## Read-only SQL review

Run in Neon SQL Editor before enabling a production migration. These statements return aggregate counts only, never customer names, phones, payment payloads, or credentials.

```sql
-- Duplicate groups/extra rows for the three proposed unique keys.
SELECT 'Order(restaurantId, source, externalOrderId)' AS constraint_name,
       COUNT(*) AS duplicate_groups,
       COALESCE(SUM(row_count - 1), 0) AS duplicate_rows
FROM (
  SELECT COUNT(*) AS row_count
  FROM "Order"
  WHERE "externalOrderId" IS NOT NULL
  GROUP BY "restaurantId", "source", "externalOrderId"
  HAVING COUNT(*) > 1
) d
UNION ALL
SELECT 'Order(restaurantId, idempotencyKey)', COUNT(*), COALESCE(SUM(row_count - 1), 0)
FROM (
  SELECT COUNT(*) AS row_count
  FROM "Order"
  WHERE "idempotencyKey" IS NOT NULL
  GROUP BY "restaurantId", "idempotencyKey"
  HAVING COUNT(*) > 1
) d
UNION ALL
SELECT 'Payment(provider, providerPaymentId)', COUNT(*), COALESCE(SUM(row_count - 1), 0)
FROM (
  SELECT COUNT(*) AS row_count
  FROM "Payment"
  WHERE "providerPaymentId" IS NOT NULL
  GROUP BY "provider", "providerPaymentId"
  HAVING COUNT(*) > 1
) d;

-- NULL and blank counts. NULL identifiers are allowed by the schema and
-- PostgreSQL permits multiple NULLs in a unique index; blanks are invalid.
SELECT
  (SELECT COUNT(*) FROM "Order" WHERE "source" IS NULL) AS order_source_nulls,
  (SELECT COUNT(*) FROM "Order" WHERE "source" IS NOT NULL AND btrim("source") = '') AS order_source_blanks,
  (SELECT COUNT(*) FROM "Order" WHERE "externalOrderId" IS NULL) AS external_order_id_nulls,
  (SELECT COUNT(*) FROM "Order" WHERE "externalOrderId" IS NOT NULL AND btrim("externalOrderId") = '') AS external_order_id_blanks,
  (SELECT COUNT(*) FROM "Order" WHERE "idempotencyKey" IS NULL) AS idempotency_key_nulls,
  (SELECT COUNT(*) FROM "Order" WHERE "idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") = '') AS idempotency_key_blanks,
  (SELECT COUNT(*) FROM "Payment" WHERE "provider" IS NULL) AS payment_provider_nulls,
  (SELECT COUNT(*) FROM "Payment" WHERE "provider" IS NOT NULL AND btrim("provider") = '') AS payment_provider_blanks,
  (SELECT COUNT(*) FROM "Payment" WHERE "providerPaymentId" IS NULL) AS provider_payment_id_nulls,
  (SELECT COUNT(*) FROM "Payment" WHERE "providerPaymentId" IS NOT NULL AND btrim("providerPaymentId") = '') AS provider_payment_id_blanks;

-- Confirm migration history state without selecting checksums or payloads.
SELECT to_regclass('"public"."_prisma_migrations"') IS NOT NULL AS migration_table_exists;
-- Run only if the result above is true:
SELECT migration_name, finished_at IS NOT NULL AS succeeded,
       rolled_back_at IS NOT NULL AS rolled_back
FROM "_prisma_migrations"
ORDER BY migration_name;
```

If duplicate groups or blank identifiers are present, stop. Review the affected records through a separately approved, privacy-preserving process and decide a business-safe remediation. Do not delete or merge records automatically. If the relevant columns do not exist yet, the read-only query will fail; inspect the live schema and migration history before applying anything.

## Constraint and write-path review

- `Order.source` is required with default `SVAADYA_QR`. Existing source-less rows receive that value when the additive migration adds the column.
- `Order.externalOrderId` and `Order.idempotencyKey` are nullable. Native order idempotency keys are accepted only when non-empty, hashed before persistence, and omitted otherwise. The marketplace providers are still unconfigured; the current adapter does not persist marketplace orders.
- `Payment.provider` is required with default `razorpay`. `Payment.providerPaymentId` is nullable until a payment callback succeeds. A failed signature check no longer stores the unverified payment ID; verification request IDs and signatures must be non-empty.
- PostgreSQL unique indexes allow multiple NULL values, which matches missing optional external identifiers. Empty or whitespace-only identifiers are not legitimate missing values and block this migration gate.
- `Payment(provider, providerPaymentId)` is global per provider, matching provider payment IDs' uniqueness scope. Marketplace settlement remains outside this table.

## Render lifecycle

The `prestart` hook now only generates Prisma Client and builds the client assets. It does not change database schema or run RBAC data updates. Render's configured build command runs `npm run db:migrate:safe --prefix server` after dependency installation. This command:

1. Detects pending migration files without printing connection details.
2. Stops if a previous migration is unresolved.
3. Requires `MIGRATION_BACKUP_CONFIRMED=true` after a verified backup and duplicate review.
4. Also requires `MIGRATION_BASELINE_CONFIRMED=true` on a database without `_prisma_migrations`, after the live schema has been compared with the checked-in additive migrations.
5. Prints only duplicate group/row counts and NULL/blank counts, and refuses to migrate on duplicates or blank identifiers.
6. Inspects the actual PostgreSQL catalog for the three expected unique indexes. If migration history is current but the indexes are missing, invalid, or have the wrong columns, it stops rather than trusting migration history or silently applying a `CREATE ... IF NOT EXISTS` no-op.
7. Runs `prisma migrate deploy`; a failed build prevents Render from deploying that build.

Render's current service is configured as `free`; Render pre-deploy commands are unavailable on that plan. The gated migration therefore runs in the build phase. The checked-in migrations are additive, so old application instances can continue while Render builds. A migration failure leaves the current successful deployment serving traffic. For a large index build, upgrade to a plan supporting a pre-deploy command and set that command to `npm run db:migrate:safe --prefix server` instead of running it during build.

Before first production migration:

1. Take a Neon backup/restore point and confirm it can be restored.
2. Run the SQL above in Neon SQL Editor and review the counts and migration history.
3. If migration history is absent, compare the current schema with every pending migration; the files use `IF NOT EXISTS` for the additive columns, tables, and indexes, but that is not a substitute for schema review.
4. Set `MIGRATION_BACKUP_CONFIRMED=true` for the reviewed deployment. If no migration history exists, also set `MIGRATION_BASELINE_CONFIRMED=true`.
5. Deploy and confirm Render's build succeeded and the service health check passes. Remove the confirmation values after the migration deployment; set them again only when reviewing a later migration.

RBAC initialization remains available as the separate idempotent command `npm run rbac:backfill --prefix server`. It upserts system roles/permissions and maps legacy users' roles; use it deliberately after a backup if existing restaurants require mapping. New restaurants and relevant role routes already call `ensureRestaurantRoles`.

## Local facts and unresolved production checks

The checked-in repository has four additive migrations but no migration history lock before this change. The local `server/.env` points to loopback PostgreSQL, not Neon; no production duplicate query was run and no production data was changed. `migrate deploy` does not detect unrelated schema drift, so review the live schema against the migration files as part of the first production baseline review. Do not claim a successful Neon check until the SQL above has been run against the production database.
