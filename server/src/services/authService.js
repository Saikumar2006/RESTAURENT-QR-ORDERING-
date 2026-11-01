const { OAuth2Client } = require("google-auth-library");
const prisma = require("../config/db");
const { hashPassword, comparePassword, signToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");
const roleService = require("./roleService");
const { PERMISSIONS_BY_ROLE } = roleService;

function serializeUserAccess(user) {
  const role = user.roleRecord;
  const isOwner = role?.name === "OWNER" || (!role && user.role === "ADMIN");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleId: role?.id || null,
    roleName: role?.name || (user.role === "ADMIN" ? "OWNER" : "STAFF"),
    permissions: isOwner
      ? ["*"]
      : role
        ? [...new Set(role.permissions.map((entry) => entry.permission.key))]
        : PERMISSIONS_BY_ROLE.STAFF,
    restaurantId: user.restaurantId,
    preferredLanguage: user.preferredLanguage || "en",
    subscriptionStatus: user.restaurant?.subscriptions?.[0]?.status || "LEGACY",
    subscriptionEndsAt: user.restaurant?.subscriptions?.[0]?.endsAt || null,
    subscriptionGraceEndsAt: user.restaurant?.subscriptions?.[0]?.graceEndsAt || null,
    subscriptionAccess: (() => {
      const subscription = user.restaurant?.subscriptions?.[0];
      if (!subscription) return true;
      const now = new Date();
      return subscription.status === "GRANDFATHERED"
        || (subscription.status === "ACTIVE" && subscription.endsAt && subscription.endsAt > now)
        || (subscription.status === "TRIALING" && subscription.trialEndsAt && subscription.trialEndsAt > now)
        || (subscription.status === "PAST_DUE" && subscription.graceEndsAt && subscription.graceEndsAt > now);
    })(),
  };
}

function createGoogleClient() {
  if (!env.googleClientId || !env.googleClientSecret || !env.googleCallbackUrl) {
    throw new ApiError(503, "Google sign-in is not configured.");
  }

  return new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleCallbackUrl);
}

function getGoogleAuthorizationUrl(state) {
  return createGoogleClient().generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
}

async function login(email, password, requestId = null, restaurantSlug = null) {
  const startTime = Date.now();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || typeof password !== "string" || !password) {
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/auth/login",
      emailProvided: Boolean(normalizedEmail),
      rejectionReason: "MISSING_CREDENTIALS",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(401, "Invalid email or password");
  }

  // Email is unique per-restaurant, not globally, so check every matching row
  const users = await prisma.user.findMany({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    include: {
      roleRecord: { include: { permissions: { include: { permission: true } } } },
      restaurant: { select: { id: true, name: true, slug: true, status: true, subscriptions: { select: { status: true, endsAt: true, trialEndsAt: true, graceEndsAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });

  let user = null;
  const activeUsers = users.filter((u) => u.isActive && u.restaurant?.status === "ACTIVE");

  if (activeUsers.length > 1) {
    // 1. If an explicit restaurant slug or ID is provided, select that account
    if (restaurantSlug) {
      const targetSlug = String(restaurantSlug).trim().toLowerCase();
      user = activeUsers.find((u) => u.restaurant?.slug?.toLowerCase() === targetSlug || u.restaurantId === restaurantSlug);
    }

    // 2. If no slug matched or none provided, test candidate passwords
    if (!user) {
      const matchingPasswordUsers = [];
      for (const candidate of activeUsers) {
        if (await comparePassword(password, candidate.passwordHash)) {
          matchingPasswordUsers.push(candidate);
        }
      }

      if (matchingPasswordUsers.length === 1) {
        user = matchingPasswordUsers[0];
      } else if (matchingPasswordUsers.length > 1) {
        // If multiple active restaurants share identical passwords, prioritize OWNER/ADMIN account
        const ownerAccounts = matchingPasswordUsers.filter((u) => u.role === "ADMIN");
        if (ownerAccounts.length === 1) {
          user = ownerAccounts[0];
        } else {
          console.log(JSON.stringify({
            event: "auth_diagnostic",
            requestId,
            endpoint: "/api/auth/login",
            emailProvided: true,
            matchCount: matchingPasswordUsers.length,
            rejectionReason: "MULTIPLE_ACCOUNTS",
            durationMs: Date.now() - startTime,
          }));
          throw new ApiError(409, "Multiple restaurant accounts match this email. Please select your restaurant.", {
            code: "MULTIPLE_ACCOUNTS",
            restaurants: matchingPasswordUsers.map((u) => ({
              id: u.restaurant.id,
              name: u.restaurant.name,
              slug: u.restaurant.slug,
              role: u.role,
            })),
          });
        }
      }
    }
  } else if (activeUsers.length === 1) {
    user = activeUsers[0];
  } else if (users.length > 0) {
    user = users[0];
  }

  if (!user) {
    let admin = prisma.platformAdmin ? await prisma.platformAdmin.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    }) : null;

    const bootstrapEmail = (process.env.INITIAL_PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
    const bootstrapPassword = process.env.INITIAL_PLATFORM_ADMIN_PASSWORD || "";
    if (prisma.platformAdmin && bootstrapEmail && bootstrapPassword && normalizedEmail === bootstrapEmail && password === bootstrapPassword) {
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
          endpoint: "/api/auth/login",
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
          endpoint: "/api/auth/login",
          emailProvided: true,
          platformAdminFound: true,
          platformAdminActive: false,
          passwordValid: true,
          rejectionReason: "ACCOUNT_INACTIVE",
          durationMs: Date.now() - startTime,
        }));
        throw new ApiError(403, "Your platform administrator account is inactive.");
      }
      const platformRoleService = require("./platformRoleService");
      const { signPlatformToken } = require("../utils/auth");
      const token = signPlatformToken(admin);
      const access = platformRoleService.resolvePlatformAccess(admin, platformRoleService.normalizeSuperAdminEmails(env.platformSuperAdminEmails));
      console.log(JSON.stringify({
        event: "auth_diagnostic",
        requestId,
        endpoint: "/api/auth/login",
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

    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/auth/login",
      emailProvided: true,
      userFound: false,
      platformAdminFound: false,
      rejectionReason: "ACCOUNT_NOT_FOUND",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(401, "Invalid email or password");
  }

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    // If tenant password failed, check if this is a platform admin account
    const admin = prisma.platformAdmin ? await prisma.platformAdmin.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    }) : null;
    if (admin && admin.isActive && await comparePassword(password, admin.passwordHash)) {
      const platformRoleService = require("./platformRoleService");
      const { signPlatformToken } = require("../utils/auth");
      const token = signPlatformToken(admin);
      const access = platformRoleService.resolvePlatformAccess(admin, platformRoleService.normalizeSuperAdminEmails(env.platformSuperAdminEmails));
      return {
        accountType: "platform",
        token,
        admin: { id: admin.id, name: admin.name, email: admin.email, role: access.platformRole, permissions: access.permissions },
        redirectTo: "/super-admin/dashboard",
      };
    }

    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/auth/login",
      emailProvided: true,
      userFound: true,
      userActive: user.isActive,
      restaurantStatus: user.restaurant?.status,
      passwordValid: false,
      rejectionReason: "INVALID_PASSWORD",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/auth/login",
      emailProvided: true,
      userFound: true,
      userActive: false,
      passwordValid: true,
      rejectionReason: "ACCOUNT_INACTIVE",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(403, "Your account is inactive. Please contact your restaurant administrator.");
  }

  if (user.restaurant?.status !== "ACTIVE") {
    console.log(JSON.stringify({
      event: "auth_diagnostic",
      requestId,
      endpoint: "/api/auth/login",
      emailProvided: true,
      userFound: true,
      userActive: true,
      restaurantStatus: user.restaurant?.status,
      passwordValid: true,
      rejectionReason: "RESTAURANT_INACTIVE",
      durationMs: Date.now() - startTime,
    }));
    throw new ApiError(403, "This restaurant account is currently suspended or inactive. Please contact support.");
  }

  const token = signToken(user);
  console.log(JSON.stringify({
    event: "auth_diagnostic",
    requestId,
    endpoint: "/api/auth/login",
    emailProvided: true,
    userFound: true,
    accountType: "tenant",
    passwordValid: true,
    tokenCreated: true,
    durationMs: Date.now() - startTime,
  }));

  return {
    token,
    user: serializeUserAccess(user),
  };
}

async function googleLoginWithCode(code) {
  const client = createGoogleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new ApiError(401, "Google sign-in could not be verified.");

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.name || payload.email_verified !== true) {
    throw new ApiError(401, "Google sign-in requires a verified Google email address.");
  }

  const users = await prisma.user.findMany({
    where: { email: { equals: payload.email, mode: "insensitive" } },
    include: {
      roleRecord: { include: { permissions: { include: { permission: true } } } },
      restaurant: { select: { status: true, subscriptions: { select: { status: true, endsAt: true, trialEndsAt: true, graceEndsAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
  if (users.length > 1) {
    throw new ApiError(409, "Multiple restaurant accounts use this Google email. Sign in with email and password or contact your administrator.");
  }
  const user = users[0];
  if (!user) {
    throw new ApiError(404, "No existing restaurant account uses this Google email. Ask your administrator to create an account or sign in with email and password.");
  }
  if (!user.isActive || user.restaurant?.status !== "ACTIVE") {
    throw new ApiError(403, "This restaurant account is inactive. Contact your administrator.");
  }

  const token = signToken(user);
  return {
    token,
    user: serializeUserAccess(user),
  };
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "restaurant";
}

// Turns a restaurant name into a unique, URL-safe slug — this is what the
// customer-facing URL and QR code are built from (see tableService.js), so
// it's what makes each restaurant's ordering page + QR "self generating"
// with zero manual entry. Appends -2, -3, ... on collision.
async function generateUniqueSlug(name) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.restaurant.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

async function registerRestaurant(input) {
  const slug = input.slug ? input.slug : await generateUniqueSlug(input.name);
  if (input.slug) {
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (existing) throw new ApiError(409, "That restaurant slug is already taken");
  }

  const passwordHash = await hashPassword(input.adminPassword);

  const restaurant = await prisma.$transaction(async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        name: input.name,
        slug,
        taxPercent: input.taxPercent ?? 0,
        serviceChargePercent: input.serviceChargePercent ?? 0,
        currency: input.currency ?? "INR",
        cuisineType: input.cuisineType || null,
      },
    });
    await tx.user.create({
      data: {
        restaurantId: created.id,
        name: input.adminName,
        email: input.adminEmail,
        passwordHash,
        role: "ADMIN",
      },
    });
    await roleService.ensureRestaurantRoles(created.id, tx);
    return created;
  });

  return restaurant;
}

module.exports = { login, getGoogleAuthorizationUrl, googleLoginWithCode, registerRestaurant };
