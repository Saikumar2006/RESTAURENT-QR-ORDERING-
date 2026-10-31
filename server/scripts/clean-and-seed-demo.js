require("dotenv").config();
const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");
const { ensureRestaurantRoles } = require("../src/services/roleService");

async function main() {
  console.log("Cleaning up old test restaurants (Option A)...");
  
  // 1. Delete dependent child records in order
  await prisma.orderItem.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.recipeComponent.deleteMany({});
  await prisma.inventoryPurchaseLine.deleteMany({});
  await prisma.inventoryMovement.deleteMany({});
  await prisma.inventoryPurchase.deleteMany({});
  await prisma.inventorySupplier.deleteMany({});
  await prisma.inventoryUnitConversion.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.table.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.websiteThemeVersion.deleteMany({});
  await prisma.marketplaceWebhookEvent.deleteMany({});
  await prisma.restaurantStaffAccessLink.deleteMany({});
  await prisma.platformRestaurantInvite.deleteMany({});
  await prisma.subscriptionPayment.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.pendingOnboarding.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  const deleted = await prisma.restaurant.deleteMany({});
  console.log(`Deleted ${deleted.count} existing restaurants and their associated data.`);

  // 2. Hash standard passwords
  const passwordHash = await bcrypt.hash("admin123", 10);
  const legacyHash = await bcrypt.hash("password123", 10);

  // 3. Create fresh Demo Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Svaadya Bistro",
      slug: "svaadya-bistro",
      taxPercent: 5,
      serviceChargePercent: 5,
      currency: "INR",
      cuisineType: "Multi-Cuisine & Cafe",
      status: "ACTIVE",
    },
  });

  // 4. Create Demo Admin with both emails or primary demo@svaadya.com and admin@spicegarden.test
  const adminUser = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Svaadya Demo Admin",
      email: "demo@svaadya.com",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // Also create spicegarden alias for backward compatibility
  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Restaurant Admin",
      email: "admin@spicegarden.test",
      passwordHash: legacyHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // Create Staff User
  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: "Kitchen Staff",
      email: "staff@svaadya.com",
      passwordHash,
      role: "STAFF",
      isActive: true,
    },
  });

  await ensureRestaurantRoles(restaurant.id);

  // 5. Seed active PREMIUM subscription for the demo restaurant
  const now = new Date();
  const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
  await prisma.subscription.create({
    data: {
      restaurantId: restaurant.id,
      planKey: "PREMIUM",
      billingPeriod: "YEARLY",
      amount: 24950,
      currency: "INR",
      status: "ACTIVE",
      startsAt: now,
      endsAt,
    },
  });

  // 6. Seed demo tables
  for (const num of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
    await prisma.table.create({
      data: { restaurantId: restaurant.id, tableNumber: num },
    });
  }

  // 7. Seed categories & menu items
  const img = (kw) => `https://loremflickr.com/400/300/${kw}`;
  const catStarters = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Starters", displayOrder: 1, imageUrl: img("starter,food") },
  });
  const catMains = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Main Course", displayOrder: 2, imageUrl: img("curry,food") },
  });
  const catDesserts = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Desserts", displayOrder: 3, imageUrl: img("dessert,sweet") },
  });
  const catBeverages = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Beverages", displayOrder: 4, imageUrl: img("beverage,drink") },
  });

  await prisma.menuItem.createMany({
    data: [
      { restaurantId: restaurant.id, categoryId: catStarters.id, name: "Paneer Tikka", price: 240, isVeg: true, description: "Grilled cottage cheese with fragrant spices", imageUrl: img("paneer,tikka"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catStarters.id, name: "Crispy Corn", price: 190, isVeg: true, description: "Golden fried sweet corn tossed with bell peppers", imageUrl: img("corn,crispy"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catStarters.id, name: "Chicken 65", price: 280, isVeg: false, description: "Spiced fried boneless chicken bites", imageUrl: img("chicken,spicy"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catMains.id, name: "Butter Chicken", price: 340, isVeg: false, description: "Tender chicken simmered in rich buttery tomato gravy", imageUrl: img("butter,chicken"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catMains.id, name: "Paneer Butter Masala", price: 290, isVeg: true, description: "Fresh paneer cubes in velvety makhani sauce", imageUrl: img("paneer,curry"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catMains.id, name: "Dal Makhani", price: 230, isVeg: true, description: "Slow-cooked black lentils simmered overnight with cream", imageUrl: img("dal,lentils"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catMains.id, name: "Garlic Butter Naan", price: 65, isVeg: true, description: "Clay oven baked flatbread brushed with garlic butter", imageUrl: img("naan,garlic"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catDesserts.id, name: "Gulab Jamun (2 pcs)", price: 110, isVeg: true, description: "Warm milk dumplings in saffron cardamom syrup", imageUrl: img("gulab,jamun"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catDesserts.id, name: "Kesar Pista Kulfi", price: 130, isVeg: true, description: "Traditional slow-churned Indian ice cream", imageUrl: img("kulfi,icecream"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catBeverages.id, name: "Mango Lassi", price: 120, isVeg: true, description: "Thick creamy yogurt smoothie with alphonso mango", imageUrl: img("mango,lassi"), isAvailable: true },
      { restaurantId: restaurant.id, categoryId: catBeverages.id, name: "Fresh Mint Lime Soda", price: 90, isVeg: true, description: "Refreshing sparkling lime with crushed mint", imageUrl: img("lime,soda"), isAvailable: true },
    ],
  });

  // 8. Seed sample active coupon
  await prisma.coupon.create({
    data: {
      restaurantId: restaurant.id,
      code: "WELCOME20",
      type: "PERCENT",
      value: 20,
      minOrderAmount: 200,
      maxDiscountAmount: 150,
      isActive: true,
    },
  });

  // 9. Ensure Platform Super Admin
  const platformAdmin = await prisma.platformAdmin.findFirst({ where: { email: "platform@svaadya.test" } });
  if (!platformAdmin) {
    const platformHash = await bcrypt.hash("admin123", 10);
    await prisma.platformAdmin.create({
      data: {
        name: "Svaadya Super Admin",
        email: "platform@svaadya.test",
        passwordHash: platformHash,
        platformRole: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log("Created Platform Super Admin: platform@svaadya.test / admin123");
  } else {
    // update password to admin123 for consistency
    const platformHash = await bcrypt.hash("admin123", 10);
    await prisma.platformAdmin.update({
      where: { id: platformAdmin.id },
      data: { passwordHash: platformHash, isActive: true },
    });
    console.log("Updated Platform Super Admin: platform@svaadya.test / admin123");
  }

  console.log("--------------------------------------------------");
  console.log("SUCCESSFULLY RESET TO CLEAN DEMO RESTAURANT (Option A)");
  console.log("Restaurant Name: Svaadya Bistro");
  console.log("Restaurant Slug: svaadya-bistro");
  console.log("Restaurant Admin: demo@svaadya.com / admin123");
  console.log("Legacy Admin: admin@spicegarden.test / password123");
  console.log("Kitchen Staff: staff@svaadya.com / admin123");
  console.log("Platform Super Admin: platform@svaadya.test / admin123");
  console.log("Active Plan: PREMIUM (1 Year Active)");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
