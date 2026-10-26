const prisma = require("../src/config/db");
const { ensureRestaurantRoles } = require("../src/services/roleService");

async function main() {
  const restaurants = await prisma.restaurant.findMany({ select: { id: true } });
  for (const restaurant of restaurants) {
    await ensureRestaurantRoles(restaurant.id);
  }
  console.log(`RBAC roles initialized for ${restaurants.length} restaurant(s).`);
}

main()
  .catch((error) => {
    console.error("RBAC role initialization failed", { name: error.name, code: error.code || "unknown" });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
