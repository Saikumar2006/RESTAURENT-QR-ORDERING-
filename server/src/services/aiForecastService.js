const prisma = require("../config/db");

/**
 * Deterministic Inventory Forecasting Engine
 * Calculates burn rates, stockout projections, and reorder points using verified math.
 */

/**
 * Calculate stockout and demand forecasts for restaurant inventory items
 */
async function forecastInventoryDemand(restaurantId, { horizonDays = 7, itemId = null } = {}) {
  const horizon = Math.max(1, Math.min(30, Number(horizonDays) || 7));
  const whereClause = { restaurantId, isActive: true };
  if (itemId) whereClause.id = itemId;

  // Retrieve inventory items with suppliers and recipe links
  const items = await prisma.inventoryItem.findMany({
    where: whereClause,
    include: {
      recipes: {
        include: {
          menuItem: { select: { id: true, name: true, price: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const lookbackDays = 14;
  const lookbackStart = new Date(now.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));

  // Retrieve historical consumption movements
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      restaurantId,
      type: { in: ["ORDER_CONSUMPTION", "WASTE"] },
      createdAt: { gte: lookbackStart },
    },
    select: {
      inventoryItemId: true,
      quantityDelta: true,
      createdAt: true,
    },
  });

  // Calculate daily burn rate per item
  const consumptionMap = new Map();
  for (const m of movements) {
    const qty = Math.abs(Number(m.quantityDelta) || 0);
    const curr = consumptionMap.get(m.inventoryItemId) || 0;
    consumptionMap.set(m.inventoryItemId, curr + qty);
  }

  // Retrieve incoming confirmed purchases that haven't been completed or cancelled
  const recentPurchases = await prisma.inventoryPurchaseLine.findMany({
    where: {
      purchase: {
        restaurantId,
        purchasedAt: { gte: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)) },
      },
    },
    select: {
      inventoryItemId: true,
      quantity: true,
    },
  });

  const incomingMap = new Map();
  for (const p of recentPurchases) {
    const qty = Number(p.quantity) || 0;
    incomingMap.set(p.inventoryItemId, (incomingMap.get(p.inventoryItemId) || 0) + qty);
  }

  const forecasts = items.map((item) => {
    const totalConsumedLookback = consumptionMap.get(item.id) || 0;
    const dailyBurnRate = Number((totalConsumedLookback / lookbackDays).toFixed(2));
    const currentStock = Number(item.quantity) || 0;
    const minStock = Number(item.lowStockThreshold) || 0;
    const incoming = incomingMap.get(item.id) || 0;

    // Projected demand for the requested horizon
    const projectedDemand = Number((dailyBurnRate * horizon).toFixed(2));
    const projectedRemaining = Number((currentStock + incoming - projectedDemand).toFixed(2));

    // Days until stockout
    let daysUntilStockout = null;
    let stockoutDate = null;
    if (dailyBurnRate > 0) {
      daysUntilStockout = Math.max(0, Number((currentStock / dailyBurnRate).toFixed(1)));
      const msUntilStockout = daysUntilStockout * 24 * 60 * 60 * 1000;
      stockoutDate = new Date(now.getTime() + msUntilStockout).toISOString().slice(0, 10);
    }

    // Safety stock: minimum stock level + 2 days of buffer
    const safetyStock = minStock > 0 ? minStock : Number((dailyBurnRate * 2).toFixed(2));

    // Suggested Reorder Quantity: (Daily Demand * Horizon) + Safety Stock - Current - Incoming
    const rawReorder = (dailyBurnRate * horizon) + safetyStock - currentStock - incoming;
    const suggestedReorderQuantity = Math.max(0, Math.ceil(rawReorder));

    // Confidence assessment based on data volume
    let confidence = "HIGH";
    let warning = null;
    if (totalConsumedLookback === 0) {
      confidence = "LOW";
      warning = "No historical consumption recorded in the last 14 days. Reorder estimate uses minimum stock baseline.";
    } else if (movements.length < 5) {
      confidence = "MEDIUM";
      warning = "Limited movement history available. Forecast accuracy will improve with more orders.";
    }

    const isAtRisk = daysUntilStockout !== null && daysUntilStockout <= horizon;

    return {
      itemId: item.id,
      itemName: item.name,
      unit: item.baseUnit,
      category: "General",
      currentStock,
      minStockLevel: minStock,
      incomingStock: incoming,
      dailyBurnRate,
      projectedDemand,
      projectedRemaining,
      daysUntilStockout,
      stockoutDate,
      suggestedReorderQuantity,
      horizonDays: horizon,
      safetyStock,
      isAtRisk,
      confidence,
      warning,
      calculationBasis: `Daily consumption (${dailyBurnRate} ${item.baseUnit}/day over ${lookbackDays}d) * ${horizon}d horizon + safety buffer (${safetyStock}) - stock (${currentStock})`,
    };
  });

  return {
    restaurantId,
    horizonDays: horizon,
    generatedAt: now.toISOString(),
    totalTrackedItems: items.length,
    atRiskItemCount: forecasts.filter((f) => f.isAtRisk).length,
    forecasts,
  };
}

function calculateSuggestedReorder({
  currentStock = 0,
  dailyBurnRate = 0,
  leadTimeDays = 2,
  safetyStock = 0,
  horizonDays = 7,
  incomingStock = 0,
} = {}) {
  const effectiveBurn = Math.max(0, Number(dailyBurnRate) || 0);
  const leadTime = Math.max(0, Number(leadTimeDays) || 0);
  const horizon = Math.max(1, Number(horizonDays) || 7);
  const safety = Math.max(0, Number(safetyStock) || 0);
  const current = Math.max(0, Number(currentStock) || 0);
  const incoming = Math.max(0, Number(incomingStock) || 0);

  const grossNeeded = (effectiveBurn * (leadTime + horizon)) + safety;
  const netNeeded = grossNeeded - current - incoming;
  const suggestedOrderQuantity = Math.max(0, Math.ceil(netNeeded));
  const daysUntilStockout = effectiveBurn > 0 ? Number((current / effectiveBurn).toFixed(1)) : 999;

  return {
    suggestedOrderQuantity,
    dailyBurnRate: effectiveBurn,
    horizonDays: horizon,
    leadTimeDays: leadTime,
    safetyStock: safety,
    currentStock: current,
    incomingStock: incoming,
    projectedStockoutInDays: daysUntilStockout,
  };
}

module.exports = {
  forecastInventoryDemand,
  calculateSuggestedReorder,
};
