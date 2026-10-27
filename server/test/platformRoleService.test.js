const test = require("node:test");
const assert = require("node:assert/strict");
const platformRoleService = require("../src/services/platformRoleService");
const { requirePlatformPermission } = require("../src/middleware/auth");

test("platform roles default unknown roles to auditor and allow explicit bootstrap super admins", () => {
  assert.equal(platformRoleService.resolvePlatformAccess({ email: "ops@example.com", platformRole: "UNKNOWN" }).platformRole, "READ_ONLY_AUDITOR");
  const allowlist = platformRoleService.normalizeSuperAdminEmails(" Root@Example.com, other@example.com ");
  assert.equal(platformRoleService.resolvePlatformAccess({ email: "root@example.com", platformRole: "SUPPORT_AGENT" }, allowlist).platformRole, "SUPER_ADMIN");
  assert.equal(platformRoleService.resolvePlatformAccess({ email: "ops@example.com", platformRole: "SUPPORT_AGENT" }, allowlist).permissions.includes("platform.finance.view"), false);
});

test("platform role middleware denies a missing capability", () => {
  const middleware = requirePlatformPermission("platform.admins.manage");
  let nextCalled = false;
  let statusCode;
  let body;
  const res = { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } };
  middleware({ platformAdmin: { permissions: ["platform.dashboard.view"] } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
  assert.equal(body.error.message, "You do not have permission to perform this action");
});

test("only platform roles with restaurant management permission can create accounts", () => {
  const middleware = requirePlatformPermission("platform.restaurants.manage");
  const operations = platformRoleService.resolvePlatformAccess({ email: "ops@example.com", platformRole: "PLATFORM_OPERATIONS" });
  const support = platformRoleService.resolvePlatformAccess({ email: "support@example.com", platformRole: "SUPPORT_AGENT" });
  const finance = platformRoleService.resolvePlatformAccess({ email: "finance@example.com", platformRole: "FINANCE_ADMIN" });

  let operationsAllowed = false;
  middleware({ platformAdmin: { permissions: operations.permissions } }, { status() { return this; }, json() {} }, () => { operationsAllowed = true; });
  assert.equal(operationsAllowed, true);
  for (const role of [support, finance]) {
    let allowed = false;
    middleware({ platformAdmin: { permissions: role.permissions } }, { status() { return this; }, json() {} }, () => { allowed = true; });
    assert.equal(allowed, false);
  }
});

test("last active Super Admin cannot self-demote before a replacement is promoted", async () => {
  const writes = [];
  const admin = { id: "admin-a", name: "Root", email: "root@example.com", platformRole: "SUPER_ADMIN", isActive: true };
  const database = {
    $transaction: (callback) => callback(database),
    platformAdmin: {
      async findUnique() { return admin; },
      async findMany() { return []; },
      async update(args) { writes.push(args); return { ...admin, platformRole: args.data.platformRole }; },
    },
    platformAdminAuditLog: { async create(args) { writes.push(args); } },
  };
  await assert.rejects(platformRoleService.updatePlatformRole("admin-a", "admin-a", "READ_ONLY_AUDITOR", database), { status: 409 });
  assert.equal(writes.length, 0);
});

test("platform role changes write an audit record and return no credential fields", async () => {
  const writes = [];
  const admin = { id: "admin-b", name: "Support", email: "support@example.com", passwordHash: "never-return", platformRole: "READ_ONLY_AUDITOR", isActive: true };
  const database = {
    $transaction: (callback) => callback(database),
    platformAdmin: {
      async findUnique() { return admin; },
      async update(args) { return { id: admin.id, name: admin.name, email: admin.email, platformRole: args.data.platformRole, isActive: true }; },
    },
    platformAdminAuditLog: { async create(args) { writes.push(args.data); } },
  };
  const updated = await platformRoleService.updatePlatformRole("admin-root", "admin-b", "SUPPORT_AGENT", database);
  assert.equal(updated.platformRole, "SUPPORT_AGENT");
  assert.equal("passwordHash" in updated, false);
  assert.equal(writes[0].actorAdminId, "admin-root");
  assert.equal(writes[0].action, "platform_admin.role_changed");
});
