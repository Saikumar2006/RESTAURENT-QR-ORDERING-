import test from "node:test";
import assert from "node:assert/strict";
import { getStoredOrder, saveOrderToHistory, getOrderHistory } from "../src/utils/orderHistory.js";

// Mock localStorage for Node test runner
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

test("order history persists and retrieves the latest order on page refresh", () => {
  storage.clear();
  const slug = "spice-garden";
  const order1 = {
    id: "ord-1",
    orderNumber: "#101",
    orderType: "DINE_IN",
    paymentStatus: "PENDING",
    orderSessionToken: "tok-123",
    totalAmount: 450,
    items: [{ menuItemId: "m-1", itemName: "Paneer Tikka", quantity: 1 }],
  };

  saveOrderToHistory(slug, order1);

  // Exact orderId lookup works
  const found = getStoredOrder(slug, "ord-1");
  assert.ok(found);
  assert.equal(found.orderSessionToken, "tok-123");

  // Fallback to latest order when orderIdParam is undefined (e.g. /confirmation refresh)
  const history = getOrderHistory(slug);
  assert.equal(history.length, 1);
  assert.equal(history[0].id, "ord-1");
});
