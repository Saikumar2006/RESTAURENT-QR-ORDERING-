const prisma = require("../config/db");
const { ApiError } = require("../utils/http");

const PERMISSION_DEFINITIONS = [
  ["orders.view", "Orders", "View orders"],
  ["orders.create", "Orders", "Create orders"],
  ["orders.update", "Orders", "Update order progress"],
  ["orders.cancel", "Orders", "Cancel orders"],
  ["orders.complete", "Orders", "Complete orders"],
  ["menu.view", "Menu", "View the restaurant menu"],
  ["menu.create", "Menu", "Create menu items"],
  ["menu.update", "Menu", "Update menu items"],
  ["menu.delete", "Menu", "Delete or disable menu items"],
  ["tables.view", "Tables", "View restaurant tables"],
  ["tables.manage", "Tables", "Create and manage tables"],
  ["tables.qr.manage", "Tables", "Manage restaurant QR codes"],
  ["payments.view", "Payments", "View payment status"],
  ["payments.refund", "Payments", "Issue refunds"],
  ["payments.reports", "Payments", "View payment reports"],
  ["analytics.view", "Analytics", "View analytics and reports"],
  ["analytics.export", "Analytics", "Export analytics"],
  ["coupons.view", "Coupons", "View coupons"],
  ["coupons.create", "Coupons", "Create coupons"],
  ["coupons.update", "Coupons", "Update coupons"],
  ["coupons.delete", "Coupons", "Delete coupons"],
  ["staff.view", "Staff", "View staff"],
  ["staff.create", "Staff", "Create staff accounts"],
  ["staff.update", "Staff", "Update staff accounts"],
  ["staff.delete", "Staff", "Remove staff accounts"],
  ["staff.roles.manage", "Staff", "Manage roles and permissions"],
  ["restaurant.view", "Restaurant", "View restaurant details"],
  ["restaurant.update", "Restaurant", "Update restaurant details"],
  ["settings.view", "Settings", "View restaurant settings"],
  ["settings.update", "Settings", "Update restaurant settings"],
  ["audit.view", "Audit log", "View the restaurant audit log"],
];

const PERMISSION_KEYS = PERMISSION_DEFINITIONS.map(([key]) => key);
const PERMISSIONS_BY_ROLE = {
  OWNER: PERMISSION_KEYS,
  MANAGER: [
    "orders.view", "orders.create", "orders.update", "orders.complete",
    "menu.view", "menu.create", "menu.update",
    "tables.view", "tables.manage", "tables.qr.manage",
    "payments.view", "payments.reports",
    "analytics.view", "analytics.export",
    "coupons.view", "coupons.create", "coupons.update",
    "staff.view", "staff.create", "staff.update", "restaurant.view", "settings.view", "settings.update",
    "audit.view",
  ],
  KITCHEN: ["orders.view", "orders.update", "orders.complete"],
  CASHIER: ["orders.view", "orders.create", "payments.view", "payments.reports"],
  STAFF: ["orders.view", "orders.update", "tables.view"],
};

const DEFAULT_ROLE_DESCRIPTIONS = {
  OWNER: "Full restaurant control. Ownership is protected from removal in the staff panel.",
  MANAGER: "Restaurant operations and analytics without owner-level destructive permissions.",
  KITCHEN: "Kitchen order queue and preparation progress.",
  CASHIER: "Order intake and payment visibility.",
  STAFF: "Assigned operational access for orders and tables.",
};

function getPermissionDefinitions() {
  return PERMISSION_DEFINITIONS.map(([key, group, label]) => ({ key, group, label }));
}

async function ensureRestaurantRoles(restaurantId, database = prisma) {
  const initialize = async (tx) => {
    const permissionRows = new Map();
    for (const [key, group, label] of PERMISSION_DEFINITIONS) {
      const permission = await tx.permission.upsert({
        where: { key },
        create: { key, group, label },
        update: { group, label },
      });
      permissionRows.set(key, permission.id);
    }

    for (const [name, permissionKeys] of Object.entries(PERMISSIONS_BY_ROLE)) {
      const role = await tx.role.upsert({
        where: { restaurantId_name: { restaurantId, name } },
        create: {
          restaurantId,
          name,
          description: DEFAULT_ROLE_DESCRIPTIONS[name],
          isSystem: true,
          permissions: {
            create: permissionKeys.map((key) => ({
              permission: { connect: { id: permissionRows.get(key) } },
            })),
          },
        },
        update: {},
      });

      if (role.isSystem && role.name === "OWNER") {
        await tx.user.updateMany({
          where: { restaurantId, roleId: null, role: "ADMIN" },
          data: { roleId: role.id },
        });
      }
      if (role.isSystem && role.name === "STAFF") {
        await tx.user.updateMany({
          where: { restaurantId, roleId: null, role: { not: "ADMIN" } },
          data: { roleId: role.id },
        });
      }
    }
  };
  if (database === prisma) return prisma.$transaction(initialize);
  return initialize(database);
}

async function getUserAccess(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roleRecord: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user) throw new ApiError(401, "Invalid or expired session");

  const role = user.roleRecord;
  const isOwner = role?.name === "OWNER" || (!role && user.role === "ADMIN");
  const permissions = isOwner
    ? PERMISSION_KEYS
    : role
      ? role.permissions.map((entry) => entry.permission.key)
      : PERMISSIONS_BY_ROLE.STAFF;
  return {
    user,
    roleName: role?.name || (user.role === "ADMIN" ? "OWNER" : "STAFF"),
    roleId: role?.id || null,
    permissions: [...new Set(permissions)],
    isOwner,
  };
}

async function listRoles(restaurantId) {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { restaurantId },
      include: { _count: { select: { users: true } }, permissions: { include: { permission: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
    prisma.permission.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] }),
  ]);
  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((item) => item.permission.key),
      createdAt: role.createdAt,
    })),
    permissionCatalog: permissions.map(({ key, group, label, description }) => ({ key, group, label, description })),
  };
}

async function createRole(restaurantId, actorId, { name, description, permissions }) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const normalizedPermissions = normalizePermissions(permissions);
  try {
    return await prisma.$transaction(async (tx) => {
      const duplicate = await tx.role.findFirst({
        where: { restaurantId, name: { equals: normalizedName, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) throw new ApiError(409, "A role with this name already exists");
      const role = await tx.role.create({
        data: {
          restaurantId,
          name: normalizedName,
          description: description || "",
          permissions: {
            create: normalizedPermissions.map((key) => ({
              permission: { connect: { key } },
            })),
          },
        },
      });
      await writeAudit(tx, restaurantId, actorId, "role.created", "role", role.id, { name: role.name });
      return { id: role.id, name: role.name, description: role.description, isSystem: false, userCount: 0, permissions: normalizedPermissions };
    });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A role with this name already exists");
    throw error;
  }
}

async function updateRole(restaurantId, actorId, roleId, { name, description }) {
  const role = await prisma.role.findFirst({ where: { id: roleId, restaurantId } });
  if (!role) throw new ApiError(404, "Role not found");
  if (role.isSystem) throw new ApiError(403, "System role names cannot be changed");
  const data = {};
  if (name !== undefined) data.name = name.trim().replace(/\s+/g, " ");
  if (description !== undefined) data.description = description;
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id: role.id }, data });
      await writeAudit(tx, restaurantId, actorId, "role.updated", "role", role.id, data);
      return updated;
    });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A role with this name already exists");
    throw error;
  }
}

async function replaceRolePermissions(restaurantId, actorId, roleId, permissions) {
  const normalizedPermissions = normalizePermissions(permissions);
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findFirst({ where: { id: roleId, restaurantId } });
    if (!role) throw new ApiError(404, "Role not found");
    if (role.name === "OWNER") throw new ApiError(403, "Owner permissions are fixed and cannot be reduced");
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (normalizedPermissions.length) {
      const records = await tx.permission.findMany({
        where: { key: { in: normalizedPermissions } },
        select: { id: true },
      });
      await tx.rolePermission.createMany({
        data: records.map((permission) => ({ roleId, permissionId: permission.id })),
      });
    }
    await writeAudit(tx, restaurantId, actorId, "role.permissions_changed", "role", roleId, { permissions: normalizedPermissions });
    return normalizedPermissions;
  });
}

async function deleteRole(restaurantId, actorId, roleId) {
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findFirst({ where: { id: roleId, restaurantId } });
    if (!role) throw new ApiError(404, "Role not found");
    if (role.isSystem) throw new ApiError(403, "System roles cannot be deleted");
    if (await tx.user.count({ where: { restaurantId, roleId } })) {
      throw new ApiError(409, "Reassign staff from this role before deleting it");
    }
    await tx.role.delete({ where: { id: roleId } });
    await writeAudit(tx, restaurantId, actorId, "role.deleted", "role", roleId, { name: role.name });
  });
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) throw new ApiError(400, "Permissions must be a list");
  const requested = [...new Set(permissions)];
  const invalid = requested.filter((key) => !PERMISSION_KEYS.includes(key));
  if (invalid.length) throw new ApiError(400, "One or more permissions are invalid", { invalid });
  return requested;
}

async function writeAudit(db, restaurantId, userId, action, resource, resourceId, metadata) {
  return db.auditLog.create({
    data: {
      restaurantId,
      userId,
      action,
      resource,
      resourceId: resourceId || null,
      metadata: JSON.stringify(metadata || {}),
    },
  });
}

async function listAuditLog(restaurantId, pageSize = 50) {
  const entries = await prisma.auditLog.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(pageSize) || 50, 1), 100),
  });
  const userIds = [...new Set(entries.map((entry) => entry.userId).filter(Boolean))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds }, restaurantId }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  return entries.map((entry) => ({
    ...entry,
    metadata: safeParseMetadata(entry.metadata),
    user: userMap.get(entry.userId) || null,
  }));
}

function safeParseMetadata(metadata) {
  try {
    return JSON.parse(metadata || "{}");
  } catch {
    return {};
  }
}

module.exports = {
  PERMISSION_DEFINITIONS,
  PERMISSION_KEYS,
  PERMISSIONS_BY_ROLE,
  getPermissionDefinitions,
  ensureRestaurantRoles,
  getUserAccess,
  listRoles,
  createRole,
  updateRole,
  replaceRolePermissions,
  deleteRole,
  listAuditLog,
  writeAudit,
};
