const { OAuth2Client } = require("google-auth-library");
const prisma = require("../config/db");
const { hashPassword, comparePassword, signToken } = require("../utils/auth");
const { ApiError } = require("../utils/http");
const env = require("../config/env");

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

async function login(email, password) {
  // Email is unique per-restaurant, not globally, so a login attempt must
  // check every matching row rather than assuming a single global user.
  const users = await prisma.user.findMany({ where: { email } });
  const user = users.find((u) => u.isActive);
  if (!user) throw new ApiError(401, "Invalid email or password");

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) throw new ApiError(401, "Invalid email or password");

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId },
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
  });
  if (users.length > 1) {
    throw new ApiError(409, "Multiple restaurant accounts use this Google email. Sign in with email and password or contact your administrator.");
  }
  const user = users[0];
  if (!user) {
    throw new ApiError(404, "No existing restaurant account uses this Google email. Ask your administrator to create an account or sign in with email and password.");
  }
  if (!user.isActive) {
    throw new ApiError(403, "This restaurant account is inactive. Contact your administrator.");
  }

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId },
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
    return created;
  });

  return restaurant;
}

module.exports = { login, getGoogleAuthorizationUrl, googleLoginWithCode, registerRestaurant };
