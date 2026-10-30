const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

process.env.JWT_SECRET = "test-only-secret-with-enough-entropy";

const prismaPath = require.resolve("../src/config/db");
const authPath = require.resolve("../src/utils/auth");
let authService;
let passwordMatches = true;

beforeEach(() => {
  passwordMatches = true;
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      user: {
        async findMany() {
          return [{
            id: "user-1",
            restaurantId: "restaurant-1",
            name: "Restaurant Admin",
            email: "admin@example.test",
            passwordHash: "stored-hash",
            role: "ADMIN",
            isActive: true,
            restaurant: { status: "ACTIVE" },
          }];
        },
      },
    },
  };
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      async comparePassword() { return passwordMatches; },
      signToken: (user) => `tenant-token:${user.id}`,
    },
  };
  delete require.cache[require.resolve("../src/services/authService")];
  authService = require("../src/services/authService");
});

test("existing email/password login still issues the tenant JWT response", async () => {
  assert.deepEqual(
    await authService.login("admin@example.test", "password123"),
    {
      token: "tenant-token:user-1",
      user: {
        id: "user-1",
        name: "Restaurant Admin",
        email: "admin@example.test",
        role: "ADMIN",
        roleId: null,
        roleName: "OWNER",
        permissions: ["*"],
        restaurantId: "restaurant-1",
      preferredLanguage: "en",
      subscriptionStatus: "LEGACY",
      subscriptionEndsAt: null,
      subscriptionGraceEndsAt: null,
      subscriptionAccess: true,
      },
    }
  );
});

test("existing email/password login still rejects an invalid password", async () => {
  passwordMatches = false;
  await assert.rejects(authService.login("admin@example.test", "wrongpass"), { status: 401 });
});

test("email lookup is case-insensitive and trims whitespace", async () => {
  const result = await authService.login("  ADMIN@EXAMPLE.TEST  ", "password123");
  assert.equal(result.user.email, "admin@example.test");
});

test("missing or empty credentials throw 401", async () => {
  await assert.rejects(authService.login("", "password123"), { status: 401 });
  await assert.rejects(authService.login("admin@example.test", ""), { status: 401 });
  await assert.rejects(authService.login(null, "password123"), { status: 401 });
});

test("inactive user account rejects with 403 when password is valid", async () => {
  require.cache[prismaPath].exports.user.findMany = async () => [{
    id: "user-inactive",
    restaurantId: "restaurant-1",
    name: "Inactive Admin",
    email: "inactive@example.test",
    passwordHash: "stored-hash",
    role: "ADMIN",
    isActive: false,
    restaurant: { status: "ACTIVE" },
  }];
  await assert.rejects(authService.login("inactive@example.test", "password123"), { status: 403 });
});

test("suspended restaurant rejects with 403 when password is valid", async () => {
  require.cache[prismaPath].exports.user.findMany = async () => [{
    id: "user-suspended",
    restaurantId: "restaurant-1",
    name: "Suspended Admin",
    email: "suspended@example.test",
    passwordHash: "stored-hash",
    role: "ADMIN",
    isActive: true,
    restaurant: { status: "SUSPENDED" },
  }];
  await assert.rejects(authService.login("suspended@example.test", "password123"), { status: 403 });
});

test("platform admin can log in via tenant auth endpoint as cross-login fallback", async () => {
  require.cache[prismaPath].exports.user.findMany = async () => [];
  require.cache[prismaPath].exports.platformAdmin = {
    async findFirst() {
      return {
        id: "platform-1",
        name: "Platform Master",
        email: "platform@svaadya.test",
        passwordHash: "stored-hash",
        platformRole: "SUPER_ADMIN",
        isActive: true,
      };
    },
  };
  require.cache[authPath].exports.signPlatformToken = () => "platform-token:1";
  const result = await authService.login("platform@svaadya.test", "password123");
  assert.equal(result.accountType, "platform");
  assert.equal(result.admin.email, "platform@svaadya.test");
});
