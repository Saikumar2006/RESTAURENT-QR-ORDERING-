const prisma = require("../config/db");
const { ApiError } = require("../utils/http");

const PLATFORM_ROLE_PERMISSIONS = Object.freeze({
  SUPER_ADMIN: ["platform.dashboard.view", "platform.restaurants.view", "platform.restaurants.manage", "platform.finance.view", "platform.support.manage", "platform.admins.manage", "platform.audit.view"],
  PLATFORM_OPERATIONS: ["platform.dashboard.view", "platform.restaurants.view", "platform.restaurants.manage", "platform.support.manage", "platform.audit.view"],
  FINANCE_ADMIN: ["platform.dashboard.view", "platform.finance.view", "platform.audit.view"],
  SUPPORT_AGENT: ["platform.dashboard.view", "platform.restaurants.view", "platform.support.manage"],
  READ_ONLY_AUDITOR: ["platform.dashboard.view", "platform.restaurants.view", "platform.finance.view", "platform.audit.view"],
});

const PLATFORM_ROLES = Object.keys(PLATFORM_ROLE_PERMISSIONS);

function normalizeSuperAdminEmails(values = "") {
  return new Set(String(values).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function resolvePlatformAccess(admin, superAdminEmails = new Set()) {
  const platformRole = superAdminEmails.has(admin.email.toLowerCase())
    ? "SUPER_ADMIN"
    : PLATFORM_ROLE_PERMISSIONS[admin.platformRole] ? admin.platformRole : "READ_ONLY_AUDITOR";
  return { platformRole, permissions: PLATFORM_ROLE_PERMISSIONS[platformRole] };
}

async function listPlatformAdmins(database = prisma) {
  const admins = await database.platformAdmin.findMany({
    select: { id: true, name: true, email: true, platformRole: true, isActive: true, createdAt: true },
    orderBy: [{ isActive: "desc" }, { email: "asc" }],
  });
  return admins;
}

async function updatePlatformRole(actorId, targetId, platformRole, database = prisma, superAdminEmails = new Set()) {
  if (!PLATFORM_ROLES.includes(platformRole)) throw new ApiError(400, "Choose a valid platform role");
  return database.$transaction(async (tx) => {
    const target = await tx.platformAdmin.findUnique({ where: { id: targetId } });
    if (!target) throw new ApiError(404, "Platform administrator not found");
    const targetIsSuper = resolvePlatformAccess(target, superAdminEmails).platformRole === "SUPER_ADMIN";
    const selfDemotion = actorId === targetId && platformRole !== "SUPER_ADMIN";
    if ((targetIsSuper || selfDemotion) && platformRole !== "SUPER_ADMIN") {
      const otherAdmins = await tx.platformAdmin.findMany({
        where: { id: { not: targetId }, isActive: true },
        select: { email: true, platformRole: true },
      });
      const hasOtherSuper = otherAdmins.some((admin) => resolvePlatformAccess(admin, superAdminEmails).platformRole === "SUPER_ADMIN");
      if (!hasOtherSuper) throw new ApiError(409, "Promote another active Super Admin before changing this role");
    }
    const updated = await tx.platformAdmin.update({
      where: { id: targetId },
      data: { platformRole },
      select: { id: true, name: true, email: true, platformRole: true, isActive: true, createdAt: true },
    });
    await tx.platformAdminAuditLog.create({
      data: { actorAdminId: actorId, targetAdminId: targetId, action: "platform_admin.role_changed", metadata: JSON.stringify({ from: target.platformRole, to: platformRole }) },
    });
    return updated;
  });
}

async function listPlatformAudit(database = prisma, limit = 100) {
  return database.platformAdminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(Number(limit) || 100, 200)),
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}

module.exports = { PLATFORM_ROLE_PERMISSIONS, PLATFORM_ROLES, normalizeSuperAdminEmails, resolvePlatformAccess, listPlatformAdmins, updatePlatformRole, listPlatformAudit };
