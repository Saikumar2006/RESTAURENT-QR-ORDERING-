const test = require("node:test");
const assert = require("node:assert/strict");
const inventoryService = require("../src/services/inventoryService");
const { inventoryPurchaseSchema, inventorySupplierCreateSchema } = require("../src/validators/schemas");

function purchaseDatabase() {
  const state = {
    item: { id: "item-a", restaurantId: "restaurant-a", baseUnit: "g", quantity: 0, isActive: true, conversions: [{ unitName: "kg", multiplierToBase: 1000 }] },
    suppliers: [{ id: "supplier-a", restaurantId: "restaurant-a", name: "Local Foods", isActive: true }],
    purchases: [],
    lines: [],
    movements: [],
  };
  const database = {
    async $transaction(callback) {
      const snapshot = structuredClone(state);
      try { return await callback(database); }
      catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
    restaurant: { async findUnique({ where }) { return where.id === "restaurant-a" ? { currency: "INR" } : null; } },
    inventorySupplier: {
      async findFirst({ where }) { return state.suppliers.find((entry) => entry.id === where.id && entry.restaurantId === where.restaurantId && entry.isActive) || null; },
    },
    inventoryItem: {
      async findFirst({ where }) { return where.id === state.item.id && where.restaurantId === state.item.restaurantId && state.item.isActive ? structuredClone(state.item) : null; },
      async updateMany({ where, data }) {
        if (where.id !== state.item.id || where.restaurantId !== state.item.restaurantId || where.quantity !== state.item.quantity) return { count: 0 };
        state.item.quantity = data.quantity;
        return { count: 1 };
      },
    },
    inventoryMovement: {
      async findFirst({ where }) { return state.movements.find((entry) => entry.restaurantId === where.restaurantId && entry.idempotencyKey === where.idempotencyKey) || null; },
      async create({ data }) { const movement = { id: `movement-${state.movements.length + 1}`, ...data }; state.movements.push(movement); return movement; },
    },
    inventoryPurchase: {
      async findFirst({ where }) { return state.purchases.find((entry) => entry.restaurantId === where.restaurantId && entry.idempotencyKey === where.idempotencyKey) || null; },
      async create({ data }) { const purchase = { id: `purchase-${state.purchases.length + 1}`, ...data }; state.purchases.push(purchase); return purchase; },
      async update({ where, data }) { const purchase = state.purchases.find((entry) => entry.id === where.id); Object.assign(purchase, data); return { ...purchase, lines: state.lines.filter((line) => line.purchaseId === purchase.id) }; },
    },
    inventoryPurchaseLine: {
      async create({ data }) { const line = { id: `line-${state.lines.length + 1}`, ...data }; state.lines.push(line); return line; },
    },
  };
  return { database, state };
}

const purchaseInput = (overrides = {}) => ({
  supplierId: "supplier-a",
  invoiceNumber: "INV-42",
  idempotencyKey: "d605b59c-792a-4b23-86de-89189c40fbac",
  lines: [{ inventoryItemId: "item-a", quantity: 1000, unit: "g", unitCost: 0.01 }],
  ...overrides,
});
test("supplier and purchase validators reject malformed and repeated stock lines", () => {
  assert.equal(supplierCreateValid({ name: "Local Foods", email: "orders@example.com" }), true);
  assert.equal(supplierCreateValid({ name: "x" }), false);
  assert.equal(inventoryPurchaseSchema.safeParse(purchaseInput({ lines: [
    { inventoryItemId: "e63ce29b-1aa3-4486-a40a-70f407cb6a82", quantity: 1 },
    { inventoryItemId: "e63ce29b-1aa3-4486-a40a-70f407cb6a82", quantity: 2 },
  ] })).success, false);
  assert.equal(inventoryPurchaseSchema.safeParse(purchaseInput({ lines: [{ inventoryItemId: "bad", quantity: -1 }] })).success, false);
});

function supplierCreateValid(value) { return inventorySupplierCreateSchema.safeParse(value).success; }

test("purchase receipt updates stock, keeps base-unit cost, and deduplicates retries", async () => {
  const { database, state } = purchaseDatabase();
  const first = await inventoryService.createPurchase("restaurant-a", "user-a", purchaseInput(), database);
  const retry = await inventoryService.createPurchase("restaurant-a", "user-a", purchaseInput(), database);
  assert.equal(state.item.quantity, 1000);
  assert.equal(state.movements.length, 1);
  assert.equal(state.lines.length, 1);
  assert.equal(state.lines[0].unitCost, 0.01);
  assert.equal(first.totalCost, 10);
  assert.equal(retry.duplicate, true);
});

test("purchase writes are tenant scoped and roll back if a line cannot be received", async () => {
  const { database, state } = purchaseDatabase();
  await assert.rejects(inventoryService.createPurchase("restaurant-b", "user-b", purchaseInput(), database), { status: 404 });
  await assert.rejects(inventoryService.createPurchase("restaurant-a", "user-a", purchaseInput({
    idempotencyKey: "f6cf01fc-044b-438d-b5ca-846944e436f6",
    supplierId: "supplier-other-tenant",
  }), database), { status: 404 });
  await assert.rejects(inventoryService.createPurchase("restaurant-a", "user-a", purchaseInput({
    idempotencyKey: "d479ad67-488c-4994-a613-2b7c6e52c48d",
    lines: [{ inventoryItemId: "item-other-tenant", quantity: 10 }],
  }), database), { status: 404 });
  assert.equal(state.item.quantity, 0);
  assert.equal(state.purchases.length, 0);
  assert.equal(state.movements.length, 0);
});

test("inventory report scopes stock, movement, and purchase totals to one restaurant and a bounded range", async () => {
  const queries = [];
  const from = "2026-10-01T00:00:00.000Z";
  const to = "2026-10-31T00:00:00.000Z";
  const report = await inventoryService.getReport("restaurant-a", from, to, {
    inventoryItem: { async findMany(query) { queries.push(query); return [
      { id: "low", name: "Rice", baseUnit: "kg", quantity: 2, lowStockThreshold: 5 },
      { id: "ok", name: "Oil", baseUnit: "l", quantity: 10, lowStockThreshold: 2 },
    ]; } },
    inventoryMovement: { async groupBy(query) { queries.push(query); return [{ type: "WASTE", _count: { _all: 2 }, _sum: { quantityDelta: -3 } }]; } },
    inventoryPurchase: { async aggregate(query) { queries.push(query); return { _count: { _all: 1 }, _sum: { totalCost: 250 } }; } },
    restaurant: { async findUnique(query) { queries.push(query); return { currency: "INR" }; } },
  });
  assert.equal(report.lowStockCount, 1);
  assert.equal(report.lowStockItems[0].name, "Rice");
  assert.equal(report.movements.WASTE.count, 2);
  assert.equal(report.purchases.totalCost, 250);
  assert.equal(report.currency, "INR");
  assert.ok(queries.every((query) => query.where.id === "restaurant-a" || query.where.restaurantId === "restaurant-a"));
  assert.ok(queries.some((query) => (query.where.createdAt?.gte || query.where.purchasedAt?.gte)?.toISOString() === from));
  await assert.rejects(inventoryService.getReport("restaurant-a", "invalid", to, {
    inventoryItem: { findMany() {} }, inventoryMovement: { groupBy() {} }, inventoryPurchase: { aggregate() {} }, restaurant: { findUnique() {} },
  }), { status: 400 });
});
