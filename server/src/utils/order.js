// Human-friendly, still-unique-enough order numbers, e.g. ORD-20260822-4F91.
function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `ORD-${y}${m}${d}-${rand}`;
}

// The only place order totals are computed. Never trust client-sent totals.
function computeTotals({ lineItems, taxPercent, serviceChargePercent, discountAmount = 0 }) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
  const taxAmount = round2((subtotal * Number(taxPercent)) / 100);
  const serviceCharge = round2((subtotal * Number(serviceChargePercent)) / 100);
  const discount = round2(Math.min(discountAmount, subtotal));
  const totalAmount = round2(subtotal + taxAmount + serviceCharge - discount);
  return {
    subtotal: round2(subtotal),
    taxAmount,
    serviceCharge,
    discountAmount: discount,
    totalAmount,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Order state machine — the only transitions allowed for restaurant staff/admin.
const ALLOWED_TRANSITIONS = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

module.exports = { generateOrderNumber, computeTotals, round2, canTransition, ALLOWED_TRANSITIONS };
