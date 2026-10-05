const authService = require("../services/authService");
const prisma = require("../config/db");
const { ok, created, asyncHandler } = require("../utils/http");
const { randomBytes, timingSafeEqual } = require("crypto");
const env = require("../config/env");

const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_STATE_COOKIE_PATH = "/api/auth/google/callback";
const GOOGLE_STATE_MAX_AGE = 5 * 60 * 1000;

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: GOOGLE_STATE_COOKIE_PATH,
    maxAge: GOOGLE_STATE_MAX_AGE,
  };
}

function clearStateCookie(res) {
  const options = stateCookieOptions();
  delete options.maxAge;
  res.clearCookie(GOOGLE_STATE_COOKIE, options);
}

function getCookie(req, name) {
  const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return "";
  }
}

function validOAuthState(expected, received) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function redirectToLogin(res, error) {
  const target = new URL("/admin/login", env.clientUrl);
  target.hash = new URLSearchParams({ google_error: error }).toString();
  return res.redirect(target.toString());
}

function googleStart(req, res) {
  const state = randomBytes(32).toString("base64url");
  res.cookie(GOOGLE_STATE_COOKIE, state, stateCookieOptions());
  try {
    return res.redirect(authService.getGoogleAuthorizationUrl(state));
  } catch (error) {
    clearStateCookie(res);
    return redirectToLogin(res, error.status === 503 ? "not_configured" : "oauth_failed");
  }
}

async function googleCallback(req, res) {
  const expectedState = getCookie(req, GOOGLE_STATE_COOKIE);
  const receivedState = typeof req.query.state === "string" ? req.query.state : "";
  clearStateCookie(res);

  if (!validOAuthState(expectedState, receivedState)) return redirectToLogin(res, "invalid_state");
  if (req.query.error) return redirectToLogin(res, req.query.error === "access_denied" ? "cancelled" : "oauth_failed");
  if (typeof req.query.code !== "string" || !req.query.code) return redirectToLogin(res, "oauth_failed");

  try {
    const result = await authService.googleLoginWithCode(req.query.code);
    const target = new URL("/admin", env.clientUrl);
    target.hash = new URLSearchParams({ google_token: result.token }).toString();
    return res.redirect(target.toString());
  } catch (error) {
    const errorCode = error.status === 404 ? "account_not_found"
      : error.status === 409 ? "ambiguous_account"
        : error.status === 403 ? "inactive_account"
          : error.status === 503 ? "not_configured" : "oauth_failed";
    return redirectToLogin(res, errorCode);
  }
}

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  ok(res, result);
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  ok(res, { id: user.id, name: user.name, email: user.email, role: user.role, restaurantId: user.restaurantId });
});

const registerRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await authService.registerRestaurant(req.body);
  created(res, restaurant);
});

module.exports = { login, googleStart, googleCallback, me, registerRestaurant };
