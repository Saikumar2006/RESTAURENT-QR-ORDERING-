const prisma = require("../config/db");
const { ApiError } = require("../utils/http");
const { deletePattern, getCacheKey, getCachedJson, setCachedJson } = require("./redisService");
const { localizeMenu, withMissingTranslations } = require("../utils/menuLocalization");

// --- Categories ------------------------------------------------------------

async function invalidateRestaurantMenuCache(restaurantId) {
  await deletePattern(`restaurant:menu:${restaurantId}:*`);
}

async function createCategory(restaurantId, data) {
  const category = await prisma.category.create({ data: { ...data, restaurantId } });
  await invalidateRestaurantMenuCache(restaurantId);
  return category;
}

async function updateCategory(restaurantId, categoryId, data) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Category not found");
  const updateData = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.translations !== undefined) updateData.translations = data.translations;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;
  if (data.displayOrder !== undefined) updateData.displayOrder = Number(data.displayOrder);
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

  const updated = await prisma.category.update({ where: { id: categoryId }, data: updateData });
  await invalidateRestaurantMenuCache(restaurantId);
  return updated;
}

async function deleteCategory(restaurantId, categoryId) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Category not found");

  // Check if any menu items in this category have historical orders
  const items = await prisma.menuItem.findMany({
    where: { categoryId, restaurantId },
    include: { _count: { select: { orderItems: true } } },
  });
  const hasOrders = items.some((item) => item._count.orderItems > 0);

  if (!hasOrders) {
    // Safe to hard-delete category; cascades to items
    await prisma.category.delete({ where: { id: categoryId } });
  } else {
    // Soft delete category and all its menu items
    await prisma.category.update({ where: { id: categoryId }, data: { isActive: false } });
    await prisma.menuItem.updateMany({
      where: { categoryId },
      data: { isDeleted: true, isAvailable: false },
    });
  }

  await invalidateRestaurantMenuCache(restaurantId);
  return { success: true, id: categoryId };
}

// --- Menu items --------------------------------------------------------

async function createMenuItem(restaurantId, data) {
  const category = await prisma.category.findFirst({ where: { id: data.categoryId, restaurantId } });
  if (!category) throw new ApiError(400, "Invalid category for this restaurant");

  const sanitizedData = {
    restaurantId,
    categoryId: data.categoryId,
    name: String(data.name).trim(),
    description: data.description ? String(data.description).trim() : null,
    translations: data.translations || undefined,
    price: Number(data.price),
    imageUrl: data.imageUrl || null,
    isVeg: data.isVeg !== undefined ? Boolean(data.isVeg) : true,
    isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
    isBestseller: data.isBestseller !== undefined ? Boolean(data.isBestseller) : false,
    displayOrder: Number.isInteger(data.displayOrder) ? data.displayOrder : 0,
    variants: Array.isArray(data.variants) ? data.variants : null,
    addons: Array.isArray(data.addons) ? data.addons : null,
  };

  const item = await prisma.menuItem.create({ data: sanitizedData });
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

  const updateData = {};
  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.description !== undefined) updateData.description = data.description ? String(data.description).trim() : null;
  if (data.translations !== undefined) updateData.translations = data.translations;
  if (data.price !== undefined) updateData.price = Number(data.price);
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;
  if (data.isVeg !== undefined) updateData.isVeg = Boolean(data.isVeg);
  if (data.isAvailable !== undefined) updateData.isAvailable = Boolean(data.isAvailable);
  if (data.isBestseller !== undefined) updateData.isBestseller = Boolean(data.isBestseller);
  if (data.displayOrder !== undefined) updateData.displayOrder = Number(data.displayOrder);
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.variants !== undefined) updateData.variants = Array.isArray(data.variants) ? data.variants : null;
  if (data.addons !== undefined) updateData.addons = Array.isArray(data.addons) ? data.addons : null;

  const updated = await prisma.menuItem.update({ where: { id: menuItemId }, data: updateData });
  await invalidateRestaurantMenuCache(restaurantId);
  return updated;
}

async function deleteMenuItem(restaurantId, menuItemId) {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!item) throw new ApiError(404, "Menu item not found");

  if (item._count.orderItems === 0) {
    await prisma.menuItem.delete({ where: { id: menuItemId } });
  } else {
    // Preserve FK relationship to orderItems while hiding it from all admin and public views
    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { isDeleted: true, isAvailable: false },
    });
  }

  await invalidateRestaurantMenuCache(restaurantId);
  return { success: true, id: menuItemId };
}

// --- Admin read (full, active categories and non-deleted items) -------------------

async function getAdminMenu(restaurantId) {
  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      menuItems: {
        where: { isDeleted: false },
        orderBy: { displayOrder: "asc" },
        include: { recipeComponents: { include: { inventoryItem: { select: { id: true, name: true, baseUnit: true } } } } },
      },
    },
  });
  return categories.map((category) => ({
    ...withMissingTranslations(category),
    menuItems: category.menuItems.map((item) => withMissingTranslations(
      item,
      item.description ? ["name", "description"] : ["name"],
    )),
  }));
}

// --- Public read (only active categories / available and non-deleted items) --------------

async function getPublicMenu(restaurantId, language = "en") {
  const cacheKey = getCacheKey("restaurant:menu", `${restaurantId}:public:${language}`);
  const cached = await getCachedJson(cacheKey);
  if (cached !== null) return cached;

  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      menuItems: {
        where: { isAvailable: true, isDeleted: false },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
  // Don't surface empty categories on the public menu.
  const menu = categories
    .filter((category) => category.menuItems.length > 0)
    .map((category) => ({
      ...localizeMenu(category, language),
      menuItems: category.menuItems.map((item) => localizeMenu(item, language)),
    }));
  await setCachedJson(cacheKey, menu, 300);
  return menu;
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
