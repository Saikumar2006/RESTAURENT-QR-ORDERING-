# Restaurant website appearance

The Restaurant Admin navigation includes **Website appearance** for users who have `settings.view`; mutations also require `settings.update`. API handlers compare the restaurant URL ID with the restaurant ID loaded from the authenticated user. Public clients can read only the newest published version. Drafts, version history, image paths, and internal editor state stay behind restaurant authentication.

The editor supports Elegant, Street Food, Luxury Dark, and Fresh & Green presets; color, typography, layout, featured-section, logo, and banner controls; desktop/mobile previews; draft saving; publishing; restoration of a previous published revision; and publishing the default appearance as a new version. Every save/publish/rollback/default action adds a tenant-scoped restaurant audit entry. Versions are retained until the restaurant itself is deleted.

Theme input is presentation-only. It has a strict allowlist schema, safe enum values, six-digit colors, WCAG AA 4.5:1 checks for body and button text, and image URL checks tied to the restaurant's object-storage folder. Prices, tax, roles, payment verification, and order behavior are not read from or written to theme configuration.

## Images and configuration

Theme image upload requires the existing server-side Supabase Storage setup (`STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`). Images are limited to 5 MB, checked for supported MIME type and matching file signature, and stored beneath `themes/<restaurantId>/` with a random name. Theme uploads deliberately fail with a clear 503 when local filesystem storage is selected, because deployment disks may be ephemeral. No new environment variable is needed. Credentials remain server-side.

## Database and deployment

The additive theme schema is `server/prisma/migrations/20261026000000_website_theme_versions/migration.sql`, with matching Prisma models in `server/prisma/schema.prisma`. It adds a per-restaurant version counter and a version table; it does not alter existing orders or menu rows. Review and apply it to an isolated staging database before production. The current server `prestart` only generates Prisma Client and builds the client; it does not run `prisma db push` or migrations. Verify the effective Render build command because dashboard settings can override the checked-in manifest. Rollback should retain the table and use the editor's version restore rather than dropping saved revisions.

## Public theme behavior and limits

Published colors, typography, and layout are applied only inside the public `/r/:slug` customer route. The landing page can display the published logo and banner. Unpublished drafts never affect visitors; if the theme read request fails, the public site uses the built-in Elegant default. Theme appearance is currently not server-rendered and should be reviewed with the actual translated content and devices before launch.
