# Render blank screen and initialization recovery

## Findings

The repository contains no Render runtime logs or browser traces, so the specific production incident cannot be attributed to one observed exception. The startup and serving code did contain several paths that can produce the reported symptoms:

- Both authentication providers restored sessions with `/me` requests that had no Axios timeout. A stalled request kept protected routes on their loading screen indefinitely.
- Both providers deleted their saved token after every restore failure. A temporary network outage or server error therefore looked like a signed-out session and forced another login.
- There was no React error boundary, so a render-time exception could leave the app blank.
- The Express SPA fallback returned `index.html` for missing JavaScript and CSS URLs. When an old HTML document requested a chunk removed by a deployment, the browser could receive HTML where JavaScript was expected.
- The production build used the expected Vite `client/dist` directory, and the same-origin API default was consistent with the single-service Render manifest. No incorrect Vite base path or production localhost URL was found in this deployment configuration.

These are code-confirmed failure modes and the most likely causes supported by the repository. Confirming which one occurred on Render still requires the deployment's logs or a browser network trace.

## Changes

- Session restoration requests now time out after 12 seconds. Restoration distinguishes invalid credentials (401/403) from connectivity, timeout, and server failures. Only invalid credentials clear the saved token; recoverable failures show a retry action on protected routes.
- Added an application error boundary with a safe reload screen. Production diagnostics log only a fixed event name, application version, timestamp, and error category. Development retains the useful exception output.
- Production request logs omit URLs and query strings. Unexpected API errors log only a safe category, status, version, timestamp, and generated request ID; the ID is also returned as `X-Request-Id` for support correlation.
- Added visible HTML loading text before JavaScript starts, plus a no-JavaScript explanation.
- Express now serves HTML with `Cache-Control: no-cache, must-revalidate`, uses immutable caching for fingerprinted assets, and returns 404 for missing asset paths. API requests continue through API routing and JSON 404 handling, not the SPA fallback.
- Added production-serving tests for deep links, missing assets, unknown API paths, asset MIME types, and cache headers.

## Verification

Run from the repository root:

```sh
npm run build --prefix client
npm test --prefix server
```

The production build completed successfully with Vite 5.4.21. The server suite passed after the build, including route, MIME, cache, and sanitized error logging checks. These local checks do not verify a live Render deploy.

## Render configuration

The checked-in `render.yaml` uses the service root `.`, runs the guarded migration command during build, starts with `npm start`, and checks `/health`. Render dashboard settings can override the manifest, so verify the effective build command in service settings and deploy logs. The server's `prestart` generates Prisma Client and builds the client; it does not apply the schema or run migrations. Production should keep `VITE_API_URL` unset for this same-origin deployment; set it only if the frontend is moved to a separate host.

After deploying, confirm in the browser network panel that `/` and a direct nested route return HTML, `/assets/<fingerprinted-file>.js` returns JavaScript, and a deliberately nonexistent `/assets/...js` path returns 404. Check Render deploy/runtime logs for startup or database errors if initialization still fails.
