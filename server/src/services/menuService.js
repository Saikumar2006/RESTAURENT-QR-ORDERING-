const prisma = require("../config/db");
const { ApiError } = require("../utils/http");

// --- Categories ------------------------------------------------------------

async function createCategory(restaurantId, data) {
  return prisma.category.create({ data: { ...data, restaurantId } });
}

async function updateCategory(restaurantId, categoryId, data) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Category not found");
  return prisma.category.update({ where: { id: categoryId }, data });
}

async function deleteCategory(restaurantId, categoryId) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Category not found");
  // Soft delete: disable rather than hard-delete so historical order_items
  // (which reference menu items under this category) stay intact.
  return prisma.category.update({ where: { id: categoryId }, data: { isActive: false } });
}

// --- Menu items --------------------------------------------------------

async function createMenuItem(restaurantId, data) {
  const category = await prisma.category.findFirst({ where: { id: data.categoryId, restaurantId } });
  if (!category) throw new ApiError(400, "Invalid category for this restaurant");
  return prisma.menuItem.create({ data: { ...data, restaurantId } });
}

async function updateMenuItem(restaurantId, menuItemId, data) {
  const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId } });
  if (!item) throw new ApiError(404, "Menu item not found");
  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, restaurantId } });
    if (!category) throw new ApiError(400, "Invalid category for this restaurant");
  }
  return prisma.menuItem.update({ where: { id: menuItemId }, data });
}

async function deleteMenuItem(restaurantId, menuItemId) {
  const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId } });
  if (!item) throw new ApiError(404, "Menu item not found");
  // Soft delete: order_items snapshot name/price already, but hard-deleting
  // would break the FK from historical order_items.
  return prisma.menuItem.update({ where: { id: menuItemId }, data: { isAvailable: false } });
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
