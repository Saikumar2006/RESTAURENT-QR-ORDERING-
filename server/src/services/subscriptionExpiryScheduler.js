const prisma = require("../config/db");
const { expireSubscriptions } = require("./subscriptionService");

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const REQUIRED_TABLES_QUERY = `
  SELECT name,
         to_regclass(format('%I.%I', 'public', name)) IS NOT NULL AS present
  FROM unnest(ARRAY['Subscription', 'PendingOnboarding']) AS required(name)
  ORDER BY name`;

function getErrorCode(error) {
  return error?.code || error?.meta?.code || "unknown";
}

function isMissingSchemaDependency(error) {
  return [error?.code, error?.meta?.code].some((code) => ["P2021", "P2022", "42P01", "42703"].includes(code));
}

async function startSubscriptionExpirySweep({
  database = prisma,
  runSweep = () => expireSubscriptions(database),
  logger = console,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  intervalMs = SWEEP_INTERVAL_MS,
} = {}) {
  let requiredTables;
  try {
    requiredTables = await database.$queryRawUnsafe(REQUIRED_TABLES_QUERY);
  } catch (error) {
    logger.error(JSON.stringify({
      event: "subscription_expiry_sweep_disabled",
      category: "billing_lifecycle",
      reason: "schema_dependency_check_failed",
      code: getErrorCode(error),
    }));
    return { started: false, reason: "schema_dependency_check_failed" };
  }

  const missingTables = requiredTables.filter((table) => !table.present).map((table) => table.name);
  if (missingTables.length) {
    logger.error(JSON.stringify({
      event: "subscription_expiry_sweep_disabled",
      category: "billing_lifecycle",
      reason: "required_tables_missing",
      missingTables,
    }));
    return { started: false, reason: "required_tables_missing", missingTables };
  }

  let timer;
  timer = setIntervalFn(async () => {
    try {
      await runSweep();
    } catch (error) {
      const code = getErrorCode(error);
      if (isMissingSchemaDependency(error)) {
        clearIntervalFn(timer);
        logger.error(JSON.stringify({
          event: "subscription_expiry_sweep_disabled",
          category: "billing_lifecycle",
          reason: "schema_dependency_missing_during_sweep",
          code,
        }));
        return;
      }

      logger.error(JSON.stringify({
        event: "subscription_expiry_sweep_failed",
        category: "billing_lifecycle",
        reason: "sweep_failed",
        code,
      }));
    }
  }, intervalMs);
  timer.unref?.();

  return { started: true, timer };
}

module.exports = { startSubscriptionExpirySweep, isMissingSchemaDependency };
