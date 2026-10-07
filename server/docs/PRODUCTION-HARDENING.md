Production hardening checklist and changes made

Overview
- Goal: production-ready horizontal scale, Redis, distributed rate limiting, idempotency, pooling, indexing guidance.

Key changes made
- Added optional Redis client and redisService abstraction (server/src/config/redis.js, server/src/services/redisService.js)
- Added Socket.IO Redis adapter initialization (server/src/sockets/index.js) when REDIS_URL set
- Added Redis-backed distributed rate limiter middleware (server/src/middleware/distributedRateLimit.js) and wired auth rate limits in app.js
- Added cache invalidation hooks for menu/table public endpoints (menuService/tableService)
- Made server start connect to Redis if configured (server/src/server.js)
- Documented REDIS_URL env var in config and README guidance pending
- Prepared safe Prisma index additions for Order queries (see notes below)

Next steps and operational guidance
- Set REDIS_URL in production (e.g. redis://:password@host:6379)
- Use managed Redis with network ACLs and TLS where available
- Tune Prisma and Postgres pool sizes in DATABASE_URL and host settings (Supabase / Render recommendations)
- Consider using a managed distributed rate-limiter library or an in-process fallback

Database indexing (recommended safe plan)
- Proposed indexes were added to server/prisma/schema.prisma to speed common queries. They are additive only (non-destructive):
  - Order: @@index([restaurantId, status, createdAt])
  - Order: @@index([restaurantId, paymentStatus])
  - Order: @@index([tableId, createdAt])
- Important: on large production tables prefer CREATE INDEX CONCURRENTLY to avoid table locks. Example SQL:

  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_restaurant_status_created_at ON "Order" ("restaurantId", "status", "createdAt");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_restaurant_paymentStatus ON "Order" ("restaurantId", "paymentStatus");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_table_createdAt ON "Order" ("tableId", "createdAt");

- If using Prisma db push against a staging DB first, validate the index benefits and then apply to production in a maintenance window or use the concurrent CREATE INDEX commands above.

Migration & safety notes
- Index additions are non-destructive but building them on very large tables can take time; plan accordingly.
- No application-level code that mutates business logic was changed; behavior is preserved when REDIS_URL is unset.

