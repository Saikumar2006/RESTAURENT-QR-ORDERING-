const { verifyToken } = require("../utils/auth");
const { fail } = require("../utils/http");
const prisma = require("../config/db");
const { PERMISSIONS_BY_ROLE } = require("../services/roleService");

// Requires a valid Bearer token. Attaches req.user = { id, restaurantId, role }.
// This is the ONLY source of truth for restaurantId on authenticated routes —
// we never trust a restaurantId supplied in the request body/params for
// authorization decisions.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return fail(res, 401, "Authentication required");

    const payload = verifyToken(token);
    if (payload.type !== "tenant") return fail(res, 401, "Invalid or expired session");
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roleRecord: { include: { permissions: { include: { permission: true } } } },
        restaurant: { select: { status: true } },
      },
    });
    if (!user || !user.isActive || user.restaurant?.status !== "ACTIVE") {
      return fail(res, 401, "Invalid or expired session");
    }

    const role = user.roleRecord;
    const isOwner = role?.name === "OWNER" || (!role && user.role === "ADMIN");
    const permissions = isOwner
      ? ["*"]
      : role
        ? role.permissions.map((entry) => entry.permission.key)
        : PERMISSIONS_BY_ROLE.STAFF;
    req.user = {
      id: user.id,
      restaurantId: user.restaurantId,
      role: user.role,
      roleId: role?.id || null,
      roleName: role?.name || (user.role === "ADMIN" ? "OWNER" : "STAFF"),
      permissions: [...new Set(permissions)],
      isOwner,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    return fail(res, 401, "Invalid or expired session");
  }
}

// Attaches req.user if a valid Bearer token is present, but does not reject
// the request otherwise. Used on endpoints reachable by both authenticated
// staff and anonymous guest customers (e.g. GET /api/orders/:id).
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return next();

    const payload = verifyToken(token);
    if (payload.type !== "tenant") return next();
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.isActive) {
      req.user = { id: user.id, restaurantId: user.restaurantId, role: user.role, name: user.name, email: user.email };
    }
    next();
  } catch {
    next();
  }
}

// Restrict to specific roles, e.g. requireRole("ADMIN")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, "You do not have permission to perform this action");
    }
    next();
  };
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    const granted = req.user?.permissions || [];
    if (granted.includes("*") || permissions.some((permission) => granted.includes(permission))) {
      return next();
    }
    return fail(res, 403, "You do not have permission to perform this action");
  };
}

// Platform (cross-restaurant) auth — completely separate from requireAuth
// above. See the comment on the PlatformAdmin model for why this isn't
// just another User role.
async function requirePlatformAuth(req, res, next) {
  try {
    const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim())
      .find((part) => part.startsWith("svaadya_platform_session="));
    let cookieToken = "";
    try { cookieToken = cookie ? decodeURIComponent(cookie.slice("svaadya_platform_session=".length)) : ""; } catch { /* Reject malformed cookies below. */ }
    const token = cookieToken || null;
    if (!token) return fail(res, 401, "Authentication required");

    const payload = verifyToken(token);
    if (payload.type !== "platform") return fail(res, 401, "Invalid or expired session");
    const admin = await prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) return fail(res, 401, "Invalid or expired session");

    req.platformAdmin = { id: admin.id, name: admin.name, email: admin.email };
    res.setHeader("Cache-Control", "no-store");
    next();
  } catch (err) {
    return fail(res, 401, "Invalid or expired session");
  }
}

module.exports = { requireAuth, requireRole, requirePermission, optionalAuth, requirePlatformAuth };
