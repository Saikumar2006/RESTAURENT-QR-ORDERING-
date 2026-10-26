const { randomUUID } = require("crypto");
const { z } = require("zod");
const prisma = require("../config/db");
const env = require("../config/env");
const { ApiError } = require("../utils/http");

const DEFAULT_THEME = Object.freeze({
  preset: "ELEGANT",
  logoUrl: null,
  bannerUrl: null,
  primaryColor: "#75432f",
  backgroundColor: "#fffaf4",
  textColor: "#28231f",
  buttonTextColor: "#ffffff",
  typography: "serif",
  layout: "editorial",
  featuredSections: ["featured", "about", "hours"],
});

const colorField = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const themeSchema = z.object({
  preset: z.enum(["ELEGANT", "STREET_FOOD", "LUXURY_DARK", "FRESH_GREEN"]),
  logoUrl: z.string().max(500).nullable(),
  bannerUrl: z.string().max(500).nullable(),
  primaryColor: colorField,
  backgroundColor: colorField,
  textColor: colorField,
  buttonTextColor: colorField,
  typography: z.enum(["sans", "serif", "rounded"]),
  layout: z.enum(["centered", "editorial", "compact"]),
  featuredSections: z.array(z.enum(["featured", "about", "hours"])).max(3),
}).strict();

const PRESETS = Object.freeze({
  ELEGANT: DEFAULT_THEME,
  STREET_FOOD: Object.freeze({ ...DEFAULT_THEME, preset: "STREET_FOOD", primaryColor: "#a43424", backgroundColor: "#fff7ec", textColor: "#2d201a", typography: "rounded", layout: "compact" }),
  LUXURY_DARK: Object.freeze({ ...DEFAULT_THEME, preset: "LUXURY_DARK", primaryColor: "#d1aa64", backgroundColor: "#171715", textColor: "#f4efe5", buttonTextColor: "#201a10", typography: "serif", layout: "editorial" }),
  FRESH_GREEN: Object.freeze({ ...DEFAULT_THEME, preset: "FRESH_GREEN", primaryColor: "#206445", backgroundColor: "#f2faf4", textColor: "#1c3327", typography: "sans", layout: "centered" }),
});

function parseConfig(raw) {
  try {
    return themeSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new ApiError(400, "Invalid website theme configuration");
    throw error;
  }
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a, b) {
  const values = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function validateTheme(raw, restaurantId, storage = env) {
  const config = parseConfig(raw);
  if (contrastRatio(config.textColor, config.backgroundColor) < 4.5
    || contrastRatio(config.buttonTextColor, config.primaryColor) < 4.5) {
    throw new ApiError(400, "Choose colors with at least 4.5:1 text contrast for readable content and buttons.");
  }
  const assetBase = storage.supabaseUrl && storage.supabaseStorageBucket
    ? `${storage.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${storage.supabaseStorageBucket}/themes/${restaurantId}/`
    : null;
  for (const asset of [config.logoUrl, config.bannerUrl]) {
    if (asset && (!assetBase || !asset.startsWith(assetBase) || asset.includes(".."))) {
      throw new ApiError(400, "Theme images must be uploaded to this restaurant's theme storage.");
    }
  }
  return config;
}

function createWebsiteThemeService(database = prisma, storage = env) {
  async function allocateVersion(tx, restaurantId) {
    const restaurant = await tx.restaurant.update({
      where: { id: restaurantId },
      data: { websiteThemeVersion: { increment: 1 } },
      select: { websiteThemeVersion: true },
    });
    return restaurant.websiteThemeVersion;
  }

  async function audit(tx, restaurantId, actorId, action, version) {
    await tx.auditLog.create({
      data: {
        restaurantId,
        userId: actorId,
        action,
        resource: "website_theme",
        resourceId: version.id,
        metadata: JSON.stringify({ version: version.version, status: version.status }),
      },
    });
  }

  async function getEditorState(restaurantId) {
    const versions = await database.websiteThemeVersion.findMany({
      where: { restaurantId }, orderBy: { version: "desc" }, take: 30,
    });
    const safeVersions = versions.map((row) => ({ ...row, config: parseConfig(row.config) }));
    return {
      draft: safeVersions.find((row) => row.status === "DRAFT") || null,
      published: safeVersions.find((row) => row.status === "PUBLISHED") || null,
      versions: safeVersions,
      defaultConfig: DEFAULT_THEME,
    };
  }

  async function saveDraft(restaurantId, actorId, rawConfig) {
    const config = validateTheme(rawConfig, restaurantId, storage);
    try {
      return await database.$transaction(async (tx) => {
        const version = await allocateVersion(tx, restaurantId);
        const row = await tx.websiteThemeVersion.create({ data: {
          id: randomUUID(), restaurantId, version, status: "DRAFT", config: JSON.stringify(config), createdBy: actorId,
        } });
        await audit(tx, restaurantId, actorId, "website_theme.draft_saved", row);
        return { ...row, config };
      });
    } catch (error) {
      if (error.code === "P2002") throw new ApiError(409, "Theme version changed while saving. Please retry.");
      throw error;
    }
  }

  async function publishDraft(restaurantId, actorId, versionId) {
    return database.$transaction(async (tx) => {
      const draft = await tx.websiteThemeVersion.findFirst({ where: { id: versionId, restaurantId, status: "DRAFT" } });
      if (!draft) throw new ApiError(404, "Draft theme version not found");
      const row = await tx.websiteThemeVersion.update({
        where: { id: draft.id }, data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      await audit(tx, restaurantId, actorId, "website_theme.published", row);
      return { ...row, config: parseConfig(row.config) };
    });
  }

  async function publishCopy(restaurantId, actorId, config, action) {
    return database.$transaction(async (tx) => {
      const version = await allocateVersion(tx, restaurantId);
      const row = await tx.websiteThemeVersion.create({ data: {
        id: randomUUID(), restaurantId, version, status: "PUBLISHED", config: JSON.stringify(config),
        createdBy: actorId, publishedAt: new Date(),
      } });
      await audit(tx, restaurantId, actorId, action, row);
      return { ...row, config };
    });
  }

  async function rollback(restaurantId, actorId, versionId) {
    const source = await database.websiteThemeVersion.findFirst({ where: { id: versionId, restaurantId, status: "PUBLISHED" } });
    if (!source) throw new ApiError(404, "Published theme version not found");
    return publishCopy(restaurantId, actorId, parseConfig(source.config), "website_theme.rolled_back");
  }

  async function restoreDefault(restaurantId, actorId) {
    return publishCopy(restaurantId, actorId, DEFAULT_THEME, "website_theme.default_restored");
  }

  async function getPublicTheme(slug) {
    const restaurant = await database.restaurant.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true } });
    if (!restaurant) throw new ApiError(404, "Restaurant not found");
    const row = await database.websiteThemeVersion.findFirst({
      where: { restaurantId: restaurant.id, status: "PUBLISHED" }, orderBy: { version: "desc" },
    });
    return { version: row?.version || 0, config: row ? parseConfig(row.config) : DEFAULT_THEME };
  }

  return { getEditorState, saveDraft, publishDraft, rollback, restoreDefault, getPublicTheme };
}

module.exports = { DEFAULT_THEME, PRESETS, themeSchema, parseConfig, validateTheme, contrastRatio, createWebsiteThemeService };
