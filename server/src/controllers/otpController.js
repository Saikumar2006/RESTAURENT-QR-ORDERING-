const otpService = require("../services/otpService");
const { ok, asyncHandler } = require("../utils/http");

const sendOtp = asyncHandler(async (req, res) => {
  const result = await otpService.sendOtp(req.params.slug, req.body.phone);
  ok(res, result);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await otpService.verifyOtp(req.body.phone, req.body.code);
  ok(res, result);
});

module.exports = { sendOtp, verifyOtp };
