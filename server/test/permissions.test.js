const assert = require("node:assert/strict");
const { test } = require("node:test");

process.env.JWT_SECRET = "test-only-secret-with-enough-entropy";

let userRecord;
const prismaPath = require.resolve("../src/config/db");
const authUtilsPath = require.resolve("../src/utils/auth");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    user: { async findUnique() { return userRecord; } },
  },
};
require.cache[authUtilsPath] = {
  id: authUtilsPath,
  filename: authUtilsPath,
  loaded: true,
  exports: { verifyToken: () => ({ type: "tenant", sub: "user-1" }) },
};
const { requireAuth, requirePermission } = require("../src/middleware/auth");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("authentication attaches tenant role and live role permissions from the database", async () => {
  userRecord = {
    id: "user-1", restaurantId: "restaurant-1", role: "STAFF", name: "Kitchen", email: "kitchen@example.test", isActive: true, restaurant: { status: "ACTIVE" },
    roleRecord: { id: "role-1", name: "KITCHEN", permissions: [{ permission: { key: "orders.update" } }] },
  };
  const req = { headers: { authorization: "Bearer token" } };
  let continued = false;
  await requireAuth(req, responseRecorder(), () => { continued = true; });

  assert.equal(continued, true);
  assert.equal(req.user.restaurantId, "restaurant-1");
  assert.equal(req.user.roleName, "KITCHEN");
  assert.deepEqual(req.user.permissions, ["orders.update"]);
});

test("legacy admin fallback remains owner access while legacy staff stays least privileged", async () => {
  userRecord = { id: "user-1", restaurantId: "restaurant-1", role: "ADMIN", name: "Owner", email: "owner@example.test", isActive: true, restaurant: { status: "ACTIVE" }, roleRecord: null };
  const ownerReq = { headers: { authorization: "Bearer token" } };
  await requireAuth(ownerReq, responseRecorder(), () => {});
  assert.deepEqual(ownerReq.user.permissions, ["*"]);

  userRecord = { ...userRecord, role: "STAFF" };
  const staffReq = { headers: { authorization: "Bearer token" } };
  await requireAuth(staffReq, responseRecorder(), () => {});
  assert.deepEqual(staffReq.user.permissions, ["orders.view", "orders.update", "tables.view"]);
});

test("suspended restaurants cannot use otherwise active tenant accounts", async () => {
  userRecord = {
    id: "user-1", restaurantId: "restaurant-1", role: "ADMIN", name: "Owner", email: "owner@example.test",
    isActive: true, restaurant: { status: "SUSPENDED" }, roleRecord: null,
  };
  const res = responseRecorder();
  let continued = false;
  await requireAuth({ headers: { authorization: "Bearer token" } }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 401);
});

test("permission middleware permits assigned capabilities and denies missing ones", () => {
  let continued = false;
  requirePermission("menu.update")({ user: { permissions: ["menu.view", "menu.update"] } }, responseRecorder(), () => { continued = true; });
  assert.equal(continued, true);

  const res = responseRecorder();
  requirePermission("menu.delete")({ user: { permissions: ["menu.view"] } }, res, () => {});
  assert.equal(res.statusCode, 403);
});
