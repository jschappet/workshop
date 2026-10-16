---
title: "Challenge - Blink an LED on ESP32"
date: 2026-10-15
permalink: /notes/esp32/blink-led/
layout: "layouts/notes.njk"
---
# Challenge - Blink an LED on ESP32

**Your goal:** make an LED turn on for one second, turn off for one second, and repeat. Then change its rhythm yourself.

You do not need programming experience. Allow about 45–60 minutes for your first setup, including downloads. Once the software is installed, repeating the challenge takes only a few minutes.

We are using the **original ESP32 development boards** from the workshop and their **onboard LED on GPIO2**. No breadboard, resistor, or jumper wires are needed for this challenge. Our programming tools use **ESP32 Dev Module** for this family. If your board says ESP32-C3, S2, or S3, ask for help identifying it before following these pin and board selections.

## 1. Gather your kit

- An ESP32 development board with its pins already fitted.
- A Windows, Mac, or Linux computer with a USB port and internet access for installation.
- A **USB data cable** that fits the board. A charging-only cable can power the board but cannot upload a program.
**Use a practice board. Uploading Blink replaces the sensor program currently running on the ESP32.** It will stop reporting temperature or other readings until you upload the sensor program again. Save or locate the original sketch first if you will need to restore it.

## 2. Connect the board to your computer

Start with the board disconnected from any sensors or loose wires. Plug the USB cable into the ESP32, then into your computer. Rest the board on a non-metal surface.

A small power light may come on. That tells you it has power; it does not prove that the cable carries data. The power light may remain steadily lit for the entire challenge. We will blink the onboard LED connected to GPIO2; it is separate from the power indicator.

If nothing lights up, try another USB port and a known data cable. Some boards have different indicator arrangements, so a missing light alone does not prove the board is broken.

## 3. Install Arduino IDE

The **IDE** is the application where you write a program and send it to the board. Arduino calls each program a **sketch**.

1. Visit the [official Arduino software download page](https://www.arduino.cc/en/software/) and download **Arduino IDE 2** for your operating system.
2. On Windows, run the installer. On macOS, open the downloaded disk image and drag Arduino IDE into Applications. On Linux, follow Arduino’s AppImage installation instructions, including making it executable.
3. Open Arduino IDE. Allow it to finish its initial setup. If your computer requires administrator permission to install software, ask the computer’s owner for help.

Arduino provides [installation instructions for each operating system](https://support.arduino.cc/hc/en-us/articles/360019833020-Download-and-install-Arduino-IDE).

## 4. Add ESP32 support and select your board

Arduino IDE needs a **board package**: the tools that translate your sketch into a program the ESP32 understands.

1. Open **Preferences**: under **File** on Windows/Linux, or the **Arduino IDE** application menu on macOS.
2. Find **Additional Boards Manager URLs** and add this address. Keep any addresses already there; use the list editor or separate entries with commas.

   ```text
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

3. Save the preferences. Open **Tools → Board → Boards Manager**.
4. Search for **esp32**. Install **esp32 by Espressif Systems** and wait for installation to finish. Use the stable release, not a development package.
5. Restart the IDE if the new boards do not appear. Select **Tools → Board → esp32 → ESP32 Dev Module** for our original ESP32 boards.
6. Under **Tools → Upload Speed**, select **115200** for this first attempt. Leave the other board settings at their defaults.

No extra sensor libraries are needed for Blink. These package setup steps follow [Espressif’s Arduino-ESP32 installation guide](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html).

### Choose the USB port

A **port** is the computer’s connection to your board. Open **Tools → Port** and select the ESP32 connection. Typical names look like these; your numbers and suffixes will differ:

| Computer | Example port |
|---|---|
| Windows | `COM3` or `COM5` |
| macOS | `/dev/cu.usbserial-…` or `/dev/cu.SLAB_USBtoUART` |
| Linux | `/dev/ttyUSB0` or `/dev/ttyACM0` |

If several ports appear, unplug the ESP32 and note which disappears. Reconnect it and select the returning port. The board may appear as an unknown device; you can still select ESP32 Dev Module manually. See Arduino’s [board and port selection instructions](https://support.arduino.cc/hc/en-us/articles/16884223752220-Select-board-and-port-in-Arduino-IDE).

## 5. Find the onboard LED

Look for the small LEDs already mounted on the ESP32 board. One may be a steady power indicator. The **programmable onboard LED is connected to GPIO2** on the workshop boards we are using; this is the one our sketch will blink.

Leave the board connected by USB with no external wiring. The LED and its resistor are already part of the board. You do not need to connect anything to the pin labeled `2` or `IO2`.

ESP32 boards vary: an unfamiliar board may have a different LED connection or no programmable onboard LED. If you cannot identify yours, ask a facilitator to check the board model.

## 6. Create your Blink sketch

Choose **File → New Sketch**. Delete the starter text and paste this whole program:

```cpp
// Workshop Blink: onboard LED on GPIO2.
const int LED_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);  // Let this pin control an output.
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // Turn the LED on.
  delay(1000);                 // Wait 1 second (1000 milliseconds).
  digitalWrite(LED_PIN, LOW);   // Turn the LED off.
  delay(1000);                 // Wait 1 second.
}
```

Save it as **WorkshopBlink**. Let the IDE create its sketch folder; the file will be named `WorkshopBlink.ino` inside that folder.

The line with `LED_PIN` selects GPIO2, which is already connected to the onboard LED. `setup()` runs once when the board starts. `loop()` repeats as long as the board has power. A millisecond is one thousandth of a second, so `1000` milliseconds equals one second.

## 7. Verify, then upload — “flash” the chip

**Verify** checks and compiles your sketch. **Upload**, also called **flashing**, writes the compiled program into the ESP32’s flash memory, where it stays after power is removed.

1. Click the **checkmark** button to Verify. The first compilation may take a while. Wait until it finishes; if it fails, check the first error in the output panel before uploading.
2. Confirm the selected board is **ESP32 Dev Module** and the selected port belongs to your ESP32.
3. Click the **right-arrow** Upload button. Keep the USB cable connected while the IDE compiles and writes the program.
4. Wait for a successful upload message. On these boards, output often ends with a reset message such as “Hard resetting via RTS pin.” The board should restart and begin blinking.

If it does not restart after a successful upload, briefly press **EN** or **RST**, the reset button. See Arduino’s [upload guide](https://support.arduino.cc/hc/en-us/articles/4733418441116-Upload-a-sketch-in-Arduino-IDE).

### If uploading gets stuck at “Connecting…”

Some ESP32 boards need help entering their upload mode:

1. Start Upload again.
2. When the output shows **Connecting…**, press and hold **BOOT**.
3. Release BOOT when writing begins or upload percentages appear.
4. If that does not work, try again: hold BOOT, briefly press and release EN/RST while still holding BOOT, then release BOOT when writing starts.

BOOT selects the upload mode; EN/RST restarts the chip. After the upload, release both buttons and tap EN/RST if needed. This manual boot procedure is covered by [Espressif’s upload troubleshooting](https://docs.espressif.com/projects/arduino-esp32/en/latest/troubleshooting.html).

## 8. Check your result

Watch the **programmable onboard LED** for at least ten seconds. It should be on for about one second and off for about one second: one complete cycle every two seconds. If your board’s LED is active-low, `LOW` turns it on and `HIGH` turns it off; this sketch still blinks, but the on/off order is reversed.

Now unplug USB, wait a moment, and plug it back in. Blink should start again without clicking Upload. Your program is stored on the board. It does not need Wi-Fi, Heron, or the IDE left open to keep blinking; it only needs power.

## 9. Make it your own

Change **both** `delay(1000)` lines to `delay(250)`. Save and upload again. Predict what will happen before watching the LED.

Then try `delay(100)` after turning the LED on and `delay(1900)` after turning it off. You should get a short flash every two seconds. Editing and saving alone does not change the board: you must upload the new sketch.

**Challenge complete:** you can connect the board, select its port, upload Blink, explain which LED is controlled, and change its timing. Show a partner your rhythm and point out the two delay values that control it.

## When something goes wrong

| What you see | What to try |
|---|---|
| Power light on, but no port | Try a known USB data cable and another computer USB port. A power-only cable is a common cause. |
| Still no port | Ask a facilitator to identify the board’s USB-to-serial chip. Some boards need a CP210x or CH340 driver; use the matching manufacturer’s driver rather than installing random driver bundles. See [Arduino’s board detection guide](https://support.arduino.cc/hc/en-us/articles/4412955149586-If-your-board-is-not-detected-by-Arduino-IDE). |
| Port busy or access denied | Close other serial monitors, terminals, or upload tools using the board. On Linux, your account may need serial-port permission; ask for help with your distribution’s setup. |
| “Failed to connect” | Recheck board and port, then try the BOOT/EN procedure above and upload speed 115200. |
| Compile error mentioning `LED_BUILTIN` | Replace the entire sketch with the GPIO2 version above. Onboard LED definitions vary between ESP32 boards. |
| Upload succeeds but the onboard LED stays dark | Check that the sketch says `const int LED_PIN = 2;`, then press EN/RST. Ask a facilitator to confirm that this board has a programmable LED on GPIO2. |
| One board LED stays on | That may be the power indicator. Watch the programmable onboard LED on GPIO2. |
| Your timing change has no effect | Save and upload again; check that the upload succeeded and that you selected the board you are watching. |

If you need help, show your board, selected board setting and port, and the **first useful error message**, not just the final “exit status” line.
