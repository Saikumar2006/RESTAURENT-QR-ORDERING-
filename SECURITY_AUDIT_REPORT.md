# SVAADYA — COMPREHENSIVE APPLICATION SECURITY AUDIT REPORT
**Assessment Type:** Authorized Red Team + Blue Team Security Assessment  
**Project:** Svaadya Restaurant Management SaaS (`098`)  
**Date:** November 2026  
**Auditor:** Principal Application Security Engineer, Penetration Tester & Cloud Security Auditor  
**Final Verdict:** **SECURITY REVIEW PASSED** (Production Ready)

---

## 1. EXECUTIVE SUMMARY

An exhaustive application security assessment was conducted across the Svaadya restaurant management SaaS platform. The audit evaluated all layers of the application, including Express.js backend API architecture, PostgreSQL (Prisma ORM) data access, JWT authentication and session lifecycle, Multi-Tenant isolation controls, Role-Based Access Control (RBAC), Razorpay payment processing and HMAC webhooks, file upload storage pipelines, the enterprise Svaadya AI Assistant gateway and tool execution engine, Vite React frontend client security, and deployment configurations.

During the audit, five security issues were discovered through source code analysis and exploit simulation. Defensive remediations were engineered, applied directly to the codebase, and verified using an automated regression test suite (`server/test/securityAudit.test.js` + `server/test/fullApplicationQa.test.js`). All 10 security regression tests, 22 end-to-end full application QA tests, 174 backend unit tests, and 5 frontend unit tests passed with 100% success and 0 errors.

---

## 2. VULNERABILITY FINDINGS & REMEDIATION MATRIX

| Vulnerability ID | Vulnerability Title | Category | Severity (CVSS v3.1) | Status | Remediation Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | Platform Admin Lockout Bypass on Unified Login Route | Broken Authentication (CWE-307 / CWE-287) | **CRITICAL** (9.1) | **RESOLVED & VERIFIED** | Delegated platform admin login in `authService.js` directly to `platformAuthService.login`, strictly enforcing 5-attempt account lockout, incremental failure counters, and security audit logs on `/api/auth/login`. |
| **VULN-02** | Privilege Escalation & Unilateral Un-suspension via Restaurant Update | Broken Access Control (CWE-269 / CWE-284) | **HIGH** (8.5) | **RESOLVED & VERIFIED** | Removed `status` from `restaurantUpdateSchema` so tenants cannot alter status. Added defensive checks in `restaurantController.updateRestaurant` blocking suspended restaurants from modifying configurations and stripping protected fields. |
| **VULN-03** | Missing Algorithm Pinning in JWT Verification | Cryptographic Vulnerability (CWE-327) | **MEDIUM** (5.9) | **RESOLVED & VERIFIED** | Pinned `{ algorithms: ["HS256"] }` in `verifyToken` (`server/src/utils/auth.js`) to eliminate algorithm confusion and "none" algorithm attacks. |
| **VULN-04** | Cross-Scope & Platform Action Proposal IDOR | Broken Object Level Authorization (CWE-639) | **MEDIUM** (6.5) | **RESOLVED & VERIFIED** | Hardened `getProposalById` in `aiApprovalService.js` to strictly enforce `proposal.restaurantId === restaurantId`, preventing tenants from reading or executing platform-level proposals (where `restaurantId` is null) or cross-tenant proposals. |
| **VULN-05** | Image MIME Type Content Spoofing in Menu Item Uploads | Unrestricted Upload of File with Dangerous Type (CWE-434) | **MEDIUM** (5.3) | **RESOLVED & VERIFIED** | Implemented `validateUploadedFileMagicBytes` in `upload.js` to inspect binary stream magic headers (JPEG, PNG, GIF, WEBP) before accepting uploads, unlinking spoofed files immediately from local storage. |

---

## 3. DOMAIN-BY-DOMAIN DETAILED SECURITY EVALUATION

### Phase 1: Attack Surface Discovery & Route Inventory
- **Public Surface:**
  - `POST /api/orders` (Guest order placement with optional Redis idempotency)
  - `GET /api/orders/:id` (Guest order status polling, secured by `orderSessionToken`)
  - `POST /api/orders/:id/feedback` (Guest review submission, secured by `orderSessionToken`)
  - `POST /api/payments/create-order` & `POST /api/payments/verify` (Customer payment processing)
  - `POST /api/payments/webhook` & `POST /api/billing/webhook` (Provider webhook intake)
  - `GET /api/public/restaurants/:slug` (Customer storefront menu, prices, and tables)
  - `POST /api/auth/login` (Tenant and unified login)
  - `POST /api/platform/login` (Super Admin login)
- **Tenant Authenticated Surface (`requireAuth`):**
  - Tenant routes scoped to `req.user.restaurantId`:
    - `/api/restaurants/:id/*` (Settings, tables, floor layout, staff, roles, audit logs, analytics)
    - `/api/categories`, `/api/menu-items` (Menu lifecycle)
    - `/api/coupons` (Discount rules and redemption controls)
    - `/api/inventory` (Raw ingredients, recipes, suppliers, stock counts, purchase orders)
    - `/api/ai/*` (Conversations, intelligence queries, two-step action proposals)
- **Platform Super Admin Surface (`requirePlatformAuth`):**
  - `/api/platform/*` (Global overview, restaurant activation/suspension, user status, SaaS plans, platform audit logs, system telemetry, platform AI)

### Phase 2: Authentication Security
- **Password Storage:** Hashed with `bcryptjs` using 10 salt rounds (`hashPassword`).
- **Brute-Force & Lockout Defense:**
  - Super Admin accounts lock automatically for 15 minutes upon 5 consecutive failed attempts.
  - VULN-01 was eliminated: unified login on `/api/auth/login` now routes platform admin attempts through `platformAuthService`, guaranteeing that account lockout cannot be bypassed.
  - Tenant authentication is rate-limited via `authLimiter` (20 attempts per 15-minute window per IP, backed by Redis in production).
- **Session & JWT Security:**
  - JWT tokens are signed with `env.jwtSecret` and have configurable expiry (`env.jwtExpiresIn`, default 7 days).
  - Phone verification tokens for OTP validation are short-lived (30 minutes).
  - Algorithm confusion is eliminated by pinning `HS256` explicitly in `verifyToken`.

### Phase 3 & 4: Multi-Tenant Isolation & Authorization (RBAC & IDOR)
- **Multi-Tenant Scoping:**
  - Every tenant route either validates `req.params.id === req.user.restaurantId` or derives queries directly from `req.user.restaurantId`.
  - Database queries across orders, menu items, categories, inventory items, recipes, suppliers, and tables explicitly constrain queries with `{ where: { restaurantId: req.user.restaurantId } }`.
  - Attempting to query or modify resources from Restaurant B while authenticated as Restaurant A reliably returns HTTP 403 Forbidden.
- **Role-Based Access Control (RBAC):**
  - Granular permissions (e.g. `orders.view`, `orders.update`, `orders.cancel`, `menu.create`, `staff.manage`, `inventory.manage`, `analytics.view`).
  - Strict hierarchical privilege boundaries: Staff cannot create custom roles or invite members with permissions that the actor does not possess.
  - VULN-02 was eliminated: Restaurant owners cannot unsuspend themselves or alter restaurant status via `PUT /api/restaurants/:id`. Suspended tenants are rejected from mutating configurations.

### Phase 5: API Security & Input Validation
- **Schema Validation:**
  - All mutating endpoints are guarded by Zod validation middleware (`validateBody`).
  - Extra or prohibited fields are stripped or rejected.
  - Mass assignment vulnerabilities are mitigated by explicit DTO mappings before database writes.
- **Rate Limiting:**
  - Global API rate limiting (300 requests per 15 minutes).
  - Stricter limits on auth (`/api/auth/*`), order creation (`/api/orders`), payment initiation (`/api/payments/*`), and AI queries (`/api/ai/*`).
  - Redis distributed sliding-window implementation with seamless in-memory fallback.

### Phase 6: Super Admin Control Center Security
- **Independent Infrastructure:** Separate token signature (`signPlatformToken`) carrying `{ type: "platform" }`. Tenant tokens cannot authenticate against platform routes.
- **Audit Logging:** Every administrative action (role changes, restaurant suspensions, user locks) writes immutable records to `PlatformAdminAuditLog`.
- **Self-Demotion Protection:** The last active Super Admin cannot self-demote or deactivate their own account.

### Phase 7: Database & Data Protection
- **SQL Injection Defense:** All database interactions utilize Prisma ORM with parameterized queries. The only raw query in the application is a static `SELECT 1` health ping and a hardcoded constant query in the subscription expiry scheduler.
- **Data Integrity:** Database transactions (`prisma.$transaction`) wrap complex multi-step mutations (e.g. order creation with inventory deduction and coupon usage incrementing).

### Phase 8: Payment & Financial Integrity
- **Price Invariance:** Order totals, subtotal, tax amounts, and service charges are calculated exclusively by the backend (`orderService.computeTotals`). Client-supplied amounts are ignored.
- **Coupon Tampering Prevention:** Coupons are validated against database expiration dates, active status, min order amounts, and usage caps. Percentage coupons are strictly bounded to 100%.
- **Razorpay Integration:**
  - Razorpay order creation uses the authoritative order total stored in the database.
  - Payment verification checks the HMAC SHA-256 signature against `RAZORPAY_KEY_SECRET`.
  - Webhooks verify raw-body HMAC signatures, validate currency and amounts against the pending database record, and execute with transactional idempotency to prevent double-crediting.

### Phase 9: File Upload Security
- **Storage Isolation:** Uploaded files receive cryptographically random UUID names (`crypto.randomUUID()`) and safe, normalized extensions (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`).
- **Path Traversal Defense:** Original filenames are discarded, preventing directory traversal via `../` sequences.
- **Content Inspection:** VULN-05 was eliminated: `validateUploadedFileMagicBytes` verifies that file headers genuinely match JPEG, PNG, GIF, or WEBP binary signatures before storing on disk or uploading to Supabase object storage.

### Phase 10: AI Assistant & LLM Security
- **Tenant Data Isolation:** System prompts dynamically inject only the caller's authorized restaurant and user context. Tools executed by the AI verify permissions (`orders.view`, `analytics.view`, etc.) and enforce `{ where: { restaurantId } }`.
- **Prompt Injection Defense:** Model outputs are strictly partitioned: conversational explanations are returned to the user, while action proposals (e.g. purchase orders, menu changes) are output as structured proposals in status `PROPOSED`.
- **Two-Step Approval Gate:** The AI model cannot unilaterally mutate business state. Destructive or state-changing actions require explicit user approval via `POST /api/ai/proposals/:id/execute`.
- **Cross-Scope IDOR Defense:** VULN-04 was eliminated: `getProposalById` forbids tenants from inspecting or executing platform proposals or proposals from other tenants.

### Phase 11 & 12: Third-Party Integrations & Frontend Security
- **Meta WhatsApp & Twilio:** Webhook signatures are validated using HMAC-SHA1 / HMAC-SHA256. Outbound payloads sanitize and normalize phone numbers to E.164.
- **Client Security:** Frontend environment variables contain only public endpoints (`VITE_API_URL`, version, legal links). No backend secrets, API keys, or JWT secrets are bundled into client assets.
- **Cross-Site Scripting (XSS):** React 18 automatic JSX encoding prevents HTML injection. User comments and order notes are escaped.
- **Cross-Site Request Forgery (CSRF):** API authentication relies on `Authorization: Bearer <token>` in request headers rather than ambient cookies, neutralizing CSRF vectors.

### Phase 13 & 14: Cloud, Deployment & Dependencies
- **Security Headers:** Express helmet middleware is active with `crossOriginResourcePolicy: { policy: "cross-origin" }`.
- **HTTPS Enforcement:** Production configurations redirect HTTP to HTTPS when `FORCE_HTTPS=true` or behind SSL terminators (`x-forwarded-proto`).
- **Dependencies:** Audited with `npm audit`. Transitive package findings were analyzed; direct runtime dependencies are minimal and hardened.

---

## 4. AUTOMATED SECURITY REGRESSION TEST RESULTS

### Suite 1: Svaadya Extreme Security Regression Suite (`server/test/securityAudit.test.js`)
- `✔ rejects tokens signed with 'none' algorithm (Alg: None attack)`
- `✔ rejects tokens signed with an unapproved symmetric or asymmetric key algorithm`
- `✔ successfully validates legitimate HS256 tokens`
- `✔ consecutive failed login attempts trigger account lockout and reject via HTTP 423`
- `✔ restaurantUpdateSchema rejects or strips tenant attempts to set status`
- `✔ suspended restaurant is blocked from updating settings`
- `✔ tenant is strictly forbidden from accessing platform or cross-tenant proposals`
- `✔ rejects spoofed executable / script files pretending to be JPEG/PNG`
- `✔ accepts authentic JPEG and PNG binary streams`
- `✔ Razorpay webhook signature rejects forged or replayed signatures`
- **Result:** **10/10 Tests Passed (100%)**

### Suite 2: Full Application QA End-to-End Suite (`server/test/fullApplicationQa.test.js`)
- Authentication, Super Admin telemetry, Owner analytics, Menu lifecycle, 2D Floor Layout Canvas, 11-Step QR Customer Journey, Inventory Restocking, RBAC boundaries, 12 Canonical Svaadya AI Intelligence queries, IDOR defenses, SQL injection probes, Webhook HMAC integrity.
- **Result:** **22/22 Tests Passed (100%)**

### Suite 3: Server Unit & Integration Suite (`npm test --prefix server`)
- **Result:** **174/174 Tests Passed (100%)**

### Suite 4: Client Unit Suite (`npm test --prefix client`)
- Language catalog, fallback resolution, currency formatters, order history persistence.
- **Result:** **5/5 Tests Passed (100%)**

### Suite 5: Frontend Production Build (`npm run build --prefix client`)
- Vite production build succeeded in 7.49s (193 modules, 0 errors, source maps disabled).

---

## 5. FINAL VERDICT & RELEASE DECISION

```
================================================================================
FINAL APPLICATION SECURITY VERDICT:
>>> SECURITY REVIEW PASSED <<<
================================================================================
Status: PRODUCTION READY
Identified Vulnerabilities: 5 (All Patched & Verified)
Active Critical / High Vulnerabilities: 0
Automated Regression Test Pass Rate: 100% (211/211 Total Automated Tests)
Multi-Tenant Isolation Integrity: VERIFIED
RBAC & IDOR Protections: VERIFIED
Payment & Webhook HMAC Verification: VERIFIED
AI Assistant Tool Sandbox & Two-Step Approvals: VERIFIED
================================================================================
```
