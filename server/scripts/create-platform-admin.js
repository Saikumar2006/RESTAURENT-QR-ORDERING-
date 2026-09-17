// Usage: node scripts/create-platform-admin.js "Your Name" you@example.com "a-strong-password"
// Run this once, locally or via your host's shell, to create (or update the
// password of) the platform admin account used to log into /platform.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: node scripts/create-platform-admin.js "Your Name" you@example.com "a-strong-password"');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { name, passwordHash, isActive: true },
    create: { name, email, passwordHash },
  });

  console.log(`Platform admin ready: ${admin.email} (id: ${admin.id})`);
  console.log("Log in at /platform/login");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
