# Unified order management

## Implemented

The restaurant inbox continues to use the existing `Order` and `OrderItem` models. A new `source` column identifies `SVAADYA_QR` and `MANUAL`; `externalOrderId`, `settlementStatus`, `paymentMethod`, `idempotencyKey`, and an idempotency fingerprint provide room for authorized sources without a second order system. Existing rows backfill to `SVAADYA_QR`. The tenant inbox supports source/status/date filters, existing text search and pagination, live Socket.IO refresh, optional new-order sound, print receipts, and staff-entered takeaway/dine-in orders. Manual order prices, active items, and table ownership are verified on the server. Orders start with payment pending; no second marketplace charge is initiated.

The public QR flow sends a request idempotency key. Redis helps coordinate concurrent requests; a tenant-scoped unique database constraint is the durable backstop, including during Redis outages. A key is stored as a SHA-256 digest with a request fingerprint so reuse with a changed payload is rejected. Marketplace source status changes are rejected until a connected provider adapter supports them.

## Not connected

Swiggy and Zomato status is `NOT_CONFIGURED`; their adapters reject ingestion. Their authenticated partner APIs and webhook contracts require partner approval and credentials unavailable in this workspace. The application does not scrape partner dashboards. The current Svaadya public flow does not distinguish a website order from a QR-initiated visit, so that source is also not falsely assigned. The manual order entry is the available fallback.

`Payment` is food-order payment state only. Subscription billing is outside this flow. Marketplace settlement is represented separately by `Order.settlementStatus`; it stays `NOT_APPLICABLE` for current Svaadya/manual orders. For any marketplace source, use `paymentMethod=MARKETPLACE` and provider-defined settlement values only after an authorized integration is built.

## Migration and verification

Migration: `server/prisma/migrations/20261014000000_unified_order_sources/migration.sql`. It adds nullable provider/idempotency identifiers and defaulted source/payment metadata without deleting orders. Apply only after a database backup and staging schema diff. Rollback is application rollback; retain additive columns unless data review approves removal. No external marketplace sandbox was available or used. Run `npm test --prefix server` and `npm run build --prefix client`.
