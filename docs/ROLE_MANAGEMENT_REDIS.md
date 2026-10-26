# Tenant roles, permissions, and Redis

## Role model

Restaurant access is now resolved from the authenticated user’s restaurant-scoped role record on each request. The server does not trust role or permission claims from the browser or JWT. Platform-admin authentication remains separate.

The built-in tenant roles are:

- **OWNER:** all capabilities; protected from reassignment, permission reduction, and deletion.
- **MANAGER:** operational access, menu/table management, analytics, coupons, basic staff management, settings, and audit viewing; excludes owner-level role management, refunds, cancellations, and destructive staff/menu/coupon actions.
- **KITCHEN:** view and progress orders, including completion.
- **CASHIER:** view orders, create orders, and view payment status/reports.
- **STAFF:** view/update orders and view tables.

Owners can create tenant-scoped custom roles, edit their permissions, and assign them to team members. System roles cannot be renamed or deleted. Roles with assigned staff cannot be deleted. Staff account creation always uses the legacy `STAFF` discriminator; it cannot grant owner access by setting `ADMIN` in the request.

The team screen is available at **Admin → Team**. The API exposes role listing/creation/update/deletion, permission replacement, staff assignment, and a bounded audit log under `/api/restaurants/:restaurantId`. Authorization and role IDs are always checked against the authenticated user’s `restaurantId`.

## Existing database rollout

The RBAC schema additions are additive: `roleId` is nullable, legacy `User.role` and password hashes remain, and existing business records are untouched. Before the server starts, `prestart` runs `prisma db push`, then `scripts/backfill-rbac.js`. The backfill creates the permission catalog and built-in tenant roles, maps old `ADMIN` users to `OWNER`, and maps old staff to `STAFF`; it can be rerun safely. New restaurant registration initializes its owner role within the registration transaction.

Use the current Render commands:

```text
Root directory: .
Build command: npm install --prefix server && npm install --prefix client
Start command: npm start
```

The existing `npm start` lifecycle runs the schema sync, RBAC backfill, and client build before `server/src/server.js`. The backfill is database-writing, so deploy it to a staging database first when introducing this version to an existing production database. Do not run the demo seed against production.

## Redis configuration and behavior

Set `REDIS_URL` in `server/.env` or the Render service environment to the private TLS connection URL from a managed Redis provider. It is intentionally a backend-only value; never use a `VITE_` variable for it. With `REDIS_URL` unset, the app continues using database reads and the existing in-process global rate limiter.

When configured, Redis provides:

- Five-minute tenant-keyed caching for public menus and active table lists, invalidated after corresponding edits.
- Atomic fixed-window distributed rate limiting for authentication and selected public write endpoints. If Redis is temporarily down, those limits fall back to a bounded per-process counter instead of becoming unlimited.
- Existing order idempotency keys and Socket.IO cross-instance room propagation.

Cache read/write/invalidation errors fail back to the database; permission records are deliberately never cached, so permission changes apply on the next request. Pattern invalidation uses incremental `SCAN`, not Redis `KEYS`. Cache values have bounded TTLs.

## Verification

The server test suite covers live permission resolution, legacy access defaults, Redis cache serialization and expiry, SCAN invalidation, atomic rate-limit calls, and outage fallback. Run:

```sh
npm test --prefix server
npm run build --prefix client
```

The application suite does not connect to a live Redis or production database. Verify the Render service’s Redis URL and database migration on staging before production rollout.
