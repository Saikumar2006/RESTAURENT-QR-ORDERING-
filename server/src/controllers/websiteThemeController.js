const { ok, created, asyncHandler, ApiError } = require("../utils/http");
const themeService = require("../services/websiteThemeService");
const storageService = require("../services/storageService");

function restaurantIdFor(req) {
  if (req.params.id !== req.user.restaurantId) throw new ApiError(403, "Forbidden");
  return req.user.restaurantId;
}

const getEditorState = asyncHandler(async (req, res) => {
  ok(res, await themeService.createWebsiteThemeService().getEditorState(restaurantIdFor(req)));
});

const saveDraft = asyncHandler(async (req, res) => {
  const result = await themeService.createWebsiteThemeService().saveDraft(restaurantIdFor(req), req.user.id, req.body.config);
  created(res, result);
});

const publishDraft = asyncHandler(async (req, res) => {
  ok(res, await themeService.createWebsiteThemeService().publishDraft(restaurantIdFor(req), req.user.id, req.params.versionId));
});

const rollback = asyncHandler(async (req, res) => {
  ok(res, await themeService.createWebsiteThemeService().rollback(restaurantIdFor(req), req.user.id, req.params.versionId));
});

const restoreDefault = asyncHandler(async (req, res) => {
  ok(res, await themeService.createWebsiteThemeService().restoreDefault(restaurantIdFor(req), req.user.id));
});

const uploadImage = asyncHandler(async (req, res) => {
  const restaurantId = restaurantIdFor(req);
  const result = await storageService.uploadThemeFile(req.file, restaurantId);
  created(res, result);
});

const getPublicTheme = asyncHandler(async (req, res) => {
  ok(res, await themeService.createWebsiteThemeService().getPublicTheme(req.params.slug));
});

module.exports = { getEditorState, saveDraft, publishDraft, rollback, restoreDefault, uploadImage, getPublicTheme };
