# Bug audit and fixes

## Fixed in this change

- **Duplicate order risk on Redis errors:** one broad catch included both Redis operations and order creation, so a post-commit Redis error could execute `createOrder` a second time. The handler now avoids rerunning creation once the write begins; the customer client sends a stable idempotency key, and a tenant-scoped unique index plus request fingerprint deduplicates even without Redis.
- **Payment demo in production:** Render configured the `mock` provider and the checkout displayed fake success/failure actions. Production now defaults to `unconfigured`, rejects mock mode at startup, and the demo controls only render in development.
- **Payment trust boundary:** Razorpay browser callback signature alone did not verify fetched captured status, amount, currency, or provider order association. Server-side provider fetch checks these before marking paid; webhook reconciliation validates amount/currency and uses a conditional pending-state update.
- **Payment data in guest order responses:** full payment rows contained provider identifiers, signatures, and raw webhook payload. Guest and staff order responses now return an allowlisted payment summary only.
- **Payment page refresh/failure:** payment depended on router-only state and rendered an indefinite spinner after a failed request. It can restore the saved order by ID and exposes retry and tracking actions.
- **Inbox gaps:** added order source/payment/settlement metadata, manual tenant-scoped order entry with server-recalculated pricing, source filters, connection status, and optional sound.
- **Mock notifications in production:** default messaging is now unconfigured; mock delivery is development-only. Twilio request timeout and sanitized notification logs were added.

## Tests and remaining audit scope

Regression coverage verifies order response secret stripping and marketplace adapters stay unavailable without authorization. Existing OTP, RBAC, Redis, serving, and service tests remain. A full customer browser flow, isolated multi-tenant database suite, live payment sandbox, Render startup against PostgreSQL, and marketplace webhook sandbox were not available in this environment. No live charge/refund or production migration was executed. See the payment, marketplace, and OTP setup docs for items awaiting credentials or external approval.
