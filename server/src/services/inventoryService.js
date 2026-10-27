const prisma = require("../config/db");
const { ApiError } = require("../utils/http");

const MANUAL_MOVEMENT_TYPES = new Set(["RECEIPT", "ADJUSTMENT", "WASTE"]);

function roundQuantity(value) {
  return Number(Number(value).toFixed(6));
}

async function listItems(restaurantId, database = prisma) {
  const items = await database.inventoryItem.findMany({
    where: { restaurantId },
    include: {
      conversions: { orderBy: { unitName: "asc" } },
      recipes: { include: { menuItem: { select: { id: true, name: true } } } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return items.map((item) => ({ ...item, lowStock: item.quantity <= item.lowStockThreshold }));
}

async function addMovementInTransaction({ restaurantId, inventoryItemId, createdById, type, quantityDelta, unit, reason, referenceId, idempotencyKey }, database) {
  if (idempotencyKey) {
    const existing = await database.inventoryMovement.findFirst({ where: { restaurantId, idempotencyKey } });
    if (existing) return { ...existing, duplicate: true };
  }
  const item = await database.inventoryItem.findFirst({
    where: { id: inventoryItemId, restaurantId, isActive: true },
    include: { conversions: true },
  });
  if (!item) throw new ApiError(404, "Inventory item not found or inactive");
  const normalizedUnit = (unit || item.baseUnit).trim().toLowerCase();
  const multiplier = normalizedUnit === item.baseUnit.toLowerCase()
    ? 1
    : item.conversions.find((conversion) => conversion.unitName.toLowerCase() === normalizedUnit)?.multiplierToBase;
  if (!multiplier) throw new ApiError(400, `No conversion is configured from ${unit} to ${item.baseUnit}`);
  const delta = roundQuantity(Number(quantityDelta) * multiplier);
  if (!Number.isFinite(delta) || delta === 0) throw new ApiError(400, "Stock change must be a finite, non-zero quantity");
  const before = roundQuantity(item.quantity);
  const after = roundQuantity(before + delta);
  if (after < -0.000001) throw new ApiError(409, "This stock change would make inventory negative");
  const updated = await database.inventoryItem.updateMany({
    where: { id: inventoryItemId, restaurantId, quantity: item.quantity, isActive: true },
    data: { quantity: Math.max(0, after) },
  });
  if (updated.count !== 1) throw new ApiError(409, "Inventory changed during this update. Refresh and retry.");
  return database.inventoryMovement.create({
    data: {
      restaurantId,
      inventoryItemId,
      createdById: createdById || null,
      type,
      quantityDelta: delta,
      quantityBefore: before,
      quantityAfter: Math.max(0, after),
      unit: item.baseUnit,
      reason: reason.trim(),
      referenceId: referenceId || null,
      idempotencyKey: idempotencyKey || null,
    },
  });
}

async function createItem(restaurantId, actorId, input, database = prisma) {
  return database.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        restaurantId,
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        baseUnit: input.baseUnit.trim(),
        quantity: 0,
        lowStockThreshold: input.lowStockThreshold ?? 0,
        conversions: { create: (input.conversions || []).map((conversion) => ({ unitName: conversion.unitName.trim().toLowerCase(), multiplierToBase: conversion.multiplierToBase })) },
      },
    });
    if (input.initialQuantity > 0) {
      await addMovementInTransaction({
        restaurantId, inventoryItemId: item.id, createdById: actorId, type: "RECEIPT",
        quantityDelta: input.initialQuantity, unit: item.baseUnit, reason: "Opening stock",
        idempotencyKey: `inventory:init:${item.id}`,
      }, tx);
    }
    return tx.inventoryItem.findUnique({ where: { id: item.id }, include: { conversions: true, recipes: true } });
  });
}

async function updateItem(restaurantId, itemId, input, database = prisma) {
  const item = await database.inventoryItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!item) throw new ApiError(404, "Inventory item not found");
  return database.$transaction(async (tx) => {
    const data = {};
    for (const key of ["name", "sku", "lowStockThreshold", "isActive"]) {
      if (input[key] !== undefined) data[key] = key === "name" ? input[key].trim() : key === "sku" ? input[key]?.trim() || null : input[key];
    }
    await tx.inventoryItem.update({ where: { id: itemId }, data });
    if (input.conversions) {
      await tx.inventoryUnitConversion.deleteMany({ where: { inventoryItemId: itemId } });
      if (input.conversions.length) await tx.inventoryUnitConversion.createMany({ data: input.conversions.map((conversion) => ({ inventoryItemId: itemId, unitName: conversion.unitName.trim().toLowerCase(), multiplierToBase: conversion.multiplierToBase })) });
    }
    return tx.inventoryItem.findFirst({ where: { id: itemId, restaurantId }, include: { conversions: true } });
  });
}

async function postMovement(restaurantId, actorId, itemId, input, database = prisma) {
  if (!MANUAL_MOVEMENT_TYPES.has(input.type)) throw new ApiError(400, "Movement type is invalid");
  let delta = Number(input.quantity);
  if (input.type === "WASTE") delta = -Math.abs(delta);
  if (input.type === "RECEIPT") delta = Math.abs(delta);
  if (input.type === "ADJUSTMENT" && input.direction === "REMOVE") delta = -Math.abs(delta);
  if (input.type === "ADJUSTMENT" && input.direction === "ADD") delta = Math.abs(delta);
  try {
    return await database.$transaction((tx) => addMovementInTransaction({
      restaurantId, inventoryItemId: itemId, createdById: actorId, type: input.type,
      quantityDelta: delta, unit: input.unit || "", reason: input.reason,
      idempotencyKey: input.idempotencyKey || null,
    }, tx));
  } catch (error) {
    if (error.code === "P2002" && input.idempotencyKey) {
      const existing = await database.inventoryMovement.findFirst({ where: { restaurantId, idempotencyKey: input.idempotencyKey } });
      if (existing) return { ...existing, duplicate: true };
    }
    throw error;
  }
}

async function listMovements(restaurantId, itemId, limit = 100, database = prisma) {
  const item = await database.inventoryItem.findFirst({ where: { id: itemId, restaurantId }, select: { id: true } });
  if (!item) throw new ApiError(404, "Inventory item not found");
  return database.inventoryMovement.findMany({
    where: { restaurantId, inventoryItemId: itemId },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(Number(limit) || 100, 200)),
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

async function listSuppliers(restaurantId, database = prisma) {
  return database.inventorySupplier.findMany({
    where: { restaurantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

async function createSupplier(restaurantId, input, database = prisma) {
  try {
    return await database.inventorySupplier.create({
      data: {
        restaurantId,
        name: input.name.trim(),
        contactName: input.contactName?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A supplier with this name already exists.");
    throw error;
  }
}

async function updateSupplier(restaurantId, supplierId, input, database = prisma) {
  const existing = await database.inventorySupplier.findFirst({ where: { id: supplierId, restaurantId }, select: { id: true } });
  if (!existing) throw new ApiError(404, "Supplier not found.");
  try {
    return await database.inventorySupplier.update({
      where: { id: supplierId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim().toLowerCase() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A supplier with this name already exists.");
    throw error;
  }
}

async function listPurchases(restaurantId, limit = 50, database = prisma) {
  return database.inventoryPurchase.findMany({
    where: { restaurantId },
    take: Math.max(1, Math.min(Number(limit) || 50, 100)),
    orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
    include: {
      supplier: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      lines: { include: { inventoryItem: { select: { id: true, name: true, baseUnit: true } } } },
    },
  });
}

async function createPurchase(restaurantId, actorId, input, database = prisma) {
  const where = { restaurantId, idempotencyKey: input.idempotencyKey };
  const include = { supplier: { select: { id: true, name: true } }, lines: true };
  const prior = await database.inventoryPurchase.findFirst({ where, include });
  if (prior) return { ...prior, duplicate: true };
  try {
    return await database.$transaction(async (tx) => {
      if (input.supplierId) {
        const supplier = await tx.inventorySupplier.findFirst({ where: { id: input.supplierId, restaurantId, isActive: true }, select: { id: true } });
        if (!supplier) throw new ApiError(404, "Supplier not found or inactive.");
      }
      const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { currency: true } });
      if (!restaurant) throw new ApiError(404, "Restaurant not found.");
      const purchase = await tx.inventoryPurchase.create({
        data: {
          restaurantId,
          supplierId: input.supplierId || null,
          createdById: actorId || null,
          invoiceNumber: input.invoiceNumber?.trim() || null,
          notes: input.notes?.trim() || null,
          currency: restaurant.currency,
          idempotencyKey: input.idempotencyKey,
          purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : new Date(),
        },
      });
      let totalCost = 0;
      for (const line of input.lines) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: line.inventoryItemId, restaurantId, isActive: true },
          include: { conversions: true },
        });
        if (!item) throw new ApiError(404, "A purchase stock item was not found or is inactive.");
        const unit = line.unit?.trim() || item.baseUnit;
        const normalizedUnit = unit.toLowerCase();
        const multiplier = normalizedUnit === item.baseUnit.toLowerCase()
          ? 1
          : item.conversions.find((conversion) => conversion.unitName.toLowerCase() === normalizedUnit)?.multiplierToBase;
        if (!multiplier) throw new ApiError(400, `No conversion is configured from ${unit} to ${item.baseUnit}.`);
        const movement = await addMovementInTransaction({
          restaurantId,
          inventoryItemId: item.id,
          createdById: actorId,
          type: "RECEIPT",
          quantityDelta: line.quantity,
          unit,
          reason: `Purchase ${input.invoiceNumber?.trim() || purchase.id}`,
          referenceId: purchase.id,
          idempotencyKey: `purchase:${purchase.id}:item:${item.id}`,
        }, tx);
        await tx.inventoryPurchaseLine.create({
          data: {
            purchaseId: purchase.id,
            inventoryItemId: item.id,
            movementId: movement.id,
            quantity: Number(movement.quantityDelta),
            unit: movement.unit,
            unitCost: line.unitCost === undefined ? null : Number(line.unitCost) / multiplier,
          },
        });
        if (line.unitCost !== undefined) totalCost += Number(movement.quantityDelta) * (Number(line.unitCost) / multiplier);
      }
      return tx.inventoryPurchase.update({ where: { id: purchase.id }, data: { totalCost }, include });
    }, { timeout: 20000 });
  } catch (error) {
    if (error.code === "P2002") {
      const duplicate = await database.inventoryPurchase.findFirst({ where, include });
      if (duplicate) return { ...duplicate, duplicate: true };
    }
    throw error;
  }
}

async function getReport(restaurantId, from, to, database = prisma) {
  const start = from ? new Date(from) : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    throw new ApiError(400, "Choose a valid inventory report date range.");
  }
  if (end.getTime() - start.getTime() > 90 * 24 * 60 * 60 * 1000) {
    throw new ApiError(400, "Inventory reports support ranges up to 90 days.");
  }
  const [items, movementGroups, purchases, restaurant] = await Promise.all([
    database.inventoryItem.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true, baseUnit: true, quantity: true, lowStockThreshold: true },
      orderBy: { name: "asc" },
    }),
    database.inventoryMovement.groupBy({
      by: ["type"],
      where: { restaurantId, createdAt: { gte: start, lte: end } },
      _count: { _all: true },
      _sum: { quantityDelta: true },
    }),
    database.inventoryPurchase.aggregate({
      where: { restaurantId, purchasedAt: { gte: start, lte: end } },
      _count: { _all: true },
      _sum: { totalCost: true },
    }),
    database.restaurant.findUnique({ where: { id: restaurantId }, select: { currency: true } }),
  ]);
  const lowStockItems = items.filter((item) => item.quantity <= item.lowStockThreshold);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    currency: restaurant?.currency || "INR",
    stockItemCount: items.length,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    movements: Object.fromEntries(movementGroups.map((group) => [group.type, {
      count: group._count._all,
      quantityDelta: group._sum.quantityDelta || 0,
    }])),
    purchases: { count: purchases._count._all, totalCost: purchases._sum.totalCost || 0 },
  };
}

async function setRecipe(restaurantId, menuItemId, components, database = prisma) {
  const menuItem = await database.menuItem.findFirst({ where: { id: menuItemId, restaurantId }, select: { id: true } });
  if (!menuItem) throw new ApiError(404, "Menu item not found");
  const stockItems = components.length ? await database.inventoryItem.findMany({ where: { id: { in: components.map((component) => component.inventoryItemId) }, restaurantId, isActive: true }, select: { id: true } }) : [];
  if (stockItems.length !== new Set(components.map((component) => component.inventoryItemId)).size) throw new ApiError(400, "A recipe ingredient is unavailable in this restaurant");
  return database.$transaction(async (tx) => {
    await tx.recipeComponent.deleteMany({ where: { restaurantId, menuItemId } });
    if (components.length) await tx.recipeComponent.createMany({ data: components.map((component) => ({ restaurantId, menuItemId, inventoryItemId: component.inventoryItemId, quantityPerItem: component.quantityPerItem })) });
    return tx.recipeComponent.findMany({ where: { restaurantId, menuItemId }, include: { inventoryItem: { select: { id: true, name: true, baseUnit: true } } } });
  });
}

async function applyOrderInventory(restaurantId, orderId, targetStatus, database) {
  if (targetStatus === "ACCEPTED") {
    const order = await database.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                recipeComponents: {
                  where: { restaurantId },
                  include: { inventoryItem: { select: { baseUnit: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!order) throw new ApiError(404, "Order not found");
    const needed = new Map();
    for (const line of order.items) {
      for (const recipe of line.menuItem.recipeComponents) {
        const current = needed.get(recipe.inventoryItemId) || { quantity: 0, unit: recipe.inventoryItem.baseUnit };
        current.quantity += Number(recipe.quantityPerItem) * line.quantity;
        needed.set(recipe.inventoryItemId, current);
      }
    }
    for (const [inventoryItemId, use] of needed) {
      await addMovementInTransaction({
        restaurantId, inventoryItemId, type: "ORDER_CONSUMPTION", quantityDelta: -use.quantity,
        unit: use.unit, reason: `Order ${order.orderNumber} accepted`, referenceId: orderId,
        idempotencyKey: `order:${orderId}:consume:${inventoryItemId}`,
      }, database);
    }
  }

  if (targetStatus === "CANCELLED") {
    const consumed = await database.inventoryMovement.findMany({ where: { restaurantId, referenceId: orderId, type: "ORDER_CONSUMPTION" } });
    for (const movement of consumed) {
      await addMovementInTransaction({
        restaurantId, inventoryItemId: movement.inventoryItemId, type: "CANCELLATION_RESTOCK",
        quantityDelta: Math.abs(movement.quantityDelta), unit: movement.unit,
        reason: `Restock cancelled order ${orderId}`, referenceId: orderId,
        idempotencyKey: `order:${orderId}:restock:${movement.inventoryItemId}`,
      }, database);
    }
  }
}

module.exports = {
  listItems, createItem, updateItem, postMovement, listMovements,
  listSuppliers, createSupplier, updateSupplier, listPurchases, createPurchase, getReport,
  setRecipe, applyOrderInventory, addMovementInTransaction,
};
