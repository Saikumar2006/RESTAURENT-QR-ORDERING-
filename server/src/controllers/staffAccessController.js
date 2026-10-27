const staffAccessService = require("../services/staffAccessService");
const { ok, asyncHandler } = require("../utils/http");

const getLink = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  ok(res, await staffAccessService.getAccessLink(req.params.token));
});

const setPassword = asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  ok(res, await staffAccessService.setPassword(req.params.token, req.body.password));
});

module.exports = { getLink, setPassword };
