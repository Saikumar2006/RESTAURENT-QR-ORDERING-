const test = require("node:test");
const assert = require("node:assert/strict");

const {
  tableCreateSchema,
  tableUpdateSchema,
  floorLayoutUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
} = require("../src/validators/schemas");

test("Menu & Category validation schemas support variants, addons, and soft-delete fields", () => {
  // Category create & update
  const catValid = categoryCreateSchema.parse({ name: "Starters & Appetizers", displayOrder: 1 });
  assert.equal(catValid.name, "Starters & Appetizers");

  const catUpdate = categoryUpdateSchema.parse({ name: "Beverages", isActive: true });
  assert.equal(catUpdate.name, "Beverages");

  // Menu item with portions/variants and add-ons
  const itemPayload = {
    categoryId: "a0000000-0000-0000-0000-000000000001",
    name: "Paneer Tikka Platter",
    description: "Charcoal grilled paneer cubes",
    price: 280,
    isVeg: true,
    isAvailable: true,
    isBestseller: true,
    variants: [
      { name: "Half (4 pcs)", price: 160 },
      { name: "Full (8 pcs)", price: 280 },
    ],
    addons: [
      { name: "Mint Chutney Dip", price: 30 },
      { name: "Extra Spices", price: 15 },
    ],
  };

  const itemParsed = menuItemCreateSchema.parse(itemPayload);
  assert.equal(itemParsed.name, "Paneer Tikka Platter");
  assert.equal(itemParsed.isBestseller, true);
  assert.equal(itemParsed.variants.length, 2);
  assert.equal(itemParsed.addons.length, 2);

  // Partial update
  const itemPartial = menuItemUpdateSchema.parse({ price: 300, isAvailable: false });
  assert.equal(itemPartial.price, 300);
  assert.equal(itemPartial.isAvailable, false);
});

test("Table and Floor Layout validation schemas support geometry, chairs, and architectural elements", () => {
  // Table Create Schema with round/square/rectangle shapes and chairs
  const tableData = {
    tableNumber: "T-14",
    capacity: 6,
    chairCount: 6,
    shape: "rectangle",
    section: "Outdoor",
    posX: 240,
    posY: 180,
    width: 140,
    height: 90,
    rotation: 45,
    status: "AVAILABLE",
  };

  const parsedTable = tableCreateSchema.parse(tableData);
  assert.equal(parsedTable.tableNumber, "T-14");
  assert.equal(parsedTable.capacity, 6);
  assert.equal(parsedTable.chairCount, 6);
  assert.equal(parsedTable.shape, "rectangle");
  assert.equal(parsedTable.section, "Outdoor");
  assert.equal(parsedTable.status, "AVAILABLE");

  // Invalid table status must be rejected
  assert.throws(() => {
    tableCreateSchema.parse({ tableNumber: "T-99", status: "FLYING" });
  });

  // Floor Layout schema with architectural elements
  const layoutData = {
    section: "Indoor",
    objects: [
      { id: "wall_1", type: "wall", name: "Wall 1", x: 100, y: 100, w: 200, h: 20, rotation: 0 },
      { id: "rec_1", type: "reception", name: "Reception", x: 40, y: 50, w: 120, h: 60 },
    ],
    gridSnap: true,
    gridSize: 20,
    canvasWidth: 1600,
    canvasHeight: 1000,
    zoom: 1.2,
    panX: 50,
    panY: 30,
  };

  const parsedLayout = floorLayoutUpdateSchema.parse(layoutData);
  assert.equal(parsedLayout.section, "Indoor");
  assert.equal(parsedLayout.objects.length, 2);
  assert.equal(parsedLayout.zoom, 1.2);
});

test("Storage fallback handles unconfigured or dummy Supabase without throwing errors", async () => {
  const { uploadFile } = require("../src/services/storageService");

  // When buffer is provided, local storage fallback safely creates the file and returns /uploads/menu-items/...
  const fakeFile = {
    buffer: Buffer.from("fake-image-bytes-data"),
    mimetype: "image/png",
    originalname: "test-dish.png",
  };

  const res = await uploadFile(fakeFile);
  assert.ok(res.url);
  assert.ok(res.url.startsWith("/uploads/menu-items/") || res.url.startsWith("http"));
});
