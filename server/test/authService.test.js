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
        restaurantId: "restaurant-1",
      },
    }
  );
});

test("existing email/password login still rejects an invalid password", async () => {
  passwordMatches = false;
  await assert.rejects(authService.login("admin@example.test", "wrongpass"), { status: 401 });
});
