const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

process.env.JWT_SECRET = "test-only-secret-with-enough-entropy";
process.env.CLIENT_URL = "https://svaadya.example.test";

const paths = {
  db: require.resolve("../src/config/db"),
  auth: require.resolve("../src/utils/auth"),
  roles: require.resolve("../src/services/roleService"),
  env: require.resolve("../src/config/env"),
  service: require.resolve("../src/services/platformRestaurantService"),
};

let service;
let database;
let savedInvite;
let savedInvites;
let savedUser;
let savedRestaurant;
let auditRows;
let subscriptionData;

beforeEach(() => {
  savedInvite = null;
  savedInvites = [];
  savedUser = null;
  savedRestaurant = null;
  auditRows = [];
  subscriptionData = null;

  database = {
    user: {
      async findFirst({ where } = {}) { return where?.restaurantId && savedUser?.restaurantId === where.restaurantId ? { id: savedUser.id, isActive: savedUser.isActive } : null; },
      async create({ data }) { savedUser = { id: "owner-1", ...data }; return { id: savedUser.id }; },
      async update({ data }) { Object.assign(savedUser, data); return savedUser; },
      async updateMany({ where, data }) {
        if (savedUser.id !== where.id || savedUser.restaurantId !== where.restaurantId || savedUser.isActive !== where.isActive) return { count: 0 };
        Object.assign(savedUser, data);
        return { count: 1 };
      },
    },
    restaurant: {
      async findUnique({ where }) { return where.id === savedRestaurant?.id ? savedRestaurant : null; },
      async create({ data }) { savedRestaurant = { id: "restaurant-1", ...data }; return savedRestaurant; },
      async update({ data }) { Object.assign(savedRestaurant, data); return savedRestaurant; },
    },
    role: { async findUnique() { return { id: "owner-role" }; } },
    subscription: { async create({ data }) { subscriptionData = data; return { id: "subscription-1", ...data }; } },
    platformRestaurantInvite: {
      async create({ data }) { savedInvite = { id: `invite-${savedInvites.length + 1}`, ...data }; savedInvites.push(savedInvite); return savedInvite; },
      async findFirst({ where }) { const found = savedInvites.find((invite) => invite.restaurantId === where.restaurantId && invite.userId === where.userId && !invite.consumedAt); return found ? { id: found.id } : null; },
      async findUnique({ where }) {
        const invite = savedInvites.find((candidate) => candidate.tokenHash === where.tokenHash) || null;
        return invite ? { ...invite, restaurant: savedRestaurant, user: savedUser } : null;
      },
      async updateMany({ where, data }) {
        const targets = savedInvites.filter((invite) => (!where.id || invite.id === where.id) && (!where.restaurantId || invite.restaurantId === where.restaurantId) && (!where.userId || invite.userId === where.userId) && !invite.consumedAt && (!where.expiresAt?.gt || invite.expiresAt > where.expiresAt.gt));
        targets.forEach((invite) => Object.assign(invite, data));
        return { count: targets.length };
      },
    },
    platformAdminAuditLog: { async create({ data }) { auditRows.push(data); return data; } },
    async $transaction(callback) { return callback(database); },
  };

  require.cache[paths.db] = { id: paths.db, filename: paths.db, loaded: true, exports: database };
  require.cache[paths.auth] = { id: paths.auth, filename: paths.auth, loaded: true, exports: { async hashPassword(value) { return `hash:${value}`; } } };
  require.cache[paths.roles] = { id: paths.roles, filename: paths.roles, loaded: true, exports: { async ensureRestaurantRoles() {} } };
  delete require.cache[paths.env];
  delete require.cache[paths.service];
  service = require("../src/services/platformRestaurantService");
});

const validInput = {
  restaurantName: "Cedar Kitchen",
  cuisineType: "Cafe",
  ownerName: "Asha Rao",
  ownerEmail: "asha@example.test",
  planKey: "STANDARD",
  reason: "Approved partner onboarding",
};

test("platform account creation stores a hashed one-time invite and audits the granted state", async () => {
  const result = await service.createRestaurant(validInput, "platform-admin-1");
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);

  assert.equal(savedRestaurant.status, "SUSPENDED");
  assert.equal(savedUser.isActive, false);
  assert.notEqual(savedInvite.tokenHash, token);
  assert.equal(savedInvite.tokenHash, service.hashInviteToken(token));
  assert.equal(subscriptionData.status, "GRANDFATHERED");
  assert.equal(subscriptionData.endsAt, null);
  assert.equal(subscriptionData.amount, 0);
  assert.equal(auditRows[0].actorAdminId, "platform-admin-1");
  assert.equal(auditRows[0].action, "platform.restaurant.created");
  assert.match(auditRows[0].metadata, /Approved partner onboarding/);
  assert.deepEqual(await service.getInvitation(token), {
    restaurantName: "Cedar Kitchen",
    ownerEmail: "asha@example.test",
    expiresAt: savedInvite.expiresAt,
  });
});

test("owner activation consumes the invite once, creates the password, and activates the restaurant", async () => {
  const result = await service.createRestaurant(validInput, "platform-admin-1");
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);
  const activated = await service.activateInvitation(token, "a-long-owner-password");

  assert.equal(activated.activated, true);
  assert.equal(savedInvite.consumedAt instanceof Date, true);
  assert.equal(savedUser.isActive, true);
  assert.equal(savedUser.passwordHash, "hash:a-long-owner-password");
  assert.equal(savedRestaurant.status, "ACTIVE");
  assert.equal(auditRows.at(-1).action, "platform.restaurant.owner_activated");
  await assert.rejects(service.activateInvitation(token, "another-long-password"), { status: 410 });
});

test("expired and malformed invite tokens cannot reveal or activate an account", async () => {
  await assert.rejects(service.getInvitation("bad"), { status: 410 });
  await assert.rejects(service.activateInvitation("bad", "a-long-owner-password"), { status: 410 });

  const result = await service.createRestaurant(validInput, "platform-admin-1");
  savedInvite.expiresAt = new Date(Date.now() - 1000);
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);
  await assert.rejects(service.getInvitation(token), { status: 410 });
  await assert.rejects(service.activateInvitation(token, "a-long-owner-password"), { status: 410 });
});

test("activation rejects password values that exceed bcrypt's UTF-8 input limit", async () => {
  await assert.rejects(service.activateInvitation("A".repeat(43), "é".repeat(40)), { status: 400 });
});

test("an audited replacement invite invalidates the old token", async () => {
  const created = await service.createRestaurant(validInput, "platform-admin-1");
  const previousToken = new URL(created.invite.setupUrl).pathname.split("/").at(-1);
  const replacement = await service.issueOwnerInvitation("restaurant-1", "Owner lost the original link", "platform-admin-1");
  const replacementToken = new URL(replacement.invite.setupUrl).pathname.split("/").at(-1);

  assert.notEqual(previousToken, replacementToken);
  const oldInvite = savedInvites[0];
  assert.equal(savedInvite.tokenHash, service.hashInviteToken(replacementToken));
  assert.equal(oldInvite.consumedAt instanceof Date, true);
  assert.equal(auditRows.at(-1).action, "platform.restaurant.owner_invite_issued");
  assert.match(auditRows.at(-1).metadata, /Owner lost the original link/);
  await assert.rejects(service.getInvitation(previousToken), { status: 410 });
  assert.equal((await service.getInvitation(replacementToken)).ownerEmail, "asha@example.test");
});
