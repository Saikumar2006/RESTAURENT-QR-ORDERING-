const prisma = require("../config/db");
const { comparePassword, signPlatformToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");

async function login(email, password) {
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) throw new ApiError(401, "Invalid email or password");

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  const token = signPlatformToken(admin);
  return { token, admin: { id: admin.id, name: admin.name, email: admin.email } };
}

module.exports = { login };
