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

## Part C: Strava upload (Nov 21, 2026)

### What was built

- **Profile, Strava block:** connect, the connected athlete's name, disconnect.
- **After End Ride:** Upload to Strava beside Download FIT. It says what it is doing, then becomes a link to the activity.
- **Four Vercel functions** in `/api/strava`, with shared code in `server/strava.js`. Plain Node, no framework, no new dependencies.

| Function | Does |
| --- | --- |
| `GET /api/strava/config` | Says whether the two variables are set, and gives the client id (public; it is part of the sign-in address) |
| `POST /api/strava/token` | Trades the sign-in code for tokens, or refreshes an expired token |
| `POST /api/strava/revoke` | Removes the app's access at Strava (Disconnect) |
| `POST` and `GET /api/strava/upload` | Passes the FIT to Strava; reports how the upload is doing |

The brief expected three functions. Two more exist because (1) the browser has to learn whether Strava is set up, and the client id, without either being built into the bundle, and (2) Strava's revoke endpoint needs the client secret.

### The server exception

The scope doc held server features until going public is a real decision. Nate made an exception for Strava upload only, recorded in CLAUDE.md and the scope doc on Nov 21, 2026. The functions are stateless: no database, no accounts, nothing written, nothing logged. The app works fully without them, and nothing else calls them. The page does not call them at load: `config` is asked only when the Profile tab opens or a ride made on a real trainer ends.

### Read first (Nov 20, 2026)

Strava's Getting Started, Authentication, Uploads, API reference, Rate Limits, the API Agreement (effective June 1, 2026) and the Brand Guidelines (last revised Sep 29, 2025); Vercel's Functions quickstart, API reference, Node.js runtime and limits. What the code relies on:

- Authorize at `https://www.strava.com/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `approval_prompt`, `scope`, `state`. A refusal comes back as `error=access_denied`.
- Tokens at `POST /oauth/token`. Access tokens last 6 hours. A refresh may return a new refresh token, and the old one stops working at once.
- **Revoke is `POST /oauth/revoke`** with HTTP Basic auth (client id and secret). The older `/oauth/deauthorize` is supported only until June 1, 2027, so it is not used.
- Upload at `POST /api/v3/uploads` (multipart): `file`, `data_type`, `sport_type`, `name`, `trainer`, `external_id`. `activity_type` is deprecated in favor of `sport_type`. Processing is asynchronous; Strava recommends checking no more than once a second and says the mean processing time is under 2 seconds.
- Limits: 200 requests per 15 minutes and 2,000 a day overall; 429 when exceeded.
- A new app is in "single player mode": one athlete, its owner.

### Judgment calls

**Everything goes through the functions.** Strava's docs say nothing about calling the API from a browser (no mention of CORS on any page read). The upload and the status check need only the rider's token, so they might work straight from the browser, but nothing documents it and a test against the real API was ruled out. So the default stands: the browser talks only to this site.

**Scope: `activity:write` only.** It is the scope Strava's upload page names. The app asks for nothing else, not even `read`: the athlete's name comes with the sign-in reply. If the rider unticks the box on Strava's page, the app says so and does not connect.

**The connect button** is Strava's own white "Connect with Strava" image at its own size, in a hairline frame, because the white asset has no edge and would vanish on a white panel. White was chosen over orange so the screen keeps one loud color. This is the one DESIGN.md exception; see "The Strava exception" there. The guidelines say an app that uses the button must link it to Strava's authorize address, which it does; they do not say plainly that the button is the only allowed way to connect. Using it is the safe reading.

**Upload to Strava is an ordinary button, and it is the primary one.** When Strava is connected and the ride is not uploaded yet, Upload to Strava is Cobalt and Download FIT turns secondary, so there is still one primary on screen. The file has already downloaded at End Ride, so the next useful click is the upload. Once uploaded, or when Strava is not connected, Download FIT is primary again.

**The link reads exactly "View on Strava"**, bold and underlined in the text color. The guidelines accept bold, underline or Strava orange; orange is not used.

**"Compatible with Strava"** is a line of text under the Profile block, the wording the guidelines give. Strava's logo files were not added. If the app ever goes for Strava's review (more than one athlete), check then whether the logo is required.

**Where the tokens live:** `localStorage` under `ww.strava`: access token, refresh token, expiry and the athlete's name. Nothing else about the athlete is kept. Disconnect clears them and revokes at Strava. If Strava cannot be reached, they are still cleared here, and the app says to remove Weem Watts on strava.com.

**CSRF and the way back.** Connect makes a random 128-bit state, keeps it in `sessionStorage` (this tab only) with the page's origin and the time, and sends the rider to Strava. On the way back the app checks the state, the origin and that it took under 15 minutes, before the code goes anywhere. The code is removed from the address bar at once. A link with a code this tab did not ask for is refused and the code is never sent.

**The functions accept only this site's own pages.** A browser sends `Origin` on every POST and `Sec-Fetch-Site` on a same-origin GET; the functions compare the origin with the host they were called on, so the live site, preview deployments and a local test all work with no list to keep. No CORS headers are ever sent. JSON bodies must be `application/json` and under 2,000 characters; codes and tokens must be 8 to 200 letters, digits, `_` or `-`; ids must be digits.

**Errors are short codes.** The functions never pass Strava's own response on, apart from an upload's status text with all markup stripped. The browser turns each code into its own sentence. Nothing is logged anywhere in the functions.

**Fake rides cannot be uploaded, three ways.**

1. The ride is marked at Start: `origin: 'fake'` on its row when the app runs with `?fake=1`, `'trainer'` otherwise. The mark stays with the ride after a reload without `?fake=1`.
2. The mark goes into the FIT file, as the `product` number of the `file_id` message: 1 a real trainer, 2 the fake trainer, 0 unknown (a ride saved before this work, or a file with no mark). The upload button shows only for `'trainer'`, never in fake mode.
3. The upload function reads the file before Strava is called and takes product 1 only. It also checks the FIT header, the size the header declares, and the file's checksum, so changing the mark by hand breaks the file. Someone who edits the byte and recomputes the checksum can get past this; that is forging a file, which nothing here can stop.

This changes one byte of every FIT made on a real trainer from now on (product 0 to 1).

**Not a FIT, or too big.** Anything that is not a FIT activity file made by this app is refused: wrong header, wrong size, bad checksum, wrong file type, wrong manufacturer. The limit is 4 MB (Vercel's own limit is 4.5 MB). A 6-hour ride is about 0.5 MB.

**The activity.** `sport_type=VirtualRide`, `trainer=1`, `data_type=fit`, the name from the setup ("Sweet Spot 3x12 on Test Hills", "Test Hills", "Sweet Spot 3x12" or "Free ride"), and `external_id` `weem-watts-` plus the ride's start time, so the same ride always has the same id. No description is sent: nothing is posted that the rider did not ask for. Every upload is a Virtual Ride, including a free ride on a flat road, as the brief asked; the FIT itself still says indoor cycling for those, and the parameter overrides it.

**The same bytes as Download FIT.** The upload builds the file with the same function from the same samples. Checked byte for byte.

**Waiting for Strava.** The app checks every 2 seconds, up to 30 times (a minute). If Strava is still working, the button becomes **Check upload**, which asks again without sending the file a second time. A failed check after Strava has taken the file is treated the same way, not as a failed upload.

**Duplicates.** Strava reports a duplicate as an error text naming the activity, sometimes inside a link. Both forms are read. The button becomes "Already on Strava" with the link. It is not shown as an error.

**Remembered on the ride.** The upload id and activity id are saved on the ride's row (`strava`), with the ride's `name` and `origin`. No new table; Dexie stays at version 4. A stored id must be digits before it is used in a link.

**Connecting after the ride has ended.** Signing in leaves the page, which would lose the "Ride ended" screen. So the ride's id travels with the sign-in, and on the way back the app reopens that ride on the Ride tab with its buttons. (Since Nov 24, 2026 it comes back to the ride's summary, the finish screen, with the same buttons in the top bar. See `finish-screen.md`.) For the same reason Connect is not offered while a trainer is connected or a ride is on: the Profile block says to end the ride first.

**An expired token** is refreshed before the upload when it has under 5 minutes left. If Strava refuses the token anyway, on the upload or on a status check, the app refreshes once and repeats that one call. If the refresh is refused, access was removed on Strava's side: the tokens are cleared and the app says to connect again.

**The upload slot hides** when Strava is not set up, for a fake ride, and when nothing was recorded. With the variables missing, the Profile block reads "Strava upload is not set up yet" and the console stays empty. A rider who is already connected sees the button at once, before the server has answered.

**Old rides are not uploadable.** The Home tab lists past rides with Download FIT. Upload from there was left out: the brief asks for the button after End Ride.

**AI.** The scope doc notes that Strava data cannot be used with AI. The agreement text read on Nov 20, 2026 had no clause that mentions AI by name; whichever is right, the app reads no Strava data, so there is none to use.

### Checks

All against a mock of Strava's endpoints and a local server that runs the functions the way Vercel does (a web Request in, a Response out). The real Strava API was never called: in the test server every outbound call is redirected to the mock and anything else throws, and in the browser every request to strava.com is blocked except the sign-in page, which the test answers itself. Rides were made on the real Bluetooth code with a mocked trainer and heart rate sensor, since a fake-mode ride cannot be uploaded.

- **Functions called by hand, 38 checks, all passing.** Another origin, or no origin: 403. A fake ride's FIT: refused as `fake_ride`, Strava never called. A FIT with no mark: refused. A fake FIT with its mark edited: fails the checksum. Empty, random bytes, a GPX, a truncated FIT, a FIT with one byte changed: refused. Over 4 MB: 413. No token: 401. A code with odd characters: refused before Strava is called. Strava got `VirtualRide`, `trainer=1`, `fit`, the name and the id, and the same bytes. Duplicate, bad file, rate limit (429), Strava down (502), a rejected token (401), refresh and revoke all map as written above. No reply from any function on any method contains the secret or its variable name. With either variable missing: `configured: false` and 503 on the rest.
- **In the browser, 76 checks, all passing:** connect (the sign-in address carries the client id, `code`, `activity:write`, this origin and a 32-character state, and no secret; the address bar is clean afterwards; tokens are in this browser only); reload keeps the connection and sends nothing to Strava; Disconnect revokes with the refresh token and clears it; upload (nothing sent before the click; the button says "Uploading to Strava" then "Strava is processing"; the link is `https://www.strava.com/activities/<id>`; one upload; the uploaded file is byte for byte the downloaded one and decodes with heart rate, 2 laps, work and calories, and the real-trainer mark); both forms of duplicate; sign-in cancelled, a wrong state, the upload box unticked, a code Strava refuses, and a sign-in link the tab never asked for; not connected at the end of a ride, then connect and come back to the ride; access revoked on Strava's side; a token near expiry, a token refused on the upload, and a token that expires while Strava is processing; rate limit; Strava down; offline; the variables removed from the server; a file Strava rejects (its reason shown with the markup stripped); Strava never finishing (30 checks, then Check upload); a fake ride (no button, the function refuses its file, still no button when the ride is reopened without `?fake=1`); nothing recorded (no upload, no download); keyboard focus and rings on the connect button, the upload button and the link; no sideways scroll at 1024, 1280 and 1920 with the link showing; the Ride tab still 720 px tall with the upload button.
- **The secret is not in the bundle.** Built with `STRAVA_CLIENT_ID` and a test `STRAVA_CLIENT_SECRET` in the environment, then searched `dist` for both variable names, the test secret and `client_secret`: no matches. The only mention in `src` is a comment.
- **Contrast:** no new token pairs. The link is `fg` on `bg` (15.6:1). Strava's button is Strava's.

### Not checked

- **The real Strava API.** Nothing here has talked to Strava. The first real upload is the test.
- **A real Vercel deployment of the functions.** They were run locally through the same Request and Response shapes Vercel documents for a non-framework project (`export function GET(request)`). If the first deploy shows a problem, it will be on the Profile tab: "Strava upload is not set up yet" with the variables set means the functions are not answering.
- **Whether Strava shows a free ride as a Virtual Ride** from the `sport_type` parameter alone.

## What was cut

- A native Apple Watch or iPhone app. Heart rate zones, zone colors, targets, HR-driven ERG.
- Charts, a ride summary, calories on the Ride tab.
- Upload without a click. Garmin and TrainingPeaks. Reading any activity data back from Strava. Accounts, a database.
- Upload of past rides from the Home tab.
- Strava's logo files, a description on the activity, a private or public choice (the activity gets the rider's Strava default).
- A notice when the heart rate sensor is lost (the tile says it).

## First real upload: checklist for Nate

1. Create the Strava API app and add the two variables in Vercel (steps in the README under Deploy), then redeploy.
2. Open Profile. It should offer Connect with Strava, not "not set up yet".
3. Connect. Strava should ask for one permission: upload activities. After approving you should land on Profile, "Connected as" your name.
4. In the Strava app, turn off the Apple Health workout import, or the watch's copy will appear beside this one.
5. Ride 10 minutes with the Kickr and the watch: a course plus a short workout, so there are laps and elevation.
6. End Ride, Confirm end, Upload to Strava. Within a few seconds it should read View on Strava.
7. On Strava check: Virtual Ride, the name, power, heart rate, laps, calories close to the ride's kJ, moving time, elevation.
8. Press nothing else and reload Strava's feed: one activity, not two.
9. On Profile press Disconnect, then check strava.com, Settings, My Apps: Weem Watts should be gone.
