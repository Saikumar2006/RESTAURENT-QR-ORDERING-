const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "spice-garden" },
    update: {},
    create: {
      name: "Spice Garden",
      slug: "spice-garden",
      taxPercent: 5,
      serviceChargePercent: 5,
      currency: "INR",
    },
  });

  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restaurant.id, email: "admin@spicegarden.test" } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Restaurant Admin",
      email: "admin@spicegarden.test",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restaurant.id, email: "staff@spicegarden.test" } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Kitchen Staff",
      email: "staff@spicegarden.test",
      passwordHash,
      role: "STAFF",
    },
  });

  const tableNumbers = ["1", "2", "3", "4", "5"];
  const tables = [];
  for (const [idx, tableNumber] of tableNumbers.entries()) {
    const table = await prisma.table.upsert({
      where: { restaurantId_tableNumber: { restaurantId: restaurant.id, tableNumber } },
      update: {},
      create: { restaurantId: restaurant.id, tableNumber },
    });
    tables.push(table);
  }

  // Categories (no natural unique constraint on name, so find-or-create
  // manually). If a category already exists but has no image yet, backfill
  // one — this makes it safe to re-run `npm run seed` after upgrading from
  // an older version of this seed file, without touching anything you've
  // since edited in the admin panel.
  async function upsertCategory(name, imageUrl, displayOrder) {
    const existing = await prisma.category.findFirst({ where: { restaurantId: restaurant.id, name } });
    if (existing) {
      if (!existing.imageUrl && imageUrl) {
        return prisma.category.update({ where: { id: existing.id }, data: { imageUrl } });
      }
      return existing;
    }
    return prisma.category.create({ data: { restaurantId: restaurant.id, name, imageUrl, displayOrder } });
  }

  // Images below are placeholder photos from a keyword-matched stock photo
  // service (loremflickr.com) — free to hotlink, no API key needed, and
  // reliable for local dev/demo use. Swap them for your own restaurant's
  // photos any time via Admin → Menu (each category/item has an
  // "Image URL" field).
  const img = (keywords) => `https://loremflickr.com/400/300/${keywords}`;

  const catStarters = await upsertCategory("Starters", img("indian,appetizer"), 1);
  const catSoups = await upsertCategory("Soups", img("soup,bowl"), 2);
  const catMains = await upsertCategory("Main Course", img("curry,indian"), 3);
  const catRice = await upsertCategory("Rice & Biryani", img("biryani,rice"), 4);
  const catBreads = await upsertCategory("Breads", img("naan,bread"), 5);
  const catDesserts = await upsertCategory("Desserts", img("indian,dessert"), 6);
  const catBeverages = await upsertCategory("Beverages", img("lassi,drink"), 7);

  async function upsertItem(categoryId, name, price, isVeg, description, imageUrl) {
    const existing = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id, name } });
    if (existing) {
      if (!existing.imageUrl && imageUrl) {
        return prisma.menuItem.update({ where: { id: existing.id }, data: { imageUrl } });
      }
      return existing;
    }
    return prisma.menuItem.create({
      data: { restaurantId: restaurant.id, categoryId, name, price, isVeg, description, imageUrl, isAvailable: true },
    });
  }

  // Starters
  await upsertItem(catStarters.id, "Paneer Tikka", 220, true, "Grilled cottage cheese with spices", img("paneer,tikka"));
  await upsertItem(catStarters.id, "Chicken 65", 260, false, "Spicy fried chicken bites", img("chicken,fried"));
  await upsertItem(catStarters.id, "Veg Spring Rolls", 180, true, "Crispy rolls with stir-fried vegetables", img("spring,rolls"));
  await upsertItem(catStarters.id, "Chilli Chicken", 280, false, "Indo-Chinese style tossed chicken", img("chilli,chicken"));
  await upsertItem(catStarters.id, "Hara Bhara Kebab", 190, true, "Spinach and green pea patties", img("kebab,vegetable"));

  // Soups
  await upsertItem(catSoups.id, "Tomato Basil Soup", 120, true, "Classic tomato soup with fresh basil", img("tomato,soup"));
  await upsertItem(catSoups.id, "Sweet Corn Soup", 130, true, "Veg or chicken, ask your server", img("corn,soup"));
  await upsertItem(catSoups.id, "Hot & Sour Soup", 140, false, "Chicken and vegetable broth with a kick", img("hot,soup"));

  // Main Course
  await upsertItem(catMains.id, "Paneer Butter Masala", 260, true, "Cottage cheese in creamy tomato gravy", img("paneer,curry"));
  await upsertItem(catMains.id, "Butter Chicken", 320, false, "Classic North Indian chicken curry", img("butter,chicken"));
  await upsertItem(catMains.id, "Dal Makhani", 210, true, "Slow-cooked black lentils", img("dal,lentils"));
  await upsertItem(catMains.id, "Palak Paneer", 240, true, "Cottage cheese in a spiced spinach gravy", img("palak,paneer"));
  await upsertItem(catMains.id, "Kadai Chicken", 300, false, "Chicken cooked with peppers in kadai masala", img("kadai,chicken"));
  await upsertItem(catMains.id, "Chana Masala", 190, true, "Spiced chickpea curry", img("chana,masala"));
  await upsertItem(catMains.id, "Fish Curry", 310, false, "Coastal-style fish in a tangy coconut gravy", img("fish,curry"));

  // Rice & Biryani
  await upsertItem(catRice.id, "Veg Biryani", 230, true, "Fragrant basmati rice with mixed vegetables", img("vegetable,biryani"));
  await upsertItem(catRice.id, "Chicken Biryani", 290, false, "Slow-cooked biryani with tender chicken", img("chicken,biryani"));
  await upsertItem(catRice.id, "Jeera Rice", 130, true, "Basmati rice tempered with cumin", img("jeera,rice"));
  await upsertItem(catRice.id, "Veg Fried Rice", 170, true, "Wok-tossed rice with mixed vegetables", img("fried,rice"));

  // Breads
  await upsertItem(catBreads.id, "Butter Naan", 45, true, null, img("butter,naan"));
  await upsertItem(catBreads.id, "Tandoori Roti", 30, true, null, img("tandoori,roti"));
  await upsertItem(catBreads.id, "Garlic Naan", 55, true, "Naan topped with garlic and coriander", img("garlic,naan"));
  await upsertItem(catBreads.id, "Laccha Paratha", 50, true, "Multi-layered whole wheat flatbread", img("paratha,bread"));

  // Desserts
  await upsertItem(catDesserts.id, "Gulab Jamun", 90, true, "Milk dumplings soaked in sugar syrup (2 pcs)", img("gulab,jamun"));
  await upsertItem(catDesserts.id, "Gajar Ka Halwa", 110, true, "Warm carrot pudding with nuts", img("carrot,halwa"));
  await upsertItem(catDesserts.id, "Chocolate Brownie", 130, true, "Served warm, with vanilla ice cream", img("chocolate,brownie"));

  // Beverages
  await upsertItem(catBeverages.id, "Masala Chaas", 60, true, "Spiced buttermilk", img("buttermilk,drink"));
  await upsertItem(catBeverages.id, "Fresh Lime Soda", 80, true, null, img("lime,soda"));
  await upsertItem(catBeverages.id, "Masala Chai", 50, true, "Spiced Indian tea", img("masala,chai"));
  await upsertItem(catBeverages.id, "Mango Lassi", 100, true, "Yogurt-based mango smoothie", img("mango,lassi"));
  await upsertItem(catBeverages.id, "Cold Coffee", 110, true, "Blended chilled coffee with ice cream", img("cold,coffee"));

  // Sample coupon so you can see the discount flow working immediately —
  // try it at checkout on the customer cart page.
  await prisma.coupon.upsert({
    where: { restaurantId_code: { restaurantId: restaurant.id, code: "WELCOME10" } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      code: "WELCOME10",
      type: "PERCENT",
      value: 10,
      minOrderAmount: 200,
      maxDiscountAmount: 150,
    },
  });

  console.log("Seed complete.");
  console.log("Admin login: admin@spicegarden.test / password123");
  console.log("Staff login: staff@spicegarden.test / password123");
  console.log(`Restaurant QR link (single QR for the whole restaurant): /r/${restaurant.slug}`);
  console.log("Customer picks a table (from those seeded below) or Takeaway once they land on that page:");
  tables.forEach((t) => console.log(`  Table ${t.tableNumber}`));
  console.log("Sample coupon: WELCOME10 (10% off, min order ₹200, capped at ₹150) — try it in the cart.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
