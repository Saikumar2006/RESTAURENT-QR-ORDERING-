const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../src/app");
const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Ensure test restaurant A and B exist
  const passwordHash = await bcrypt.hash("password123", 10);
  const restA = await prisma.restaurant.upsert({
    where: { slug: "spice-garden" },
    update: {},
    create: { name: "Spice Garden", slug: "spice-garden" },
  });
  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restA.id, email: "admin@spicegarden.test" } },
    update: { passwordHash, isActive: true },
    create: { restaurantId: restA.id, name: "Admin Spice", email: "admin@spicegarden.test", passwordHash, role: "ADMIN", isActive: true },
  });
  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restA.id, email: "staff@spicegarden.test" } },
    update: { passwordHash, isActive: true },
    create: { restaurantId: restA.id, name: "Staff Spice", email: "staff@spicegarden.test", passwordHash, role: "STAFF", isActive: true },
  });

  const restB = await prisma.restaurant.upsert({
    where: { slug: "royal-curry" },
    update: {},
    create: { name: "Royal Curry", slug: "royal-curry" },
  });
  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restB.id, email: "admin@royalcurry.test" } },
    update: { passwordHash, isActive: true },
    create: { restaurantId: restB.id, name: "Admin Royal", email: "admin@royalcurry.test", passwordHash, role: "ADMIN", isActive: true },
  });

  // Ensure platform admin exists
  const platformHash = await bcrypt.hash("PlatformAdminPass123!", 10);
  await prisma.platformAdmin.upsert({
    where: { email: "platform@svaadya.test" },
    update: { passwordHash: platformHash, isActive: true },
    create: { name: "Platform Admin", email: "platform@svaadya.test", passwordHash: platformHash, platformRole: "SUPER_ADMIN", isActive: true },
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

// Scenario 1: Valid platform administrator login -> Super Admin Dashboard
test("Scenario 1: Valid platform administrator login returns SUPER_ADMIN role and platform dashboard redirect", async () => {
  const res = await fetch(`${baseUrl}/api/platform/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "platform@svaadya.test", password: "PlatformAdminPass123!" }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.accountType, "platform");
  assert.equal(data.data.admin.role, "SUPER_ADMIN");
  assert.equal(data.data.redirectTo, "/super-admin/dashboard");
  const cookie = res.headers.get("set-cookie");
  assert.ok(cookie && cookie.includes("svaadya_platform_session="));
});

// Scenario 2: Invalid platform credentials -> clear error, no session
test("Scenario 2: Invalid platform credentials returns HTTP 401 error and no session", async () => {
  const res = await fetch(`${baseUrl}/api/platform/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "platform@svaadya.test", password: "WrongPassword" }),
  });
  const data = await res.json();
  assert.equal(res.status, 401);
  assert.equal(data.success, false);
  assert.equal(data.error.message, "Invalid email or password");
});

// Scenario 3: Valid restaurant owner login -> that restaurant's dashboard
test("Scenario 3: Valid restaurant owner login returns ADMIN/OWNER role and routes to /admin", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@spicegarden.test", password: "password123" }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.accountType, "tenant");
  assert.equal(data.data.user.role, "ADMIN");
  assert.equal(data.data.redirectTo, "/admin");
  assert.ok(data.data.token);
});

// Scenario 4: Valid staff login -> authorized staff interface
test("Scenario 4: Valid staff login returns STAFF role and routes to staff interface", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "staff@spicegarden.test", password: "password123" }),
  });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.accountType, "tenant");
  assert.equal(data.data.user.role, "STAFF");
  assert.equal(data.data.redirectTo, "/admin/orders");
});

// Scenario 5: Customer ordering -> customer-facing interface
test("Scenario 5: Customer ordering endpoints are public and separate from administrative routes", async () => {
  const res = await fetch(`${baseUrl}/api/public/restaurants/spice-garden`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.restaurant.slug, "spice-garden");
  assert.equal(data.data.restaurant.name, "Spice Garden");
});

// Scenario 6: Unauthenticated user -> appropriate rejection
test("Scenario 6: Unauthenticated access to protected tenant and platform endpoints returns 401", async () => {
  const tenantRes = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(tenantRes.status, 401);

  const platformRes = await fetch(`${baseUrl}/api/platform/me`);
  assert.equal(platformRes.status, 401);
});

// Scenario 7: Refresh a protected page -> session handled correctly
test("Scenario 7: Re-validating session on page refresh returns current user and platform profile", async () => {
  // Tenant refresh
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@spicegarden.test", password: "password123" }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = await meRes.json();
  assert.equal(meRes.status, 200);
  assert.equal(meData.data.email, "admin@spicegarden.test");

  // Platform refresh with cookie
  const pLoginRes = await fetch(`${baseUrl}/api/platform/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "platform@svaadya.test", password: "PlatformAdminPass123!" }),
  });
  const cookieHeader = pLoginRes.headers.get("set-cookie").split(";")[0];
  const pMeRes = await fetch(`${baseUrl}/api/platform/me`, {
    headers: { Cookie: cookieHeader },
  });
  const pMeData = await pMeRes.json();
  assert.equal(pMeRes.status, 200);
  assert.equal(pMeData.data.email, "platform@svaadya.test");
});

// Scenario 8: Logout -> session cleared
test("Scenario 8: Platform logout clears session cookie", async () => {
  const res = await fetch(`${baseUrl}/api/platform/logout`, { method: "POST" });
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie");
  assert.ok(cookie && (cookie.includes("Expires=Thu, 01 Jan 1970") || cookie.includes("Max-Age=0")));
});

// Scenario 9: Restaurant A cannot access Restaurant B's data
test("Scenario 9: Restaurant A token cannot access Restaurant B orders or settings (tenant isolation)", async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@spicegarden.test", password: "password123" }),
  });
  const tokenA = (await loginRes.json()).data.token;

  const restB = await prisma.restaurant.findUnique({ where: { slug: "royal-curry" } });
  const crossRes = await fetch(`${baseUrl}/api/restaurants/${restB.id}/orders`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  // Cross tenant access is forbidden
  assert.equal(crossRes.status, 403);
});

// Scenario 10: Directly entering a protected platform URL cannot bypass authorization
test("Scenario 10: Protected platform endpoints deny unauthenticated direct access", async () => {
  const overviewRes = await fetch(`${baseUrl}/api/platform/overview`);
  assert.equal(overviewRes.status, 401);

  const restaurantsRes = await fetch(`${baseUrl}/api/platform/restaurants`);
  assert.equal(restaurantsRes.status, 401);
});

// Scenario 11: End-to-end onboarding: Registration -> Restaurant -> Owner -> RBAC Roles & Permissions -> Subscription -> Login -> Dashboard Access
test("Scenario 11: Full End-to-End Onboarding Journey", async () => {
  process.env.SAAS_TRIAL_DAYS = "14";
  const e2eEmail = "e2e_owner@verifysaas.test";

  // Clean up if prior run exists
  const existingUser = await prisma.user.findFirst({ where: { email: e2eEmail } });
  if (existingUser) {
    await prisma.restaurant.delete({ where: { id: existingUser.restaurantId } });
  }

  // 1. Submit Trial Registration
  const regRes = await fetch(`${baseUrl}/api/subscriptions/onboarding/trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantName: "E2E Verify Bistro",
      cuisineType: "Continental",
      adminName: "E2E Owner Admin",
      adminEmail: e2eEmail,
      phone: "+919876543210",
      adminPassword: "Password1234!",
      planKey: "GROWTH",
    }),
  });

  const regData = await regRes.json();
  assert.equal(regRes.status, 201);
  assert.equal(regData.success, true);
  assert.ok(regData.data.token);
  assert.ok(regData.data.restaurant.id);
  assert.ok(regData.data.owner.id);
  assert.equal(regData.data.trial, true);
  assert.equal(regData.data.days, 14);

  const restaurantId = regData.data.restaurant.id;

  // 2. Verify Database State: Restaurant, Roles, RolePermissions, User
  const dbUser = await prisma.user.findFirst({
    where: { email: e2eEmail, restaurantId },
    include: {
      roleRecord: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
      restaurant: {
        include: {
          subscriptions: true,
          roles: { include: { permissions: true } },
        },
      },
    },
  });

  assert.ok(dbUser);
  assert.equal(dbUser.role, "ADMIN");
  assert.ok(dbUser.roleId);
  assert.equal(dbUser.roleRecord.name, "OWNER");
  assert.ok(dbUser.restaurant.roles.length >= 7);
  assert.equal(dbUser.restaurant.subscriptions[0].status, "TRIALING");
  assert.ok(dbUser.restaurant.subscriptions[0].trialEndsAt > new Date());

  // 3. Login with newly created credentials
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e2eEmail, password: "Password1234!" }),
  });

  const loginData = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.equal(loginData.success, true);
  assert.equal(loginData.data.accountType, "tenant");
  assert.ok(loginData.data.token);
  assert.equal(loginData.data.user.email, e2eEmail);
  assert.equal(loginData.data.user.roleName, "OWNER");
  assert.equal(loginData.data.user.subscriptionStatus, "TRIALING");
  assert.equal(loginData.data.user.subscriptionAccess, true);

  // 4. Access Protected Dashboard Me endpoint
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.data.token}` },
  });
  const meData = await meRes.json();
  assert.equal(meRes.status, 200);
  assert.equal(meData.data.email, e2eEmail);
  assert.equal(meData.data.restaurantId, restaurantId);
  assert.deepEqual(meData.data.permissions, ["*"]);

  // Clean up
  await prisma.restaurant.delete({ where: { id: restaurantId } });
});

// Scenario 12: Registration Conflict 409 when email already has an active account
test("Scenario 12: Registration returns HTTP 409 when email already exists", async () => {
  const conflictRes = await fetch(`${baseUrl}/api/subscriptions/onboarding/trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantName: "Duplicate Bistro",
      adminName: "Spice Admin",
      adminEmail: "admin@spicegarden.test",
      adminPassword: "Password1234!",
      planKey: "STARTER",
    }),
  });
  const conflictData = await conflictRes.json();
  assert.equal(conflictRes.status, 409);
  assert.equal(conflictData.success, false);
  assert.match(conflictData.error?.message, /already has an active account/i);
});

// Scenario 13: Safely reject paid checkout when gateway is unconfigured (503)
test("Scenario 13: Paid checkout safely rejects with 503 when payment gateway is unconfigured", async () => {
  delete process.env.SAAS_RAZORPAY_KEY_ID;
  delete process.env.SAAS_RAZORPAY_KEY_SECRET;
  process.env.SAAS_PAYMENT_PROVIDER = "unconfigured";

  const checkoutRes = await fetch(`${baseUrl}/api/subscriptions/onboarding/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantName: "Unconfigured Gateway Cafe",
      adminName: "Gateway Admin",
      adminEmail: "unconfigured@gatewaytest.test",
      adminPassword: "Password1234!",
      planKey: "STARTER",
      billingPeriod: "MONTHLY",
    }),
  });
  const checkoutData = await checkoutRes.json();
  assert.equal(checkoutRes.status, 503);
  assert.equal(checkoutData.success, false);
  assert.match(checkoutData.error?.message, /online payments are currently disabled/i);
});
