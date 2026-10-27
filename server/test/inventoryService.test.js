const test = require("node:test");
const assert = require("node:assert/strict");
const inventoryService = require("../src/services/inventoryService");
const { inventoryItemCreateSchema, inventoryMovementSchema, recipeComponentsSchema } = require("../src/validators/schemas");

function fakeDatabase() {
  const state = {
    item: { id: "item-a", restaurantId: "restaurant-a", name: "Flour", baseUnit: "g", quantity: 0, lowStockThreshold: 0, isActive: true, conversions: [{ id: "conversion-a", unitName: "kg", multiplierToBase: 1000 }] },
    movements: [],
  };
  const database = {
    $transaction: (callback) => callback(database),
    inventoryItem: {
      async findFirst({ where }) { return where.restaurantId === state.item.restaurantId && where.id === state.item.id && (!where.isActive || state.item.isActive) ? structuredClone(state.item) : null; },
      async updateMany({ where, data }) {
        if (where.restaurantId !== state.item.restaurantId || where.id !== state.item.id || where.quantity !== state.item.quantity) return { count: 0 };
        state.item.quantity = data.quantity;
        return { count: 1 };
      },
    },
    inventoryMovement: {
      async findFirst({ where }) { return state.movements.find((movement) => movement.restaurantId === where.restaurantId && movement.idempotencyKey === where.idempotencyKey) || null; },
      async create({ data }) { const created = { id: `movement-${state.movements.length + 1}`, ...data }; state.movements.push(created); return created; },
    },
  };
  return { database, state };
}

test("inventory item and recipe validators enforce positive units and unique mappings", () => {
  assert.equal(inventoryItemCreateSchema.safeParse({ name: "Flour", baseUnit: "g", conversions: [{ unitName: "kg", multiplierToBase: 1000 }] }).success, true);
  assert.equal(inventoryItemCreateSchema.safeParse({ name: "Flour", baseUnit: "g", conversions: [{ unitName: "kg", multiplierToBase: 0 }] }).success, false);
  assert.equal(inventoryMovementSchema.safeParse({ type: "ADJUSTMENT", quantity: 1, reason: "Count correction", idempotencyKey: "ab5e3d1e-9ad3-41a9-b984-8cc80a43b386" }).success, false);
  assert.equal(recipeComponentsSchema.safeParse({ components: [{ inventoryItemId: "e63ce29b-1aa3-4486-a40a-70f407cb6a82", quantityPerItem: 2 }, { inventoryItemId: "e63ce29b-1aa3-4486-a40a-70f407cb6a82", quantityPerItem: 3 }] }).success, false);
});

test("stock receipts convert units and an idempotent retry does not duplicate stock", async () => {
  const { database, state } = fakeDatabase();
  const input = { type: "RECEIPT", quantity: 1, unit: "kg", reason: "Supplier delivery", idempotencyKey: "ab5e3d1e-9ad3-41a9-b984-8cc80a43b386" };
  const first = await inventoryService.postMovement("restaurant-a", "user-a", "item-a", input, database);
  const retry = await inventoryService.postMovement("restaurant-a", "user-a", "item-a", input, database);
  assert.equal(first.quantityDelta, 1000);
  assert.equal(state.item.quantity, 1000);
  assert.equal(state.movements.length, 1);
  assert.equal(retry.duplicate, true);
});

test("inventory movement rejects cross-tenant writes and stock below zero", async () => {
  const { database, state } = fakeDatabase();
  await assert.rejects(inventoryService.postMovement("restaurant-b", "user-b", "item-a", {
    type: "RECEIPT", quantity: 1, reason: "Other tenant", idempotencyKey: "ab5e3d1e-9ad3-41a9-b984-8cc80a43b386",
  }, database), { status: 404 });
  await assert.rejects(inventoryService.postMovement("restaurant-a", "user-a", "item-a", {
    type: "WASTE", quantity: 1, reason: "Spoilage", idempotencyKey: "3cbdf640-718f-47a3-971a-bb5ddebf4785",
  }, database), { status: 409 });
  assert.equal(state.item.quantity, 0);
  assert.equal(state.movements.length, 0);
});

test("concurrent adjustments use optimistic stock checks so only one conflicting write wins", async () => {
  const { database, state } = fakeDatabase();
  state.item.quantity = 10;
  const changes = [
    inventoryService.postMovement("restaurant-a", "user-a", "item-a", { type: "WASTE", quantity: 7, reason: "Prep waste", idempotencyKey: "c63b9911-5f64-4b48-bc92-3d794320b395" }, database),
    inventoryService.postMovement("restaurant-a", "user-a", "item-a", { type: "WASTE", quantity: 7, reason: "Prep waste", idempotencyKey: "4dcc53eb-7d7b-42d9-b0c5-a5e41414ed92" }, database),
  ];
  const results = await Promise.allSettled(changes);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(results.filter((entry) => entry.status === "rejected").length, 1);
  assert.equal(state.item.quantity, 3);
});

test("accepting an order consumes mapped stock once and cancellation restocks once", async () => {
  const state = {
    quantity: 100,
    movements: [],
    order: {
      orderNumber: "S-1001",
      items: [{ quantity: 2, menuItem: { recipeComponents: [{ inventoryItemId: "item-a", quantityPerItem: 5, inventoryItem: { baseUnit: "g" } }] } }],
    },
  };
  const database = {
    $transaction: (callback) => callback(database),
    order: { async findFirst() { return state.order; } },
    inventoryItem: {
      async findFirst({ where }) { return where.restaurantId === "restaurant-a" && where.id === "item-a" ? { id: "item-a", restaurantId: "restaurant-a", baseUnit: "g", quantity: state.quantity, isActive: true, conversions: [] } : null; },
      async updateMany({ where, data }) {
        if (where.restaurantId !== "restaurant-a" || where.id !== "item-a" || where.quantity !== state.quantity) return { count: 0 };
        state.quantity = data.quantity;
        return { count: 1 };
      },
    },
    inventoryMovement: {
      async findFirst({ where }) { return state.movements.find((movement) => movement.restaurantId === where.restaurantId && movement.idempotencyKey === where.idempotencyKey) || null; },
      async findMany({ where }) { return state.movements.filter((movement) => movement.restaurantId === where.restaurantId && movement.referenceId === where.referenceId && movement.type === where.type); },
      async create({ data }) { const movement = { id: `move-${state.movements.length + 1}`, ...data }; state.movements.push(movement); return movement; },
    },
  };

  await inventoryService.applyOrderInventory("restaurant-a", "order-a", "ACCEPTED", database);
  await inventoryService.applyOrderInventory("restaurant-a", "order-a", "ACCEPTED", database);
  assert.equal(state.quantity, 90);
  assert.equal(state.movements.filter((movement) => movement.type === "ORDER_CONSUMPTION").length, 1);

  await inventoryService.applyOrderInventory("restaurant-a", "order-a", "CANCELLED", database);
  await inventoryService.applyOrderInventory("restaurant-a", "order-a", "CANCELLED", database);
  assert.equal(state.quantity, 100);
  assert.equal(state.movements.filter((movement) => movement.type === "CANCELLATION_RESTOCK").length, 1);
});
