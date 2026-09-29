const crypto = require("crypto");
const env = require("../config/env");
const { safeExtension } = require("../middleware/upload");

// Uploads req.file (populated by middleware/upload.js — memoryStorage for
// supabase, diskStorage for local) and returns the public URL to store as
// imageUrl. Both providers return a URL that resolveAssetUrl (client-side)
// already knows how to handle without any client changes: Supabase returns
// an absolute https:// URL (left untouched), local returns a relative
// /uploads/... path (resolved against the API origin when split-deployed).
async function uploadFile(file) {
  if (env.storageProvider === "supabase") {
    return uploadToSupabase(file);
  }
  return { url: `/uploads/menu-items/${file.filename}` };
}

async function uploadToSupabase(file) {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase Storage is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  const objectPath = `menu-items/${crypto.randomUUID()}${safeExtension(file.originalname)}`;
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

module.exports = { uploadFile };
