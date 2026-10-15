# Workshop metrics viewer

Visit `/metrics/`. The page uses the existing base layout and adds a Metrics
navigation link. It supports temperature/humidity and touch-count readings,
1-hour/24-hour/7-day ranges, a readings table, and a 30-second refresh toggle.
The local sensor link opens the device's `/sensor` endpoint and requires LAN access.

Sign in at `/login/` with an existing Heron account, then open `/metrics/`.
Login adapts Regen's username/password flow and redirects to metrics on success.
Sign out from `/login/`.

All frontend API requests use `Alpine.store("api").call(...)` through Heron's
shared `/api/config/alpine_custom.js`. Capabilities supply the route URLs.
The login payload is form encoded, as required by Heron; the browser sends its
same-origin session cookie. Device discovery and metric history accept a login
session or the existing device token. Sensor submissions still require the token.
No device token is embedded in the frontend.

The former API-address override is removed: authentication, capabilities and
metrics must use the same Workshop origin. For local development, proxy `/api/`
to Heron with the intended Workshop host configuration. Host scoping means the
wrong host can correctly return no devices.

Deployment requires both repositories:

1. Rebuild and restart Heron with the shared client and IoT read authorization
   changes. The client is embedded in the binary using `include_bytes!`.
2. In Workshop run `npm ci` and `npm run build`, then publish `dist/` through the
   existing deployment process.
3. Ensure Workshop's `/api/` requests reach Heron (including `/api/config/` and
   `/api/auth/`), with session cookies and the Workshop host preserved.
4. Check `/login/` with a valid account, confirm `/metrics/` shows that host's
   reports, then sign out and verify refresh asks for sign-in.

Metrics are paginated by insertion ID. Each refresh loads up to 20 pages of 500
reports; any remaining history is explicitly marked partial with a Load older
reports button. Time ranges use device observation timestamps, shown in the
browser's local timezone. Touch totals sum interval counts, never boot totals.
Intervals are included by their observation timestamp. Chart gaps longer than
10 minutes stay disconnected. The display does not fabricate missing samples.

Run `npm test` and `npm run build` in Workshop. In Heron run
`node --test tests/alpine-client.test.mjs` and `cargo test routes::iot::tests`.
Tests cover form encoding, cookie options, pagination, failed/successful login,
logout, metric cards/charts/table rendering with a simulated DOM, expired access,
and backend session/token authorization. A real production login still needs the
post-deployment smoke check above.
