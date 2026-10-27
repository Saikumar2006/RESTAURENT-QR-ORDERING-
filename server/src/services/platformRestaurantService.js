const { createHash, randomBytes } = require("crypto");
const prisma = require("../config/db");
const env = require("../config/env");
const { hashPassword } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const roleService = require("./roleService");

const INVITE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const PLAN_KEYS = new Set(["BASIC", "STANDARD", "PREMIUM"]);

function hashInviteToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function slugBase(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "restaurant";
}

async function uniqueSlug(tx, name) {
  const base = slugBase(name);
  let candidate = base;
  let suffix = 1;
  while (await tx.restaurant.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function normalizeCreateInput(input) {
  const name = input?.restaurantName?.trim();
  const ownerName = input?.ownerName?.trim();
  const ownerEmail = input?.ownerEmail?.trim().toLowerCase();
  const reason = input?.reason?.trim();
  const planKey = input?.planKey;
  if (!name || name.length < 2 || name.length > 100) throw new ApiError(400, "Enter a restaurant name between 2 and 100 characters.");
  if (!ownerName || ownerName.length < 2 || ownerName.length > 100) throw new ApiError(400, "Enter the owner's name.");
  if (!ownerEmail || ownerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new ApiError(400, "Enter a valid owner email address.");
  if (!PLAN_KEYS.has(planKey)) throw new ApiError(400, "Choose a valid plan.");
  if (!reason || reason.length < 8 || reason.length > 500) throw new ApiError(400, "Enter an audit reason between 8 and 500 characters.");
  const cuisineType = input.cuisineType?.trim() || null;
  if (cuisineType && cuisineType.length > 60) throw new ApiError(400, "Cuisine type must be 60 characters or fewer.");
  return { name, ownerName, ownerEmail, reason, planKey, cuisineType };
}

async function createRestaurant(input, actorAdminId, database = prisma) {
  const normalized = normalizeCreateInput(input);
  const existingOwner = await database.user.findFirst({
    where: { email: { equals: normalized.ownerEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingOwner) throw new ApiError(409, "This email already belongs to a restaurant account.");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(token);
  const placeholderPasswordHash = await hashPassword(randomBytes(48).toString("base64url"));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_LIFETIME_MS);

  try {
    const result = await database.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: normalized.name,
          slug: await uniqueSlug(tx, normalized.name),
          cuisineType: normalized.cuisineType,
          status: "SUSPENDED",
          isOpen: false,
        },
        select: { id: true, name: true, slug: true, status: true },
      });
      const owner = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          name: normalized.ownerName,
          email: normalized.ownerEmail,
          passwordHash: placeholderPasswordHash,
          role: "ADMIN",
          isActive: false,
        },
        select: { id: true },
      });

      await roleService.ensureRestaurantRoles(restaurant.id, tx);
      const ownerRole = await tx.role.findUnique({
        where: { restaurantId_name: { restaurantId: restaurant.id, name: "OWNER" } },
        select: { id: true },
      });
      if (!ownerRole) throw new Error("Owner role initialization failed");
      await tx.user.update({ where: { id: owner.id }, data: { roleId: ownerRole.id } });

      const subscription = await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planKey: normalized.planKey,
          billingPeriod: "PLATFORM",
          amount: 0,
          currency: "INR",
          status: "GRANDFATHERED",
          startsAt: now,
          endsAt: null,
        },
        select: { id: true, planKey: true, billingPeriod: true, amount: true, status: true, startsAt: true, endsAt: true },
      });

      await tx.platformRestaurantInvite.create({
        data: { restaurantId: restaurant.id, userId: owner.id, createdByAdminId: actorAdminId, tokenHash, expiresAt },
      });
      await tx.platformAdminAuditLog.create({
        data: {
          actorAdminId,
          targetRestaurantId: restaurant.id,
          action: "platform.restaurant.created",
          metadata: JSON.stringify({
            reason: normalized.reason,
            planKey: normalized.planKey,
            subscriptionState: subscription.status,
            billingPeriod: subscription.billingPeriod,
            restaurantState: restaurant.status,
            serviceState: "CLOSED_PENDING_OWNER_SETUP",
            ownerActivation: "PENDING",
            inviteExpiresAt: expiresAt.toISOString(),
          }),
        },
      });
      return { restaurant, subscription };
    }, { timeout: 20000 });

    return {
      ...result,
      invite: {
        setupUrl: new URL(`/activate-account/${token}`, `${env.clientUrl}/`).toString(),
        expiresAt,
      },
    };
  } catch (error) {
    if (error.code === "P2002") throw new ApiError(409, "An account with that email or restaurant URL already exists.");
    throw error;
  }
}

async function issueOwnerInvitation(restaurantId, reason, actorAdminId, database = prisma) {
  const auditReason = typeof reason === "string" ? reason.trim() : "";
  if (auditReason.length < 8 || auditReason.length > 500) throw new ApiError(400, "Enter an audit reason between 8 and 500 characters.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_LIFETIME_MS);
  const result = await database.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, name: true, status: true } });
    if (!restaurant) throw new ApiError(404, "Restaurant account not found.");
    const owner = await tx.user.findFirst({ where: { restaurantId, role: "ADMIN" }, select: { id: true, isActive: true } });
    if (!owner || owner.isActive || restaurant.status !== "SUSPENDED") throw new ApiError(409, "This restaurant does not have a pending owner setup.");
    const pendingInvite = await tx.platformRestaurantInvite.findFirst({ where: { restaurantId, userId: owner.id, consumedAt: null }, select: { id: true } });
    if (!pendingInvite) throw new ApiError(409, "This restaurant does not have a pending owner setup.");

    // Lock and revoke invitations before the owner row, matching activation's
    // invite-then-user lock order and preventing deadlocks during concurrent use.
    const revoked = await tx.platformRestaurantInvite.updateMany({ where: { restaurantId, userId: owner.id, consumedAt: null }, data: { consumedAt: now } });
    if (revoked.count < 1) throw new ApiError(409, "This restaurant does not have a pending owner setup.");
    const ownerClaim = await tx.user.updateMany({ where: { id: owner.id, restaurantId, isActive: false }, data: { isActive: false } });
    if (ownerClaim.count !== 1) throw new ApiError(409, "This owner account has already been activated.");
    await tx.platformRestaurantInvite.create({ data: { restaurantId, userId: owner.id, createdByAdminId: actorAdminId, tokenHash, expiresAt } });
    await tx.platformAdminAuditLog.create({
      data: {
        actorAdminId,
        targetRestaurantId: restaurantId,
        action: "platform.restaurant.owner_invite_issued",
        metadata: JSON.stringify({ reason: auditReason, ownerSetup: "PENDING", inviteExpiresAt: expiresAt.toISOString() }),
      },
    });
    return { restaurant: { id: restaurant.id, name: restaurant.name, status: restaurant.status } };
  }, { timeout: 15000 });
  return { ...result, invite: { setupUrl: new URL(`/activate-account/${token}`, `${env.clientUrl}/`).toString(), expiresAt } };
}

async function getInvitation(token, database = prisma) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) throw new ApiError(410, "This account setup link is invalid or has expired.");
  const invitation = await database.platformRestaurantInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { restaurant: { select: { name: true } }, user: { select: { email: true, isActive: true } } },
  });
  if (!invitation || invitation.consumedAt || invitation.expiresAt <= new Date() || invitation.user.isActive) {
    throw new ApiError(410, "This account setup link is invalid or has expired.");
  }
  return { restaurantName: invitation.restaurant.name, ownerEmail: invitation.user.email, expiresAt: invitation.expiresAt };
}

async function activateInvitation(token, password, database = prisma) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) throw new ApiError(410, "This account setup link is invalid or has expired.");
  if (typeof password !== "string" || password.length < 10 || password.length > 72 || Buffer.byteLength(password, "utf8") > 72) throw new ApiError(400, "Password must be 10 to 72 characters and at most 72 UTF-8 bytes.");
  const tokenHash = hashInviteToken(token);
  const invitation = await database.platformRestaurantInvite.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.consumedAt || invitation.expiresAt <= new Date()) {
    throw new ApiError(410, "This account setup link is invalid or has expired.");
  }
  const passwordHash = await hashPassword(password);
  const now = new Date();

  return database.$transaction(async (tx) => {
    const consumed = await tx.platformRestaurantInvite.updateMany({
      where: { id: invitation.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new ApiError(410, "This account setup link is invalid or has expired.");

    const ownerRole = await tx.role.findUnique({
      where: { restaurantId_name: { restaurantId: invitation.restaurantId, name: "OWNER" } },
      select: { id: true },
    });
    const activated = await tx.user.updateMany({
      where: { id: invitation.userId, restaurantId: invitation.restaurantId, isActive: false },
      data: { passwordHash, role: "ADMIN", roleId: ownerRole?.id || null, isActive: true },
    });
    if (activated.count !== 1) throw new ApiError(410, "This account setup link is invalid or has expired.");

    const restaurant = await tx.restaurant.update({
      where: { id: invitation.restaurantId },
      data: { status: "ACTIVE" },
      select: { name: true, slug: true },
    });
    await tx.platformAdminAuditLog.create({
      data: {
        targetRestaurantId: invitation.restaurantId,
        action: "platform.restaurant.owner_activated",
        metadata: JSON.stringify({ ownerUserId: invitation.userId, result: "ACTIVE", serviceState: "CLOSED_UNTIL_OWNER_OPENS", activatedAt: now.toISOString() }),
      },
    });
    return { activated: true, restaurant: { name: restaurant.name, slug: restaurant.slug } };
  }, { timeout: 15000 });
}

module.exports = { hashInviteToken, normalizeCreateInput, createRestaurant, issueOwnerInvitation, getInvitation, activateInvitation };
