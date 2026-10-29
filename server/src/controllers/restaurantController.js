const prisma = require("../config/db");
const tableService = require("../services/tableService");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const roleService = require("../services/roleService");
const staffAccessService = require("../services/staffAccessService");

const getRestaurant = asyncHandler(async (req, res) => {
  // req.params.id is not trusted for authorization — a staff/admin can only
  // ever fetch their own restaurant (from req.user), regardless of the URL.
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.user.restaurantId } });
  ok(res, restaurant);
});

function assertRestaurantPath(req) {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
}

const updateRestaurant = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const restaurant = await prisma.restaurant.update({ where: { id: req.user.restaurantId }, data: req.body });
  ok(res, restaurant);
});

// --- Tables ----------------------------------------------------------------

const listTables = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const tables = await tableService.listTables(req.user.restaurantId);
  ok(res, tables);
});

const createTable = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const table = await tableService.createTable(req.user.restaurantId, req.body);
  created(res, table);
});

const updateTable = asyncHandler(async (req, res) => {
  const table = await tableService.updateTable(req.user.restaurantId, req.params.id, req.body);
  ok(res, table);
});

const disableTable = asyncHandler(async (req, res) => {
  const table = await tableService.disableTable(req.user.restaurantId, req.params.id);
  ok(res, table);
});

// Single QR for the whole restaurant (not one per table anymore). It
// encodes the restaurant's public link; the customer chooses a table or
// takeaway once they land on the page.
const generateRestaurantQr = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.user.restaurantId } });
  const qr = await tableService.generateRestaurantQr(restaurant.slug);
  ok(res, qr);
});

// --- Staff -------------------------------------------------------------

const listStaff = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const staff = await prisma.user.findMany({
    where: { restaurantId: req.user.restaurantId },
    include: {
      roleRecord: { select: { id: true, name: true, isSystem: true } },
      staffAccessLinksReceived: { where: { purpose: "ACTIVATE", consumedAt: null }, select: { expiresAt: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });
  ok(res, staff.map(({ passwordHash, roleRecord, staffAccessLinksReceived, ...member }) => ({
    ...member,
    roleId: roleRecord?.id || null,
    roleName: roleRecord?.name || (member.role === "ADMIN" ? "OWNER" : "STAFF"),
    isOwner: roleRecord?.name === "OWNER" || (!roleRecord && member.role === "ADMIN"),
    setupPending: !member.isActive && staffAccessLinksReceived.length > 0,
    setupInviteExpiresAt: staffAccessLinksReceived[0]?.expiresAt || null,
  })));
});

const createStaff = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const invitation = await staffAccessService.createInvitation(req.user.restaurantId, req.user, req.body);
  created(res, invitation);
});

const createStaffInvitation = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const invitation = await staffAccessService.createInvitation(req.user.restaurantId, req.user, req.body);
  created(res, invitation);
});

const issueStaffActivationLink = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const result = await staffAccessService.issueAccessLink(
    req.user.restaurantId, req.params.staffId, req.user.id, staffAccessService.PURPOSE.ACTIVATE, req.body.reason
  );
  created(res, result);
});

const issueStaffPasswordResetLink = asyncHandler(async (req, res) => {
  assertRestaurantPath(req);
  const result = await staffAccessService.issueAccessLink(
    req.user.restaurantId, req.params.staffId, req.user.id, staffAccessService.PURPOSE.PASSWORD_RESET, req.body.reason
  );
  created(res, result);
});

const updateStaff = asyncHandler(async (req, res) => {
  const staffMember = await prisma.user.findFirst({
    where: { id: req.params.id, restaurantId: req.user.restaurantId },
    include: { roleRecord: true },
  });
  if (!staffMember) throw new ApiError(404, "Staff member not found");
  const isOwner = staffMember.roleRecord?.name === "OWNER" || (!staffMember.roleRecord && staffMember.role === "ADMIN");
  if (isOwner) throw new ApiError(403, "The owner account cannot be changed here");
  if (req.body.isActive === true && !staffMember.isActive) {
    const pendingInvite = await prisma.restaurantStaffAccessLink.findUnique({
      where: { userId_purpose: { userId: staffMember.id, purpose: "ACTIVATE" } },
      select: { consumedAt: true },
    });
    if (pendingInvite && !pendingInvite.consumedAt) throw new ApiError(409, "This team member must activate through their setup link.");
  }
  if (req.params.id === req.user.id && req.body.roleId !== undefined && !req.user.isOwner) {
    throw new ApiError(403, "You cannot change your own role");
  }

  const data = { name: req.body.name, isActive: req.body.isActive };
  if (req.body.roleId !== undefined) {
    if (!req.user.permissions.includes("staff.roles.manage")) throw new ApiError(403, "You cannot assign roles");
    const role = req.body.roleId
      ? await prisma.role.findFirst({ where: { id: req.body.roleId, restaurantId: req.user.restaurantId }, include: { permissions: { include: { permission: { select: { key: true } } } } } })
      : await prisma.role.findFirst({ where: { restaurantId: req.user.restaurantId, name: "STAFF", isSystem: true }, include: { permissions: { include: { permission: { select: { key: true } } } } } });
    if (!role || role.name === "OWNER") throw new ApiError(400, "Choose a valid staff role");
    roleService.assertPermissionSubset(role.permissions.map((entry) => entry.permission.key), req.user.permissions);
    data.roleId = role.id;
    data.role = "STAFF";
  }
  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
  const updated = await prisma.$transaction(async (tx) => {
    const member = await tx.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, roleId: true, isActive: true, createdAt: true },
    });
    if (data.isActive === false && staffMember.isActive) {
      await tx.restaurantStaffAccessLink.updateMany({
        where: { restaurantId: req.user.restaurantId, userId: member.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    }
    await roleService.writeAudit(tx, req.user.restaurantId, req.user.id, "staff.updated", "user", member.id, {
      ...(data.roleId ? { roleId: data.roleId } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });
    return member;
  });
  const assignedRole = await prisma.role.findFirst({ where: { id: updated.roleId, restaurantId: req.user.restaurantId } });
  ok(res, { ...updated, roleName: assignedRole?.name || "STAFF", isOwner: false });
});

module.exports = {
  getRestaurant,
  updateRestaurant,
  listTables,
  createTable,
  updateTable,
  disableTable,
  generateRestaurantQr,
  listStaff,
  createStaff,
  createStaffInvitation,
  issueStaffActivationLink,
  issueStaffPasswordResetLink,
  updateStaff,
};
