# QR Restaurant Ordering System

A full-stack, multi-tenant MVP built from the SRS: customers scan **one QR
code** for the whole restaurant, choose **Dine In (pick a table)** or
**Takeaway**, browse the menu, order, and pay from their phone; restaurant
staff manage menus/tables and process live orders from a dashboard.

**Stack:** React (Vite) · Node.js/Express · Supabase (Postgres + Storage) · Prisma (schema-push, no migration files) · Socket.IO · Razorpay (pluggable, mock provider included)

## Project layout

```
restaurant-qr-ordering/
├── package.json     Root scripts — this is what you run
├── client/          React customer + admin app (Vite)
├── server/          Express API, Prisma schema, Socket.IO, and (once built)
│                    serves the client too
├── docs/            (add API notes / ER diagrams here as you extend it)
└── server/.env.example   (copy to server/.env — see Setup below)
```

## Why one server for both client and server

This is set up like a typical e-commerce app deployment: the React app is
**built** into static files (HTML/CSS/JS), and the Express server serves
those files directly alongside its own `/api/*` routes, on the same port.

- **One process, one port, one command.** `npm start` builds the client and
  starts the API — you don't run two servers or juggle two terminals for a
  normal run.
- **No CORS to think about.** Client and API share the same origin in
  production, so the browser never makes cross-origin requests.
- **Simpler to deploy.** One deployable unit (e.g. one Node process on
  Render/Railway/a VPS) instead of hosting a static frontend and an API
  separately and wiring them together.

You still get instant hot-reload while actively developing — `npm run dev`
runs the API and the Vite dev server side by side (Vite proxies `/api` calls
to the API in that mode) — but the moment you want to just *run the app*,
`npm start` is the one command that matters.

## 1. Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project (this app uses Supabase
  for both its database and file storage — no local database or Docker
  needed at all)

Create a Supabase project (takes about 2 minutes), then grab three things
from its dashboard before you start:
1. **Settings > Database** — the "Transaction" pooler connection string
   (port 6543) and the direct connection string (port 5432).
2. **Settings > API** — your project URL and the `service_role` key.
3. **Storage** — create a new bucket named `menu-images` and mark it
   **Public** (so menu photos load directly in `<img>` tags).

## 2. Setup

```bash
# from the repo root
npm run install:all   # installs server + client dependencies
npm run setup:env     # creates server/.env from server/.env.example with a
                       # freshly generated JWT_SECRET — you still need to
                       # fill in the Supabase values from step 1 above
npm run db:setup      # pushes the schema to your Supabase database, seeds demo data
npm start              # builds the client, then starts the one server on
                        # http://localhost:4000 — client + API both live there
```

After `setup:env` runs, open `server/.env` and fill in `DATABASE_URL`,
`DIRECT_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` with the
values from your Supabase project. Everything else in that file already
has a working default.

**Why two database URLs?** Supabase's connection pooler (pgbouncer, in
transaction mode) doesn't support the prepared statements Prisma uses for
schema changes. `DATABASE_URL` (pooled) is what the running app uses for
every normal query; `DIRECT_URL` is used only by `prisma db push` when you
change the schema. Prisma switches between them automatically — you never
have to think about which one is being used.

**No migration files.** `db:setup` (and `server`'s own `npm run db:push`)
uses `prisma db push`, which reads `server/prisma/schema.prisma` and syncs
your database to match it directly — no `prisma/migrations/` folder to
generate, commit, or keep in sync. Change a model, run `npm run db:push
--prefix server` (or `db:setup` again), done. The trade-off: no migration
history/rollback log — fine for a single-tenant app you control, less ideal
if you ever need to coordinate schema changes across a team or audit what
changed when. If you outgrow that, switch to `prisma migrate dev` /
`migrate deploy` later; nothing else about the setup needs to change.

**File storage:** `STORAGE_PROVIDER=supabase` (the default) uploads menu
photos straight to your Supabase Storage bucket — nothing touches this
server's disk, so uploaded photos survive redeploys automatically with no
volume to configure on your host. Set `STORAGE_PROVIDER=local` instead if
you'd rather save to `server/uploads` on disk (you'll need a persistent
volume mounted there on most hosts, or uploads vanish on the next deploy).

`npm run setup:env` is a small Node script rather than a plain `cp`/`copy`,
so it works the same way on Windows, macOS, and Linux — no shell-specific
commands to remember. It only creates the file if one doesn't already exist,
so it's safe to re-run.

**Note on where `.env` lives:** the file goes in `server/.env`, not the repo
root. `npm start`/`npm run dev` run the server with `server/` as its working
directory (that's what `--prefix server` does), and both the Prisma CLI and
the app's own config loader read `.env` from the current working directory —
so `server/.env` is the one place that's actually read.

Open **http://localhost:4000** — that's the whole app, frontend and backend,
from one process.

### Developing (hot reload)

```bash
npm run dev
```

This runs the API (nodemon, auto-restarts on server changes) and the Vite
dev server (instant client hot-reload) together, in one terminal, with
labeled output. The app during development is at **http://localhost:5173**
(Vite proxies `/api` calls to the API on port 4000 automatically).

## 3. Try it out

After seeding, the server console prints the restaurant's single QR link,
e.g. `/r/spice-garden`.

- **Customer flow:** open `http://localhost:4000/r/spice-garden` (or
  `:5173` if you're running `npm run dev`) → choose **Dine In** and tap a
  table number, or choose **Takeaway** → browse menu → add to cart →
  checkout → pay (mock provider shows "Simulate Successful/Failed Payment"
  buttons by default) → watch the status timeline update live.
- **Admin flow:** open `.../admin/login`
  - Admin: `admin@spicegarden.test` / `password123`
  - Staff: `staff@spicegarden.test` / `password123`
  - Under **Tables**, click "View QR" to see/download the one QR code that
    covers the whole restaurant — print it once and put it on every table or
    at the counter/entrance for takeaway customers.
  - Accept the order in the dashboard and change its status — the customer's
    tracking page updates in real time via Socket.IO.
- **New restaurant:** `.../admin/register` self-service onboarding.

## 4. How the single QR works

Instead of printing a different QR code for every table, the restaurant has
**one QR code** that links to `/r/<restaurant-slug>`. When a customer scans
it, they land on a page where they either:

- **Dine In** — tap their table number from a list (built from the tables
  the admin has added under **Tables**), or
- **Takeaway** — no table needed.

That choice is stored for the rest of their session and sent with their
order, so the kitchen/dashboard still knows exactly where (or whether) to
deliver the order — without needing a physical QR code per table.

## 5. Switching on real Razorpay payments

By default `PAYMENT_PROVIDER=mock` in `server/.env`, which lets you exercise the
entire order → pay → verify → webhook flow without live credentials.

To go live:

1. Set `PAYMENT_PROVIDER=razorpay`
2. Fill in `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
3. Point your Razorpay webhook at `POST {SERVER_URL}/api/payments/webhook`

The backend never trusts a frontend "payment succeeded" event on its own —
`POST /api/payments/verify` re-checks the Razorpay signature server-side, and
the webhook handler is idempotent so duplicate delivery can't double-process
a payment.

## 6. Precision note on money fields

Money fields (`price`, `taxAmount`, totals, etc.) use Prisma's `Float`
type rather than `Decimal @db.Decimal(10,2)`. This is a holdover from an
earlier SQLite-based version of this schema (SQLite has no native decimal
type) that was never revisited after the move to Postgres. Postgres does
support exact fixed-point `Decimal`, so if you want to eliminate any
theoretical floating-point rounding risk on money math, switch those
fields to `Decimal @db.Decimal(10, 2)` in `schema.prisma` and run `npm run
db:push --prefix server`. In practice, amounts here are small (menu
prices, single-restaurant order totals) and rounded to 2 decimals for
display, so this is a nice-to-have rather than a live bug — flagging it
for anyone who wants to close the gap.

## 7. Restaurant open/closed status and in-restaurant-only ordering

Two independent controls, both in **Admin → Settings**:

- **Open/closed:** a manual toggle ("Restaurant is open/closed") that
  immediately switches the customer-facing QR page to an "Out of Service"
  screen. There's also an optional auto-schedule (open/close time) that
  closes it automatically outside those hours even if you forget to flip
  the toggle — both are enforced server-side too, not just hidden in the
  UI, so a saved/bookmarked link can't bypass it.
- **In-restaurant-only ordering (geofencing):** when enabled, a customer's
  browser is asked for its GPS location on the landing page, and must be
  within a configurable radius (default 200m) of the restaurant's
  registered coordinates to proceed. Use the "Use my current location"
  button while standing in the restaurant to set its coordinates. This is
  re-verified server-side on every order placed, not just client-side, so
  it can't be bypassed by calling the API directly — but note browser GPS
  itself can be spoofed by a determined user (e.g. a fake-location app),
  so treat this as a strong deterrent for casual off-site use, not
  airtight security.

## 8. What's implemented (MVP scope from the SRS)

- Multi-tenant schema from day one (every tenant table scoped by `restaurantId`)
- Single QR per restaurant → customer picks dine-in table or takeaway on a
  landing page; table selection uses an opaque, non-guessable table token
  (no restaurant/table database IDs ever exposed to the public)
- Admin: restaurant profile, categories/menu CRUD, table CRUD, one
  restaurant-wide QR generation/download, staff management, order dashboard,
  basic reports
- Customer: menu browsing/search, cart, checkout, payment, live order
  tracking — no account required
- Orders: **server always recalculates price** from current DB menu data;
  cart totals sent by the client are advisory only
- Order type: `DINE_IN` (linked to a table) or `TAKEAWAY` (no table)
- Order state machine: `PENDING → ACCEPTED → PREPARING → READY → COMPLETED`, plus `CANCELLED`, enforced server-side (`src/utils/order.js`)
- Payment state machine: `PENDING → PAID`, `PENDING → FAILED`, `PAID → REFUNDED`
- Socket.IO: restaurant-scoped rooms for staff/admin (auth-gated), order-scoped rooms for guests; UI re-fetches authoritative state on reconnect rather than trusting missed events
- AuthN/AuthZ: JWT-based sessions, bcrypt password hashing, `ADMIN`/`STAFF` roles, every protected query filtered by `restaurantId` derived from the token — never from client-supplied IDs
- Security basics: helmet, CORS locked to `CLIENT_URL`, rate limiting (tighter on `/api/auth`), Zod request validation, Razorpay webhook signature verification over the raw body

## 9. What's intentionally out of scope for the MVP (see SRS §32 roadmap)

Multi-language menus, split bills, delivery, inventory integration,
loyalty, advanced analytics, kitchen display system, multiple payment
providers. The codebase is structured (routes/controllers/services/validators)
so these can be added without a rewrite.

## 10. Production readiness checklist before a real pilot

**Enforced automatically, nothing to do:**
- `npm run setup:env` generates a real random `JWT_SECRET` — not a placeholder.
- The server refuses to start in `NODE_ENV=production` with an insecure/missing `JWT_SECRET`, or with `PAYMENT_PROVIDER=razorpay`/`MESSAGING_PROVIDER=twilio` set but no credentials — see `server/src/startupChecks.js`. It fails loudly at boot rather than running insecurely.
- Plain HTTP is redirected to HTTPS in production (`FORCE_HTTPS`, no-op on hosts that already terminate TLS in front, like Railway/Render/Cloudflare).
- Razorpay signature verification (both the checkout callback and the webhook) uses a constant-time comparison, not `===` — closes a timing side-channel on the HMAC check.

**Still on you before a real launch:**
- Get real Razorpay keys and test the actual payment + webhook flow end to end — this has only ever been tested against the mock provider.
- Get real Twilio (or another provider) credentials for OTP/WhatsApp notifications if you're using those features — same caveat, mock-only so far.
- DB backups: Supabase takes automatic daily backups on paid plans — check your project's plan and retention window; the free tier has no point-in-time recovery.
- Load testing if you expect a busy concurrent rush — Supabase's pooled connection handles concurrent writes fine at small-to-mid scale, but check your plan's connection limits before a big launch.
- Work through the full acceptance checklist in `docs/` and SRS §36 before onboarding a real restaurant.

This build focuses on a correct, secure, end-to-end vertical slice per SRS §38's recommended build order.
