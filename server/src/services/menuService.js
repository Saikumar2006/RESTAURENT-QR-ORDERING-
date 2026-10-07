const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { deletePattern, getCacheKey } = require("./redisService");

// --- Categories ------------------------------------------------------------

async function invalidateRestaurantMenuCache(restaurantId) {
  await deletePattern(`restaurant:menu:${restaurantId}:*`);
  await deletePattern(`restaurant:context:${restaurantId}:*`);
  await deletePattern(`restaurant:public:${restaurantId}:*`);
  await deletePattern(`restaurant:context:slug:*`);
  await deletePattern(`restaurant:public:slug:*`);
}

async function createCategory(restaurantId, data) {
  const category = await prisma.category.create({ data: { ...data, restaurantId } });
  await invalidateRestaurantMenuCache(restaurantId);
  return category;
}

async function updateCategory(restaurantId, categoryId, data) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Category not found");
  const updated = await prisma.category.update({ where: { id: categoryId }, data });
  await invalidateRestaurantMenuCache(restaurantId);
  return updated;
}

async function deleteCategory(restaurantId, categoryId) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Category not found");
  // Soft delete: disable rather than hard-delete so historical order_items
  // (which reference menu items under this category) stay intact.
  const updated = await prisma.category.update({ where: { id: categoryId }, data: { isActive: false } });
  await invalidateRestaurantMenuCache(restaurantId);
  return updated;
}

// --- Menu items --------------------------------------------------------

async function createMenuItem(restaurantId, data) {
  const category = await prisma.category.findFirst({ where: { id: data.categoryId, restaurantId } });
  if (!category) throw new ApiError(400, "Invalid category for this restaurant");
  const item = await prisma.menuItem.create({ data: { ...data, restaurantId } });
  await invalidateRestaurantMenuCache(restaurantId);
  return item;
}

async function updateMenuItem(restaurantId, menuItemId, data) {
  const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId } });
  if (!item) throw new ApiError(404, "Menu item not found");
  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, restaurantId } });
    if (!category) throw new ApiError(400, "Invalid category for this restaurant");
  }
  const updated = await prisma.menuItem.update({ where: { id: menuItemId }, data });
  await invalidateRestaurantMenuCache(restaurantId);
  return updated;
}

async function deleteMenuItem(restaurantId, menuItemId) {
  const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId } });
  if (!item) throw new ApiError(404, "Menu item not found");
  // Soft delete: order_items snapshot name/price already, but hard-deleting
  // would break the FK from historical order_items.
  const updated = await prisma.menuItem.update({ where: { id: menuItemId }, data: { isAvailable: false } });
  await invalidateRestaurantMenuCache(restaurantId);
  return updated;
}

// --- Admin read (full, including disabled/unavailable) -------------------

async function getAdminMenu(restaurantId) {
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { displayOrder: "asc" },
    include: { menuItems: { orderBy: { displayOrder: "asc" } } },
  });
  return categories;
}

// --- Public read (only active categories / available items) --------------

async function getPublicMenu(restaurantId) {
  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
  // Don't surface empty categories on the public menu.
  return categories.filter((c) => c.menuItems.length > 0);
}

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getAdminMenu,
  getPublicMenu,
};
