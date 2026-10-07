-- Safe index creation for production: run these using psql or your DB admin console.
-- These use CREATE INDEX CONCURRENTLY to avoid table locks on large tables.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_restaurant_status_created_at ON "Order" ("restaurantId", "status", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_restaurant_paymentStatus ON "Order" ("restaurantId", "paymentStatus");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_table_createdAt ON "Order" ("tableId", "createdAt");

-- Verify indexes:
-- \di+ idx_order_restaurant_status_created_at
-- or run EXPLAIN ANALYZE on your typical queries to confirm the planner uses them.
