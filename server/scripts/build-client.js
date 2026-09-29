// Runs automatically before `npm start` (see the "prestart" script in
// package.json). It makes the server folder self-sufficient: even if you
// `cd server && npm start` directly (instead of running `npm start` from
// the project root), the client gets installed/built first so the same
// Express process can serve it.
//
// Skips work it doesn't need to redo: only installs client deps if
// node_modules is missing, and always rebuilds so you're never serving a
// stale bundle after editing client code.
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const clientDir = path.join(__dirname, "..", "..", "client");

if (!fs.existsSync(clientDir)) {
  console.warn(`[build-client] no client/ folder found at ${clientDir} — skipping client build.`);
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: clientDir, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`[build-client] "${command} ${args.join(" ")}" failed in ${clientDir}`);
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(path.join(clientDir, "node_modules"))) {
  console.log("[build-client] client dependencies not installed yet — installing (first run only)...");
  run("npm", ["install"]);
}

console.log("[build-client] building client...");
run("npm", ["run", "build"]);
console.log("[build-client] client build ready — server will serve it from client/dist");
