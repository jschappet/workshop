# Workshop metrics viewer

Visit `/metrics/`. The page uses the existing base layout and adds a Metrics
navigation link. It supports temperature/humidity and touch-count readings,
1-hour/24-hour/7-day ranges, a readings table, and a 30-second refresh toggle.
The local sensor link opens the device's `/sensor` endpoint and requires LAN access.

By default the viewer requests `/api/iot` on the same host. Set the address in the
page's connection field (remembered for this browser tab), or supply a build-time
default:

```sh
IOT_API_BASE=https://dev.regenerateskagit.org/api/iot npm run build
```

Use the Heron host that received the devices' reports. Host scoping means another
host can correctly return an empty list. For an 11ty development server, specify
the full Heron URL; its server must permit the frontend origin through CORS.
HTTPS pages cannot fetch an HTTP API because browsers block mixed content.

The viewer uses the existing GET routes and embeds no device tokens. It reports
an access error if those routes require authorization. This does not change server
access policies.

Metrics are paginated by insertion ID. Each refresh loads up to 20 pages of 500
reports; any remaining history is explicitly marked partial with a Load older
reports button. Time ranges use device observation timestamps, shown in the
browser's local timezone. Touch totals sum interval counts, never boot totals.
Intervals are included by their observation timestamp. Chart gaps longer than
10 minutes stay disconnected. The display does not fabricate missing samples.

Run `node --test tests/metrics.test.mjs` for data handling checks and `npm run build`
for the 11ty build. No chart dependency is needed; charts use SVG with an accessible
readings table. The browser preview was not verified during implementation because
browser access was declined.
