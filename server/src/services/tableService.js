const QRCode = require("qrcode");
const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const { deleteCachedKey, getCacheKey, getCachedJson, setCachedJson } = require("./redisService");

async function invalidatePublicTables(restaurantId) {
  await deleteCachedKey(getCacheKey("restaurant:public:tables", restaurantId));
}

async function listTables(restaurantId) {
  const tables = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { tableNumber: "asc" },
    include: {
      orders: {
        where: {
          status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          items: true,
        },
      },
    },
  });

  return tables.map((t) => {
    const activeOrder = t.orders && t.orders.length > 0 ? t.orders[0] : null;
    let computedStatus = t.status || "AVAILABLE";
    if (t.isActive === false) {
      computedStatus = "DISABLED";
    } else if (activeOrder) {
      computedStatus = "OCCUPIED";
    }
    return {
      ...t,
      computedStatus,
      activeOrder,
    };
  });
}

// Public, customer-facing table list for the "select a table" landing page.
// Only ever exposes tableNumber + the opaque tableToken — never the raw
// table id — so this stays consistent with the rest of the public API.
async function listActiveTablesPublic(restaurantId) {
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
  const subscription = await prisma.subscription.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });
  if (subscription && subscription.status !== "GRANDFATHERED") {
    const plan = subscription.planKey;
    const maxTables = (plan === "STARTER" || plan === "BASIC") ? 15 : (plan === "GROWTH" || plan === "STANDARD") ? 50 : Infinity;
    if (maxTables !== Infinity) {
      const count = await prisma.table.count({ where: { restaurantId } });
      if (count >= maxTables) {
        throw new ApiError(403, `Your current plan allows up to ${maxTables} tables. Please upgrade your subscription to add more tables.`);
      }
    }
  }

  const existing = await prisma.table.findFirst({ where: { restaurantId, tableNumber: String(data.tableNumber).trim() } });
  if (existing) throw new ApiError(409, "A table with this number already exists");

  const table = await prisma.table.create({
    data: {
      restaurantId,
      tableNumber: String(data.tableNumber).trim(),
      capacity: data.capacity !== undefined ? Number(data.capacity) : 4,
      section: data.section ? String(data.section).trim() : "Indoor",
      shape: data.shape || "round",
      posX: data.posX !== undefined ? Number(data.posX) : 120,
      posY: data.posY !== undefined ? Number(data.posY) : 120,
      width: data.width !== undefined ? Number(data.width) : 90,
      height: data.height !== undefined ? Number(data.height) : 90,
      rotation: data.rotation !== undefined ? Number(data.rotation) : 0,
      chairCount: data.chairCount !== undefined ? Number(data.chairCount) : (data.capacity || 4),
      chairPositions: data.chairPositions || null,
      status: data.status || "AVAILABLE",
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });
  await invalidatePublicTables(restaurantId);
  return table;
}

async function updateTable(restaurantId, tableId, data) {
  const table = await prisma.table.findFirst({ where: { id: tableId, restaurantId } });
  if (!table) throw new ApiError(404, "Table not found");

  const updateData = {};
  if (data.tableNumber !== undefined) updateData.tableNumber = String(data.tableNumber).trim();
  if (data.capacity !== undefined) updateData.capacity = Number(data.capacity);
  if (data.section !== undefined) updateData.section = String(data.section).trim();
  if (data.shape !== undefined) updateData.shape = data.shape;
  if (data.posX !== undefined) updateData.posX = Number(data.posX);
  if (data.posY !== undefined) updateData.posY = Number(data.posY);
  if (data.width !== undefined) updateData.width = Number(data.width);
  if (data.height !== undefined) updateData.height = Number(data.height);
  if (data.rotation !== undefined) updateData.rotation = Number(data.rotation);
  if (data.chairCount !== undefined) updateData.chairCount = Number(data.chairCount);
  if (data.chairPositions !== undefined) updateData.chairPositions = data.chairPositions;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

  const updated = await prisma.table.update({ where: { id: tableId }, data: updateData });
  await invalidatePublicTables(restaurantId);
  return updated;
}

async function batchUpdateTables(restaurantId, tables) {
  if (!Array.isArray(tables)) return [];
  const results = [];
  for (const item of tables) {
    if (!item.id) continue;
    const updateData = {};
    if (item.posX !== undefined) updateData.posX = Number(item.posX);
    if (item.posY !== undefined) updateData.posY = Number(item.posY);
    if (item.width !== undefined) updateData.width = Number(item.width);
    if (item.height !== undefined) updateData.height = Number(item.height);
    if (item.rotation !== undefined) updateData.rotation = Number(item.rotation);
    if (item.shape !== undefined) updateData.shape = item.shape;
    if (item.capacity !== undefined) updateData.capacity = Number(item.capacity);
    if (item.chairCount !== undefined) updateData.chairCount = Number(item.chairCount);
    if (item.chairPositions !== undefined) updateData.chairPositions = item.chairPositions;
    if (item.section !== undefined) updateData.section = String(item.section).trim();
    if (item.status !== undefined) updateData.status = item.status;
    if (item.isActive !== undefined) updateData.isActive = Boolean(item.isActive);

    const updated = await prisma.table.updateMany({
      where: { id: item.id, restaurantId },
      data: updateData,
    });
    results.push(updated);
  }
  await invalidatePublicTables(restaurantId);
  return results;
}

async function deleteTable(restaurantId, tableId) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    include: { _count: { select: { orders: true } } },
  });
  if (!table) throw new ApiError(404, "Table not found");

  if (table._count.orders === 0) {
    await prisma.table.delete({ where: { id: tableId } });
  } else {
    await prisma.table.update({
      where: { id: tableId },
      data: { isActive: false, status: "DISABLED" },
    });
  }
  await invalidatePublicTables(restaurantId);
  return { success: true, id: tableId };
}

async function disableTable(restaurantId, tableId) {
  return deleteTable(restaurantId, tableId);
}

// Floor Layout Persistence (per-section canvas state and architectural objects)
async function getFloorLayout(restaurantId, section = "Indoor") {
  let layout = await prisma.floorLayout.findUnique({
    where: {
      restaurantId_section: { restaurantId, section },
    },
  });
  if (!layout) {
    layout = await prisma.floorLayout.create({
      data: {
        restaurantId,
        section,
        objects: [],
        gridSnap: true,
        gridSize: 20,
        canvasWidth: 1600,
        canvasHeight: 1000,
        zoom: 1.0,
        panX: 0,
        panY: 0,
      },
    });
  }
  return layout;
}

async function updateFloorLayout(restaurantId, data) {
  const section = data.section || "Indoor";
  const updateData = {};
  if (data.objects !== undefined) updateData.objects = data.objects;
  if (data.gridSnap !== undefined) updateData.gridSnap = Boolean(data.gridSnap);
  if (data.gridSize !== undefined) updateData.gridSize = Number(data.gridSize);
  if (data.canvasWidth !== undefined) updateData.canvasWidth = Number(data.canvasWidth);
  if (data.canvasHeight !== undefined) updateData.canvasHeight = Number(data.canvasHeight);
  if (data.zoom !== undefined) updateData.zoom = Number(data.zoom);
  if (data.panX !== undefined) updateData.panX = Number(data.panX);
  if (data.panY !== undefined) updateData.panY = Number(data.panY);

  const layout = await prisma.floorLayout.upsert({
    where: {
      restaurantId_section: { restaurantId, section },
    },
    update: updateData,
    create: {
      restaurantId,
      section,
      ...updateData,
    },
  });
  return layout;
}

// Public ordering URL encoded into the single restaurant QR. It carries only
// the restaurant's public slug — the customer picks "dine-in table" or
// "takeaway" once they land on the page, instead of scanning a different
// code per table.
function buildRestaurantUrl(slug) {
  return `${env.clientUrl}/r/${slug}`;
}

function buildTableUrl(slug, tableToken) {
  return `${env.clientUrl}/r/${slug}?tableToken=${encodeURIComponent(tableToken)}`;
}

// Unified QR for the restaurant (customer chooses dine-in or takeaway)
async function generateRestaurantQr(slug) {
  const url = buildRestaurantUrl(slug);
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return { url, dataUrl };
}

// Dedicated QR for a specific dining table carrying its secure rotating tableToken
async function generateTableQr(restaurantId, tableId) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    include: { restaurant: true },
  });
  if (!table) throw new ApiError(404, "Table not found");

  const url = buildTableUrl(table.restaurant.slug, table.tableToken);
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return {
    tableId: table.id,
    tableNumber: table.tableNumber,
    tableToken: table.tableToken,
    url,
    dataUrl,
    restaurantName: table.restaurant.name,
    restaurantSlug: table.restaurant.slug,
  };
}

// Rotates the secure tableToken and returns the freshly generated QR code
async function rotateTableToken(restaurantId, tableId) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
    include: { restaurant: true },
  });
  if (!table) throw new ApiError(404, "Table not found");

  const { randomUUID } = require("crypto");
  const newToken = randomUUID();
  const updated = await prisma.table.update({
    where: { id: tableId },
    data: { tableToken: newToken },
    include: { restaurant: true },
  });
  await invalidatePublicTables(restaurantId);

  const url = buildTableUrl(table.restaurant.slug, newToken);
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return {
    tableId: updated.id,
    tableNumber: updated.tableNumber,
    tableToken: updated.tableToken,
    url,
    dataUrl,
    restaurantName: updated.restaurant.name,
    restaurantSlug: updated.restaurant.slug,
  };
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
  batchUpdateTables,
  deleteTable,
  disableTable,
  getFloorLayout,
  updateFloorLayout,
  generateRestaurantQr,
  generateTableQr,
  rotateTableToken,
  buildRestaurantUrl,
  buildTableUrl,
  resolveTableByToken,
  resolveRestaurantBySlug,
};
