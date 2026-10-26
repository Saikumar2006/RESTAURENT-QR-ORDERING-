const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, test } = require("node:test");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-with-enough-entropy";
process.env.NODE_ENV = "test";

const distPath = path.join(__dirname, "..", "..", "client", "dist");
const app = require("../src/app");
let server;
let origin;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      origin = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("production SPA routes return revalidating HTML when a build exists", async (t) => {
  if (!fs.existsSync(path.join(distPath, "index.html"))) {
    t.skip("Build the client before checking production static serving");
    return;
  }

  const response = await fetch(`${origin}/r/test-restaurant/menu`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(response.headers.get("cache-control"), /no-cache/);
});

test("missing frontend assets return 404 instead of the SPA document", async () => {
  const response = await fetch(`${origin}/assets/missing-deployment-chunk.js`);
  assert.equal(response.status, 404);
  assert.doesNotMatch(response.headers.get("content-type") || "", /text\/html/);
});

test("unknown API paths return JSON and never the SPA document", async () => {
  const response = await fetch(`${origin}/api/route-that-does-not-exist`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.ok(response.headers.get("x-request-id"));
});

test("fingerprinted production assets use immutable caching", async (t) => {
  const htmlPath = path.join(distPath, "index.html");
  if (!fs.existsSync(htmlPath)) {
    t.skip("Build the client before checking production asset caching");
    return;
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  const assetMatch = html.match(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/);
  assert.ok(assetMatch, "Vite HTML should reference a built JS or CSS asset");

  const response = await fetch(`${origin}${assetMatch[1]}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), assetMatch[1].endsWith(".js") ? /javascript/ : /text\/css/);
  assert.match(response.headers.get("cache-control"), /immutable/);
});

test("production API error diagnostics omit exception text and request data", () => {
  const { errorHandler } = require("../src/middleware/errorHandler");
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  const logLines = [];
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  process.env.NODE_ENV = "production";
  console.error = (...args) => logLines.push(args.join(" "));
  try {
    errorHandler(
      new Error("secret-token-do-not-log"),
      { path: "/api/example", originalUrl: "/api/example?email=private@example.test", method: "GET", requestId: "request-id" },
      response,
      () => {}
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(logLines.length, 1);
  assert.match(logLines[0], /request-id/);
  assert.doesNotMatch(logLines[0], /secret-token|private@example\.test|stack/);
});
