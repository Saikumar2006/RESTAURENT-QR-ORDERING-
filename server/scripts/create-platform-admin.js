// Run interactively on a trusted server shell. Passwords are not accepted as
// arguments or echoed, and this command only creates PlatformAdmin records.
const readline = require("readline");
const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("A secure interactive terminal is required to enter a platform password.");
  }
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (input) => {
      for (const char of input.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Provisioning cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u0008" || char === "\u007f") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    stdin.on("data", onData);
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) parsed.name = args[++i];
    if (args[i] === "--email" && args[i + 1]) parsed.email = args[++i];
    if (args[i] === "--password" && args[i + 1]) parsed.password = args[++i];
    if (args[i] === "--role" && args[i + 1]) parsed.role = args[++i];
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let name = args.name || process.env.INITIAL_PLATFORM_ADMIN_NAME || "";
  let email = (args.email || process.env.INITIAL_PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
  let password = args.password || process.env.INITIAL_PLATFORM_ADMIN_PASSWORD || "";
  let platformRole = args.role || process.env.INITIAL_PLATFORM_ADMIN_ROLE || "SUPER_ADMIN";

  if (!name || !email || !password) {
    if (!process.stdin.isTTY) {
      throw new Error("Interactive terminal required, or supply --name, --email, and --password arguments (or INITIAL_PLATFORM_ADMIN_* env vars).");
    }
    name = await ask("Platform administrator name: ");
    email = (await ask("Platform administrator email: ")).toLowerCase().trim();
    password = await askHidden("Password (minimum 12 characters): ");
    const confirmation = await askHidden("Confirm password: ");
    if (password !== confirmation) throw new Error("The passwords did not match.");
  }

  if (!name || name.length > 120) throw new Error("Enter a name between 1 and 120 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`Platform administrator already exists: ${existing.email} (id: ${existing.id})`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.platformAdmin.create({ data: { name, email, passwordHash, platformRole } });
  console.log(`Platform administrator created: ${admin.email} (id: ${admin.id}, role: ${admin.platformRole})`);
  console.log("Sign in at /super-admin/login or /login. Store the password in an approved password manager.");
}

main()
  .catch((err) => {
    console.error(err.message || "Platform administrator provisioning failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
