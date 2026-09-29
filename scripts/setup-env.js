// Creates server/.env from server/.env.example if it doesn't already
// exist, replacing the placeholder JWT_SECRET with a real random one.
// Won't touch an existing server/.env — safe to re-run.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const root = path.resolve(__dirname, "..");
const examplePath = path.join(root, "server", ".env.example");
const envPath = path.join(root, "server", ".env");

if (fs.existsSync(envPath)) {
  console.log("server/.env already exists — leaving it as is.");
  process.exit(0);
}

let contents = fs.readFileSync(examplePath, "utf8");
const randomSecret = crypto.randomBytes(48).toString("hex");
contents = contents.replace(
  /^JWT_SECRET=.*$/m,
  `JWT_SECRET=${randomSecret}`
);

fs.writeFileSync(envPath, contents);
console.log("Created server/.env from server/.env.example with a freshly generated JWT_SECRET.");
console.log("Review the other values (payment/messaging keys, URLs) before deploying.");
