const prisma = require("../config/db");
const { comparePassword, signPlatformToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const platformRoleService = require("./platformRoleService");

async function login(email, password, requestId = null, restaurantSlug = null) {
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

  let admin = await prisma.platformAdmin.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

  const bootstrapEmail = (process.env.INITIAL_PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  const bootstrapPassword = process.env.INITIAL_PLATFORM_ADMIN_PASSWORD || "";
  if (bootstrapEmail && bootstrapPassword && normalizedEmail === bootstrapEmail && password === bootstrapPassword) {
    const { hashPassword } = require("../utils/auth");
    const newHash = await hashPassword(password);
    if (!admin) {
      admin = await prisma.platformAdmin.create({
        data: {
          name: process.env.INITIAL_PLATFORM_ADMIN_NAME || "Platform Super Admin",
          email: normalizedEmail,
          passwordHash: newHash,
          platformRole: process.env.INITIAL_PLATFORM_ADMIN_ROLE || "SUPER_ADMIN",
          isActive: true,
        },
      });
    } else if (!admin.isActive || !(await comparePassword(password, admin.passwordHash))) {
      admin = await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { passwordHash: newHash, isActive: true, platformRole: "SUPER_ADMIN" },
      });
    }
  }

  if (admin) {
    const valid = await comparePassword(password, admin.passwordHash);
    if (!valid) {
      console.log(JSON.stringify({
        event: "auth_diagnostic",
        requestId,
        endpoint: "/api/platform/login",
        emailProvided: true,
        platformAdminFound: true,
        platformAdminActive: admin.isActive,
        passwordValid: false,
        rejectionReason: "INVALID_PASSWORD",
        durationMs: Date.now() - startTime,
      }));
      throw new ApiError(401, "Invalid email or password");
    }

    if (!admin.isActive) {
      console.log(JSON.stringify({
        event: "auth_diagnostic",
        requestId,
        endpoint: "/api/platform/login",
        emailProvided: true,
        platformAdminFound: true,
        platformAdminActive: false,
        passwordValid: true,
        rejectionReason: "ACCOUNT_INACTIVE",
        durationMs: Date.now() - startTime,
      }));
      throw new ApiError(403, "Your platform administrator account is inactive.");
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
      admin: { id: admin.id, name: admin.name, email: admin.email, role: access.platformRole, permissions: access.permissions },
      redirectTo: "/super-admin/dashboard",
    };
  }

  // Fall back to tenant user (restaurant owner or staff)
  const authService = require("./authService");
  const tenantResult = await authService.login(email, password, requestId, restaurantSlug);
  return tenantResult;
}

module.exports = { login };
