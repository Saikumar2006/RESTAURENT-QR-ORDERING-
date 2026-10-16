// Run interactively on a trusted server shell. Passwords are not accepted as
// arguments or echoed, and this command only creates PlatformAdmin records.
const readline = require("readline");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

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

async function main() {
  if (!process.stdin.isTTY) throw new Error("Run this command from a trusted interactive terminal.");
  const name = await ask("Platform administrator name: ");
  const email = (await ask("Platform administrator email: ")).toLowerCase();
  if (!name || name.length > 120) throw new Error("Enter a name between 1 and 120 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");

  const password = await askHidden("Password (minimum 12 characters): ");
  const confirmation = await askHidden("Confirm password: ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  if (password !== confirmation) throw new Error("The passwords did not match.");

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) throw new Error("A platform administrator with this email already exists. Use the audited account recovery process; this command never resets accounts.");
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.platformAdmin.create({ data: { name, email, passwordHash } });
  console.log(`Platform administrator created: ${admin.email} (id: ${admin.id})`);
  console.log("Sign in at /super-admin/login. Store the password in an approved password manager.");
}

main()
  .catch((err) => {
    console.error(err.message || "Platform administrator provisioning failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
