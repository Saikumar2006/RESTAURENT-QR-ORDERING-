# Svaadya Product Upgrade Audit

Audit refreshed: 26 October 2026. This inventory describes repository evidence only; it does not establish that production credentials, external integrations, migrations, or live payment flows work.

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
| Tables and current-day orders | Partial | `tableService.listTables` and tenant-scoped order listing exist. `getTodayOperations` in `restaurantInsightsService.js` now returns a timezone-bounded summary and five deterministically sorted orders; recent table occupancy remains based on currently loaded active orders. |
| Menu sections and classifications | Partial | `menuService.js` validates tenant ownership and preserves historical order snapshots; `AdminMenu.jsx` supports Veg/Non-Veg and collapsible category panels. Editable category sections/classification and archive UX remain incomplete. |
| Restaurant staff and RBAC | Partial | `roleService.ensureRestaurantRoles`, role APIs in `roleController.js`, and `AdminStaff.jsx` support configurable restaurant roles. Invitation/reset onboarding, access reviews, immutable audit storage, and broader negative tests are missing. |
| Platform administration/RBAC | Partial | `PlatformAdmin` auth and `platformService.js` exist. Platform roles for operations, finance, support, and read-only auditing, with scoped server authorization, are missing. |
| Navigation and settings | Partial | `AdminLayout.jsx` has responsive drawer/collapse behavior, but not the requested top-right control. `AdminSettings.jsx` covers profile, hours, tax, and some notifications; branches, full payment/security integration settings, and secure connection tests are incomplete. |
| Marketplace orders | Partial; not live | `orderProviders.js`, `AdminIntegrations.jsx`, order source fields, and provider docs exist. Swiggy/Zomato show unconfigured states; no approved provider credentials or verified live ingestion exists. `AdminOrders.jsx` provides a shared internal inbox for persisted sources. |
| Website theme editor | Partial / substantially implemented | `websiteThemeService.js`, `websiteThemeController.js`, `AdminAppearance.jsx`, and `WebsiteThemeVersion` provide tenant-scoped versioned drafts, publish/rollback/default, presets, and storage validation. Production object storage ownership and browser/device accessibility coverage are not verified. |
| Subscription plans, paid onboarding, expiry | Missing | No subscription/plan/pending-onboarding models or entitlement scheduler found in `schema.prisma`, routes, or services. `authService.registerRestaurant` currently creates a restaurant directly. |
| Public pricing, legal, trial, checkout pages | Partial | `client/src/pages/Home.jsx` and admin login/registration exist. Pricing-period checkout, trial/payment-result states, contact/about, and legal pages are missing; owner-supplied business facts and legal review are required. |
| Inventory | Missing | No ingredients, stock ledger, recipes, suppliers, movements, or inventory endpoints/services found. |
| Premium AI form autofill | Missing | No AI provider, subscription/role entitlement, voice/text proposal, validation, or confirmation flow found. |
| Eleven-language localization | Missing | Most UI strings remain embedded in React pages; no translation resources, preference storage, coverage scan, or translated-flow tests found. |
| Production migration lifecycle | Partial / unverified | The server no longer runs `db push` or the RBAC backfill in `prestart`. `db:migrate:safe` checks duplicate values and catalog index state before `migrate deploy`. Neon counts, schema history, backup, and actual deployment remain unverified. |
| Automated regression/accessibility coverage | Partial | 52 server tests cover auth, permissions, Redis, payment signatures, order state, marketplace fallback, theme isolation, migration gates, coupon caps, and timezone/date-range boundaries. Frontend e2e, accessibility, responsive checks, subscription, inventory, AI, and full localization coverage are absent. |

## Dependencies and risks

1. Platform RBAC must precede platform finance, support, account creation, or other cross-tenant operations.
2. SaaS plans, separate billing records, signed webhook idempotency, trials, and backend entitlements must precede paid onboarding and Premium AI.
3. Inventory needs tenant-owned stock movements, recipe mappings, transaction/idempotency policy, and explicit cancellation/refund handling before deductions are enabled.
4. Public legal content needs owner-approved company details and qualified review; do not invent them.
5. Localization and AI cross many pages and APIs. Entitlement, privacy, provider, rate-limit, and confirmation policy should precede UI claims.
6. Production migration state is still an external gate. No production data change should happen before Neon backup and duplicate/schema review.

## Prioritized implementation plan

1. Continue Phase 1 operations UX: current-day table occupancy accuracy, staff onboarding/access controls, and broader interaction/accessibility coverage.
2. Complete separate platform RBAC, audit retention, and authorization-negative tests.
3. Design subscription and onboarding persistence, a payment ledger separate from food orders, webhook idempotency, trials/expiry worker, and server entitlement checks.
4. Add public pricing/checkout and owner-reviewed legal/support pages against the subscription APIs.
5. Add inventory ledger and optional recipe consumption only after explicit mappings and order lifecycle policy.
6. Add Premium AI proposals with backend entitlements, structured validation, privacy disclosure, and explicit user confirmation.
7. Externalize UI strings, add 11 translations/fallbacks, and test coverage before claiming completeness.
8. Expand security, reliability, accessibility, migration recovery, and staging verification across all modules.

## Phase 1 slice implemented after the checkpoint

- Added `getTodayOperations` in `server/src/services/restaurantInsightsService.js` and `GET /:id/analytics/today`, protected by authentication, tenant assertion, and `analytics.view`.
- Added IANA timezone validation and DST-aware business-day boundaries in `server/src/utils/timezone.js`.
- Dashboard cards now use server-computed business-day totals and show five deterministically sorted, tenant-scoped orders without returning customer contact/session-token fields.
- Tests in `server/test/restaurantTimezone.test.js` cover tenant-scoped query shapes, five-order limit, valid zones, 23/25-hour DST days, local analytics grouping, date-range validation, and date-range maximums.
- Reworked `AdminCoupons.jsx` into a responsive form/list layout with edit, deactivate/archive behavior, retry/error states, and expiry/usage details. Coupon creation/update validation now rejects over-100% discounts and impossible usage-limit reductions. `couponService.incrementUsage` performs a conditional atomic increment inside the order transaction, preventing concurrent redemptions from exceeding a cap or leaving a coupon order partially created.
- `server/test/couponService.test.js` covers discount rules and a concurrent usage-cap claim.
- Analytics now uses restaurant-local day boundaries for range queries and peak-hour grouping; the dashboard accepts a date range up to 90 days. Fixed an adjacent undefined month-boundary helper in the customer report.

This slice does not complete the broader product upgrade or establish production readiness. No production database was accessed or changed, and external marketplace connectivity remains unverified.
