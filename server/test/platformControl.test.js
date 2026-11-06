process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_32_characters_minimum_len!";
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const platformAuthService = require("../src/services/platformAuthService");
const platformControlService = require("../src/services/platformControlService");
const { signPlatformToken, signToken } = require("../src/utils/auth");
const { requirePlatformAuth } = require("../src/middleware/auth");

test("platform login locks account for 15 minutes after 5 consecutive failed attempts", async () => {
  const auditLogs = [];
  const updates = [];
  const hashedPassword = await bcrypt.hash("CorrectPassword123!", 10);

  const fakeAdmin = {
    id: "admin-lockout-test",
    name: "SecOps Admin",
    email: "secops@svaadya.test",
    passwordHash: hashedPassword,
    platformRole: "PLATFORM_OPERATIONS",
    isActive: true,
    failedLoginAttempts: 4,
    lockedUntil: null,
  };

  const mockDb = {
    platformAdmin: {
      findFirst: async () => fakeAdmin,
      update: async (args) => {
        updates.push(args);
        return { ...fakeAdmin, ...args.data };
      },
    },
    platformAdminAuditLog: {
      create: async (args) => {
        auditLogs.push(args);
        return { id: "log-1", ...args.data };
      },
    },
  };

  // 5th attempt fails with bad password -> should trigger lockout
  await assert.rejects(
    platformAuthService.login(
      "secops@svaadya.test",
      "WrongPassword!",
      "req-123",
      "127.0.0.1",
      mockDb
    ),
    (err) => {
      assert.equal(err.status, 423);
      assert.match(err.message, /Account locked/);
      return true;
    }
  );

  // Check database update recorded lockout
  const lockoutUpdate = updates.find((u) => u.data.lockedUntil);
  assert.ok(lockoutUpdate, "Expected database update setting lockedUntil");
  assert.equal(lockoutUpdate.data.failedLoginAttempts, 5);

  // Check audit log recorded lockout
  const lockoutAudit = auditLogs.find((l) => l.data.action === "platform_admin.account_locked");
  assert.ok(lockoutAudit, "Expected audit log for account_locked");
});

test("platform login resets failed attempts upon successful authentication", async () => {
  const auditLogs = [];
  const updates = [];
  const hashedPassword = await bcrypt.hash("ValidPlatformPass1!", 10);

  const fakeAdmin = {
    id: "admin-success-test",
    name: "Platform Super Admin",
    email: "admin@svaadya.test",
    passwordHash: hashedPassword,
    platformRole: "SUPER_ADMIN",
    isActive: true,
    failedLoginAttempts: 3,
    lockedUntil: null,
  };

  const mockDb = {
    platformAdmin: {
      findFirst: async () => fakeAdmin,
      update: async (args) => {
        updates.push(args);
        return { ...fakeAdmin, ...args.data };
      },
    },
    platformAdminAuditLog: {
      create: async (args) => {
        auditLogs.push(args);
        return { id: "log-2", ...args.data };
      },
    },
  };

  const result = await platformAuthService.login(
    "admin@svaadya.test",
    "ValidPlatformPass1!",
    "req-456",
    "127.0.0.1",
    mockDb
  );

  assert.ok(result.token, "Result should include platform JWT token");
  assert.equal(result.admin.email, "admin@svaadya.test");
  assert.equal(result.admin.passwordHash, undefined, "Password hash must not be returned");

  // Check reset of failed attempts
  const resetUpdate = updates.find((u) => u.data.failedLoginAttempts === 0);
  assert.ok(resetUpdate, "Expected update resetting failedLoginAttempts to 0");
  assert.equal(resetUpdate.data.lockedUntil, null);
  assert.ok(resetUpdate.data.lastLoginAt);

  // Check audit log recorded success
  const successAudit = auditLogs.find((l) => l.data.action === "platform_admin.login_success");
  assert.ok(successAudit, "Expected audit log for login_success");
});

test("platform password change enforces complexity and audits changes", async () => {
  const auditLogs = [];
  const updates = [];
  const oldHashed = await bcrypt.hash("OldComplexPass123!", 10);

  const fakeAdmin = {
    id: "admin-pw-test",
    email: "pwtest@svaadya.test",
    passwordHash: oldHashed,
  };

  const mockDb = {
    platformAdmin: {
      findUnique: async () => fakeAdmin,
      update: async (args) => {
        updates.push(args);
        return { ...fakeAdmin, ...args.data };
      },
    },
    platformAdminAuditLog: {
      create: async (args) => {
        auditLogs.push(args);
        return { id: "log-3", ...args.data };
      },
    },
  };

  // Reject short password
  await assert.rejects(
    platformAuthService.changeAdminPassword("admin-pw-test", "OldComplexPass123!", "short", mockDb),
    { status: 400 }
  );

  // Reject wrong current password
  await assert.rejects(
    platformAuthService.changeAdminPassword("admin-pw-test", "WrongCurrentPass!", "NewComplexPass123!", mockDb),
    { status: 401 }
  );

  // Accept valid change
  const success = await platformAuthService.changeAdminPassword(
    "admin-pw-test",
    "OldComplexPass123!",
    "NewComplexPass123!",
    mockDb
  );

  assert.equal(success.success, true);
  assert.ok(updates.length > 0);
  assert.ok(auditLogs.some((l) => l.data.action === "platform_admin.password_changed"));
});

test("platform restaurant suspension and reactivation updates status with audit trail", async () => {
  const auditLogs = [];
  let currentStatus = "ACTIVE";

  const fakeRestaurant = {
    id: "rest-test-1",
    name: "Bistro Mocha",
    slug: "bistro-mocha",
    get status() { return currentStatus; },
  };

  const mockDb = {
    restaurant: {
      findUnique: async () => fakeRestaurant,
      update: async (args) => {
        currentStatus = args.data.status;
        return { ...fakeRestaurant, status: currentStatus };
      },
    },
    platformAdminAuditLog: {
      create: async (args) => {
        auditLogs.push(args);
        return { id: "log-4", ...args.data };
      },
    },
  };

  // Suspend
  const suspended = await platformControlService.updateRestaurantStatus(
    "rest-test-1",
    "SUSPENDED",
    "Payment default",
    "admin-actor-1",
    mockDb
  );
  assert.equal(suspended.status, "SUSPENDED");
  assert.equal(auditLogs[auditLogs.length - 1].data.action, "restaurant.suspended");

  // Reactivate
  const reactivated = await platformControlService.updateRestaurantStatus(
    "rest-test-1",
    "ACTIVE",
    "Account cleared",
    "admin-actor-1",
    mockDb
  );
  assert.equal(reactivated.status, "ACTIVE");
  assert.equal(auditLogs[auditLogs.length - 1].data.action, "restaurant.reactivated");
});

test("platform control manages support tickets and status updates", async () => {
  const tickets = [];
  const auditLogs = [];

  const mockDb = {
    platformSupportTicket: {
      count: async () => tickets.length,
      create: async (args) => {
        const created = { id: `ticket-${tickets.length + 1}`, status: args.data.status || "OPEN", ...args.data, createdAt: new Date(), updatedAt: new Date() };
        tickets.push(created);
        return created;
      },
      findUnique: async ({ where }) => tickets.find((t) => t.id === where.id),
      update: async (args) => {
        const idx = tickets.findIndex((t) => t.id === args.where.id);
        tickets[idx] = { ...tickets[idx], ...args.data, updatedAt: new Date() };
        return tickets[idx];
      },
    },
    platformAdminAuditLog: {
      create: async (args) => {
        auditLogs.push(args);
        return { id: "log-ticket", ...args.data };
      },
    },
  };

  const created = await platformControlService.createSupportTicket(
    {
      title: "QR scanner printer offline",
      description: "Thermal printer not connecting to bluetooth",
      priority: "HIGH",
      category: "HARDWARE",
    },
    "admin-1",
    mockDb
  );

  assert.ok(created.ticketNumber.startsWith("TICK-"));
  assert.equal(created.status, "OPEN");
  assert.equal(created.priority, "HIGH");

  const resolved = await platformControlService.updateSupportTicket(
    created.id,
    { status: "RESOLVED", internalNotes: "Firmware re-flashed" },
    "admin-1",
    mockDb
  );

  assert.equal(resolved.status, "RESOLVED");
  assert.equal(resolved.internalNotes, "Firmware re-flashed");
  assert.ok(auditLogs.some((l) => l.data.action === "support_ticket.updated"));
});

test("requirePlatformAuth accepts Bearer token and rejects non-platform JWTs", async () => {
  const fakeAdmin = {
    id: "admin-bearer-test",
    name: "Bearer Admin",
    email: "bearer@svaadya.test",
    platformRole: "SUPER_ADMIN",
    isActive: true,
  };

  const mockDb = {
    platformAdmin: {
      findUnique: async () => fakeAdmin,
    },
  };

  // 1. Missing header and cookie -> 401
  let statusCode;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(val) { body = val; return this; },
    setHeader() {},
  };

  let nextCalled = false;
  await requirePlatformAuth({ headers: {}, cookies: {}, db: mockDb }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);

  // 2. Valid platform token -> 200 next()
  const validPlatformToken = signPlatformToken(fakeAdmin);

  let allowedNext = false;
  const req = {
    headers: { authorization: `Bearer ${validPlatformToken}` },
    cookies: {},
    db: mockDb,
  };

  await requirePlatformAuth(req, res, () => { allowedNext = true; });
  assert.equal(allowedNext, true);
  assert.equal(req.platformAdmin.id, "admin-bearer-test");
  assert.equal(req.platformAdmin.role, "SUPER_ADMIN");

  // 3. Token with tenant type (restaurant user token) -> 401
  const restaurantToken = signToken({ id: "user-123", restaurantId: "rest-1", role: "OWNER" });

  let rejectedNext = false;
  await requirePlatformAuth(
    { headers: { authorization: `Bearer ${restaurantToken}` }, cookies: {}, db: mockDb },
    res,
    () => { rejectedNext = true; }
  );
  assert.equal(rejectedNext, false);
});
