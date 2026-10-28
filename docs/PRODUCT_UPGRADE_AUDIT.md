# Svaadya Product Upgrade Audit

Audit refreshed: 27 October 2026. This inventory describes repository evidence only; it does not establish that production credentials, external integrations, migrations, or live payment flows work.

## Checkpoint and baseline

- Checkpoint commit before this implementation slice: `c6027a8` (`Harden production Prisma migration deployment`) on `security-hardening`.
- Before the dashboard slice: `npm.cmd test --prefix server` passed **45/45**; Prisma 5.22.0 schema validation passed. The ordinary sandboxed build was blocked because esbuild could not access a parent directory outside the workspace.
- After the current Phase 1 operations slice: server tests pass **52/52**; Node syntax checks pass for the changed analytics/timezone modules and tests. The complete Vite production build passes with approved elevated access: 156 modules transformed; 103.42 kB CSS and 457.01 kB JS (uncompressed). The ordinary sandboxed build remains blocked by the workspace boundary.
- No production database was accessed or changed. The local `server/.env` points to `127.0.0.1`, not Neon.

## Feature matrix

| Requirement area | Status | Repository evidence and gap |
|---|---|---|
| Core QR ordering | Implemented | `server/src/services/orderService.js:createOrder` recomputes prices from tenant-owned menu items; `canTransition` in `server/src/utils/order.js` enforces order state progression. |
| Customer payments | Partial | `server/src/services/paymentService.js:createPaymentOrder`, `verifyPayment`, and `handleWebhook` verify signatures and reconcile state. Provider credentials and production replay behavior remain unverified; food-order payments are separate from SaaS billing. |
| Redis and Socket.IO | Partial / unverified in production | `server/src/services/redisService.js` and `server/src/config/redis.js` provide cache/rate-limit behavior and outage fallback; `server/src/sockets/index.js` handles realtime. Live Render/Redis behavior was not checked. |
| Restaurant dashboard analytics | Partial | `getAnalytics` in `server/src/services/restaurantInsightsService.js` provides revenue, orders, items, coupons, and peak hours using restaurant-local date grouping, with validated date ranges up to 90 days. `AdminDashboard.jsx` has date-range controls and timezone-based current-day totals with the latest five orders. Staff onboarding, export, and broader analytics UX remain incomplete. |
| Promotions | Partial | `server/src/services/couponService.js` implements tenant-scoped CRUD, discount/expiry checks, and an atomic usage-limit claim inside the order transaction. `AdminCoupons.jsx` now has a responsive two-column create/edit and list view, activate/deactivate, expiry/limits, and restricts deletion to unused coupons. Bulk scheduling and broader checkout concurrency tests remain. |
| Tables and current-day orders | Partial | `getTodayOperations` returns timezone-bounded totals, five deterministic orders, and all occupied table IDs from current active dine-in orders. Dashboard occupancy no longer depends on the five displayed orders. |
| Menu sections and classifications | Partial | `AdminMenu.jsx` supports Veg/Non-Veg, category expand/collapse, category rename/archive, item availability, responsive layout, and an explicitly disabled Premium AI status panel. |
| Restaurant staff and RBAC | Partial / improved | `AdminStaff.jsx` now creates hashed, seven-day setup links and manager-issued, one-hour password-reset links instead of asking managers to choose staff passwords. Link use is atomic and tenant scoped; role creation and assignment cannot exceed the actor's permissions. Owners remain protected. The team page now shows role permission grants, account state, and last sign-in for access review. Owner self-service recovery, tamper-resistant audit storage, staff removal policy, and broader negative tests remain. |
| Platform administration/RBAC | Partial / implemented slice | Server-resolved platform roles and permissions protect dashboard, access administration, and restaurant creation. Platform Operators and Super Admins can create an account with a required audit reason; new owner access is disabled until a one-time hashed invite is accepted. Account and invitation actions are audited. Existing tenant system-role links still need the deliberate `rbac:backfill` operation after backup/schema review. |
| Navigation and settings | Partial / improved | `AdminLayout.jsx` has responsive drawer/collapse behavior, including the top-right desktop control. `AdminSettings.jsx` covers profile, hours, tax, notifications, and a safe WhatsApp Business OTP status panel with an explicit read-only sender/template connection check. Credentials remain in server environment settings. Branches, restaurant-owned messaging accounts, full payment/security settings, and live provider verification remain incomplete. |
| Marketplace orders | Partial; not live | `orderProviders.js`, `AdminIntegrations.jsx`, order source fields, and provider docs exist. Swiggy/Zomato show unconfigured states; no approved provider credentials or verified live ingestion exists. `AdminOrders.jsx` provides a shared internal inbox for persisted sources. |
| Website theme editor | Partial / substantially implemented | `websiteThemeService.js`, `websiteThemeController.js`, `AdminAppearance.jsx`, and `WebsiteThemeVersion` provide tenant-scoped versioned drafts, publish/rollback/default, presets, and storage validation. Production object storage ownership and browser/device accessibility coverage are not verified. |
| Subscription plans, paid onboarding, expiry | Implemented slice / external setup pending | Added separate subscription/payment/onboarding/webhook models, plan catalog, trial and paid onboarding, captured-payment verification, renewal, failure grace, tenant entitlement checks, and an expiry worker. Platform-created accounts receive a separately audited `GRANDFATHERED` grant. Prices, approved SaaS provider credentials, live webhook delivery, and production migrations remain unconfigured/unverified. |
| Public pricing, legal, trial, checkout pages | Partial / owner input pending | Added pricing, onboarding/result, contact/about, terms, privacy, and account billing pages. Public tenant creation now routes through plan onboarding. Prices are placeholders, and legal pages remain explicitly marked as drafts until owner facts and approved wording are provided. |
| Inventory | Implemented slice / rollout pending | Added tenant-scoped items, unit conversions, stock movement ledger, idempotency, recipe mapping, transaction-aware consume/restock, optional suppliers and supplier-linked purchase receipts, low-stock alerts, and movement/purchase summaries. New purchase records and stock receipts commit together. Requires additive migrations and deliberate RBAC backfill before rollout; no database was accessed. |
| Premium AI form autofill | Disabled placeholder | Added Premium/status visibility and configuration fields. No provider was selected and no provider adapter or autofill flow is enabled; no AI-generated menu content is claimed. |
| Eleven-language localization | Partial | Added language selection/persistence for English, Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, and Odia, with translated admin navigation and language labels. Other page content is still largely English; full-site translation and translated-flow tests remain. |
| Production migration lifecycle | Partial / unverified | The checked-in manifest declares `db:migrate:safe`, but dashboard settings can override it; verify the effective Render build command. Runtime `prestart` only generates Prisma Client/builds the UI. Production migration history and schema remain unverified. RBAC backfill remains deliberate and is not run at startup. |
| Automated regression/accessibility coverage | Partial | Added platform RBAC, inventory idempotency/tenant/concurrency, occupied-table, subscription catalog/date/signature/expiry tests. Marketplace live access, staging billing/webhook tests, full frontend e2e, accessibility coverage, and complete localization coverage remain external or incomplete. |

## Dependencies and risks

1. Platform RBAC must precede platform finance, support, account creation, or other cross-tenant operations.
2. SaaS plans, separate billing records, signed webhook idempotency, trials, and backend entitlements must precede paid onboarding and Premium AI.
3. Inventory needs tenant-owned stock movements, recipe mappings, transaction/idempotency policy, and explicit cancellation/refund handling before deductions are enabled.
4. Public legal content needs owner-approved company details and qualified review; do not invent them.
5. Localization and AI cross many pages and APIs. Entitlement, privacy, provider, rate-limit, and confirmation policy should precede UI claims.
6. Production migration state is still an external gate. No production data change should happen before Neon backup and duplicate/schema review.

## Historical implementation priorities at the initial checkpoint

The following list records the initial audit priorities; it is not a claim that all work remains undone.

1. Continue Phase 1 operations UX and finish owner self-service password recovery, integrations status, and accessibility coverage.
2. Complete platform audit retention and remaining authorization-negative tests.
3. Provide approved subscription prices, payment credentials, trial/grace policy, and verified staging/live webhook delivery.
4. Obtain owner company/legal facts and approved public terms/privacy wording.
5. Complete the AI provider adapter only after a provider and its data-handling policy are approved.
6. Finish translation of all customer and authenticated UI flows in the eleven requested languages, with locale-aware formatting and native review.
7. Complete end-to-end security, reliability, accessibility, migration recovery, and staging verification.

## Phase 1 slice implemented after the checkpoint

- Added `getTodayOperations` in `server/src/services/restaurantInsightsService.js` and `GET /:id/analytics/today`, protected by authentication, tenant assertion, and `analytics.view`.
- Added IANA timezone validation and DST-aware business-day boundaries in `server/src/utils/timezone.js`.
- Dashboard cards now use server-computed business-day totals and show five deterministically sorted, tenant-scoped orders without returning customer contact/session-token fields.
- Tests in `server/test/restaurantTimezone.test.js` cover tenant-scoped query shapes, five-order limit, valid zones, 23/25-hour DST days, local analytics grouping, date-range validation, and date-range maximums.
- Reworked `AdminCoupons.jsx` into a responsive form/list layout with edit, deactivate/archive behavior, retry/error states, and expiry/usage details. Coupon creation/update validation now rejects over-100% discounts and impossible usage-limit reductions. `couponService.incrementUsage` performs a conditional atomic increment inside the order transaction, preventing concurrent redemptions from exceeding a cap or leaving a coupon order partially created.
- `server/test/couponService.test.js` covers discount rules and a concurrent usage-cap claim.
- Analytics now uses restaurant-local day boundaries for range queries and peak-hour grouping; the dashboard accepts a date range up to 90 days. Fixed an adjacent undefined month-boundary helper in the customer report.

This slice does not complete the broader product upgrade or establish production readiness. No production database was accessed or changed, and external marketplace connectivity remains unverified.

## Implementation follow-up — 27 October 2026

- Added the platform role controls, tenant inventory ledger/recipe UI and order acceptance/cancellation stock policy, plan onboarding and subscription recovery, public informational/legal placeholder pages, preferred-language persistence, and additional responsive restaurant-admin layout changes.
- Added three additive migrations: `20261027000000_platform_rbac`, `20261027000001_inventory_and_language`, and `20261027000002_subscription_lifecycle`. Their applied state must be determined from the target database's migration history.
- Public restaurant signup now routes to plans. Checkout/trials remain disabled by default because no prices, SaaS payment credentials, or trial duration were provided. Renewal is manual; automatic recurring charges are not implemented.
- AI autofill has a Premium/status placeholder only. No provider was selected and no AI request adapter is enabled. The language selector supports the eleven requested languages and stores the authenticated user's choice, but full-page translation coverage is incomplete.
- `render.yaml` declares `db:migrate:safe` in the build phase; dashboard settings may override it. `server` `prestart` only generates Prisma Client and builds the UI. Neither production migration nor `rbac:backfill` was run during this change.
- Verification after these changes: server tests **67/67 passed**; Prisma 5.22 schema validation passed; Node syntax checks passed for 71 server files; Vite production build passed with 162 modules and route-level code splitting (largest emitted JavaScript chunk: 238.07 kB). No lint script is defined in the root, server, or client package manifests.
- The production Neon database was not connected to, inspected, backed up, migrated, or modified. Before production migration, an operator must create/verify a backup, review migration history and the safe gate's duplicate counts, then deliberately set the Render backup confirmation. Existing tenant role permission links require the separate `rbac:backfill` command after migration review.

## Platform account-creation follow-up — 27 October 2026

- Added permission-checked platform restaurant creation with an explicit reason, a zero-amount `GRANDFATHERED` platform grant, and an initially suspended restaurant/disabled owner login.
- Added an expiring one-time owner activation link. Only its SHA-256 hash is stored; activation sets a password, consumes the link atomically, enables the owner, activates the restaurant, and records the result. A replacement link invalidates previous unconsumed links and requires a new audit reason.
- Added migration `20261027000003_platform_restaurant_invites`; it makes `Subscription.endsAt` nullable for indefinite grants and adds the invite table/indexes. This migration has not been applied to any database.
- Verification at this checkpoint: all **73** server tests passed; Prisma Client 5.22.0 generation and schema validation passed. The ordinary `npm.cmd run build` command was blocked because Vite/esbuild tried to resolve its config through a parent directory outside the granted workspace; the Vite JavaScript API build workaround completed successfully with 163 modules (largest JS chunk 238.25 kB). No production database or Render service was accessed.
- The activation link is displayed once in the authorized platform session and must be shared manually through an approved channel; email delivery is not configured.

Remaining owner/provider inputs: approved prices and billing policy, trial/grace durations, Svaadya billing account and webhook credentials, company/contact/registration facts and approved legal wording, selected AI provider/adapter approval, provider approvals for marketplace feeds, and native review of translations. Live Swiggy/Zomato order ingestion and production checkout are not claimed.

## Restaurant staff-access follow-up — 27 October 2026

- The Restaurant OS team page now invites staff through one-time, SHA-256-hashed seven-day setup links. The invitee chooses a password; the account stays inactive until the link is consumed. Reissued links replace the prior token.
- Authorized staff can issue one-hour password-reset links with a required audit reason. Link consumption is atomic; owners cannot be reset from team management. Delivery is manual because no email provider is configured.
- Role creation and assignment now enforce a permission-subset rule on the server, preventing a manager from assigning permissions they do not hold, including through existing higher-privilege custom roles.
- Added migration `20261027000004_restaurant_staff_access_links`, with one current link per user and purpose plus audit history in the existing tenant audit log. It has not been applied to any database.
- Verification: server tests **83/83** passed; Prisma Client 5.22.0 generation and schema validation passed; Vite JavaScript API build transformed 164 modules successfully (largest JS chunk 238.43 kB). The ordinary npm build command remains blocked by the sandbox's parent-directory restriction.

## Inventory suppliers and purchase reporting — 27 October 2026

- Added optional tenant-owned suppliers and purchase records with invoice references, line quantities, base-unit costs, purchase date, and actor attribution. Supplier deletion is avoided so records remain referentially stable; suppliers can be deactivated.
- Purchase creation validates tenant ownership and conversions, creates receipt movements and purchase lines in one transaction, and uses a restaurant-scoped idempotency key to prevent duplicate stock receipts. Failed lines roll back the purchase and all stock movements.
- Added a bounded 90-day report for active/low-stock items, movement counts and quantities by movement type, and purchase count/spend. The admin page now shows low-stock items, recent supplier purchases, and a purchase entry workflow.
- Added additive migration `20261027000005_inventory_purchases`; it creates supplier, purchase, and purchase-line tables and indexes. It has not been applied to a database.
- Verification after this slice: **87/87 server tests** passed (including purchase retry, rollback, tenant isolation, conversion/cost, and report-scope coverage); Prisma Client 5.22.0 generation and schema validation passed; Vite production build transformed 165 modules successfully (largest JS chunk 238.47 kB).
- The eleven-language navigation catalog was moved into a dedicated resource module and its previously mojibake non-English labels were replaced with Unicode text. Client tests verify all eleven catalogs have matching non-empty keys and detect the prior mojibake patterns. This fixes navigation labels only; the rest of the app still needs full localization and native review.
- Client catalog tests: **2/2** passed. The normal client npm build wrapper remains blocked by the workspace parent-directory restriction; the Vite JavaScript API build passed.

## WhatsApp status and connection check — 27 October 2026

- Added tenant and permission-checked WhatsApp status/test endpoints under restaurant integrations. They report configuration readiness without returning credentials or provider IDs. The explicit test action makes read-only Meta Graph API requests for the configured sender and OTP template and returns only masked sender details, verified name, quality status, template status, and a timestamp.
- Provider diagnostics are reduced to safe status/code/trace metadata; raw provider messages and bearer credentials are never returned. No external request is made until an authorized settings user clicks the test button, and no Meta credentials were available for a live check in this workspace.
- The settings UI labels this as Svaadya's platform-managed OTP channel; restaurant notification delivery remains separately platform configured. Per-restaurant WhatsApp credential storage and order-message template setup remain incomplete.
- Verification after this slice: server tests **91/91** and client tests **2/2** passed. The Vite JavaScript API production build transformed 165 modules successfully; largest emitted JavaScript chunk: 238.47 kB. Prisma schema validation passed with the installed local Prisma CLI. The ordinary `npm run build --prefix client` command remains blocked because esbuild tries to read a parent directory outside the workspace; using the Vite JavaScript API with the same checked-in config succeeded.

## Overall completion and production-readiness verdict

The requested product upgrade is **not complete**. The repository contains substantial working implementation slices, but several phases remain partial, provider-dependent, or unverified. In particular, full-site localization, AI form autofill, immutable platform audit retention, waste/spoilage inventory tracking, approved payment/marketplace connections, production migration execution, and live staging/production verification are not complete. The feature matrix above records these limits. The six `20261027000000` through `20261027000005` migrations are checked in but have not been run against Neon.

Final local verification on 27 October 2026:

- `npm.cmd test --prefix server`: **91/91 passed**.
- `npm.cmd test --prefix client`: **2/2 passed**.
- `client` Vite JavaScript API production build: **passed**, 165 modules; largest JavaScript chunk 238.47 kB.
- Node syntax checks over `server/src`, `server/test`, and `server/scripts`: **101 JavaScript files passed**.
- `server/node_modules/.bin/prisma.cmd validate --schema prisma/schema.prisma` from `server`: **passed**.
- `git diff --check`: **passed**; Git emitted only line-ending normalization warnings.
- `npm.cmd run build --prefix client`: **failed in the restricted workspace** because esbuild could not read a parent directory. The same Vite config built successfully through Vite's JavaScript API.
- No lint script is defined. The current branch is `security-hardening`, at `fdd02fa`; the product-upgrade edits are uncommitted in the worktree. No production database, Render service, Meta WhatsApp account, payment account, or marketplace partner connection was accessed. No production data was inspected or changed.

Before claiming production completion, still required: review and apply the pending migrations only after verified Neon backup, duplicate/schema review, and deliberate Render approval; configure approved subscription prices, billing and trial/grace policies, provider credentials and signed webhooks; supply owner-approved company/legal content; select and approve an AI provider and privacy policy; obtain authorized Swiggy/Zomato access; complete all-page translation and native review; and run staging security, payment, recovery, accessibility, and migration rollback checks. Current edits are in the worktree; this audit did not commit or push them.
