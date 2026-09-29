// When the client and API share an origin (the default: Express serves the
// built client itself), relative paths like "/uploads/menu-items/x.jpg"
// just work. When the client is deployed separately (e.g. Cloudflare Pages)
// from the API (e.g. Railway/Render), those same relative paths would
// resolve against the *client's* origin instead and 404. This resolves
// them against VITE_API_URL when it's set, and leaves them untouched
// (same-origin, existing behavior) otherwise.
const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function resolveAssetUrl(pathOrUrl) {
  if (!pathOrUrl) return pathOrUrl;
  // Already absolute (http/https) — leave external/CDN URLs alone.
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!API_ORIGIN) return pathOrUrl;
  return `${API_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
