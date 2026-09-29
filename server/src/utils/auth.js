const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const env = require("../config/env");

function signToken(user) {
  return jwt.sign(
    { sub: user.id, restaurantId: user.restaurantId, role: user.role, type: "tenant" },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function signPlatformToken(admin) {
  return jwt.sign({ sub: admin.id, type: "platform" }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

// Issued once an OTP is successfully verified. The client attaches this to
// order creation; orderService checks payload.type + payload.phone matches
// the phone on the order, rather than trusting a "verified" flag the client
// could just set itself. Deliberately short-lived (30 min) — this only
// needs to survive from OTP verification through to placing one order.
function signPhoneVerificationToken(phone) {
  return jwt.sign({ phone, type: "phone_verify" }, env.jwtSecret, { expiresIn: "30m" });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = {
  signToken,
  signPlatformToken,
  signPhoneVerificationToken,
  verifyToken,
  hashPassword,
  comparePassword,
};
