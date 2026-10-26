const prisma = require("../config/db");
const tableService = require("../services/tableService");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const { hashPassword } = require("../utils/auth");
const roleService = require("../services/roleService");

const getRestaurant = asyncHandler(async (req, res) => {
  // req.params.id is not trusted for authorization — a staff/admin can only
  // ever fetch their own restaurant (from req.user), regardless of the URL.
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const restaurant = await prisma.restaurant.findUnique({ where: { id: req.user.restaurantId } });
  ok(res, restaurant);
});

const updateRestaurant = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const restaurant = await prisma.restaurant.update({ where: { id: req.user.restaurantId }, data: req.body });
  ok(res, restaurant);
});

// --- Tables ----------------------------------------------------------------

const listTables = asyncHandler(async (req, res) => {
  const tables = await tableService.listTables(req.user.restaurantId);
  ok(res, tables);
});

const createTable = asyncHandler(async (req, res) => {
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
  const staff = await prisma.user.findMany({
    where: { restaurantId: req.user.restaurantId },
    include: { roleRecord: { select: { id: true, name: true, isSystem: true } } },
    orderBy: { createdAt: "asc" },
  });
  ok(res, staff.map(({ passwordHash, roleRecord, ...member }) => ({
    ...member,
    roleId: roleRecord?.id || null,
    roleName: roleRecord?.name || (member.role === "ADMIN" ? "OWNER" : "STAFF"),
    isOwner: roleRecord?.name === "OWNER" || (!roleRecord && member.role === "ADMIN"),
  })));
});

const createStaff = asyncHandler(async (req, res) => {
  await roleService.ensureRestaurantRoles(req.user.restaurantId);
  const role = req.body.roleId
    ? await prisma.role.findFirst({ where: { id: req.body.roleId, restaurantId: req.user.restaurantId } })
    : await prisma.role.findFirst({ where: { restaurantId: req.user.restaurantId, name: "STAFF", isSystem: true } });
  if (!role || role.name === "OWNER") throw new ApiError(400, "Choose a valid staff role");
  if (req.body.roleId && !req.user.permissions.includes("staff.roles.manage") && role.name !== "STAFF") {
    throw new ApiError(403, "You cannot assign roles");
  }
  const existing = await prisma.user.findFirst({
    where: { restaurantId: req.user.restaurantId, email: { equals: req.body.email.trim(), mode: "insensitive" } },
  });
  if (existing) throw new ApiError(409, "A staff member with this email already exists");

  const passwordHash = await hashPassword(req.body.password);
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        restaurantId: req.user.restaurantId,
        name: req.body.name,
        email: req.body.email.trim().toLowerCase(),
        role: "STAFF",
        roleId: role.id,
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, roleId: true, isActive: true, createdAt: true },
    });
    await roleService.writeAudit(tx, req.user.restaurantId, req.user.id, "staff.created", "user", createdUser.id, { roleId: role.id });
    return createdUser;
  });
  created(res, { ...user, roleName: role.name, isOwner: false });
});

const updateStaff = asyncHandler(async (req, res) => {
  const staffMember = await prisma.user.findFirst({
    where: { id: req.params.id, restaurantId: req.user.restaurantId },
    include: { roleRecord: true },
  });
  if (!staffMember) throw new ApiError(404, "Staff member not found");
  const isOwner = staffMember.roleRecord?.name === "OWNER" || (!staffMember.roleRecord && staffMember.role === "ADMIN");
  if (isOwner) throw new ApiError(403, "The owner account cannot be changed here");
  if (req.params.id === req.user.id && req.body.roleId !== undefined && !req.user.isOwner) {
    throw new ApiError(403, "You cannot change your own role");
  }

  const data = { name: req.body.name, isActive: req.body.isActive };
  if (req.body.roleId !== undefined) {
    if (!req.user.permissions.includes("staff.roles.manage")) throw new ApiError(403, "You cannot assign roles");
    const role = req.body.roleId
      ? await prisma.role.findFirst({ where: { id: req.body.roleId, restaurantId: req.user.restaurantId } })
      : await prisma.role.findFirst({ where: { restaurantId: req.user.restaurantId, name: "STAFF", isSystem: true } });
    if (!role || role.name === "OWNER") throw new ApiError(400, "Choose a valid staff role");
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
  updateStaff,
};
