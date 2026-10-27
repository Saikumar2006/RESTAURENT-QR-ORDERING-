const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

process.env.JWT_SECRET = "test-only-secret-with-enough-entropy";
process.env.CLIENT_URL = "https://svaadya.example.test";

const paths = {
  db: require.resolve("../src/config/db"),
  auth: require.resolve("../src/utils/auth"),
  roles: require.resolve("../src/services/roleService"),
  env: require.resolve("../src/config/env"),
  service: require.resolve("../src/services/staffAccessService"),
};
let database;
let service;
let member;
let link;
let auditRows;
let currentRole;

beforeEach(() => {
  member = null;
  link = null;
  auditRows = [];
  currentRole = { id: "staff-role", name: "STAFF", permissions: [{ permission: { key: "orders.view" } }] };

  database = {
    role: {
      async findFirst() { return currentRole; },
    },
    user: {
      async findFirst({ where } = {}) {
        if (!member) return null;
        if (where?.id && where.id !== member.id) return null;
        if (where?.restaurantId && where.restaurantId !== member.restaurantId) return null;
        if (where?.email) return null;
        return { ...member, restaurant: { name: "Cedar Kitchen", status: "ACTIVE" } };
      },
      async create({ data }) { member = { id: "staff-1", ...data, roleRecord: { name: currentRole.name } }; return member; },
      async updateMany({ where, data }) {
        if (!member || member.id !== where.id || member.restaurantId !== where.restaurantId || member.isActive !== where.isActive) return { count: 0 };
        Object.assign(member, data);
        return { count: 1 };
      },
    },
    restaurantStaffAccessLink: {
      async upsert({ where, create, update }) {
        if (where.userId_purpose.userId !== "staff-1" || where.userId_purpose.purpose !== create.purpose) throw new Error("unexpected upsert key");
        link = link ? { ...link, ...update } : { id: "link-1", ...create };
        return link;
      },
      async findUnique({ where }) {
        if (!link) return null;
        if (where.userId_purpose) return link.userId === where.userId_purpose.userId && link.purpose === where.userId_purpose.purpose ? { id: link.id } : null;
        if (where.tokenHash === link.tokenHash) return { ...link, user: member, restaurant: { name: "Cedar Kitchen", status: "ACTIVE" } };
        return null;
      },
      async updateMany({ where, data }) {
        if (!link || link.id !== where.id || link.purpose !== where.purpose || link.consumedAt || link.expiresAt <= where.expiresAt.gt) return { count: 0 };
        Object.assign(link, data);
        return { count: 1 };
      },
    },
    async $transaction(callback) { return callback(database); },
  };

  require.cache[paths.db] = { id: paths.db, filename: paths.db, loaded: true, exports: database };
  require.cache[paths.auth] = { id: paths.auth, filename: paths.auth, loaded: true, exports: { async hashPassword(value) { return `hash:${value}`; } } };
  require.cache[paths.roles] = {
    id: paths.roles,
    filename: paths.roles,
    loaded: true,
    exports: {
      async ensureRestaurantRoles() {},
      assertPermissionSubset(permissions, actorPermissions) {
        if (!actorPermissions.includes("*") && permissions.some((permission) => !actorPermissions.includes(permission))) {
          const error = new Error("You cannot assign permissions you do not hold");
          error.status = 403;
          throw error;
        }
      },
      async writeAudit(_db, restaurantId, userId, action, resource, resourceId, metadata) { auditRows.push({ restaurantId, userId, action, resource, resourceId, metadata }); },
    },
  };
  delete require.cache[paths.env];
  delete require.cache[paths.service];
  service = require("../src/services/staffAccessService");
});

const actor = { id: "owner-1", permissions: ["*"] };

test("staff invites create an inactive tenant user and persist only the hashed expiring token", async () => {
  const result = await service.createInvitation("restaurant-1", actor, { name: "Mina Rao", email: "Mina@Example.test" });
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);

  assert.equal(member.isActive, false);
  assert.equal(member.restaurantId, "restaurant-1");
  assert.equal(member.email, "mina@example.test");
  assert.equal(link.tokenHash, service.hashToken(token));
  assert.notEqual(link.tokenHash, token);
  assert.equal(link.purpose, "ACTIVATE");
  assert.equal(auditRows[0].action, "staff.invited");
  assert.equal((await service.getAccessLink(token)).purpose, "ACTIVATE");
});

test("a staff setup link sets the password once and activates only that tenant member", async () => {
  const result = await service.createInvitation("restaurant-1", actor, { name: "Mina Rao", email: "mina@example.test" });
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);
  const completion = await service.setPassword(token, "a-strong-staff-password");

  assert.equal(completion.completed, true);
  assert.equal(member.isActive, true);
  assert.equal(member.passwordHash, "hash:a-strong-staff-password");
  assert.equal(link.consumedAt instanceof Date, true);
  assert.equal(auditRows.at(-1).action, "staff.activated");
  await assert.rejects(service.setPassword(token, "another-strong-password"), { status: 410 });
});

test("replacement activation links invalidate old tokens and record a reason", async () => {
  const created = await service.createInvitation("restaurant-1", actor, { name: "Mina Rao", email: "mina@example.test" });
  const previousToken = new URL(created.invite.setupUrl).pathname.split("/").at(-1);
  const replacement = await service.issueAccessLink("restaurant-1", member.id, actor.id, "ACTIVATE", "The original invite expired");
  const replacementToken = new URL(replacement.invite.setupUrl).pathname.split("/").at(-1);

  assert.notEqual(previousToken, replacementToken);
  await assert.rejects(service.getAccessLink(previousToken), { status: 410 });
  assert.equal((await service.getAccessLink(replacementToken)).email, "mina@example.test");
  assert.equal(auditRows.at(-1).action, "staff.activation_link_issued");
  assert.match(auditRows.at(-1).metadata.reason, /original invite expired/);
});

test("password reset links require an active non-owner and change no role or activation state", async () => {
  await service.createInvitation("restaurant-1", actor, { name: "Mina Rao", email: "mina@example.test" });
  member.isActive = true;
  link = null;
  const result = await service.issueAccessLink("restaurant-1", member.id, actor.id, "PASSWORD_RESET", "The staff member requested a reset");
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);
  assert.equal((await service.getAccessLink(token)).purpose, "PASSWORD_RESET");
  await service.setPassword(token, "a-new-password-for-staff");

  assert.equal(member.isActive, true);
  assert.equal(member.passwordHash, "hash:a-new-password-for-staff");
  assert.equal(member.roleId, "staff-role");
  assert.equal(auditRows.at(-1).action, "staff.password_reset");
});

test("another restaurant cannot issue a link for this member and an owner cannot be reset", async () => {
  await service.createInvitation("restaurant-1", actor, { name: "Mina Rao", email: "mina@example.test" });
  await assert.rejects(service.issueAccessLink("restaurant-2", member.id, actor.id, "ACTIVATE", "Wrong restaurant"), { status: 404 });
  member.isActive = true;
  member.roleRecord.name = "OWNER";
  await assert.rejects(service.issueAccessLink("restaurant-1", member.id, actor.id, "PASSWORD_RESET", "Owner reset"), { status: 403 });
});

test("staff cannot be invited into a role with permissions the actor does not have", async () => {
  currentRole = { id: "elevated", name: "Elevated", permissions: [{ permission: { key: "payments.refund" } }] };
  await assert.rejects(
    service.createInvitation("restaurant-1", { id: "manager-1", permissions: ["staff.create"] }, { name: "Mina Rao", email: "mina@example.test", roleId: "elevated" }),
    { status: 403 }
  );
  assert.equal(member, null);
});

test("expired and malformed staff access links are rejected", async () => {
  await assert.rejects(service.getAccessLink("invalid"), { status: 410 });
  const result = await service.createInvitation("restaurant-1", actor, { name: "Mina Rao", email: "mina@example.test" });
  const token = new URL(result.invite.setupUrl).pathname.split("/").at(-1);
  link.expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(service.getAccessLink(token), { status: 410 });
  await assert.rejects(service.setPassword(token, "a-strong-staff-password"), { status: 410 });
});
