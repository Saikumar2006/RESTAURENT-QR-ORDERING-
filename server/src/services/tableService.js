const QRCode = require("qrcode");
const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const env = require("../config/env");

async function listTables(restaurantId) {
  return prisma.table.findMany({ where: { restaurantId }, orderBy: { tableNumber: "asc" } });
}

// Public, customer-facing table list for the "select a table" landing page.
// Only ever exposes tableNumber + the opaque tableToken — never the raw
// table id — so this stays consistent with the rest of the public API.
async function listActiveTablesPublic(restaurantId) {
  const { getCachedJson, setCachedJson, getCacheKey } = require("./redisService");
  const cacheKey = getCacheKey("restaurant:public:tables", restaurantId);
  const cached = await getCachedJson(cacheKey);
  if (cached) return cached;

  const tables = await prisma.table.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { tableNumber: "asc" },
    select: { tableNumber: true, tableToken: true },
  });
  await setCachedJson(cacheKey, tables, 300);
  return tables;
}

async function createTable(restaurantId, data) {
  const existing = await prisma.table.findFirst({ where: { restaurantId, tableNumber: data.tableNumber } });
  if (existing) throw new ApiError(409, "A table with this number already exists");
  return prisma.table.create({ data: { ...data, restaurantId } });
}

async function updateTable(restaurantId, tableId, data) {
  const table = await prisma.table.findFirst({ where: { id: tableId, restaurantId } });
  if (!table) throw new ApiError(404, "Table not found");
  return prisma.table.update({ where: { id: tableId }, data });
}

async function disableTable(restaurantId, tableId) {
  const table = await prisma.table.findFirst({ where: { id: tableId, restaurantId } });
  if (!table) throw new ApiError(404, "Table not found");
  return prisma.table.update({ where: { id: tableId }, data: { isActive: false } });
}

// Public ordering URL encoded into the single restaurant QR. It carries only
// the restaurant's public slug — the customer picks "dine-in table" or
// "takeaway" once they land on the page, instead of scanning a different
// code per table.
function buildRestaurantUrl(slug) {
  return `${env.clientUrl}/r/${slug}`;
}

// One QR per restaurant, not one per table.
async function generateRestaurantQr(slug) {
  const url = buildRestaurantUrl(slug);
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return { url, dataUrl };
}

// Resolves the public table context from a table token (chosen by the
// customer on the landing page, not encoded in a per-table QR anymore).
// This remains the only way a dine-in request establishes restaurantId/
// tableId — never accepted directly from the client as a trusted id.
async function resolveTableByToken(tableToken) {
  const table = await prisma.table.findUnique({
    where: { tableToken },
    include: { restaurant: true },
  });
  if (!table || !table.isActive || table.restaurant.status !== "ACTIVE") {
    throw new ApiError(404, "This table is invalid or no longer active");
  }
  return table;
}

// Resolves the public restaurant context from its slug — used for the
// landing page and for takeaway orders, which have no table at all.
async function resolveRestaurantBySlug(slug) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") {
    throw new ApiError(404, "This restaurant link is invalid or no longer active");
  }
  return restaurant;
}

module.exports = {
  listTables,
  listActiveTablesPublic,
  createTable,
  updateTable,
  disableTable,
  generateRestaurantQr,
  buildRestaurantUrl,
  resolveTableByToken,
  resolveRestaurantBySlug,
};
