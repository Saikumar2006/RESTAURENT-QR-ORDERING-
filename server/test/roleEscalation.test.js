const assert = require("node:assert/strict");
const { test } = require("node:test");
const roleService = require("../src/services/roleService");

test("a custom role cannot receive permissions its creator does not hold", () => {
  const managerPermissions = ["orders.view", "orders.update", "staff.create", "staff.roles.manage"];
  assert.deepEqual(
    roleService.assertPermissionSubset(["orders.view", "orders.update"], managerPermissions),
    ["orders.view", "orders.update"]
  );
  assert.throws(
    () => roleService.assertPermissionSubset(["orders.view", "payments.refund"], managerPermissions),
    (error) => error.status === 403 && error.details.unauthorized.includes("payments.refund")
  );
});

test("owners retain permission to create full custom roles and invalid keys stay rejected", () => {
  assert.deepEqual(roleService.assertPermissionSubset(["payments.refund", "inventory.manage"], ["*"]), ["payments.refund", "inventory.manage"]);
  assert.throws(() => roleService.assertPermissionSubset(["platform.admins.manage"], ["*"]), { status: 400 });
});

test("assigning a role follows the same permission-subset rule as creating one", () => {
  const currentActor = ["orders.view", "tables.view"];
  assert.deepEqual(roleService.assertPermissionSubset(["orders.view"], currentActor), ["orders.view"]);
  assert.throws(() => roleService.assertPermissionSubset(["staff.roles.manage"], currentActor), { status: 403 });
});
