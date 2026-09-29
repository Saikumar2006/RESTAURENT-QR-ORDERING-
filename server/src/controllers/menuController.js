const menuService = require("../services/menuService");
const tableService = require("../services/tableService");
const storageService = require("../services/storageService");
const prisma = require("../config/db");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const { isRestaurantOpenNow } = require("../utils/restaurantStatus");

const getAdminMenu = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  const menu = await menuService.getAdminMenu(req.user.restaurantId);
  ok(res, menu);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await menuService.createCategory(req.user.restaurantId, req.body);
  created(res, category);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await menuService.updateCategory(req.user.restaurantId, req.params.id, req.body);
  ok(res, category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await menuService.deleteCategory(req.user.restaurantId, req.params.id);
  ok(res, category);
});

const createMenuItem = asyncHandler(async (req, res) => {
  const item = await menuService.createMenuItem(req.user.restaurantId, req.body);
  created(res, item);
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const item = await menuService.updateMenuItem(req.user.restaurantId, req.params.id, req.body);
  ok(res, item);
});

const deleteMenuItem = asyncHandler(async (req, res) => {
  const item = await menuService.deleteMenuItem(req.user.restaurantId, req.params.id);
  ok(res, item);
});

// Accepts a single multipart image (field name "image"), already validated
// by the upload middleware, and uploads it via storageService (local disk
// or Supabase Storage, depending on STORAGE_PROVIDER) before returning the
// public URL to store as imageUrl. Kept separate from create/update so the
// client can upload the file the moment it's picked and only send plain
// JSON to the create/update endpoints. Used for both menu items and categories.
const uploadImage = asyncHandler(async (req, res) => {
  const { url } = await storageService.uploadFile(req.file);
  created(res, { url });
});

// --- Public endpoints ------------------------------------------------------

// Public: resolves the restaurant behind the single QR link, plus the list
// of active tables (number + opaque token only) so the customer can pick
// "dine-in, table N" or "takeaway" on the landing page.
const getPublicRestaurantContext = asyncHandler(async (req, res) => {
  const restaurant = await tableService.resolveRestaurantBySlug(req.params.slug);
  const tables = await tableService.listActiveTablesPublic(restaurant.id);
  ok(res, {
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
      currency: restaurant.currency,
      searchEnabled: restaurant.searchEnabled,
      isOpenNow: isRestaurantOpenNow(restaurant),
      geofenceEnabled: restaurant.geofenceEnabled,
      // Public location, needed client-side to check "am I close enough?"
      // before letting the browser send GPS coordinates anywhere.
      latitude: restaurant.geofenceEnabled ? restaurant.latitude : null,
      longitude: restaurant.geofenceEnabled ? restaurant.longitude : null,
      geofenceRadiusMeters: restaurant.geofenceRadiusMeters,
    },
    tables,
  });
});

const getPublicMenuBySlug = asyncHandler(async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant || restaurant.status !== "ACTIVE") throw new ApiError(404, "Restaurant not found");
  const menu = await menuService.getPublicMenu(restaurant.id);
  ok(res, menu);
});

module.exports = {
  getAdminMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  uploadImage,
  getPublicRestaurantContext,
  getPublicMenuBySlug,
};
