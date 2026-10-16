# Platform administrator access

Platform administrators are stored in the separate `PlatformAdmin` table. Restaurant administrators and staff cannot sign in to the platform console, and there is no public platform-admin registration endpoint.

## Provision the first account

Run provisioning from a trusted interactive terminal with the server environment configured for the intended database:

```sh
cd server
npm run create-platform-admin
```

The command prompts for a name, email, and password. Password input is hidden. Use at least 12 characters and store it in an approved password manager. The command creates a new platform administrator only; it refuses to reset an existing record and never promotes a restaurant account. It does not accept passwords in command-line arguments or print them. Restrict access to the server shell and database while provisioning.

If access must be recovered, use the organization's audited database recovery procedure; this provisioning command intentionally cannot reset an existing platform account.

## Sign in and session behavior

Use `/super-admin/login` (the existing `/platform/login` path remains available). The API validates credentials against `PlatformAdmin`, checks `isActive`, and rate-limits platform endpoints. A successful login sets a host-only, HTTP-only, SameSite=Strict cookie scoped to `/api/platform`, with Secure enabled in production and a lifetime matching the signed token. The browser does not store platform tokens in local storage, and platform APIs accept only this cookie. Logout clears the cookie.

Every platform API request validates the signed platform token and reloads the active `PlatformAdmin` record. The platform console APIs are separate from restaurant tenant authorization and intentionally provide platform-wide oversight. Do not add mutation endpoints without explicit authorization checks, audit logging, and review of tenant impact.

Production is deployed as a same-origin app by default. If the client and API are split across sites, review cookie SameSite policy and CSRF protections before deployment; do not weaken cookie protections without that review.

## Public-site contact and legal links

The homepage uses `VITE_SALES_EMAIL` for a real contact email, and accepts `VITE_PRIVACY_URL` / `VITE_TERMS_URL` only as HTTPS links to the organization's approved policies. Leave them unset until those contact details and policy documents exist; the site does not invent pricing or legal terms.
