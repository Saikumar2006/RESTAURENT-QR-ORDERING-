# Security test plan

Automated checks currently available:

- `npm test --prefix server`: service/unit tests for permission resolution, legacy owner fallback, permission middleware, Redis cache JSON/TTL/SCAN/Lua behavior and outage fallback, plus production static serving.
- `npm run build --prefix client`: Vite production bundle.
- `npm run prisma:generate --prefix server` and `npm exec --prefix server -- prisma validate --schema prisma/schema.prisma`: generated client/schema validation.

Before release, use isolated disposable PostgreSQL and Redis services to add integration cases for Restaurant A vs B reads/writes/deletes, mismatched nested resource IDs, order export/refund, staff role and account revocation, final-owner protection, manager escalation, custom role tenant boundaries, Redis outage, and cache invalidation after committed and rolled-back transactions. Regression-test login/logout, QR ordering, kitchen/cashier paths, subscriptions/payments, direct page refresh and startup. Never point destructive test commands at production.

This workspace has no verified disposable DB or live Redis endpoint, so database migration application and real cross-tenant integration tests remain unverified. Do not interpret unit tests as satisfying those integration cases.
