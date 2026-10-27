const { createHash, randomBytes } = require("crypto");
const prisma = require("../config/db");
const env = require("../config/env");
const { hashPassword } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const roleService = require("./roleService");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const PURPOSE = Object.freeze({ ACTIVATE: "ACTIVATE", PASSWORD_RESET: "PASSWORD_RESET" });

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken() {
  return randomBytes(32).toString("base64url");
}

function isOwnerUser(user) {
  return user?.roleRecord?.name === "OWNER" || (!user?.roleRecord && user?.role === "ADMIN");
}

function setupUrl(token) {
  return new URL(`/staff-access/${token}`, `${env.clientUrl}/`).toString();
}

function assertStaffRole(role, actorPermissions) {
  if (!role || role.name === "OWNER") throw new ApiError(400, "Choose a valid non-owner staff role.");
  roleService.assertPermissionSubset(role.permissions.map((entry) => entry.permission.key), actorPermissions);
}

async function createInvitation(restaurantId, actor, input, database = prisma) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 100) throw new ApiError(400, "Enter a staff name between 2 and 100 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid staff email address.");
  if (input.roleId && !actor.permissions.includes("staff.roles.manage") && !actor.permissions.includes("*")) {
    throw new ApiError(403, "You cannot assign roles.");
  }

  await roleService.ensureRestaurantRoles(restaurantId, database);
  const token = makeToken();
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(randomBytes(48).toString("base64url"));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  try {
    const staff = await database.$transaction(async (tx) => {
      const role = input.roleId
        ? await tx.role.findFirst({ where: { id: input.roleId, restaurantId }, include: { permissions: { include: { permission: { select: { key: true } } } } } })
        : await tx.role.findFirst({ where: { restaurantId, name: "STAFF", isSystem: true }, include: { permissions: { include: { permission: { select: { key: true } } } } } });
      assertStaffRole(role, actor.permissions);

      const duplicate = await tx.user.findFirst({ where: { restaurantId, email: { equals: email, mode: "insensitive" } }, select: { id: true } });
      if (duplicate) throw new ApiError(409, "A team account already uses this email.");

      const member = await tx.user.create({
        data: { restaurantId, name, email, role: "STAFF", roleId: role.id, passwordHash, isActive: false },
        select: { id: true, name: true, email: true, roleId: true, isActive: true, createdAt: true },
      });
      await tx.restaurantStaffAccessLink.upsert({
        where: { userId_purpose: { userId: member.id, purpose: PURPOSE.ACTIVATE } },
        create: { restaurantId, userId: member.id, createdByUserId: actor.id, purpose: PURPOSE.ACTIVATE, tokenHash, expiresAt },
        update: { createdByUserId: actor.id, tokenHash, expiresAt, consumedAt: null, createdAt: now },
      });
      await roleService.writeAudit(tx, restaurantId, actor.id, "staff.invited", "user", member.id, { roleId: role.id, invitationExpiresAt: expiresAt.toISOString() });
      return { ...member, roleName: role.name, isOwner: false };
    }, { timeout: 15000 });
    return { staff, invite: { setupUrl: setupUrl(token), expiresAt } };
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "A team account already uses this email.");
    throw error;
  }
}

async function issueAccessLink(restaurantId, staffId, actorId, purpose, reason, database = prisma) {
  if (![PURPOSE.ACTIVATE, PURPOSE.PASSWORD_RESET].includes(purpose)) throw new ApiError(400, "Invalid staff access link purpose.");
  const auditReason = typeof reason === "string" ? reason.trim() : "";
  if (auditReason.length < 8 || auditReason.length > 500) throw new ApiError(400, "Enter an audit reason between 8 and 500 characters.");

  const existing = await database.user.findFirst({
    where: { id: staffId, restaurantId },
    select: { id: true, role: true, isActive: true, roleRecord: { select: { name: true } } },
  });
  if (!existing) throw new ApiError(404, "Team member not found.");
  if (isOwnerUser(existing)) throw new ApiError(403, "The owner account cannot be reset from team management.");
  if (purpose === PURPOSE.ACTIVATE && existing.isActive) throw new ApiError(409, "This team member is already active.");
  if (purpose === PURPOSE.PASSWORD_RESET && !existing.isActive) throw new ApiError(409, "Activate this team member before issuing a reset link.");
  if (purpose === PURPOSE.ACTIVATE) {
    const prior = await database.restaurantStaffAccessLink.findUnique({ where: { userId_purpose: { userId: staffId, purpose } }, select: { id: true } });
    if (!prior) throw new ApiError(409, "This account has no pending activation invite.");
  }

  const token = makeToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (purpose === PURPOSE.ACTIVATE ? INVITE_TTL_MS : RESET_TTL_MS));
  const action = purpose === PURPOSE.ACTIVATE ? "staff.activation_link_issued" : "staff.password_reset_link_issued";
  await database.$transaction(async (tx) => {
    const owner = await tx.user.findFirst({ where: { id: staffId, restaurantId }, select: { id: true, role: true, isActive: true, roleRecord: { select: { name: true } } } });
    if (!owner || isOwnerUser(owner)) throw new ApiError(404, "Team member not found.");
    if ((purpose === PURPOSE.ACTIVATE && owner.isActive) || (purpose === PURPOSE.PASSWORD_RESET && !owner.isActive)) {
      throw new ApiError(409, "The team member's access state changed. Refresh and try again.");
    }
    await tx.restaurantStaffAccessLink.upsert({
      where: { userId_purpose: { userId: staffId, purpose } },
      create: { restaurantId, userId: staffId, createdByUserId: actorId, purpose, tokenHash, expiresAt },
      update: { createdByUserId: actorId, tokenHash, expiresAt, consumedAt: null, createdAt: now },
    });
    await roleService.writeAudit(tx, restaurantId, actorId, action, "user", staffId, { reason: auditReason, purpose, expiresAt: expiresAt.toISOString() });
  }, { timeout: 15000 });
  return { invite: { setupUrl: setupUrl(token), expiresAt } };
}

async function getAccessLink(token, database = prisma) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) throw new ApiError(410, "This staff access link is invalid or has expired.");
  const access = await database.restaurantStaffAccessLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, isActive: true, roleRecord: { select: { name: true } } } },
      restaurant: { select: { name: true, status: true } },
    },
  });
  const validState = access?.purpose === PURPOSE.ACTIVATE
    ? !access.user.isActive
    : access?.purpose === PURPOSE.PASSWORD_RESET && access.user.isActive;
  if (!access || access.consumedAt || access.expiresAt <= new Date() || isOwnerUser(access.user) || access.restaurant.status !== "ACTIVE" || !validState) {
    throw new ApiError(410, "This staff access link is invalid or has expired.");
  }
  return {
    name: access.user.name,
    email: access.user.email,
    restaurantName: access.restaurant.name,
    purpose: access.purpose,
    expiresAt: access.expiresAt,
  };
}

async function setPassword(token, password, database = prisma) {
  if (typeof password !== "string" || password.length < 10 || password.length > 72 || Buffer.byteLength(password, "utf8") > 72) {
    throw new ApiError(400, "Password must be 10 to 72 characters and at most 72 UTF-8 bytes.");
  }
  const publicData = await getAccessLink(token, database);
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);
  const now = new Date();
  const link = await database.restaurantStaffAccessLink.findUnique({ where: { tokenHash } });
  if (!link) throw new ApiError(410, "This staff access link is invalid or has expired.");

  return database.$transaction(async (tx) => {
    const consumed = await tx.restaurantStaffAccessLink.updateMany({
      where: { id: link.id, purpose: publicData.purpose, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new ApiError(410, "This staff access link is invalid or has expired.");

    const member = await tx.user.findFirst({
      where: { id: link.userId, restaurantId: link.restaurantId },
      include: { roleRecord: { select: { name: true } }, restaurant: { select: { name: true, status: true } } },
    });
    if (!member || isOwnerUser(member) || member.restaurant.status !== "ACTIVE") throw new ApiError(410, "This staff access link is invalid or has expired.");
    const activating = publicData.purpose === PURPOSE.ACTIVATE;
    const updated = await tx.user.updateMany({
      where: { id: member.id, restaurantId: link.restaurantId, isActive: !activating },
      data: { passwordHash, ...(activating ? { isActive: true } : {}) },
    });
    if (updated.count !== 1) throw new ApiError(410, "This staff access link is invalid or has expired.");

    await roleService.writeAudit(
      tx,
      link.restaurantId,
      member.id,
      activating ? "staff.activated" : "staff.password_reset",
      "user",
      member.id,
      { purpose: publicData.purpose, completedAt: now.toISOString() }
    );
    return { completed: true, purpose: publicData.purpose, restaurantName: member.restaurant?.name || publicData.restaurantName };
  }, { timeout: 15000 });
}

module.exports = { PURPOSE, hashToken, createInvitation, issueAccessLink, getAccessLink, setPassword };
