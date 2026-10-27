const inventoryService = require("../services/inventoryService");
const menuService = require("../services/menuService");
const { ok, created, asyncHandler, ApiError } = require("../utils/http");

function assertOwnRestaurant(req) {
  if (req.params.restaurantId && req.params.restaurantId !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
}

const listItems = asyncHandler(async (req, res) => {
  assertOwnRestaurant(req);
  ok(res, await inventoryService.listItems(req.user.restaurantId));
});

const getReport = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.getReport(req.user.restaurantId, req.validatedQuery?.from, req.validatedQuery?.to));
});

const listSuppliers = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.listSuppliers(req.user.restaurantId));
});

const createSupplier = asyncHandler(async (req, res) => {
  created(res, await inventoryService.createSupplier(req.user.restaurantId, req.body));
});

const updateSupplier = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.updateSupplier(req.user.restaurantId, req.params.supplierId, req.body));
});

const listPurchases = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.listPurchases(req.user.restaurantId, req.query.limit));
});

const createPurchase = asyncHandler(async (req, res) => {
  const result = await inventoryService.createPurchase(req.user.restaurantId, req.user.id, req.body);
  ok(res, result, result.duplicate ? { deduplicated: true } : undefined);
});

const createItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.createItem(req.user.restaurantId, req.user.id, req.body);
  created(res, item);
});

const updateItem = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.updateItem(req.user.restaurantId, req.params.itemId, req.body));
});

const postMovement = asyncHandler(async (req, res) => {
  const result = await inventoryService.postMovement(req.user.restaurantId, req.user.id, req.params.itemId, req.body);
  ok(res, result, result.duplicate ? { deduplicated: true } : undefined);
});

const listMovements = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.listMovements(req.user.restaurantId, req.params.itemId, req.query.limit));
});

const getMenu = asyncHandler(async (req, res) => {
  ok(res, await menuService.getAdminMenu(req.user.restaurantId));
});

const setRecipe = asyncHandler(async (req, res) => {
  ok(res, await inventoryService.setRecipe(req.user.restaurantId, req.params.menuItemId, req.body.components));
});

module.exports = {
  listItems, getReport, listSuppliers, createSupplier, updateSupplier, listPurchases, createPurchase,
  createItem, updateItem, postMovement, listMovements, getMenu, setRecipe,
};
