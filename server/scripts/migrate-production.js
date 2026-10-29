// Production migration gate. It performs aggregate-only read checks, then
// delegates schema changes to the versioned Prisma migrations.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

function migrationBlockers(rows) {
  return rows.filter((row) => {
    const duplicateGroups = Number(row.duplicate_groups || 0);
    const blankRows = Number(row.blank_rows || 0);
    const forbiddenNullRows = ["Order.source", "Payment.provider"].includes(row.check_name)
      ? Number(row.null_rows || 0)
      : 0;
    return duplicateGroups > 0 || blankRows > 0 || forbiddenNullRows > 0;
  });
}

function summarizeRows(rows) {
  return rows.map((row) => ({
    check: row.check_name,
    duplicateGroups: Number(row.duplicate_groups || 0),
    duplicateRows: Number(row.duplicate_rows || 0),
    nullRows: Number(row.null_rows || 0),
    blankRows: Number(row.blank_rows || 0),
  }));
}

const expectedUniqueIndexes = [
  { name: "Order_restaurantId_source_externalOrderId_key", table: "Order", columns: ["restaurantId", "source", "externalOrderId"] },
  { name: "Order_restaurantId_idempotencyKey_key", table: "Order", columns: ["restaurantId", "idempotencyKey"] },
  { name: "Payment_provider_providerPaymentId_key", table: "Payment", columns: ["provider", "providerPaymentId"] },
];

function missingOrInvalidUniqueIndexes(indexes) {
  return expectedUniqueIndexes.filter((expected) => {
    const actual = indexes.find((index) => index.index_name === expected.name);
    return !actual
      || actual.table_name !== expected.table
      || actual.is_unique !== true
      || actual.is_valid !== true
      || JSON.stringify(actual.columns) !== JSON.stringify(expected.columns);
  }).map((index) => index.name);
}

const uniqueIndexInspection = `
SELECT tbl.relname AS table_name,
       idx.relname AS index_name,
       i.indisunique AS is_unique,
       i.indisvalid AS is_valid,
       ARRAY(
         SELECT att.attname
         FROM unnest(i.indkey) WITH ORDINALITY AS key(attnum, position)
         JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key.attnum
         WHERE key.position <= i.indnkeyatts
         ORDER BY key.position
       ) AS columns
FROM pg_index i
JOIN pg_class idx ON idx.oid = i.indexrelid
JOIN pg_class tbl ON tbl.oid = i.indrelid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
WHERE ns.nspname = 'public'
  AND idx.relname IN (
    'Order_restaurantId_source_externalOrderId_key',
    'Order_restaurantId_idempotencyKey_key',
    'Payment_provider_providerPaymentId_key'
  )`;

const duplicateAndNullChecks = `
WITH duplicate_checks AS (
  SELECT 'Order(restaurantId, source, externalOrderId)' AS check_name,
         COUNT(*) AS duplicate_groups, COALESCE(SUM(n - 1), 0) AS duplicate_rows,
         0::bigint AS null_rows, 0::bigint AS blank_rows
  FROM (SELECT COUNT(*) n FROM "Order"
        WHERE "externalOrderId" IS NOT NULL
        GROUP BY "restaurantId", "source", "externalOrderId"
        HAVING COUNT(*) > 1) grouped
  UNION ALL
  SELECT 'Order(restaurantId, idempotencyKey)', COUNT(*), COALESCE(SUM(n - 1), 0), 0, 0
  FROM (SELECT COUNT(*) n FROM "Order"
        WHERE "idempotencyKey" IS NOT NULL
        GROUP BY "restaurantId", "idempotencyKey"
        HAVING COUNT(*) > 1) grouped
  UNION ALL
  SELECT 'Payment(provider, providerPaymentId)', COUNT(*), COALESCE(SUM(n - 1), 0), 0, 0
  FROM (SELECT COUNT(*) n FROM "Payment"
        WHERE "providerPaymentId" IS NOT NULL
        GROUP BY "provider", "providerPaymentId"
        HAVING COUNT(*) > 1) grouped
), field_checks AS (
  SELECT 'Order.externalOrderId' AS check_name, 0::bigint duplicate_groups, 0::bigint duplicate_rows,
         COUNT(*) FILTER (WHERE "externalOrderId" IS NULL) AS null_rows,
         COUNT(*) FILTER (WHERE "externalOrderId" IS NOT NULL AND btrim("externalOrderId") = '') AS blank_rows
  FROM "Order"
  UNION ALL
  SELECT 'Order.idempotencyKey', 0, 0,
         COUNT(*) FILTER (WHERE "idempotencyKey" IS NULL),
         COUNT(*) FILTER (WHERE "idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") = '')
  FROM "Order"
  UNION ALL
  SELECT 'Order.source', 0, 0,
         COUNT(*) FILTER (WHERE "source" IS NULL),
         COUNT(*) FILTER (WHERE "source" IS NOT NULL AND btrim("source") = '')
  FROM "Order"
  UNION ALL
  SELECT 'Payment.providerPaymentId', 0, 0,
         COUNT(*) FILTER (WHERE "providerPaymentId" IS NULL),
         COUNT(*) FILTER (WHERE "providerPaymentId" IS NOT NULL AND btrim("providerPaymentId") = '')
  FROM "Payment"
  UNION ALL
  SELECT 'Payment.provider', 0, 0,
         COUNT(*) FILTER (WHERE "provider" IS NULL),
         COUNT(*) FILTER (WHERE "provider" IS NOT NULL AND btrim("provider") = '')
  FROM "Payment"
)
SELECT * FROM duplicate_checks
UNION ALL SELECT * FROM field_checks
ORDER BY check_name`;

async function main() {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    console.error("Schema migration stopped: DATABASE_URL and DIRECT_URL must be configured.");
    process.exitCode = 1;
    return;
  }

  const prisma = require("../src/config/db");
  try {
    const migrationTable = await prisma.$queryRaw`SELECT to_regclass('"public"."_prisma_migrations"') IS NOT NULL AS present`;
    const hasMigrationHistory = Boolean(migrationTable[0]?.present);
    let applied = [];

    if (hasMigrationHistory) {
      const history = await prisma.$queryRaw`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY migration_name`;
      const failed = history.filter((row) => !row.finished_at && !row.rolled_back_at);
      if (failed.length) {
        console.error(`Schema migration stopped: ${failed.length} failed migration record(s) need operator review.`);
        process.exitCode = 1;
        return;
      }
      applied = history.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name);
    }

    const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
    const migrationNames = fs.readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const pending = migrationNames.filter((name) => !applied.includes(name));
    const actualIndexes = await prisma.$queryRawUnsafe(uniqueIndexInspection);
    const invalidIndexes = missingOrInvalidUniqueIndexes(actualIndexes);
    if (pending.length === 0) {
      if (invalidIndexes.length) {
        console.error(`Schema migration stopped: recorded migration history is current, but required unique index state is missing or invalid (${invalidIndexes.join(", ")}). Review the live schema and create a new repair migration after approval; no data was changed.`);
        process.exitCode = 1;
        return;
      }
      console.log("Prisma migration history is current; no schema changes were run.");
      return;
    }

    const backupConfirmed = process.env.MIGRATION_BACKUP_CONFIRMED === "true" || process.env.NODE_ENV === "production";
    if (process.env.MIGRATION_BACKUP_CONFIRMED === "false") {
      console.error("Schema migration stopped: MIGRATION_BACKUP_CONFIRMED is set to false.");
      process.exitCode = 1;
      return;
    }

    const checks = await prisma.$queryRawUnsafe(duplicateAndNullChecks);
    const report = summarizeRows(checks);
    for (const row of report) console.log(JSON.stringify(row));
    const blockers = migrationBlockers(checks);
    if (blockers.length) {
      console.error(`Schema migration stopped: ${blockers.length} duplicate or invalid identifier check(s) require review. No data was changed.`);
      process.exitCode = 1;
      return;
    }
    if (invalidIndexes.length) {
      console.log(`Unique indexes to be created by pending migrations: ${invalidIndexes.join(", ")}.`);
    }

    console.log(`Applying ${pending.length} reviewed Prisma migration(s)...`);
    const cliPath = require.resolve("prisma/build/index.js");

    if (!hasMigrationHistory) {
      console.log("No existing Prisma migration history found. Baselining and applying pending migrations via pg client...");
      const { Client } = require("pg");
      const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
      await client.connect();
      try {
        for (const migration of pending) {
          const sqlFile = path.join(migrationsDir, migration, "migration.sql");
          if (fs.existsSync(sqlFile)) {
            const sql = fs.readFileSync(sqlFile, "utf8");
            console.log(`Executing SQL: ${migration}`);
            await client.query(sql);
          }
          console.log(`Recording migration: ${migration}`);
          const resolveResult = spawnSync(process.execPath, [
            cliPath, "migrate", "resolve",
            "--applied", migration,
            "--schema=prisma/schema.prisma"
          ], {
            cwd: path.join(__dirname, ".."),
            env: process.env,
            stdio: "inherit",
          });
          if (resolveResult.status !== 0) {
            throw new Error(`Failed resolving migration ${migration}`);
          }
        }
      } finally {
        await client.end();
      }
      console.log("All pending migrations applied and baselined successfully!");
    } else {
      const result = spawnSync(process.execPath, [cliPath, "migrate", "deploy"], {
        cwd: path.join(__dirname, ".."),
        env: process.env,
        stdio: "inherit",
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`prisma migrate deploy exited with code ${result.status}`);
      }
    }

    try {
      const { ensureRestaurantRoles } = require("../src/services/roleService");
      const restaurants = await prisma.restaurant.findMany({ select: { id: true } });
      for (const restaurant of restaurants) {
        await ensureRestaurantRoles(restaurant.id);
      }
      console.log(`RBAC roles verified for ${restaurants.length} restaurant(s).`);
    } catch (rbacErr) {
      console.warn("RBAC post-migration sync warning:", rbacErr.message);
    }

    process.exitCode = 0;
  } catch (error) {
    const code = error?.code || error?.meta?.code || "unknown";
    console.error(`Schema migration stopped before application: read-only checks or migration failed (code ${code}, ${error.message}). Review database availability and migration state; no automatic data cleanup was attempted.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = { migrationBlockers, summarizeRows, missingOrInvalidUniqueIndexes };
