const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("../config/env");
const { safeExtension, MENU_ITEMS_DIR } = require("../middleware/upload");
const { ApiError } = require("../utils/http");

// Uploads req.file (populated by middleware/upload.js — memoryStorage for
// supabase, diskStorage for local) and returns the public URL to store as
// imageUrl. If Supabase is unconfigured or unreachable, seamlessly falls back
// to local disk storage so menu image uploads never fail.
async function uploadFile(file) {
  if (env.storageProvider === "supabase") {
    const isConfigured = env.supabaseUrl && env.supabaseServiceRoleKey && !env.supabaseUrl.includes("xxxxxxxxxxxx");
    if (isConfigured) {
      try {
        return await uploadToSupabase(file);
      } catch (err) {
        console.warn("Supabase Storage upload failed, falling back to local storage:", err.message);
      }
    }
    if (file && file.buffer) {
      fs.mkdirSync(MENU_ITEMS_DIR, { recursive: true });
      const filename = `${crypto.randomUUID()}${safeExtension(file.originalname || "image.png")}`;
      fs.writeFileSync(path.join(MENU_ITEMS_DIR, filename), file.buffer);
      return { url: `/uploads/menu-items/${filename}` };
    }
  }
  return { url: `/uploads/menu-items/${file.filename}` };
}

async function uploadThemeFile(file, restaurantId) {
  if (env.storageProvider !== "supabase") {
    throw new ApiError(503, "Website theme images require configured Supabase object storage.");
  }
  return uploadToSupabase(file, `themes/${restaurantId}`);
}

async function uploadToSupabase(file, folder = "menu-items") {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase Storage is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  const objectPath = `${folder}/${crypto.randomUUID()}${safeExtension(file.originalname)}`;
  const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${env.supabaseStorageBucket}/${objectPath}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": file.mimetype,
      "x-upsert": "false",
    },
    body: file.buffer,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status}): ${errBody || res.statusText}`);
  }

  // Requires the bucket to be marked Public in the Supabase dashboard —
  // otherwise this URL 403s and you'd need signed URLs instead, which is
  // more setup than this app needs for menu photos.
  const publicUrl = `${env.supabaseUrl}/storage/v1/object/public/${env.supabaseStorageBucket}/${objectPath}`;
  return { url: publicUrl };
}

module.exports = { uploadFile, uploadThemeFile };
