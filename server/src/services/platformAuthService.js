const prisma = require("../config/db");
const { comparePassword, signPlatformToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const platformRoleService = require("./platformRoleService");

async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await prisma.platformAdmin.findUnique({ where: { email: normalizedEmail } });
  if (!admin || !admin.isActive) throw new ApiError(401, "Invalid email or password");

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  const token = signPlatformToken(admin);
  const access = platformRoleService.resolvePlatformAccess(admin, platformRoleService.normalizeSuperAdminEmails(env.platformSuperAdminEmails));
  return { token, admin: { id: admin.id, name: admin.name, email: admin.email, role: access.platformRole, permissions: access.permissions } };
}

module.exports = { login };
