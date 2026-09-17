const prisma = require("../config/db");
const tableService = require("../services/tableService");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const { hashPassword } = require("../utils/auth");

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
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  ok(res, staff);
});

const createStaff = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findFirst({
    where: { restaurantId: req.user.restaurantId, email: req.body.email },
  });
  if (existing) throw new ApiError(409, "A staff member with this email already exists");

  const passwordHash = await hashPassword(req.body.password);
  const user = await prisma.user.create({
    data: {
      restaurantId: req.user.restaurantId,
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      passwordHash,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  created(res, user);
});

const updateStaff = asyncHandler(async (req, res) => {
  const staffMember = await prisma.user.findFirst({ where: { id: req.params.id, restaurantId: req.user.restaurantId } });
  if (!staffMember) throw new ApiError(404, "Staff member not found");
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  ok(res, updated);
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
