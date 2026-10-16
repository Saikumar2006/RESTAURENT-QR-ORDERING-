# Security Audit and Remediation

This repository was reviewed for insecure defaults, authentication weaknesses, configuration drift, and tenant-isolation issues before the hardening changes in this patch set.

## Initial findings

| # | Severity | Area | Evidence | Status |
|---|---|---|---|---|
| 1 | 🔴 Critical | Configuration hardening | `server/src/config/env.js` used a default JWT secret (`dev-secret-change-me`), which would allow insecure production deployments if the environment variable were not set. | Fixed |
| 2 | 🟠 High | Authentication robustness | Restaurant login logic accepted any matching active user without normalizing email case and without guarding against ambiguous duplicate active accounts. | Fixed |
| 3 | 🟠 High | Input validation | OTP phone normalization and verification accepted malformed numbers and non-digit codes without explicit server-side validation before hashing/comparison. | Fixed |
| 4 | 🟡 Medium | Security posture | The project required an explicit production startup safety gate for weak or missing secrets, but the default JWT fallback weakened that safety net. | Fixed |
| 5 | 🟡 Medium | Multi-tenant isolation | Several restaurant-scoped routes already compare `req.user.restaurantId` to the request URL but the system still needed stronger normalization and defensive checks to avoid ambiguous account handling and malformed tenant-scoped inputs. | Hardened |
| 6 | 🟠 High | Dependency security hygiene | `npm audit --prefix server` still reports a high-severity `nodemon -> chokidar -> braces` advisory in the dev-only watcher stack; no safe published replacement was available without changing the core dev tooling path. | Documented / upstream limitation |

## Remediation actions implemented

- Removed the insecure JWT fallback from `server/src/config/env.js` and made startup fail closed if `JWT_SECRET` is missing.
- Hardened restaurant login email normalization and duplicate-account checks in `server/src/services/authService.js`.
- Hardened OTP phone normalization/validation and code validation in `server/src/services/otpService.js` and `server/src/validators/schemas.js`.
- Kept the production safety gate in `server/src/startupChecks.js` aligned with the stricter environment handling.
- Documented the remaining upstream dependency issue and its assessment in this file.

## Verification

The repository test suite was run after the fixes:

- Command: `npm test --prefix server -- --test-reporter=spec`
- Result: 14 passing, 0 failing

The dependency scan was also run:

- Command: `npm audit --prefix server --json`
- Result: the remaining findings are entirely in the dev-only `nodemon`/`chokidar`/`braces` chain and are unresolved by a safe published patch in the current toolchain.

This assessment is evidence that the critical app-level hardening is in place and the remaining dependency advisories are third-party tooling issues rather than unsafe application code.

## Notes

- No real secrets, database credentials, or customer data were printed or committed in this report.
- Any real deployment credentials should still be rotated according to the relevant host provider's process if they were ever exposed outside the local environment.
