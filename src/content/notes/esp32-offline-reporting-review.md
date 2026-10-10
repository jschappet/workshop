---
title: "ESP32 offline reporting: firmware review and proposed changes"
date: 2026-10-10
permalink: /notes/esp32/offline-reporting/2026-10-10/
layout: "layouts/notes.njk"
---
# ESP32 offline reporting: firmware review and proposed changes

**Status: proposal for review — no firmware changes implemented for this note.**

The workshop Wi-Fi is switched off overnight. Sensors should continue measuring,
retain values and their observation times, reconnect in the morning, and deliver
the backlog without double-counting. This proposal assumes the sensors remain
powered when Wi-Fi is off. A powered-off sensor cannot measure the missing period.

The review covers Heron's `firmware/esp32_sensor/esp32_sensor.ino` (touch),
`firmware/esp32_temperature/esp32_temperature.ino` (DHT11 on GPIO27), the Node
flasher in `utils/flash-esp32/index.js`, and the IoT ingestion/storage code in
`src/routes/iot.rs` and `src/services/iot_metrics.rs`. Function names below are
review anchors; the sketches may change after this note is written.

## Current behavior and review findings

| Priority | Location | Finding and consequence | Proposed change |
|---|---|---|---|
| High | Both sketches: `setup()`, `connectWiFi()`, `loop()` | Startup waits up to 15 seconds. Any connection failure sets `setupMode`, switches to an access point, and prevents subsequent calls to `updateDiscovery()`. A sensor starting overnight can remain in setup mode after the router returns. | Distinguish missing credentials from a temporarily unavailable saved network. Keep station reconnection active when credentials exist. |
| High | Both: `updateDiscovery()` | Report construction happens only after connectivity and clock checks. There is one RAM `retryJob`, not a history queue. | Produce reports independently of transport, and durably queue each reporting window. |
| High | Temperature: `updateSensor()` | The latest temperature and humidity overwrite the preceding sample. During an outage, the overnight temperature curve is lost. | Save one fresh sample per five-minute window, even while offline. Preserve its actual observation time. |
| High | Touch: `reportStart`, `acknowledgedTotal`, `snapshotTotal` | Window advancement depends on acknowledgment. Touches continue to accumulate while powered, but an outage merges periods into a longer interval. Reboot loses RAM counters and pending work. | Advance collection windows when their reports are safely queued; track delivery acknowledgment separately. |
| High | Both: `discoveryWorker()` and acknowledgment processing | Any 2xx is treated as success. Only an HTTP status is returned to the main loop. | Verify the returned `ok` and `report_id` for a metric before durably acknowledging that queue record. |
| Medium | Both: `connectWiFi()` | `WiFi.setAutoReconnect(true)` is already present. Reconnection is not entirely absent, but there is no explicit bounded recovery supervisor. | Keep automatic reconnect and add observable retries with backoff. Avoid repeatedly resetting the radio while a connection attempt is active. |
| Medium | Both: `time(nullptr)` threshold | A plausible timestamp is used as the readiness check. There is no explicit last-sync or time-quality state. | Track synchronization and distinguish known, estimated, and unresolved observation times. |
| Medium | Shared reporting logic duplicated in both sketches | A fix applied to only one sensor will produce inconsistent behavior. | Extract a small shared network, clock, queue, and delivery layer; keep sensor-specific sampling separate. |

Heron already rejects conflicting reuse of a report ID and deduplicates identical
readings by host, device ID, and report ID. That provides the foundation for
at-least-once delivery: firmware can safely resend after losing an acknowledgment.

## Proposed operating model

Sampling, report creation, network recovery, and delivery should be separate jobs.
A network failure must not stop sampling or advance the delivery cursor.

```text
sensor sampling → five-minute report → durable queue → HTTPS worker → acknowledgment
                        ↑                   ↑                              |
                   clock state       survives restart             durable dequeue

Wi-Fi supervisor reconnects independently of sampling and queue creation.
```

Illustrative pseudocode, not a drop-in implementation:

```cpp
void loop() {
  serviceLocalWeb();
  sampleSensorWhenDue();
  processDeliveryResults();
  closeReportWindowWhenDue();   // Works without Wi-Fi; commits before advancing.
  maintainWiFiConnection();     // Timed state transitions; no 15-second wait loop.
  updateClockState();
  startOldestEligibleReport();  // One in flight; worker owns HTTPS.
}
```

Flash writes can also introduce latency. The implementation should measure their
impact on touch detection and, if necessary, use a dedicated storage worker with
explicit commit results. Wi-Fi callbacks should signal state changes rather than
perform disk writes or HTTP requests. Queue mutation needs a single owner.

## Wi-Fi recovery and startup

Use explicit states such as `Unconfigured`, `Connecting`, `Online`, and
`WaitingToRetry`. Credentials are loaded once at startup. With saved credentials,
initialize sampling, storage, web handlers, and the delivery worker regardless of
whether the access point is currently reachable.

A proposed retry schedule is 5, 15, 30, then 60 seconds, capped at 60 seconds with
small jitter. Give each attempt a bounded connection window and reset backoff on
success. Use monotonic elapsed time, not wall-clock time, for these deadlines.
Only escalate to a controlled Wi-Fi driver restart after repeated failures; do
not reboot the microcontroller or erase credentials as routine recovery.

No saved credentials should still enter provisioning. A manual setup/reset action
should allow correction of bad credentials. An overnight outage should not itself
open an unintended provisioning access point or permanently disable station mode.
On reconnect, synchronize time as needed and send discovery with the current IP.

The [Arduino-ESP32 Wi-Fi API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html)
provides automatic reconnect and explicit reconnect operations. Their exact event
and retry behavior should be bench-tested with the installed core and workshop router.

## What to record while offline

Keep the existing five-minute reporting resolution for the first implementation:

- **Temperature:** one latest valid DHT11 sample per window, with Celsius,
  humidity, and the sample's observation time. Continue two-second sampling for
  the local page. This proposal does not persist every two-second reading or
  silently change the report to an average.
- **Touch:** one interval count per window, including zero-count intervals.
  Record cumulative boot count as supporting metadata, but never use it as an
  interval total.
- **Failed temperature reads:** do not write zero or reuse an old reading with a
  new time. Track missing-window/read-failure diagnostics. A server-visible
  missing-reading event would require a separate agreed schema change.

For touch counts, introduce `lastQueuedTotal` separately from the acknowledged
boundary. At window closure, compute the interval delta, append the report, and
advance `lastQueuedTotal` only after a successful durable commit. A storage failure
must not discard that delta. Flag any extended window caused by storage pressure.

The user-facing “touches awaiting successful report” count should include queued
but unacknowledged intervals plus the current window. Morning acknowledgments
reduce it without erasing touches received during transmission. When draining a
previous boot's queue, never assign its cumulative total to the new boot's counter.
Completed windows can survive restart; touches since the last checkpoint cannot
be guaranteed to survive sudden power loss without additional persistence.

## Durable queue and crash recovery

A proposed implementation is an append-only journal in a dedicated filesystem
partition, using LittleFS if available in the selected ESP32 partition layout.
Confirm usable space, core support, and the boot recovery behavior before choosing
file sizes. Avoid writing every touch or every two-second sample to flash.

Each record should contain a local format version, durable sequence, original
boot/report IDs, sensor schema, observation time or unresolved time anchor, window
bounds, sensor data, record length, and integrity check. Keep authentication tokens
out of the queue: supply current credentials when transmitting.

The sequence is:

1. Construct an immutable report with a unique ID.
2. Append it and complete the storage commit before advancing its collection window.
3. Send the oldest eligible report without removing it.
4. Verify the server acknowledgment matches that report.
5. Persist the acknowledged position; reclaim old segments later.

Recovery must distinguish a complete committed record from a torn tail write.
Never enable automatic filesystem formatting on mount failure: that could erase
all overnight measurements. Surface a storage fault and preserve recoverable data.
Compaction must leave either the old or new committed generation usable after a
power interruption. “Written to a buffer” is not sufficient evidence of durability;
test the chosen filesystem/flush strategy with deliberate power cuts.

A crash after server acceptance but before local acknowledgment persistence causes
a resend. That is expected and should produce a successful duplicate response.
Retain the original IDs after reboot; only newly collected reports get the new
boot ID. Never alter a reading once it has been submitted to Heron.

At five-minute resolution, each sensor creates 12 reports/hour, 144 over a
12-hour outage, or 288/day. At an illustrative 1 KiB per stored record, that is
about 144 KiB/night before filesystem overhead. These are sizing estimates, not
measured record sizes. Measure real encoding overhead and available partition space;
choose and document the retention target before implementation.

Proposed overflow policy: preserve already-queued history, stop committing new
windows when full, and expose an explicit loss/storage-full diagnostic. Do not
silently overwrite unacknowledged records. This policy sacrifices newer data, so
it needs agreement before coding. Bounded RAM cannot guarantee indefinite retention.

## Observation time during an outage

A synchronized, continuously powered ESP32 can keep advancing its system clock
without Wi-Fi, but drift must be measured. Use the observation timestamp captured
when measuring, not the morning upload time. Heron's `received_at_unix` already
provides the separate arrival timestamp.

After a cold start without network time, do not manufacture a Unix timestamp.
Persist the sample with its boot ID and monotonic offset as locally unresolved.
If time synchronizes later in the same boot, estimate earlier times from that
anchor and mark their quality explicitly. Once finalized for sending, keep the
reading immutable across retries and later clock adjustments.

If power is lost again before obtaining an anchor, that earlier boot's absolute
times cannot be reliably reconstructed from uptime alone. Retain those records
for explicit handling rather than labeling them with upload time. A battery-backed
RTC is an option if accurate timestamps after offline cold starts are required.
Clock corrections and `millis()` rollover also need dedicated tests.

Espressif documents the ESP32's RTC and high-resolution system time sources and
power-on reset limitations in its [System Time guide](https://docs.espressif.com/projects/esp-idf/en/v5.0.4/esp32/api-reference/system/system_time.html).
The time-quality and unresolved-record behavior above is a proposed application policy.

## Delivery, discovery, and backend compatibility

Keep the existing valid `touch_count` and `temperature` version-1 readings unchanged
for normally synchronized reports. Queued readings should be wrapped in current
discovery metadata at send time so morning delivery does not advertise last night's
IP address. This is compatible with Heron's deduplication of the reading itself.

Drain oldest eligible records one at a time, with a short bounded delay between
successful deliveries. Continue sampling during catch-up. Discovery-only success
must never acknowledge a metric. Repeated 5xx, connection failures, and timeouts
retain the queue item and back off. Authentication failures need a visible
configuration error rather than rapid retries. A 400/409 report needs an explicit
quarantine/error policy so it neither disappears nor blocks every later report.
A 429 should honor a usable Retry-After value.

The first implementation can replay known-time readings through the existing API.
Unresolved timestamps, time-quality fields, and missing-window diagnostics need an
explicit server contract: the current typed reading format cannot simply accept
new fields or absent observation times. Do not claim those cases work unchanged.

Never disable certificate verification to get an unsynchronized device online.
Wi-Fi association, trusted clock availability, and HTTPS readiness are separate states.

## Proposed configuration and code organization

Retain `touch.dev.json`, `touch.prod.json`, `temperature.dev.json`, and
`temperature.prod.json`. Consider validated optional settings for report interval,
queue capacity/retention, reconnect backoff, and backlog pacing. Keep safe defaults;
reject impossible combinations before compilation. The flasher must preserve the
data partition during ordinary updates and document which erase/partition changes
will delete queued reports.

Suggested shared components are `NetworkManager`, `ClockState`, `ReportQueue`, and
`ReportSender`, with sensor-specific window collectors in each sketch. The Node
flasher currently copies one sketch directory into its temporary build folder, so
shared sources must be packaged or copied there deliberately. Updating imports
alone will not make shared code available to Arduino builds.

Expose queue depth, oldest queued observation, storage usage, last successful
upload, last time sync, Wi-Fi state, and storage/report errors on `/sensor` and the
local page. Distinguish “no network,” “waiting for time,” and “server rejected report.”

## Acceptance tests before flashing into regular use

| Test | Expected result |
|---|---|
| Disable Wi-Fi for 12 hours while powered | Five-minute windows continue; valid temperature history and zero/nonzero touch intervals remain queued. |
| Restore Wi-Fi | Reconnect without reboot/provisioning; backlog drains with original times and no duplicate metric rows. |
| Boot with saved credentials while router is off | Sampling/storage start; station retries continue; router return recovers automatically. |
| Reboot with queued reports | Committed records retain their original IDs and survive; new reports use a new boot identity. |
| Lose HTTP response after server commit | Retry creates no second metric; matching acknowledgment removes the local record. |
| Cut power during append, acknowledgment, and compaction | Previously committed unacknowledged records remain recoverable; torn data is detected. |
| Touch during upload and catch-up | No overlap or gaps between durably queued intervals; current touches are not cleared by older acknowledgments. |
| DHT read failures | No fabricated zero-temperature samples or stale samples with new timestamps. |
| Cold boot offline, then time sync | Same-boot anchored estimates are explicitly distinguished; unresolved older boots are not assigned false times. |
| Queue full, mount failure, 401, 400, or 409 | Clear diagnostics; no automatic formatting or silent record deletion. |
| Clock adjustment and uptime rollover | Sampling/retry cadence remains correct; submitted report content does not change. |
| Firmware update | Queue compatibility is checked and the data partition remains intact for supported upgrades. |

Recommended sequence: implement/test network state handling; decouple report
creation; add and power-cut-test the durable queue; add acknowledgment-driven replay;
then agree and implement uncertain-time behavior. Finish with a real overnight test
on both sensor types and reconcile queued IDs against SQLite rows and viewer times.

## Decisions still needed

Confirm whether five-minute snapshots are sufficient, how many offline days to
retain, whether the proposed overflow policy is acceptable, and whether power-loss
survival must include the unfinished touch window. Decide whether offline cold-start
time requires an external RTC or a backend protocol for uncertain timestamps.

This note is a source review and design proposal. No reconnect changes, flash queue,
new firmware configuration, or hardware flashing were performed while preparing it.
