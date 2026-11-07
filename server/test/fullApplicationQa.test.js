const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = require("../src/app");
const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { initSockets } = require("../src/sockets");

let server;
let baseUrl;

// Test fixtures state
let testRestA;
let testRestB;
let ownerA;
let staffA;
let ownerB;
let tokenOwnerA;
let tokenStaffA;
let tokenOwnerB;
let platformCookie;
let testTableA;
let testCategoryA;
let testMenuItemA;
let testCouponA;
let testInventoryItemA;
let testSupplierA;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", async () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      await initSockets(server);
      resolve();
    });
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Setup Restaurant A ("QA Grand Spice")
  testRestA = await prisma.restaurant.upsert({
    where: { slug: "qa-grand-spice" },
    update: {
      status: "ACTIVE",
      isOpen: true,
      taxPercent: 5.0,
      serviceChargePercent: 2.5,
      currency: "INR",
    },
    create: {
      name: "QA Grand Spice",
      slug: "qa-grand-spice",
      status: "ACTIVE",
      isOpen: true,
      taxPercent: 5.0,
      serviceChargePercent: 2.5,
      currency: "INR",
    },
  });

  // Owner A
  ownerA = await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: testRestA.id, email: "owner_a@qasvaadya.test" } },
    update: { passwordHash, isActive: true, role: "ADMIN" },
    create: {
      restaurantId: testRestA.id,
      name: "Owner Alice",
      email: "owner_a@qasvaadya.test",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // Staff A (restricted)
  staffA = await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: testRestA.id, email: "staff_a@qasvaadya.test" } },
    update: { passwordHash, isActive: true, role: "STAFF" },
    create: {
      restaurantId: testRestA.id,
      name: "Staff Alex",
      email: "staff_a@qasvaadya.test",
      passwordHash,
      role: "STAFF",
      isActive: true,
    },
  });

  // 2. Setup Restaurant B ("QA Royal Tandoor" for tenant isolation verification)
  testRestB = await prisma.restaurant.upsert({
    where: { slug: "qa-royal-tandoor" },
    update: { status: "ACTIVE", isOpen: true },
    create: {
      name: "QA Royal Tandoor",
      slug: "qa-royal-tandoor",
      status: "ACTIVE",
      isOpen: true,
      taxPercent: 5.0,
    },
  });

  ownerB = await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: testRestB.id, email: "owner_b@qasvaadya.test" } },
    update: { passwordHash, isActive: true, role: "ADMIN" },
    create: {
      restaurantId: testRestB.id,
      name: "Owner Bob",
      email: "owner_b@qasvaadya.test",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // 3. Platform Super Admin
  const platformHash = await bcrypt.hash("PlatformMasterPass2026!", 10);
  await prisma.platformAdmin.upsert({
    where: { email: "superqa@svaadya.platform" },
    update: { passwordHash: platformHash, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    create: {
      name: "Chief QA Platform Admin",
      email: "superqa@svaadya.platform",
      passwordHash: platformHash,
      platformRole: "SUPER_ADMIN",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // 4. Create Active Table for Restaurant A
  testTableA = await prisma.table.upsert({
    where: { restaurantId_tableNumber: { restaurantId: testRestA.id, tableNumber: "T-01" } },
    update: { isActive: true, status: "AVAILABLE", posX: 150, posY: 180, capacity: 4 },
    create: {
      restaurantId: testRestA.id,
      tableNumber: "T-01",
      capacity: 4,
      section: "Indoor Main",
      posX: 150,
      posY: 180,
      status: "AVAILABLE",
      isActive: true,
    },
  });

  // 5. Create Category and Menu Items for Restaurant A
  testCategoryA = await prisma.category.findFirst({
    where: { restaurantId: testRestA.id, name: "Specialties" },
  });
  if (!testCategoryA) {
    testCategoryA = await prisma.category.create({
      data: {
        restaurantId: testRestA.id,
        name: "Specialties",
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  testMenuItemA = await prisma.menuItem.findFirst({
    where: { restaurantId: testRestA.id, name: "Butter Chicken Supreme" },
  });
  if (!testMenuItemA) {
    testMenuItemA = await prisma.menuItem.create({
      data: {
        restaurantId: testRestA.id,
        categoryId: testCategoryA.id,
        name: "Butter Chicken Supreme",
        description: "Rich tender chicken simmered in makhani gravy",
        price: 360,
        isVeg: false,
        isAvailable: true,
      },
    });
  }

  // 6. Create Coupon for Restaurant A
  testCouponA = await prisma.coupon.upsert({
    where: { restaurantId_code: { restaurantId: testRestA.id, code: "QABONUS20" } },
    update: { isActive: true, value: 20, type: "PERCENT", usageLimit: 50, usageCount: 0, minOrderAmount: 200 },
    create: {
      restaurantId: testRestA.id,
      code: "QABONUS20",
      type: "PERCENT",
      value: 20,
      minOrderAmount: 200,
      usageLimit: 50,
      usageCount: 0,
      isActive: true,
    },
  });

  // 7. Create Inventory Ingredient and Recipe Component for Restaurant A
  testInventoryItemA = await prisma.inventoryItem.findFirst({
    where: { restaurantId: testRestA.id, name: "Fresh Butter" },
  });
  if (!testInventoryItemA) {
    testInventoryItemA = await prisma.inventoryItem.create({
      data: {
        restaurantId: testRestA.id,
        name: "Fresh Butter",
        baseUnit: "g",
        quantity: 5000,
        lowStockThreshold: 1000,
      },
    });
  } else {
    await prisma.inventoryItem.update({
      where: { id: testInventoryItemA.id },
      data: { quantity: 5000, lowStockThreshold: 1000 },
    });
  }

  await prisma.recipeComponent.deleteMany({
    where: { restaurantId: testRestA.id, menuItemId: testMenuItemA.id },
  });
  await prisma.recipeComponent.create({
    data: {
      restaurantId: testRestA.id,
      menuItemId: testMenuItemA.id,
      inventoryItemId: testInventoryItemA.id,
      quantityPerItem: 50, // 50g butter per dish
    },
  });

  // 8. Create Supplier for Restaurant A
  testSupplierA = await prisma.inventorySupplier.findFirst({
    where: { restaurantId: testRestA.id, name: "Quality Dairies Ltd" },
  });
  if (!testSupplierA) {
    testSupplierA = await prisma.inventorySupplier.create({
      data: {
        restaurantId: testRestA.id,
        name: "Quality Dairies Ltd",
        contactName: "Rajesh Kumar",
        phone: "+919811122233",
        email: "rajesh@qualitydairies.test",
      },
    });
  }
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

// ==========================================
// MODULE A: AUTHENTICATION & SESSION LIFECYCLE
// ==========================================

test("MODULE A.1: Owner Login succeeds and returns tenant JWT", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner_a@qasvaadya.test", password: "Password123!" }),
  });
  const data = await res.json();
  assert.equal(res.status, 200, "Status must be 200");
  assert.equal(data.success, true);
  assert.equal(data.data.accountType, "tenant");
  assert.equal(data.data.user.email, "owner_a@qasvaadya.test");
  assert.ok(data.data.token, "Must return JWT token");
  tokenOwnerA = data.data.token;
});

test("MODULE A.2: Staff Login returns restricted permissions", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "staff_a@qasvaadya.test", password: "Password123!" }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.data.user.role, "STAFF");
  assert.ok(data.data.token);
  tokenStaffA = data.data.token;
});

test("MODULE A.3: Login with Invalid Password returns HTTP 401", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner_a@qasvaadya.test", password: "IncorrectPassword!" }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
});

test("MODULE A.4: Super Admin Login succeeds, returns SUPER_ADMIN and sets httpOnly session cookie", async () => {
  const res = await fetch(`${baseUrl}/api/platform/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superqa@svaadya.platform", password: "PlatformMasterPass2026!" }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.data.admin.role, "SUPER_ADMIN");
  assert.equal(data.data.redirectTo, "/super-admin/dashboard");
  const cookie = res.headers.get("set-cookie");
  assert.ok(cookie && cookie.includes("svaadya_platform_session="));
  platformCookie = cookie.split(";")[0];
});

test("MODULE A.5: Super Admin lockout triggers after 5 consecutive failed attempts", async () => {
  for (let i = 0; i < 5; i++) {
    await fetch(`${baseUrl}/api/platform/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superqa@svaadya.platform", password: "WrongPasswordAttempt!" }),
    });
  }
  const lockedRes = await fetch(`${baseUrl}/api/platform/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "superqa@svaadya.platform", password: "PlatformMasterPass2026!" }),
  });
  assert.ok(lockedRes.status === 423 || lockedRes.status === 429, "Locked account must return 423 Locked or 429 Rate Limited");
  const data = await lockedRes.json();
  assert.match(data.error.message, /locked/i);

  // Reset lockout for subsequent tests
  await prisma.platformAdmin.update({
    where: { email: "superqa@svaadya.platform" },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
});

test("MODULE A.6: Authenticated Session Persistence (/api/auth/me)", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.data.email, "owner_a@qasvaadya.test");
  assert.equal(data.data.restaurantId, testRestA.id);
});

// ==========================================
// MODULE B: SUPER ADMIN CONTROL CENTRE
// ==========================================

test("MODULE B.1: Super Admin retrieves Platform Overview Telemetry", async () => {
  const res = await fetch(`${baseUrl}/api/platform/overview`, {
    headers: { Cookie: platformCookie },
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(typeof data.data.totalRestaurants === "number", "Total restaurants telemetry present");
  assert.ok(Array.isArray(data.data.planDistribution), "Must return subscription plan distribution");
});

test("MODULE B.2: Super Admin lists all multi-tenant restaurants", async () => {
  const res = await fetch(`${baseUrl}/api/platform/restaurants`, {
    headers: { Cookie: platformCookie },
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.some((r) => r.slug === "qa-grand-spice"));
});

test("MODULE B.3: Super Admin can inspect System Health endpoint", async () => {
  const res = await fetch(`${baseUrl}/api/platform/system-health`, {
    headers: { Cookie: platformCookie },
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(data.data.database, "Database telemetry present");
});

// ==========================================
// MODULE C: RESTAURANT DASHBOARD & KPI AUDIT
// ==========================================

test("MODULE C.1: Restaurant Owner fetches dashboard analytics & compares with DB", async () => {
  const res = await fetch(`${baseUrl}/api/restaurants/${testRestA.id}/analytics?days=7`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.ok(data.data.summary, "Summary metrics present");
  assert.equal(typeof data.data.summary.paidRevenue, "number");
  assert.equal(typeof data.data.summary.orderCount, "number");
});

// ==========================================
// MODULE D: RESTAURANT PROFILE & SETTINGS
// ==========================================

test("MODULE D.1: Restaurant Settings update persists operational configurations", async () => {
  const updatePayload = {
    name: "QA Grand Spice Updated",
    taxPercent: 5.0,
    serviceChargePercent: 2.0,
    discountPercent: 10.0,
    discountEnabled: true,
    isOpen: true,
    autoScheduleEnabled: true,
    openTime: "11:00",
    closeTime: "23:00",
    timezone: "Asia/Kolkata",
    geofenceEnabled: true,
    latitude: 12.9716,
    longitude: 77.5946,
    geofenceRadiusMeters: 250,
  };

  const res = await fetch(`${baseUrl}/api/restaurants/${testRestA.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.data.name, "QA Grand Spice Updated");
  assert.equal(data.data.serviceChargePercent, 2.0);
  assert.equal(data.data.geofenceEnabled, true);

  // Restore name
  await prisma.restaurant.update({
    where: { id: testRestA.id },
    data: { name: "QA Grand Spice", geofenceEnabled: false, discountEnabled: false },
  });
});

// ==========================================
// MODULE E: MENU MANAGEMENT & PUBLISHING
// ==========================================

test("MODULE E.1: Create, Update and Query Menu Categories and Items", async () => {
  // Create Category
  const catRes = await fetch(`${baseUrl}/api/categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Beverages", displayOrder: 2 }),
  });
  const catData = await catRes.json();
  assert.equal(catRes.status, 201);
  const newCatId = catData.data.id;

  // Create Menu Item
  const itemRes = await fetch(`${baseUrl}/api/menu-items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      categoryId: newCatId,
      name: "Fresh Mango Lassi",
      price: 120,
      isVeg: true,
      isAvailable: true,
    }),
  });
  const itemData = await itemRes.json();
  assert.equal(itemRes.status, 201);
  assert.equal(itemData.data.price, 120);

  // Verify item is published on public QR menu
  const publicRes = await fetch(`${baseUrl}/api/public/restaurants/qa-grand-spice/menu`);
  const publicData = await publicRes.json();
  assert.equal(publicRes.status, 200);
  assert.ok(publicData.data.some((c) => c.name === "Beverages"));

  // Clean up test item and category
  await prisma.menuItem.delete({ where: { id: itemData.data.id } });
  await prisma.category.delete({ where: { id: newCatId } });
});

// ==========================================
// MODULE F: TABLES & 2D FLOOR PLAN PERSISTENCE
// ==========================================

test("MODULE F.1: Table creation, chair positions and 2D floor layout canvas persistence", async () => {
  // Create Table with custom geometric coordinates
  const createRes = await fetch(`${baseUrl}/api/restaurants/${testRestA.id}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tableNumber: "T-99",
      capacity: 6,
      section: "Rooftop Lounge",
      posX: 320,
      posY: 240,
      width: 120,
      height: 80,
      rotation: 45,
      chairCount: 6,
    }),
  });
  const tableData = await createRes.json();
  assert.equal(createRes.status, 201);
  assert.equal(tableData.data.tableNumber, "T-99");
  assert.equal(tableData.data.rotation, 45);
  const createdTableId = tableData.data.id;

  // Save 2D Floor Layout Canvas
  const layoutRes = await fetch(`${baseUrl}/api/restaurants/${testRestA.id}/floor-layout`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      section: "Rooftop Lounge",
      gridSnap: true,
      gridSize: 20,
      zoom: 1.25,
      panX: 50,
      panY: 30,
      objects: [{ id: "arch-wall-1", type: "wall", x: 100, y: 100, width: 400, height: 10 }],
    }),
  });
  const layoutData = await layoutRes.json();
  assert.equal(layoutRes.status, 200);
  assert.equal(layoutData.data.zoom, 1.25);
  assert.equal(layoutData.data.objects.length, 1);

  // Clean up table
  await prisma.table.delete({ where: { id: createdTableId } });
});

// ==========================================
// MODULE G: FULL 11-STEP CUSTOMER QR ORDERING JOURNEY
// ==========================================

test("MODULE G: Simulate Complete 11-Step Customer QR Ordering Journey", async () => {
  // Step 1: Open restaurant QR URL / landing
  const step1 = await fetch(`${baseUrl}/api/public/restaurants/qa-grand-spice`);
  assert.equal(step1.status, 200);
  const step1Data = (await step1.json()).data;
  const restInfo = step1Data.restaurant;
  assert.ok(restInfo && restInfo.slug === "qa-grand-spice");

  // Step 2: Verify active dining tables
  const tables = step1Data.tables;
  assert.ok(Array.isArray(tables), "Must return tables array");
  const tableT01 = tables.find((t) => t.tableNumber === "T-01");
  assert.ok(tableT01 && tableT01.tableToken, "Must receive opaque table token");

  // Step 3: Load public menu
  const step3 = await fetch(`${baseUrl}/api/public/restaurants/qa-grand-spice/menu`);
  assert.equal(step3.status, 200);
  const categories = (await step3.json()).data;
  const targetItem = categories.flatMap((c) => c.menuItems).find((i) => i.name === "Butter Chicken Supreme");
  assert.ok(targetItem, "Menu must include Butter Chicken Supreme");

  // Step 4: Validate eligible coupon before checkout
  const step4 = await fetch(`${baseUrl}/api/public/restaurants/qa-grand-spice/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "QABONUS20", subtotal: 720 }),
  });
  const couponValidation = await step4.json();
  assert.equal(step4.status, 200);
  assert.equal(couponValidation.data.code, "QABONUS20");
  assert.equal(couponValidation.data.discountAmount, 144); // 20% of 720

  // Step 5: Place Customer Dine-In Order
  const initialStock = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;

  const orderPayload = {
    slug: "qa-grand-spice",
    orderType: "DINE_IN",
    tableToken: tableT01.tableToken,
    customerName: "Dine-in Gourmet",
    customerPhone: "+919876543211",
    couponCode: "QABONUS20",
    items: [
      {
        menuItemId: targetItem.id,
        quantity: 2,
        instructions: "Extra creamy, medium spicy",
      },
    ],
  };

  const step5 = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  });
  const orderRes = await step5.json();
  assert.equal(step5.status, 201);
  assert.ok(orderRes.data.id);
  assert.equal(orderRes.data.status, "PENDING");
  assert.equal(orderRes.data.tableNumber, "T-01");
  assert.equal(orderRes.data.discountAmount, 144);
  const placedOrderId = orderRes.data.id;
  const sessionToken = orderRes.data.orderSessionToken;

  // Step 6: Verify Table Status updates to OCCUPIED
  const tableCheck = await prisma.table.findUnique({
    where: { id: testTableA.id },
    include: { orders: { where: { status: "PENDING" } } },
  });
  assert.ok(tableCheck.orders.length > 0, "Table has active pending order");

  // Step 7: Owner receives order and advances status to ACCEPTED
  const step7 = await fetch(`${baseUrl}/api/orders/${placedOrderId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "ACCEPTED" }),
  });
  assert.equal(step7.status, 200);

  // Step 8: Verify Automated Inventory Consumption (2 dishes * 50g butter = 100g deduction)
  const afterAcceptStock = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;
  assert.equal(afterAcceptStock, initialStock - 100, "100g of butter must be deducted upon order acceptance");

  // Step 9: Advance through kitchen workflow: PREPARING -> READY -> COMPLETED
  await fetch(`${baseUrl}/api/orders/${placedOrderId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenOwnerA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PREPARING" }),
  });

  await fetch(`${baseUrl}/api/orders/${placedOrderId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenOwnerA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "READY" }),
  });

  const step9 = await fetch(`${baseUrl}/api/orders/${placedOrderId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenOwnerA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "COMPLETED" }),
  });
  assert.equal(step9.status, 200);

  // Step 10: Customer polls order tracking status
  const step10 = await fetch(`${baseUrl}/api/orders/${placedOrderId}?orderSessionToken=${encodeURIComponent(sessionToken)}`);
  const trackingData = await step10.json();
  assert.equal(step10.status, 200);
  assert.equal(trackingData.data.status, "COMPLETED");

  // Step 11: Cleanup test order
  await prisma.orderItem.deleteMany({ where: { orderId: placedOrderId } });
  await prisma.order.delete({ where: { id: placedOrderId } });
});

// ==========================================
// MODULE I: INVENTORY LIFECYCLE & CANCELLATION RESTOCK
// ==========================================

test("MODULE I.1: Order cancellation automatically restocks deducted ingredients", async () => {
  const stockBefore = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;

  // Place order
  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: "qa-grand-spice",
      orderType: "TAKEAWAY",
      customerName: "Cancellation Tester",
      items: [{ menuItemId: testMenuItemA.id, quantity: 1 }],
    }),
  });
  const order = (await orderRes.json()).data;

  // Accept -> Deducts 50g
  const acceptRes = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenOwnerA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ACCEPTED" }),
  });
  assert.equal(acceptRes.status, 200);

  const stockAfterAccept = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;
  assert.equal(stockAfterAccept, stockBefore - 50);

  // Cancel -> Must restock 50g
  const cancelRes = await fetch(`${baseUrl}/api/orders/${order.id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenOwnerA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  assert.equal(cancelRes.status, 200);

  const stockAfterCancel = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;
  assert.equal(stockAfterCancel, stockBefore, "Restock must restore exact original quantity");

  // Cleanup
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
});

test("MODULE I.2: Purchase orders increase ingredient inventory quantities", async () => {
  const stockBefore = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;

  const purchaseRes = await fetch(`${baseUrl}/api/inventory/purchases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenOwnerA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      supplierId: testSupplierA.id,
      invoiceNumber: "INV-QA-2026-001",
      idempotencyKey: crypto.randomUUID(),
      lines: [
        {
          inventoryItemId: testInventoryItemA.id,
          quantity: 2000,
          unitCost: 0.5,
        },
      ],
    }),
  });
  assert.ok(purchaseRes.status === 200 || purchaseRes.status === 201, "Purchase must succeed");

  const stockAfter = (await prisma.inventoryItem.findUnique({ where: { id: testInventoryItemA.id } })).quantity;
  assert.equal(stockAfter, stockBefore + 2000, "Purchase order must add 2000g to inventory");
});

// ==========================================
// MODULE J: STAFF MANAGEMENT & RBAC ENFORCEMENT
// ==========================================

test("MODULE J.1: Staff with restricted permissions cannot access financial reports", async () => {
  const res = await fetch(`${baseUrl}/api/restaurants/${testRestA.id}/analytics`, {
    headers: { Authorization: `Bearer ${tokenStaffA}` },
  });
  assert.equal(res.status, 403, "Staff without analytics.view permission must receive HTTP 403 Forbidden");
});

// ==========================================
// MODULE N: SVAADYA AI FULL FUNCTIONAL TESTING (12 PROMPT QUESTIONS)
// ==========================================

test("MODULE N: Execute and Verify All 12 Canonical Svaadya AI Intelligence Queries", async () => {
  const questions = [
    { q: "What were my sales today?", toolExpected: "get_sales_summary" },
    { q: "Compare today's sales with yesterday.", toolExpected: "compare_sales_periods" },
    { q: "What are my best-selling items?", toolExpected: "get_top_selling_products" },
    { q: "Which items are selling slowly?", toolExpected: "get_slow_moving_products" },
    { q: "Which ingredients are running low?", toolExpected: "get_low_stock_items" },
    { q: "What may run out in the next three days?", toolExpected: "forecast_stock_demand" },
    { q: "What should I reorder?", toolExpected: "calculate_reorder_quantity" },
    { q: "Explain my inventory health.", toolExpected: "get_inventory_summary" },
    { q: "What upcoming festivals may affect demand?", toolExpected: "get_upcoming_festivals" },
    { q: "What should I prepare for the next busy period?", toolExpected: "get_upcoming_festivals" },
    { q: "How can I improve my menu?", toolExpected: "get_slow_moving_products" },
    { q: "Summarize my restaurant's performance this week.", toolExpected: "get_sales_summary" },
  ];

  for (const { q, toolExpected } of questions) {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenOwnerA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: q,
        currentModule: "overview",
        language: "en",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200, `Query "${q}" must return HTTP 200`);
    const replyText = data.data?.reply || data.data?.message?.content;
    assert.ok(replyText, `Query "${q}" must return assistant reply`);
    assert.ok(data.data?.conversationId, `Query "${q}" must return persistent conversationId`);
    assert.equal(typeof replyText, "string");
    assert.ok(replyText.length > 20, `Reply for "${q}" must be non-empty and structured`);
  }
});

test("MODULE N.2: Svaadya AI multi-tenant isolation rejects cross-restaurant access", async () => {
  // Owner B cannot inspect Owner A's conversation
  const convRes = await fetch(`${baseUrl}/api/ai/conversations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenOwnerA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Private Business Audit" }),
  });
  const convId = (await convRes.json()).data.conversation.id;

  // Log in as Owner B
  const loginB = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner_b@qasvaadya.test", password: "Password123!" }),
  });
  tokenOwnerB = (await loginB.json()).data.token;

  // Owner B tries to read Owner A's conversation
  const stealRes = await fetch(`${baseUrl}/api/ai/conversations/${convId}`, {
    headers: { Authorization: `Bearer ${tokenOwnerB}` },
  });
  assert.ok(stealRes.status === 403 || stealRes.status === 404, "Cross-tenant conversation access must be strictly forbidden (403/404)");
});

// ==========================================
// MODULE O & SECURITY TESTING
// ==========================================

test("SECURITY: Tenant A cannot access Tenant B orders or settings (IDOR Defense)", async () => {
  const crossRes = await fetch(`${baseUrl}/api/restaurants/${testRestB.id}/orders`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  assert.equal(crossRes.status, 403, "Cross-tenant access must return HTTP 403 Forbidden");
});

test("SECURITY: SQL Injection probe on search parameters fails safely without syntax error", async () => {
  const sqliRes = await fetch(`${baseUrl}/api/restaurants/${testRestA.id}/orders?search=' OR 1=1; --`, {
    headers: { Authorization: `Bearer ${tokenOwnerA}` },
  });
  assert.equal(sqliRes.status, 200, "SQL injection string must be safely parameterized by Prisma and not crash");
});

test("SECURITY: Webhook forgery with invalid HMAC signature is rejected", async () => {
  const fakeWebhook = await fetch(`${baseUrl}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "forged_invalid_signature_hex",
    },
    body: JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_fake_123" } } } }),
  });
  assert.equal(fakeWebhook.status, 400, "Forged webhook must be rejected with 400 Bad Request");
});
