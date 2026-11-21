# Heart rate, calories and Strava upload (Nov 20, 2026)

What was built, every judgment call, and what was cut. Three parts, shipped in this order: A heart rate, B calories, C Strava upload.

Screenshots: `docs/screenshots/hr-*.png` and `strava-*.png` (1280x720).

## Part A: heart rate

### What was built

- **A second Bluetooth device.** `src/lib/heartRate.ts` talks to the standard Heart Rate service (0x180D) and Heart Rate Measurement (0x2A37, notify) and nothing else. A strap, an armband and a watch relay app all look the same to it.
- **Its own tile** on the Ride tab: "Heart rate", the number, "bpm". Always there. "--" with a Connect control when no sensor is connected.
- **Saved with each one-second sample** as an optional field (`heartRateBpm`), and written to the FIT file: `heart_rate` on each record that has one, average and max on every lap and on the session.
- **A fake sensor** with `?fake=1`: heart rate follows power with a 25 s lag. **H** drops it for 8 seconds.

### Judgment calls

**Where the fifth tile goes.** The panel was the Power tile plus a 2x2 grid, and it is exactly 720 px tall at 1280x720 in every ride type. There is no height left, so the tile had to go sideways.

- The right side is now two rows: **Cadence, Heart rate, Speed** on top and **Distance, Time** below.
- Distance and Time keep half the width each. They hold the long values ("112.34 mi", "1:23:45") and would not fit in a third.
- Power went from half the panel to two fifths (486 px at 1280). A three-digit power needs 341 px; four digits fill it to the edge.
- The top row is split 9 : 8 : 8, so Cadence has room for its cue.
- **The cadence cue lost its unit:** "target 90 rpm · under" is now "target 90 · under". The tile already says rpm. The long form did not fit beside the label in a third of the row.
- Measured at 1280: the worst case (120 rpm with "target 110 · under", 188 bpm with Disconnect, 38.8 mph) fits with 3 px to spare on the Heart rate label row and 2 px on Speed. Wider screens have more room. Under 1280 the panel stacks, as before.
- Heart rate sits next to Cadence because both are about the rider. Power stays the one big number. The Heart rate number is plain `fg`, the same as the other tiles.

**The connect control is a word, not a button.** A `Button` in the label row would make the tile taller and push the control row off a 720 px screen. It is label-sized underlined text (`.ww-tile-link`, added to DESIGN.md). One element for every state, so keyboard focus stays on it: Connect, Connecting, Disconnect, Reconnecting, Retry.

- **Reconnecting can be pressed** to stop the retries. Otherwise a rider whose strap battery died would watch 30 tries.
- **After 30 failed tries** it reads Retry and the tile shows "--". No notice bar: a notice pushes the control row down, and a lost strap is not worth that.
- **A failed first connect forgets the device**, so Retry opens the picker again. A lost connection keeps the device, so reconnecting needs no picker.

**What counts as a fresh reading.** Two constants in `src/config.ts`:

- `HR_STALE_AFTER_MS = 3000`: the tile grays out after 3 s with no reading, the same as the trainer's numbers. The last number stays, gray.
- `HR_FRESH_MS = 2000`: a recorded second gets a heart rate only if a reading arrived in the 2 s before it. Why not 1 s: a 1 Hz sensor and a 1 Hz trainer drift against each other, and a strict 1 s window would leave holes in a healthy recording. Why not 3 s: that would carry an old value for 3 seconds after a drop. With 2 s, an 8-second drop leaves 7 seconds without heart rate.
- **This is the number most likely to need changing after a real ride.** If a watch relay app sends a reading only every 5 seconds, the tile will flicker gray and most seconds will have no heart rate. Both constants would then go up together.

**Never carried forward.** The recorder fills a second or two that a late trainer reading skipped by holding the last power and cadence. Those filled seconds do not hold the last heart rate: each one gets a heart rate only if the sensor read in its own window.

**What is not a reading.** The parser returns nothing for: a packet under 2 bytes; the 16-bit flag with only one value byte; a value outside 20 to 250 bpm (straps send 0 with no skin contact); and "sensor contact supported, not detected" (flags bits 1 to 2 equal 2). Energy expended and RR intervals come after the value and are ignored.

**The sensor never touches the ride.** It has its own device, its own connection, its own reconnect loop and its own state. Nothing in it calls the trainer. The StatusPill, auto-pause, stale detection and recording look at the trainer only. A lost heart rate changes the color of one tile.

**The tile is live outside a ride too.** Connect the sensor first and the number shows before the trainer is connected, and after End Ride. That is the quickest way to see that the watch is broadcasting. Nothing is recorded until Start, as for power.

**FIT: the same file as before without a sensor.** The heart rate fields are added to the record, lap and session definitions only when at least one sample has a heart rate. Checked byte for byte against the writer on `main` for a free ride and a course plus workout. On a ride with a sensor, a second with no reading gets the FIT invalid value (0xFF), which decoders read as "no heart rate", never 0.

**FIT field numbers** (read from the Garmin FIT SDK profile, not guessed): record `heart_rate` 3; lap `avg_heart_rate` 15, `max_heart_rate` 16; session `avg_heart_rate` 16, `max_heart_rate` 17. All uint8 bpm.

**Lap and session heart rate** average the records that have one. A lap with none gets the invalid value.

**No database change.** `heartRateBpm` is an unindexed optional field on a sample. Dexie stays at version 4. Old rides load and export as before.

**Fake key: H.** D, C, S, J and E were taken. Like the other fake keys it is ignored while typing in a field.

**After a reload** the sensor has to be picked again (a Chrome limit, same as the trainer). A resumed ride keeps the heart rate it saved before the reload.

### Checks (headless Chromium; FIT decoded with @garmin/fitsdk in a scratch folder)

- **Fake sensor, 26 checks, all passing.** Connected before the trainer and again mid-ride. Nothing recorded before Start with the sensor connected (0 rides, 0 samples). Power, heart rate and time changed on 7 of 7 one-second reads; cadence, speed and distance moved. H: tile gray, pill still "Connected", time kept counting, then recovered. D with the sensor connected: power gray, heart rate still live. S, C and J behaved as before.
- **Real Bluetooth code against a mocked trainer and sensor, 14 checks, all passing.** Its own picker asking for the Heart Rate service only. Connecting it wrote nothing to the trainer. Link loss: tile gray with Reconnecting, ride on, back on its own with no picker. Trainer loss with the sensor connected: heart rate unaffected. A sensor that goes silent without disconnecting: gray, ride on. A cancelled picker: back to Connect, no error. The mock cycled through seven packet shapes (8-bit, 16-bit, with energy expended, with RR intervals, contact lost, truncated, empty) and the tile never showed a wrong number.
- **Parser, 18 cases, all passing:** empty, one byte, 16-bit flag with a short payload, 8-bit and 16-bit values, energy expended, RR intervals, both, a truncated extra field, the three contact states, 0, 255, 300, reserved flag bits, and a view with a byte offset.
- **FIT, workout with an 8-second drop:** 60 records, 5 laps, 0 decode errors, integrity check passed. 51 records with heart rate, 7 in a row without during the drop, 0 with a value of 0. Each lap's average and max matched its records. Session 95 avg, 130 max, matching the records. Lap timer sum 60 s, session 60 s. Lap distance sum 454.62 m, session 454.62 m.
- **Reload mid-ride:** 9 records with heart rate from before the reload, 5 without after it (the sensor was not picked again). 0 decode errors.
- **Layout:** 1280x720 in all four ride types, idle, waiting and riding, with and without reduced motion: page height 720, key hint on one line and on screen. No horizontal scroll at 1024, 1280, 1440 and 1920.
- **Keyboard:** Tab reaches the control, the 2 px focus ring shows, Enter connects, and focus stays on it as it turns into Disconnect.
- **Contrast:** no new pairs. The control is `fg` on `surface` (17.4:1), `fg-muted` on hover (7.1:1), `state-under` while reconnecting (5.9:1).

### Needs a real ride

1. Does the relay app show up in Chrome's picker when you press Connect on the tile?
2. How often does it send? Watch the tile for a minute. If it flickers gray, tell me roughly how many seconds apart the number changes.
3. Does the number match the watch?
4. Walk away from the computer with the watch for 20 seconds mid-ride. The tile should go gray and say Reconnecting, the ride should carry on, and the number should come back when you return.
5. Does connecting the sensor ever disturb the Kickr? It should not.

## Part B: calories

File only. Nothing about calories shows on the Ride tab.

### What was built

Every lap and the session in the FIT file now carry `total_work` (joules) and `total_calories` (kcal), worked out from recorded power.

### Judgment calls

- **1 kJ of work is 1 kcal.** This is the usual cycling convention for calories from a power meter. It works because a rider turns about 24% of the energy burned into work at the pedals, and 1 kcal is 4.184 kJ, so the two nearly cancel. It is an estimate of energy burned, not a measurement.
- **Each record is one second at its power.** Work is the sum of the recorded watts, one second each. There are no records while paused or during a dropout, so those add nothing. A record is never stretched across a hole: after a 2-second hiccup the record before it still counts for one second, not three.
- **Work is not average power times timer time.** The two differ by a few joules when a ride has small holes. The sum of the records was chosen because it only counts seconds that have data.
- **Laps add up exactly.** Lap work is in whole joules, so the laps sum to the session. Calories are rounded on the running total (lap calories are the rounded total at the lap's end minus the rounded total at its start), so the laps always add up to the session's whole number. Rounding each lap on its own would drift: forty 3-second laps of 480 J would each round to 0.
- **Heart rate is not used.** Calories come from power only, with or without a sensor.
- **Field numbers** (from the Garmin FIT SDK profile): lap `total_work` 41 (uint32, J), lap `total_calories` 11 (uint16, kcal); session `total_work` 48, session `total_calories` 11.
- **Every FIT changes by these four fields**, sensor or not. They sit after the existing lap and session fields, before the heart rate fields.
- **Rides saved before this work** get work and calories too when they are downloaded again (from Home, for example): the numbers come from the samples, not from anything stored.

### Checks (FIT decoded with @garmin/fitsdk in a scratch folder)

- **Six built rides, 39 checks, all passing:** a 10-minute free ride; a workout with 7 laps, 2 pauses, a dropout, heart rate and a course; forty 3-second laps of under 1 kJ each; a ride of all zeros; 6 hours with 40 laps; a single sample. In each: session work equals the sum of the recorded watts, session calories equal that in kJ, lap work adds up to the session, lap calories add up to the session, and lap timer and distance still add up.
- **Pauses add nothing:** the same 300 samples with two 1-minute pauses and a 20-second dropout gave the same work and calories (74,850 J, 75 kcal) while elapsed time went from 300 s to 440 s.
- **From the browser** (fake workout, sensor connected, an 8-second heart rate drop): 61 records, 5 laps, 0 decode errors. Lap work 2,369 + 1,126 + 414 + 5,391 + 377 = 9,677 J, session 9,677 J. Lap calories 2 + 1 + 1 + 5 + 1 = 10, session 10. Each lap's work equals the sum of its records' power.

### Needs a real ride

Compare the calories Strava shows with the ride's work in kJ. They should match (Strava may show its own estimate beside it).
