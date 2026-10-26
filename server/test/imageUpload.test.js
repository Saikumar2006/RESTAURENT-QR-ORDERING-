const assert = require("node:assert/strict");
const { test } = require("node:test");
const { hasValidImageSignature } = require("../src/middleware/upload");

test("theme image content must match an allowed image MIME type", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const gif = Buffer.from("GIF89a");
  const webp = Buffer.from("RIFF0000WEBP");
  assert.equal(hasValidImageSignature(jpeg, "image/jpeg"), true);
  assert.equal(hasValidImageSignature(png, "image/png"), true);
  assert.equal(hasValidImageSignature(gif, "image/gif"), true);
  assert.equal(hasValidImageSignature(webp, "image/webp"), true);
  assert.equal(hasValidImageSignature(Buffer.from("not an image"), "image/png"), false);
  assert.equal(hasValidImageSignature(jpeg, "image/png"), false);
});
