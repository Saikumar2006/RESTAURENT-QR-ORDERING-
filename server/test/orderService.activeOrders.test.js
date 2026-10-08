const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReceiptData, isActiveOrderStatus } = require('../src/services/orderService');

test('buildReceiptData includes table number for dine-in and omits it for takeaway', () => {
  const dineInOrder = {
    id: 'ord-1',
    orderNumber: 'ORD-1',
    createdAt: '2026-10-08T12:00:00.000Z',
    orderType: 'DINE_IN',
    table: { tableNumber: '5' },
    customerName: 'Alice',
    customerPhone: '+919999999999',
    paymentStatus: 'PAID',
    status: 'PREPARING',
    subtotal: 300,
    taxAmount: 27,
    discountAmount: 20,
    totalAmount: 307,
    items: [
      { itemName: 'Butter Naan', quantity: 2, unitPrice: 80, lineTotal: 160 },
      { itemName: 'Paneer', quantity: 1, unitPrice: 140, lineTotal: 140 },
    ],
  };

  const takeawayOrder = { ...dineInOrder, orderType: 'TAKEAWAY', table: null, items: [{ itemName: 'Coke', quantity: 1, unitPrice: 60, lineTotal: 60 }] };

  const dineIn = buildReceiptData(dineInOrder, { name: 'Royal Spices' });
  const takeaway = buildReceiptData(takeawayOrder, { name: 'Royal Spices' });

  assert.equal(dineIn.orderTypeLabel, 'DINE IN');
  assert.equal(dineIn.tableNumber, '5');
  assert.equal(takeaway.tableNumber, null);
  assert.equal(takeaway.orderTypeLabel, 'TAKEAWAY');
  assert.equal(takeaway.items[0].itemName, 'Coke');
});

test('order status is active unless it is completed or cancelled', () => {
  assert.equal(isActiveOrderStatus('PENDING'), true);
  assert.equal(isActiveOrderStatus('PREPARING'), true);
  assert.equal(isActiveOrderStatus('COMPLETED'), false);
  assert.equal(isActiveOrderStatus('CANCELLED'), false);
});
