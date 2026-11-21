---
title: "MeshCore Rust Bot — Progress and Testing Notes"
date: 2026-11-20
permalink: /notes/meshcore/2026-11-20/
layout: "layouts/notes.njk"
---
# MeshCore Rust Bot — Progress and Testing Notes

Updated November 20, 2026

## Project and acknowledgment

Our MeshCore bot lives at [jschappet/meshcore-bot](https://github.com/jschappet/meshcore-bot).

This project builds on the work of Adam Gessaman and the contributors to the original Python MeshCore Bot. Their command system, diagnostics, automation, and documentation provided the foundation and inspiration for this Rust rewrite. [Original MeshCore Bot](https://github.com/agessaman/meshcore-bot)

## Working on the radio

The Rust bot communicates with a MeshCore USB Companion radio through `/dev/cu.usbserial-0001` on macOS.

- **Ping verified.** The bot received `ping` and replied `Pong!`.
- **Signal test verified.** The `test` command returned `Direct route | SNR 12.5 dB`.
- **Heartbeat verified.** The admin node received numbered heartbeat DMs with local timestamps, including `Heartbeat #4 | 2026-11-15 13:26:02 -08:00`.

Heartbeat controls include `hb on`, `hb off`, `hb status`, and `hb reset`. Frequency presets are `hb fast` at 60 seconds, `hb default` at 300 seconds, and `hb slow` at 60 minutes. The counter resets on each new local date.

## Features implemented

The Rust implementation includes automatic serial reconnect, admin authorization, configurable logging, and these mesh diagnostics:

- `path`, `decode`, and `route` report incoming repeater hashes when a matching radio packet is available.
- `prefix` looks up repeaters in radio contacts.
- `stats` reports message and command activity.
- `multitest` collects distinct paths observed for the same channel packet.
- `trace` and `tracer` request link traces.
- Numbered `probe` packets measure delivery counts, duplicates, SNR, and RSSI.

Automation includes scheduled channel posts, flood adverts, announcements, configuration reload, and channel pause/resume. Automatic replies on Public and `#test` are disabled.

The Actix Web Viewer follows Heron’s `web::scope` routing pattern. It displays radio connection state, probe runs, individual receptions, and repeater statistics. Its listening address is configurable with `--web-host` and `--web-port`.

## Antenna and reach testing

A field-test workflow was added using numbered packets such as `probe baseline 1/20` through `probe baseline 20/20`. The bot records unique packets received and returns numbered ACKs. Comparing the bot’s receive count with ACKs received by the field node measures outbound delivery and full round-trip delivery.

Signal readings at the bot describe the final RF hop into its radio. A relayed packet’s SNR and RSSI therefore describe reception from the last repeater.

### Kelso test observation

An outgoing test from Schappet reached the Kelso test bot through the mesh. Kelso observed a 10-hop copy at 8.75 dB SNR and −99 dBm RSSI and generated a reply.

The local client never received that reply. It was visible on the tracker website through other observers.

This test established one successful outbound delivery to Kelso and zero successful return deliveries to the local client. The tracker’s many observations showed propagation of the packet. Reliability across separate transmissions still needs a numbered test series.

## Workshop IoT metrics

Five-minute reporting was implemented using Flood Monitor’s device enrollment, persistent outbox, and retry behavior. Reports include DM counts, message counts by channel, listening time, and directly heard repeater neighbors.

The backend device was approved. Investigation found that the bot retained a three-hour retry delay from an earlier HTTP 202 provisional response. Detailed request logging and `--metrics-retry-now` were added.

A successful HTTP 201 acknowledgment from the live Workshop endpoint remains unconfirmed in these notes.

## Repeater tracking

`rp stats` reports total repeaters, activity within 24 hours and seven days, stale entries, unknown advert times, location coverage, and shared one-byte prefixes.

The first radio-contact snapshot returned zero repeaters. Collection was expanded to include signed repeater adverts heard over the air, including relayed adverts.

A `tracked_repeaters` setting accepts full public keys. The configured target loaded successfully, but the latest reported result was `Tracked 0/1`. A matching contact or signed advert has yet to be confirmed. Tracking is currently passive.

## Automated verification and remaining checks

The latest recorded check passed all 19 Rust tests and lint. Simulated tests cover radio framing, reconnect behavior, reply routing, path matching, trace results, admin authorization, heartbeat timing, metrics persistence, and scoped viewer APIs.

Physical-radio checks remain for the newer diagnostics, probe series, reconnect recovery, repeater discovery, and Workshop reporting. Probe and repeater history currently live in memory and reset when the bot restarts. Persistent history and export remain future work.