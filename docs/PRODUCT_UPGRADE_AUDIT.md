# Svaadya Product Upgrade Audit

Audit date: 25 October 2026  
Checkpoint: clean working tree on branch `security-hardening`, commit `5d4a5d2e634b484237209daef2d0ffb97125ca0f`. No production database or secrets were accessed.

## Baseline

- `npm.cmd test --prefix server`: **31 passed, 0 failed**.
- `npm.cmd run build`: **blocked by the workspace sandbox**. Vite/esbuild reports `Cannot read directory "../../../..": Access is denied` while resolving `client/vite.config.js`. The earlier `npm` PowerShell shim invocation was also blocked by the host execution policy; using `npm.cmd` bypassed that issue.
- No code changes existed at the checkpoint. The test suite covers auth, permission middleware, Redis behavior, OTP, order providers and lifecycle, and production static serving. It does not cover most of the upgrade requirements below.

## Feature inventory

Statuses describe evidence in this repository, not deployment verification.

| Area | Status | Evidence and assessment |
|---|---|---|
| Frontend/backend structure and core restaurant ordering | Implemented | React routes in `client/src/App.jsx`; Express mounts routes in `server/src/app.js`; `orderService` recalculates prices from DB data; order/payment state handling in `server/src/services/orderService.js` and `paymentService.js`. |
| Restaurant dashboard analytics | Partial | `restaurantInsightsService.getAnalytics` returns daily counts/revenue, top items, categories, coupons, and peak hours; dashboard shows a seven-day revenue chart and recent order feed in `client/src/pages/admin/AdminDashboard.jsx`. The date range is fixed, the feed uses a 25-order response, and date calculations are UTC rather than restaurant business-day time. `AdminReports.jsx` is a summary of a capped 500 recent orders, not a full date-filtered reporting view. |
| Promotions/coupons | Partial | CRUD API and server checks exist in `server/src/routes/coupons.js`, `couponController.js`, `couponService.js`, and coupon Zod schemas. The UI `AdminCoupons.jsx` creates, activates/deactivates, lists, and deletes coupons, but offers no edit flow and is not the requested two-column responsive editor/list. Concurrent usage-limit enforcement needs regression coverage. |
| Tables and recent orders | Partial | Tenant-protected table/order routes in `server/src/routes/restaurants.js`; `AdminDashboard.jsx` shows active/recent orders and table occupancy. There is no clear five-most-recent current-business-day section; dashboard filters to active orders and uses a UTC date for its revenue card. `orderController.listOrders` provides paging, but dashboard pagination/business-day semantics are not surfaced. |
| Menu management | Partial | Category/item CRUD and ownership validation are in `menuService.js`; deletes disable records to retain historical order references. `AdminMenu.jsx` supports category and item operations and Veg/Non-Veg via `MenuItem.isVeg`, but category sections are all expanded and categories have no editable section/classification model. |
| Restaurant staff and roles | Partial | Tenant roles, permissions, assignment, and audit writes are implemented in `roleService.js`, `roleController.js`, and restaurant routes. `restaurantController.listStaff` omits password hashes and `createStaff` hashes passwords. `AdminStaff.jsx` supports staff and restaurant-role UI. Initial passwords are directly entered; invitation/reset onboarding, complete removal, and audit immutability are not established. |
| Platform roles and administration | Partial | Separate `PlatformAdmin` authentication and restaurant overview/list APIs exist (`platformAuthService.js`, `platformService.js`, `routes/platform.js`). The model has no platform role/permission fields; all active platform admins share the same API access. Requested Operations, Finance, Support, and Auditor scopes and platform role management are missing. |
| Navigation | Partial | `AdminLayout.jsx` has mobile drawer and desktop collapse state with accessible labels; the collapse button is at the sidebar bottom, and the top bar has no requested beside-heading toggle. |
| Restaurant settings/integrations | Partial | Restaurant profile, tax, hours, timezone, geofence, notifications, and platform payment status appear in `AdminSettings.jsx`. WhatsApp sender/template/connection configuration and secure connection test are absent; current OTP WhatsApp integration is platform-configured through environment variables. Branches, hours by weekday, QR/table options, and integration management are not complete. |
| Payments | Partial | Razorpay/mock provider, server-side checkout signature verification, raw-body webhook signature verification, and transactional status claim exist in `paymentService.js` and `app.js`. This is for customer food orders, not SaaS subscription checkout. Live provider credentials/webhooks are not verified here; replay/idempotency coverage is limited. |
| Pricing, SaaS checkout, onboarding, subscription lifecycle | Missing | No subscription/plan/pending-onboarding models or billing APIs were found in `schema.prisma`, routes, or services. Restaurant registration in `authService.registerRestaurant` is immediate; `AdminRegister.jsx` is directly linked from the public landing page. No expiry scheduler or subscription entitlement enforcement exists. |
| Public website and legal pages | Partial | A substantial landing page exists in `Home.jsx`, plus restaurant login/register. Dedicated pricing/billing selection, contact/about/legal, trial, payment-result, and support pages are absent. Landing-page pricing styles and illustrative dashboard/platform metrics are not backed by a billing product. Truthful owner-supplied legal/contact details remain an input. |
| Inventory | Missing | No ingredient, stock, recipe, supplier, purchase, or inventory ledger models/routes/services exist in schema or server source. |
| Premium AI voice form autofill | Missing | No AI provider, voice capture, entitlement, proposal/confirmation, or usage API is present. |
| Eleven-language localization | Missing | No localization framework/resources or language preference storage are present. UI text is largely hardcoded in React pages. |
| Authentication, tenant isolation, RBAC | Partial / implemented core | Tenant ID is derived from authenticated user in `middleware/auth.js`; restaurant controllers/services scope queries; separate platform auth is used. Restaurant roles are configurable and role changes write `AuditLog`. There is no platform RBAC, no access review workflow, and `AuditLog` is mutable/deletable with the restaurant (not tamper-resistant). Negative tenant/escalation test coverage is limited. |
| Redis, Socket.IO, deployment | Partial / unverified in deployment | Redis-backed cache/rate limits and Socket.IO adapter have best-effort outage fallbacks (`config/redis.js`, `services/redisService.js`, `sockets/index.js`). Production manifest is `render.yaml`; actual deployed configuration/health, Redis, and database behavior were not checked. Socket restaurant join currently trusts a verified JWT payload without reloading active user/restaurant state. |
| Database changes and rollback | Partial / risk | Two SQL migrations exist under `server/prisma/migrations`, while `server/package.json` prestart executes `prisma db push`; README claims there are no migration files. This deployment/documentation strategy is inconsistent and needs an explicit safe migration/rollback policy before schema-heavy phases. No database migration was run. |
| Tests and accessibility/responsiveness | Partial / unverified | Eight server test files, 31 passing baseline tests. No frontend component/e2e, accessibility, responsive, plan, inventory, AI, or localization tests are configured. |

## Dependencies and risks

1. Subscription plans, payment ledger/webhook idempotency, and entitlement checks must precede public paid onboarding and Premium-only features. They need a schema migration and a deliberate payment provider account/product model; food-order payments cannot safely double as SaaS billing.
2. Platform RBAC must precede platform-created restaurants, finance access, support access, or cross-tenant tools. It should be separate from restaurant `User` roles and have append-only actor/reason audit records.
3. Inventory depends on a tenant-owned ledger, transaction/concurrency policy, recipe mapping, and explicit order confirmation/cancellation/refund rules. Existing order-item snapshots provide history but do not imply ingredient consumption.
4. Localization and AI touch broad UI/backend surfaces. AI also depends on subscription entitlements, role checks, provider/privacy decisions, structured validation, rate limits, and a user confirmation UX.
5. The existing hard-delete coupon route and DB cascade policies need care around audit retention; restaurant deletion cascades users/audit logs. No destructive operation was invoked.
6. Current schema uses floating point for monetary amounts; changing money storage has compatibility and migration implications. Do not combine it casually with subscription work.

## Prioritized implementation plan

1. Phase 1 dashboard and daily operations: make analytics date-aware and restaurant-timezone aware, clarify the current business-day recent-five feed, improve loading/error/empty states, then promotions layout/editing, collapsible menu sections, staff onboarding, and responsive settings/navigation.
2. Phase 2 authorization: add platform role/permission assignments and scoped APIs/UI; strengthen immutable audit design; add negative cross-tenant and privilege-escalation tests before exposing new platform actions.
3. Phase 3 subscription foundation: define plan/price/tax/currency and pending onboarding, provider-specific SaaS payment records, signed idempotent webhook reconciliation, trials/grace/expiry policy, and safe scheduler/entitlement enforcement before public checkout UI.
4. Phase 4 public/legal pages: ship only owner-verified company/contact details and qualified legal copy; connect pricing/trial/checkout to Phase 3 server state.
5. Phase 5 inventory: design ledger and idempotent event policy first, then tenant-scoped CRUD/reports/alerts and transaction/concurrency coverage.
6. Phase 6 AI form proposals: choose provider/privacy policy; implement backend entitlement and schema validation before voice/text UI, always requiring explicit confirmation.
7. Phase 7 localization: establish externalized resources and fallback/coverage checks; translate the complete UI and critical flows rather than claiming partial translation as complete.
8. Phase 8 reliability/security: add negative-authorization, payment replay, expiry/retry, inventory concurrency, coupon concurrency, validation, Redis outage, accessibility, and migration/rollback coverage; verify staging provider and deployment configuration.

## First implementation slice

Implemented the first small Phase 1 slice: category cards in `client/src/pages/admin/AdminMenu.jsx` now collapse/expand with native keyboard-accessible buttons, item counts, and `aria-expanded`/`aria-controls`. The first category opens by default; category/item APIs and stored data are unchanged.

Post-slice checks: `npm.cmd test --prefix server` **31 passed, 0 failed**; an esbuild JSX transform reports `AdminMenu JSX syntax OK`. The full client build remains blocked by the same sandbox access error recorded above; Vite 5.4.8 does not accept the attempted `--configLoader runner` workaround. No schema or database changes were made.
