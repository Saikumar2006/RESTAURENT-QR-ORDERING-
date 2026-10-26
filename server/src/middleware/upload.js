const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { fail } = require("../utils/http");
const env = require("../config/env");

// Only created/used when STORAGE_PROVIDER=local. Served statically at
// /uploads (see app.js).
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const MENU_ITEMS_DIR = path.join(UPLOAD_ROOT, "menu-items");
if (env.storageProvider === "local") {
  fs.mkdirSync(MENU_ITEMS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function safeExtension(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : "";
}

// Supabase: keep the file in memory so storageService can upload the raw
// buffer directly — nothing ever touches this container's disk, so there's
// no volume to configure and uploads survive redeploys automatically.
// Local: write straight to disk with a random name (never trust the
// original filename) + the original extension, as before.
const storage =
  env.storageProvider === "supabase"
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination(req, file, cb) {
          cb(null, MENU_ITEMS_DIR);
        },
        filename(req, file, cb) {
          cb(null, `${crypto.randomUUID()}${safeExtension(file.originalname)}`);
        },
      });

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed"));
  }
  cb(null, true);
}

const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
}).single("image");

// Wraps multer so its errors go through the same { success:false, error }
// envelope as the rest of the API instead of leaking a raw multer error.
function handleImageUpload(req, res, next) {
  uploadImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return fail(res, 400, "Image must be smaller than 5MB");
      }
      return fail(res, 400, err.message);
    }
    if (err) return fail(res, 400, err.message);
    if (!req.file) return fail(res, 400, "No image file was provided (expected field name 'image')");
    next();
  });
}

function hasValidImageSignature(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimetype === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === "image/gif") return buffer.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
  if (mimetype === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function handleThemeImageUpload(req, res, next) {
  if (env.storageProvider !== "supabase") {
    return fail(res, 503, "Website theme images require configured Supabase object storage.");
  }
  return handleImageUpload(req, res, () => {
    if (!hasValidImageSignature(req.file?.buffer, req.file?.mimetype)) {
      return fail(res, 400, "The uploaded file content does not match a supported image type.");
    }
    next();
  });
}

module.exports = { handleImageUpload, handleThemeImageUpload, hasValidImageSignature, MENU_ITEMS_DIR, UPLOAD_ROOT, safeExtension };
