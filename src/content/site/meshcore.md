---
title: MeshCore | Schappet's Workshop
permalink: /meshcore/
layout: layouts/notes.njk
---

<h1 class="text-4xl font-bold">MeshCore</h1>

We’re experimenting with off-grid text messaging at the workshop. MeshCore uses low-power LoRa radios to send messages without Wi-Fi or cell service. A companion radio connects to a phone or computer for messaging, and a repeater can relay messages between radios that are out of direct range. [MeshCore project](https://meshcore.io/)

## Hardware we’re testing

- **RAKwireless WisBlock starter kit (US915).** This kit pairs a RAK19007 base board with a RAK4631 radio module. [Amazon listing](https://www.amazon.com/dp/B0CHKZJK9C)
- **ESP32 LoRa V3 development boards (N30, 915 MHz).** This two-pack includes SX1262-based boards, antennas, batteries, and cases. The exact MeshCore firmware target still needs to be confirmed for this board revision. [Amazon listing](https://www.amazon.com/dp/B0F1CXG94J)
- **Seeed Studio SenseCAP Solar Node P1 Pro.** We’re looking at this solar-powered unit as a repeater. Seeed’s linked listing is for the Meshtastic version, and MeshCore lists repeater firmware for the P1 Pro. [Seeed Studio listing](https://www.seeedstudio.com/SenseCAP-Solar-Node-P1-Pro-for-Meshtastic-LoRa-p-6412.html) · [MeshCore hardware list](https://meshcore.io/#hardware)

## Software we’re trying

**Supply Drop BBS** is a bulletin board system for LoRa networks. It supports MeshCore and Meshtastic and can run on a Raspberry Pi. We’re exploring what it takes to make a shared message board available over the workshop mesh. [Supply Drop BBS](https://supplydrop.meshamerica.com/)

## What we want to find out

- How reliably can two companion radios exchange messages around the workshop?
- Where would a solar repeater extend coverage, and how does it hold up through cloudy weather?
- Can someone on a companion radio reach Supply Drop and leave a message?

For setup, see the [MeshCore documentation](https://docs.meshcore.io/) and the [MeshCore web flasher](https://flasher.meshcore.io/).
