const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const roleService = require("../services/roleService");

function restaurantIdFor(req) {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  return req.user.restaurantId;
}

const list = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req);
  await roleService.ensureRestaurantRoles(restaurantId);
  ok(res, { ...await roleService.listRoles(restaurantId), permissions: roleService.getPermissionDefinitions() });
});

const create = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(restaurantIdFor(req), req.user.id, req.body, req.user.permissions);
  created(res, role);
});

const update = asyncHandler(async (req, res) => {
  ok(res, await roleService.updateRole(restaurantIdFor(req), req.user.id, req.params.roleId, req.body));
});

const setPermissions = asyncHandler(async (req, res) => {
  if (!req.user.isOwner && req.user.roleId === req.params.roleId) {
    throw new ApiError(403, "You cannot change permissions on your own role");
  }
  const permissions = await roleService.replaceRolePermissions(
    restaurantIdFor(req), req.user.id, req.params.roleId, req.body.permissions, req.user.permissions
  );
  ok(res, { roleId: req.params.roleId, permissions });
});

const remove = asyncHandler(async (req, res) => {
  await roleService.deleteRole(restaurantIdFor(req), req.user.id, req.params.roleId);
  ok(res, { deleted: true });
});

const auditLog = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req);
  ok(res, await roleService.listAuditLog(restaurantId, req.query.limit));
});

module.exports = { list, create, update, setPermissions, remove, auditLog };
