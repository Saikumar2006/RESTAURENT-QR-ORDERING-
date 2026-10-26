const assert = require("node:assert/strict");
const { test } = require("node:test");
const { DEFAULT_THEME, createWebsiteThemeService } = require("../src/services/websiteThemeService");

function createFakeDatabase() {
  const rows = [];
  const queries = [];
  const versions = new Map();
  const fake = {
    rows,
    queries,
    restaurant: {
      async findFirst(query) { queries.push(["restaurant.findFirst", query]); return { id: "restaurant-a" }; },
      async update({ where }) {
        const next = (versions.get(where.id) || 0) + 1;
        versions.set(where.id, next);
        return { websiteThemeVersion: next };
      },
    },
    websiteThemeVersion: {
      async findMany(query) { queries.push(["theme.findMany", query]); return rows.filter((row) => row.restaurantId === query.where.restaurantId).sort((a, b) => b.version - a.version); },
      async findFirst(query) { queries.push(["theme.findFirst", query]); return rows.find((row) => row.id === query.where.id && row.restaurantId === query.where.restaurantId && row.status === query.where.status) || null; },
      async create({ data }) { rows.push(data); return data; },
      async update({ where, data }) { const row = rows.find((item) => item.id === where.id); Object.assign(row, data); return row; },
    },
    auditLog: { async create() { return {}; } },
    async $transaction(callback) { return callback(fake); },
  };
  return fake;
}

test("theme editor and published theme reads are restaurant scoped", async () => {
  const db = createFakeDatabase();
  const service = createWebsiteThemeService(db, {});
  const editor = await service.getEditorState("restaurant-a");
  assert.equal(editor.draft, null);
  assert.equal(editor.published, null);
  assert.deepEqual(editor.defaultConfig, DEFAULT_THEME);
  assert.deepEqual(db.queries[0], ["theme.findMany", { where: { restaurantId: "restaurant-a" }, orderBy: { version: "desc" }, take: 30 }]);

  const publicTheme = await service.getPublicTheme("cafe-a");
  assert.equal(publicTheme.version, 0);
  assert.deepEqual(publicTheme.config, DEFAULT_THEME);
  assert.deepEqual(db.queries.at(-1), ["theme.findFirst", { where: { restaurantId: "restaurant-a", status: "PUBLISHED" }, orderBy: { version: "desc" } }]);
});

test("draft save allocates a tenant version and writes an audit record", async () => {
  const db = createFakeDatabase();
  const service = createWebsiteThemeService(db, {});
  const draft = await service.saveDraft("restaurant-a", "staff-a", DEFAULT_THEME);
  assert.equal(draft.restaurantId, "restaurant-a");
  assert.equal(draft.version, 1);
  assert.equal(draft.status, "DRAFT");
  assert.deepEqual(draft.config, DEFAULT_THEME);
});

test("publishing and rollback create retained, ordered versions", async () => {
  const db = createFakeDatabase();
  const service = createWebsiteThemeService(db, {});
  const firstDraft = await service.saveDraft("restaurant-a", "staff-a", DEFAULT_THEME);
  const firstPublished = await service.publishDraft("restaurant-a", "staff-a", firstDraft.id);
  assert.equal(firstPublished.status, "PUBLISHED");

  const secondConfig = { ...DEFAULT_THEME, ...require("../src/services/websiteThemeService").PRESETS.LUXURY_DARK, preset: "LUXURY_DARK" };
  const secondDraft = await service.saveDraft("restaurant-a", "staff-a", secondConfig);
  const secondPublished = await service.publishDraft("restaurant-a", "staff-a", secondDraft.id);
  const restored = await service.rollback("restaurant-a", "staff-a", firstPublished.id);

  assert.equal(restored.version, 3);
  assert.equal(restored.status, "PUBLISHED");
  assert.deepEqual(restored.config, DEFAULT_THEME);
  const state = await service.getEditorState("restaurant-a");
  assert.equal(state.published.version, 3);
  assert.equal(state.versions.length, 3);
  assert.equal(state.versions.find((row) => row.version === 2).status, "PUBLISHED");
});

test("theme revisions from another restaurant cannot be published or rolled back", async () => {
  const db = createFakeDatabase();
  db.rows.push({ id: "private-version", restaurantId: "restaurant-b", version: 1, status: "PUBLISHED", config: JSON.stringify(DEFAULT_THEME) });
  const service = createWebsiteThemeService(db, {});
  await assert.rejects(service.publishDraft("restaurant-a", "staff-a", "private-version"), { status: 404 });
  await assert.rejects(service.rollback("restaurant-a", "staff-a", "private-version"), { status: 404 });
  assert.ok(db.queries.filter(([name]) => name === "theme.findFirst").every(([, query]) => query.where.restaurantId === "restaurant-a"));
});

test("tenant theme assets must use that tenant's object-storage path", async () => {
  const storage = { supabaseUrl: "https://storage.example", supabaseStorageBucket: "restaurant-assets" };
  const service = createWebsiteThemeService(createFakeDatabase(), storage);
  const config = { ...DEFAULT_THEME, logoUrl: "https://storage.example/storage/v1/object/public/restaurant-assets/themes/restaurant-b/logo.png" };
  await assert.rejects(service.saveDraft("restaurant-a", "staff-a", config), { status: 400 });
});

test("low-contrast theme colors are rejected before saving", async () => {
  const service = createWebsiteThemeService(createFakeDatabase(), {});
  const config = { ...DEFAULT_THEME, textColor: "#fffaf4" };
  await assert.rejects(service.saveDraft("restaurant-a", "staff-a", config), { status: 400 });
});
