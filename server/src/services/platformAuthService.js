const prisma = require("../config/db");
const { comparePassword, signPlatformToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const platformRoleService = require("./platformRoleService");

async function login(email, password, requestId = null) {
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

  const admin = await prisma.platformAdmin.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

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
  const tenantResult = await authService.login(email, password, requestId);
  return tenantResult;
}

module.exports = { login };
