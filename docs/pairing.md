# Pairing: the browser's device list (Nov 22, 2026)

Nate asked whether the "rullo.vercel.app wants to pair" box could be branded. It cannot: the browser draws it, for security, and no site can style or replace it. He asked for the next best things, ahead of the v3.2 ride test: skip the box where the browser allows it, and put a Rullo step in front of it everywhere else.

## What was built

- **Remembered devices** (`src/lib/pairing.ts`). The id of the trainer and of the heart rate sensor that last connected is saved in the browser. On Connect, a browser that has `navigator.bluetooth.getDevices()` hands the same device back and it connects with no device list.
- **The pairing step** (`PairingStep`). When the device list really is about to open, Connect first opens a Rullo panel on the Ride tab: what to do first (wake the trainer, close the Wahoo app and Zwift), what is about to appear, and one button, Show device list. The same step, with its own words, for the Heart rate tile's Connect.
- Reconnects during a ride, and a second ride in the same tab, never showed the list and still do not. Nothing about them changed.

## The limit: flags

Read from Chromium's source on Nov 22, 2026 (`runtime_enabled_features.json5`): `WebBluetoothGetDevices` and `WebBluetoothWatchAdvertisements` are still "experimental", so they are off in normal Chrome and Edge. The Web Bluetooth group's status page says the same, and that a permission lasting past a browser restart is behind a second flag.

So today, skipping the list needs two flags turned on once, on the computer by the bike:

1. `chrome://flags/#enable-experimental-web-platform-features`: Enabled
2. `chrome://flags/#enable-web-bluetooth-new-permissions-backend`: Enabled
3. Relaunch Chrome. Connect once through the list. After that, Connect goes straight to the trainer.

Without the flags, the app behaves as before plus the pairing step. If Chrome ships the API, the skip starts working with no change here.

## Calls

- **The step shows only when the list will open.** With a device in memory or one the browser hands back, Connect connects. The step costs one more click per page load without the flags; that was the trade Nate picked.
- **A remembered device that does not answer is tried once.** It waits up to 10 seconds to hear the device, then says "Could not find your trainer…" and lets go of it. The next Connect opens the step and the list. A device list cannot be opened after a wait (the browser needs a fresh click), which is why it does not fall through on its own.
- **The trainer's id is shared by every rider on the browser; the heart rate sensor's moves with its rider** (`ww.hrDeviceId` is in `RIDER_KEYS`). The trainer belongs to the room, the sensor is worn. Neither is written into a backup: an id means something only to this site in this browser.
- **One primary.** While the trainer's step is open its button is the Olive one and the top bar's Connect turns secondary. The heart rate step's button is secondary, since Start ride is usually the primary by then.
- **"Your browser", not "Chrome"**, since Edge shows the same list.
- **The fake trainer never shows the step.**
- **Not built:** connecting on page load without a click, a "forget this trainer" control, a list of remembered devices, a "do not show this again" choice for the step.

## Checked (headless Chromium, with a stand-in for the Bluetooth API)

- No `getDevices()`: Connect opens the step; Escape and Cancel close it with nothing asked of the browser; Show device list opens the list in that click and the trainer connects. Same for heart rate.
- `getDevices()` with a remembered trainer and sensor: both connect with no step and no list.
- `getDevices()` with nothing remembered: the step.
- Remembered but silent: fails after 10 s with the message; the next Connect shows the step, then the list, and connects.
- `?fake=1`: no step, numbers update.

## Needs the real Kickr and watch

- Without flags: Connect, the step, the list, pair. Same on the Heart rate tile.
- With both flags on: pair once, reload, press Connect. The trainer should connect with no list. Same for the watch. Quit Chrome fully and try again.
- With flags on and the Kickr unplugged: Connect should give up after about 10 seconds and the next Connect should open the list.

## The watch card (Nov 22, 2026)

Nate asked for more on the heart rate sensor's step: what to do to connect a watch, which app to use, links to the apps, subtle motion, and a button that says Connect. It replaces the two-line heart rate step. The trainer's step did not change.

- **Three steps:** Get a relay app, Start the broadcast, Pick it in the list. Side by side from 1280px wide, stacked below.
- **Three apps, each a link to its App Store page** (read on Nov 22, 2026): HeartBLE (watch only, watchOS 26 or later), HeartCast (watch and iPhone), HR Broadcast (watch and iPhone; the iPhone app stays open). Links open in a new tab, so the card and the ride stay put. None has been ride-tested with Rullo.
- **The button says Connect** and opens the browser's device list in that click, as before. It is secondary: the top bar keeps the one primary.
- **Motion:** the panel enters, then the three steps enter 80ms apart. Once. Nothing loops (the status dot stays the only loop), and with reduced motion it all snaps.
- **A strap needs no app.** One line in the footer says so.
- **Height.** The card is about 300px tall at 1280, so the Ride tab scrolls while it is open. It is open only before the device list, never for a remembered sensor and never mid-reconnect.
- **Not built:** a "do not show this again" choice, detecting which watch the rider has, Garmin or Wear OS instructions, app logos (they would need each brand's assets).
- **Checked (headless Chromium, Bluetooth stand-in):** the tile's Connect opens the card with focus on Connect; Escape and Cancel close it with nothing asked of the browser; Connect asks for the device list once; three links with the right addresses and a new tab; no sideways scroll at 1280 and 1024; `?fake=1` shows no card and the numbers update.
- **Needs the real watch:** which of the three apps works with Chrome, and what name it shows in the list. The card's wording on that ("HeartBLE or your iPhone") comes from the listings.
