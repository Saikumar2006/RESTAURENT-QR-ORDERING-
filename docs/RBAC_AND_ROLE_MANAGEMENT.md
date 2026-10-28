# RBAC and role management

## Implemented model

Tenant login identifies one existing `User` row, whose `restaurantId` is authoritative. `Role` rows are restaurant-scoped; permissions are loaded from Prisma on every authenticated request, so role changes and deactivation take effect on the next request without JWT role claims. Platform admins use the separate `PlatformAdmin` table and `platform` JWT type. The platform endpoints currently expose login, self, overview, and restaurant listing; the platform role taxonomy (support/finance/super-admin) is not yet implemented.

| Role | Effective access |
|---|---|
| OWNER | All registered restaurant permissions; protected from staff-screen demotion/removal and permission reduction |
| MANAGER | Operations, menu/table, analytics, coupons, basic staff, settings, audit; no owner-level role management, refunds, or destructive actions |
| KITCHEN | Order view/progress/completion |
| CASHIER | Order view/create and payment status/report visibility |
| STAFF | Order view/progress and table view |
| Custom | Explicit permission set scoped to one restaurant; only role managers can assign/manage |

The central permission registry is `server/src/services/roleService.js`. Actual keys follow this product's existing route vocabulary (for example `orders.view`, `staff.roles.manage`, `analytics.export`); the registry is returned to the staff UI. Platform permissions are never present in tenant roles.

## Staff workflow and current limits

The existing staff page lists restaurant users, creates a staff account, changes its name/status/role, and provides role CRUD and audit history. Password-based invitation email, hashed single-use invitation tokens, invitation expiry, session-token revocation beyond next-request database status checks, and ownership transfer are not implemented. Account creation currently provisions a password directly; only trusted staff managers should be given this workflow. There is no multi-restaurant membership model: each user belongs to exactly one restaurant. Managers cannot manage roles because that permission is owner-only; owners remain the only principals able to define permission sets, preventing manager privilege escalation.

A custom role may hold any registered tenant permission when configured by an owner. The database checks role IDs against restaurant scope in staff assignment and role endpoints. Existing platform admins are separate and inaccessible through tenant role IDs.

## Rollout

The additive schema is in `server/prisma/migrations/20261009000000_restaurant_rbac/migration.sql`. It adds nullable `User.roleId`, Role, Permission, RolePermission, and AuditLog while preserving users and hashes. Backfill maps legacy ADMIN to OWNER and all other legacy accounts to STAFF. Stage against a disposable/staging PostgreSQL database first. Current `prestart` only generates Prisma Client and builds the client; it does not run `prisma db push`, migrations, or the RBAC backfill. Never use `prisma migrate reset` or seed production.

On isolated staging PostgreSQL, review schema and migration history, apply checked-in migrations with `prisma migrate deploy`, then run `npm run rbac:backfill --prefix server`. Verify owner/staff mapping before considering production. Rollback application code first; additive tables/columns can remain. No production DB application was performed in this workspace.
