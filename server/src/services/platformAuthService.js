const prisma = require("../config/db");
const { comparePassword, hashPassword, signPlatformToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const platformRoleService = require("./platformRoleService");

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function login(email, password, requestId = null, clientIp = null, db = prisma) {
  const startTime = Date.now();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || typeof password !== "string" || !password) {
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/platform/login",
      emailProvided: Boolean(normalizedEmail),
      rejectionReason: "MISSING_CREDENTIALS",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(401, "Invalid email or password");
  }

  let admin = await db.platformAdmin.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

  const bootstrapEmail = (process.env.INITIAL_PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  const bootstrapPassword = process.env.INITIAL_PLATFORM_ADMIN_PASSWORD || "";
  if (bootstrapEmail && bootstrapPassword && normalizedEmail === bootstrapEmail && password === bootstrapPassword) {
    const newHash = await hashPassword(password);
    if (!admin) {
      admin = await prisma.platformAdmin.create({
        data: {
          name: process.env.INITIAL_PLATFORM_ADMIN_NAME || "Platform Super Admin",
          email: normalizedEmail,
          passwordHash: newHash,
          platformRole: process.env.INITIAL_PLATFORM_ADMIN_ROLE || "SUPER_ADMIN",
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    } else if (!admin.isActive || !(await comparePassword(password, admin.passwordHash))) {
      admin = await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          passwordHash: newHash,
          isActive: true,
          platformRole: "SUPER_ADMIN",
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }
  }

  if (!admin) {
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/platform/login",
      emailProvided: true,
      platformAdminFound: false,
      rejectionReason: "ACCOUNT_NOT_FOUND",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(401, "Invalid email or password");
  }

  // Account lockout check
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const remainingMinutes = Math.max(1, Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000));
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/platform/login",
      emailProvided: true,
      platformAdminFound: true,
      accountLocked: true,
      remainingMinutes,
      rejectionReason: "ACCOUNT_LOCKED",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(423, `Account temporarily locked due to repeated failed attempts. Please retry in ${remainingMinutes} minute(s).`);
  }

  if (!admin.isActive) {
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/platform/login",
      emailProvided: true,
      platformAdminFound: true,
      platformAdminActive: false,
      rejectionReason: "ACCOUNT_INACTIVE",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(403, "Your platform administrator account is inactive.");
  }

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) {
    const nextAttempts = (admin.failedLoginAttempts || 0) + 1;
    const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

    if (db.platformAdmin.update) {
      await db.platformAdmin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: nextAttempts,
          lockedUntil: lockedUntil || admin.lockedUntil,
        },
      });
    }

    try {
      await db.platformAdminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          targetAdminId: admin.id,
          action: shouldLock ? "platform_admin.account_locked" : "platform_admin.login_failed",
          metadata: JSON.stringify({
            ip: clientIp,
            failedAttempts: nextAttempts,
            locked: shouldLock,
          }),
        },
      });
    } catch {
      // Non-blocking audit record failure
    }

    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/platform/login",
      emailProvided: true,
      platformAdminFound: true,
      failedAttempts: nextAttempts,
      accountLockedNow: shouldLock,
      passwordValid: false,
      rejectionReason: shouldLock ? "LOCKED_MAX_ATTEMPTS" : "INVALID_PASSWORD",
      durationMs: Date.now() - startTime,
    }));

    if (shouldLock) {
      throw new ApiError(423, `Account locked due to 5 consecutive failed attempts. Locked for ${LOCKOUT_MINUTES} minutes.`);
    }

    throw new ApiError(401, "Invalid email or password");
  }

  // Login succeeded: reset failed attempts & record activity
  if (db.platformAdmin.update) {
    await db.platformAdmin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: clientIp || null,
      },
    });
  }

  try {
    await db.platformAdminAuditLog.create({
      data: {
        actorAdminId: admin.id,
        targetAdminId: admin.id,
        action: "platform_admin.login_success",
        metadata: JSON.stringify({ ip: clientIp, userAgent: requestId }),
      },
    });
  } catch {
    // Non-blocking
  }

  const token = signPlatformToken(admin);
  const access = platformRoleService.resolvePlatformAccess(admin, platformRoleService.normalizeSuperAdminEmails(env.platformSuperAdminEmails));

  console.log(JSON.stringify({
    event: "auth_diagnostic",
    requestId,
    endpoint: "/api/platform/login",
    emailProvided: true,
    platformAdminFound: true,
    accountType: "platform",
    passwordValid: true,
    tokenCreated: true,
    durationMs: Date.now() - startTime,
  }));

  return {
    accountType: "platform",
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: access.platformRole,
      permissions: access.permissions,
      lastLoginAt: admin.lastLoginAt,
    },
    redirectTo: "/super-admin/dashboard",
  };
}

async function changeAdminPassword(adminId, currentPassword, newPassword, db = prisma) {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters long.");
  }
  const admin = await db.platformAdmin.findUnique({ where: { id: adminId } });
  if (!admin) throw new ApiError(404, "Platform administrator not found.");

  const valid = await comparePassword(currentPassword, admin.passwordHash);
  if (!valid) throw new ApiError(401, "Current password is incorrect.");

  const newHash = await hashPassword(newPassword);
  await db.platformAdmin.update({
    where: { id: adminId },
    data: {
      passwordHash: newHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await db.platformAdminAuditLog.create({
    data: {
      actorAdminId: adminId,
      targetAdminId: adminId,
      action: "platform_admin.password_changed",
      metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
    },
  });

  return { success: true, message: "Password updated successfully." };
}

module.exports = { login, changeAdminPassword };
