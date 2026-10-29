const prisma = require("../config/db");
const { comparePassword, signPlatformToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const platformRoleService = require("./platformRoleService");

async function login(email, password) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || typeof password !== "string" || !password) {
    throw new ApiError(401, "Invalid email or password");
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { email: normalizedEmail } });
  if (admin && admin.isActive) {
    const valid = await comparePassword(password, admin.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid email or password");

    const token = signPlatformToken(admin);
    const access = platformRoleService.resolvePlatformAccess(admin, platformRoleService.normalizeSuperAdminEmails(env.platformSuperAdminEmails));
    return {
      accountType: "platform",
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: access.platformRole, permissions: access.permissions },
      redirectTo: "/super-admin/dashboard",
    };
  }

  // Fall back to tenant user (restaurant owner or staff)
  const authService = require("./authService");
  const tenantResult = await authService.login(email, password);
  return tenantResult;
}

module.exports = { login };
