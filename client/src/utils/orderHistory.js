// There's no customer login in this app — orders are tracked by a
// per-order orderSessionToken (see OrderTracking.jsx). This persists that
// token (plus a light summary for display) to localStorage, scoped per
// restaurant slug, so a customer can revisit "My Orders" later, refresh
// the tracking page without losing it, and use "Order Again".
//
// This is best-effort, device-local history — clearing browser storage or
// switching devices loses it, same as any guest-checkout flow with no
// account.
const STORAGE_KEY = "qr_order_history";
const MAX_ORDERS_PER_RESTAURANT = 20;

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// order: { id, orderNumber, orderSessionToken, totalAmount, items, createdAt }
export function saveOrderToHistory(slug, order) {
  const all = readAll();
  const list = all[slug] || [];
  const withoutDupe = list.filter((o) => o.id !== order.id);
  const entry = {
    id: order.id,
    orderNumber: order.orderNumber,
    orderSessionToken: order.orderSessionToken,
    totalAmount: order.totalAmount,
    items: (order.items || []).map((i) => ({
      menuItemId: i.menuItemId,
      name: i.itemName || i.name,
      quantity: i.quantity,
    })),
    createdAt: order.createdAt || new Date().toISOString(),
  };
  all[slug] = [entry, ...withoutDupe].slice(0, MAX_ORDERS_PER_RESTAURANT);
  writeAll(all);
}

export function getOrderHistory(slug) {
  const all = readAll();
  return all[slug] || [];
}

export function getStoredOrder(slug, orderId) {
  return getOrderHistory(slug).find((o) => o.id === orderId) || null;
}

// Cross-references a past order's items against the CURRENT live menu
// (menuCategories = the array returned by GET /public/restaurants/:slug/menu)
// rather than blindly re-adding stale snapshot data — items may have been
// removed, repriced, or marked unavailable since the order was placed.
// Returns { toAdd: [{menuItem, quantity}], skipped: [name, ...] }.
export function buildReorderPlan(historyItems, menuCategories) {
  const byId = new Map();
  (menuCategories || []).forEach((cat) => (cat.menuItems || []).forEach((mi) => byId.set(mi.id, mi)));

  const toAdd = [];
  const skipped = [];
  (historyItems || []).forEach((hi) => {
    const live = byId.get(hi.menuItemId);
    if (live && live.isAvailable) {
      toAdd.push({ menuItem: live, quantity: hi.quantity });
    } else {
      skipped.push(hi.name);
    }
  });
  return { toAdd, skipped };
}
