# Rullo

A free browser app for riding a Wahoo Kickr Core 2. It shows live power, cadence, heart rate, speed, distance, and time, lets you change resistance or hold a target power (ERG) while riding in one gear, rides GPX courses with an elevation profile, runs structured workouts in ERG (built-ins, imported ZWO files, or ones you build in the app), saves every second to the browser, and exports a FIT file.

**Live:** https://rullo.vercel.app

**Try it without the bike:** https://rullo.vercel.app/?fake=1

Chrome or Edge on desktop only (needs Web Bluetooth).

## Tabs

- **Home** (`#/`, where the app opens): your FTP and weight, your power zones, totals from your saved rides (all rides and the last 7 days), your power bests (5 s, 1 min, 5 min, 20 min), and your ride history with **Download FIT** and **Delete** on every ride. Click a ride to open its **summary**: its numbers, a line each for power, cadence, heart rate and elevation, time in each power zone, and its bests. A ride that beat every earlier ride over a stretch gets a **PR** tag. One button takes you to the next step: **Set up a ride**, or **Go to Ride** once a setup is on the Ride tab.
- **Ride** (`#/ride`): live numbers only.
- **Workout** (`#/workout`): pick a course and a workout.
- **Profile** (`#/profile`): who's riding, weights, position, FTP, your power zones, your own files, and back up and restore.

Ride history is read from the rides saved in this browser. Nothing is uploaded. **Delete**, then **Confirm delete**, removes a ride and its recording from this browser for good; download the FIT first if you want to keep it. A ride that was never ended (a reload or a crash) is not in the list until you end it from the Ride tab.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge.

Production build:

```bash
npm run build
npm run preview
```

## Ride without the bike: `?fake=1`

Open http://localhost:5173/?fake=1 and press **Connect** (it takes you to the Ride tab). A fake trainer sends power and cadence once a second. The first 3 seconds are 0 W (rider getting on). Power, cadence and speed are live at once; the status reads "Not recording" and time and distance stay at zero until you press **Start ride** (or **Start workout**).

- Change resistance with the step buttons or keys. Fake power rises and falls with it.
- In **ERG**, fake power follows the target. Press **C** to drop cadence to 40 rpm for 6 seconds and watch ERG release, re-engage and ease back in. Like a Kickr Core 2 is reported to, the fake trainer refuses a resistance level while stopped, so restarts show the 25 W fallback and the retry.
- Press **S** to stop pedaling until you press it again. After Start, the ride auto-pauses after 3 seconds; the status shows "Paused" and time, distance and recording stop. Press **S** again and the fake rider spins back up from 0 rpm.
- Press **J** (or open `?fake=1&jitter=1`) for jittery delivery: readings arrive 0.3 to 2.6 s apart. The FIT file should still have a record every second.
- Press **D** to drop data for 5 seconds. The numbers gray out and the status shows "Reconnecting", then recover.
- Press **Connect** on the Heart rate tile for a fake heart rate sensor. It follows your power with a lag. Press **H** to drop it for 8 seconds: the tile grays out, the ride carries on, and those seconds have no heart rate in the FIT file.
- Press **End Ride** twice (the second click confirms) to end and download the FIT file.
- On the **Workout** tab pick **Test Intervals** (2 minutes) to watch ERG follow each interval, or **Test Ramp** and press **C** mid-ramp to fail the test and get an FTP estimate. These two show only with `?fake=1`.
- Reload mid-ride to test crash recovery: an "Unfinished ride found" bar offers Resume or End and download.

## Workouts

Open the **Workout** tab before connecting. It is two steps. What you pick here stays on the Workout tab until you confirm it. The Ride tab changes only when you press **Ride this workout** or **Done: go to Ride**.

1. **Choose your course.** Cards: a flat road, then each course with a small elevation profile, its miles and climbing. Click a course and its overview opens under the cards (distance, climbing, low and high points, the full profile) with the start mile. Press **Next**.
2. **Choose your workout.** A library of cards, each with a small graph of the workout. **Custom Workout** is the first card and opens the builder; **Free ride** is next. The side menu switches between **All workouts** and **Custom** (the ones you built or imported). Filter by **Length** and **Difficulty**. Click a card to open the workout's overview (graph, description, **Edit a copy**). Looking at a workout does not pick it: press **Ride this workout** to put your course and that workout on the Ride tab. For a ride with no workout, click the **Free ride** card, then **Done: go to Ride**.

The line at the bottom of each step shows what you picked and says whether the Ride tab has it yet. **Done: go to Ride** puts exactly that line on the Ride tab. Your picks are still on the Workout tab after a reload. The Ride tab always starts as a free ride on a flat road, and **New ride** puts it back to that.

What sets the load:

| Setup | Trainer mode | The load comes from |
| --- | --- | --- |
| Course + workout | ERG | the workout's targets; the course sets speed, distance and the profile |
| Course + free ride | Grade | the course's hills (see Grade mode below) |
| Flat road + workout | ERG | the workout's targets |
| Flat road + free ride | Resistance or ERG | you |

The mode is picked for you and you can always switch it on the Ride tab (or press **E**). The control row always says who sets the load right now: "Workout sets the load.", "Hills set the load." or "You set the load." On a course the course row adds "The course sets speed, not the load." or, in Grade, "The course sets speed and the load." With a workout loaded but not started, the trainer holds your own ERG target ("You set the load for now.") until Start workout.

Built-ins: Endurance 60, Sweet Spot 3x12, VO2 5x3, a Ramp FTP test, and the ZWO files in `public/workouts/`: FRNKLN - January 6, five 15-minute rides (Quick 15: Recovery Flush, Zone 2 Spin, Ironman Race Pace, Tempo Bursts, Sweet Spot Hit), five 30-minute rides (Easy Street, No Retreat, Iron Will, Red Line, The Caldron), five 45-minute rides (The Road Home, The Grinder, Test of Will, The Crucible Ring, Grit Test), five easy rides (Long Haul III, The Causeway IV, The Levee IV, The Long Road V, Coastal Cruise V), five medium (The Forge IV, Sweat Factory V, Copper Wire IV, Over the Top V, The Rolling Mill V) and five hard (Hour of Power V, The Heat V, The Smelting Pot IV, The Millstone V, Critical Mass IV).

**Your own files:** Import GPX, Import ZWO and **New workout** are on the **Profile** tab, under "Your files". Imports and the workouts you build are saved in this browser and listed there.

### Build a workout

Press **Custom Workout** (the first card in step 2 of the Workout tab, or the button on Profile), or open any workout and press **Edit a copy** to start from it. The builder works like Zwift's editor.

1. **Name it.** Click the title, type, press Enter.
2. **Add blocks.** Click a tile on the right (Z1 to Z6, Warm up, Cool down, Intervals) to add it after the selected block, or drag the tile to a spot on the graph.
3. **Set time and power.** Click a block and its fields show right above it. Type a time (`12` is minutes; `12:00`, `90s`) and a power. Or drag the block's top edge for power and its right edge for time.
4. **Intervals** have a − / + repeat count and Duration One / Power One, Duration Two / Power Two. **Add step** gives a repeat a third step or more.
5. **Cadence.** Select a block and click the Cadence tile (or drag it onto a block). The × removes it.
6. **Move and delete.** Drag a block sideways to move it, or onto **Delete block** to remove it. **Undo** (Ctrl + Z) takes back any change.
7. **Save.** You land on the workout's overview. Press **Ride this workout** to put it on the Ride tab.

- **Display** switches the power fields between % FTP and watts. A bare number takes the unit on display; `225w` or `90%` always wins. A % target follows your FTP, a watts target stays fixed.
- Keys on a block: ← → select, ↑ ↓ power, Shift + ← → time, Alt + ← → move, Delete, Ctrl + D duplicate.
- **Step list** opens the same workout as typed rows, with a label per step.
- An unsaved draft survives a reload. Limits are the same as for imported files: 6 hours, 2,000 intervals, 500% or 2,500 W.
- **Cadence** is a cue for you. The Ride tab shows it in the workout row and the Cadence tile; the trainer holds the power either way.
- Custom workouts live in this browser only. Clearing site data deletes them; there is no export yet.

Details and decisions: `docs/workout-builder.md`.

To add a built-in ZWO: put the file in `public/workouts/` and add `{ "id": "...", "file": "....zwo" }` to `public/workouts/index.json`. An optional `"tag"` of `easy`, `medium` or `hard` puts it under that Difficulty filter.

- A confirmed workout shows on the Ride tab but doesn't start on its own. Connect and spin up as long as you like at your own ERG target or resistance: nothing is recorded yet. Then press **Start workout** in the top bar. The clock, the recording and the workout start together, from the workout's first step, and the trainer follows each interval in ERG. The workout's own warm-up is its first lap.
- In ERG the step buttons and keys change workout intensity (every target, 50 to 150%). In Resistance the workout keeps running but targets aren't applied.
- **Skip interval** jumps ahead. In the ramp test, dropping below 50 rpm (or **End test**) ends the test, starts the cool-down and offers **Set FTP**.
- When the workout ends, ERG holds the cool-down watts until you press End Ride.
- Each interval is a lap in the FIT file. The file starts at Start workout; pedaling before it is not in the file.

## Profile

Open the **Profile** tab (`#/profile`). On the left are the rider at a glance (rides, last ride, riding since, last backup) and a menu of four sections: **Your numbers**, **Riders**, **Your files**, and **Data and connections** (back up, restore and Strava). One section shows at a time.

In **Your numbers**, set rider weight, bike weight, FTP, and riding position (hoods, drops or aero). Speed and distance use these, and "On the road at 200 W" shows what they come to on a flat road and a 5% climb as you change them. Until you set a number the page says these are starting numbers. The profile is saved in this browser and applies to your next ride; past rides don't change.

**Interval sounds** (the last row of Your numbers, off by default): in a workout, three soft beeps in the last three seconds of an interval and a tone when the next one starts. Turning it on plays the tone once. Nothing sounds while a ride is paused. You can switch it mid-ride.

**FTP history** lists each change of FTP with its day and how it was set (typed, ramp test, or from your best 20 minutes). Each new ride keeps the FTP it was ridden at, so its time in zone does not move when your FTP does. When your best 20 minutes in the last 60 days points above your FTP (95% of it is higher), the page says so and offers **Set FTP to … W**. It never changes your FTP on its own; **Not now** puts that value away.

### More than one rider

**Who's riding**, in the Riders section of the Profile tab, is for a shared trainer. No passwords.

- **Add rider** makes a new rider and switches to them. They start with the default profile and nothing saved.
- **Switch** changes who is riding. The page reloads, so disconnect the trainer and end the ride first.
- Each rider has their own name, profile, settings, rides, courses, workouts and backups. Nobody sees another rider's rides.
- Type in the name field to rename yourself.
- **Remove** works only for a rider with nothing saved. A rider's rides are never deleted from this list.
- With more than one rider, the name of whoever is riding shows in the top bar.

### Power zones

Under the FTP field, and on Home: your seven power zones (Z1 Active recovery to Z7 Neuromuscular) with the % FTP range and the watt range at your FTP. Change the FTP and the watts follow. Workout blocks use the same boundaries and colors, so a block's color always matches the chart.

## Heart rate

The Ride tab has a **Heart rate** tile. It reads any standard Bluetooth heart rate sensor: a chest strap, an armband, or an Apple Watch through a relay app.

1. Put the strap on, or start the relay app (below).
2. Press **Connect** in the Heart rate tile. A pop-up card walks through the steps and links the relay apps; press **Connect** on it and pick the sensor in the browser's list. It is a second device, separate from the Kickr. You can do this before or during a ride.
3. The tile shows bpm. Each recorded second with a reading gets heart rate in the FIT file, with average and max on every lap and the ride.

- The sensor never affects the ride. If it drops, the tile grays out and the app retries every 2 seconds; time, recording and the trainer carry on. Seconds with no reading have no heart rate in the file.
- Nothing is recorded before **Start ride**, the same as power.
- **Disconnect** is in the same tile. After a page reload, Chrome needs you to pick the sensor again.
- No zones or targets. The tile is a number.

**Apple Watch.** The watch does not broadcast heart rate on its own. A relay app makes it show up as a standard sensor. None of these has been tested with Rullo yet:

| App | Runs on | Needs |
| --- | --- | --- |
| [HR Broadcast](https://apps.apple.com/us/app/hr-broadcast/id6766073249) | Watch and iPhone | Free. The iPhone nearby with the app open; the phone is what the browser sees. |
| [HeartCast](https://apps.apple.com/us/app/heartcast-heart-rate-monitor/id1499771124) | Watch and iPhone | Free; its paid extras are optional. The phone relays the watch. |
| [HeartBLE](https://apps.apple.com/us/app/heartble-heart-rate-bluetooth/id6758879454) | The watch itself | Paid. watchOS 26 or later. No iPhone in the chain. |

Start the session on the watch (in the relay app). Rullo cannot start it for you; it only listens. A strap works the same way with no app at all.

### Back up and restore

Everything is saved in this browser only. Clearing site data wipes it, and another browser or computer starts empty.

- **Back up** downloads one file (`rullo-backup-<date>.json`) with your finished rides, courses, workouts, profile and settings. About 220 KB per hour ridden. A backup made when the app was called Weem Watts (`weem-watts-backup-<date>.json`) still restores.
- **A reminder:** from 5 rides that are in no backup, Home and the Profile tab say so, with a link to Back up. Pressing Back up clears it. A clean browser that restores a backup counts that file as its backup.
- **Storage in this browser** (same section) shows how much the app uses and whether the browser has agreed not to clear it. **Ask to keep it** asks the browser; it may say no, and a backup file is still the sure way.
- **Restore** reads a backup file and adds the rides, courses and workouts this browser does not have. It never changes or removes anything already here, so restoring twice is safe. Your profile and settings are restored only where this browser has none saved.
- A damaged file, or one that is not a backup, is refused and nothing is changed.
- A ride that was never ended is not in a backup. End it first.
- The file names its rider. A browser with nothing saved becomes that rider on restore, so you stay one rider across a wipe or a new computer.

## Strava

After a ride, **Upload to Strava** sends the ride to your Strava account. It is always a click; nothing is uploaded on its own.

1. **Connect once.** Open **Profile**, scroll to **Strava**, and press **Connect with Strava**. Strava asks you to allow Rullo to upload activities. That is the only permission it asks for; it reads nothing from your account. Leave the box checked and approve.
2. **Ride**, then press **End Ride** and **Confirm end**.
3. Press **Upload to Strava**, beside Download FIT. It reads "Uploading to Strava", then "Strava is processing", then turns into **View on Strava**, a link to the activity.

- **What the activity contains:** the same FIT file Download FIT gives you. Power, cadence, speed, distance, one lap per workout interval, moving time, heart rate if a sensor was connected, work and calories, and elevation on a course. It is posted as a Virtual Ride on a trainer, named after the setup ("Sweet Spot 3x12 on Test Hills", or "Free ride").
- **Turn off Strava's Apple Health import for rides.** If your Apple Watch workouts sync to Strava through Apple Health, each ride will show up twice: once from the watch and once from Rullo. In the Strava app's settings, find the Apple Health connection and turn the automatic workout import off, or delete the watch's copy after each ride. (The exact menu was not checked here; it has moved between app versions.)
- **Uploaded twice?** Strava spots it. The button reads "Already on Strava" with the link.
- **If it fails** the reason is shown in plain words and Download FIT is still there. You can add the file by hand on strava.com (Upload activity, File).
- **Not connected** when you end a ride? The button reads "Connect Strava to upload" and takes you to Profile. After you connect, the ride is waiting on the Ride tab with Upload to Strava.
- **Disconnect** (Profile, Strava) removes the connection from this browser and from your Strava account.
- Rides made with `?fake=1` cannot be uploaded.
- Your Strava sign-in is kept in this browser only. There are no accounts and no database.

Setup for whoever hosts the site is under Deploy.

## ERG mode

Switch the control row from **Resistance** to **ERG** (or press **E**). In ERG you set a target in watts and the Kickr holds it at any cadence or gear.

- Step buttons: -10 / -5 / -1 and +1 / +5 / +10 W. Keys: **Arrow Up / Down** 1 W, **+ / -** 5 W, **Shift + Arrow** 10 W.
- The target also shows as % of your FTP.
- **Low-cadence release:** below 50 rpm for 3 seconds, or stopped (below 20 rpm) for 1 second, ERG lets go so you can spin back up. A ride in ERG starts released.
- **Soft start:** ERG re-engages once you hold 60 rpm for a second, then ramps from your current power to the target over 6 seconds. The same ramp runs when a ride or workout starts in ERG. The status reads "Easing in to target" while it does.
- While released the trainer gets a 25 W target and its minimum resistance level. A command the trainer refuses is sent again 2 seconds later.
- Mode and target are remembered between rides and re-sent after a reconnect.

## Grade mode

On a course with no workout, the control row switches to **Grade** and the trainer follows the hills (FTMS simulation).

- The step buttons set **hill feel**, 0 to 100% (default 50%): how much of the course grade the trainer gets. At 50% a 6% climb feels like 3%. Speed on screen always uses the real grade.
- The grade is smoothed over 2 seconds and sent at most once a second. The Kickr Core can't simulate a descent, so descents ride as flat. The top is 16%.
- Shift gears as you would outside.
- If the trainer has no simulation control, the row says so and falls back to your resistance level.

## Ride a course

1. Before connecting, pick **Flat road** or a course in step 1 of the Workout tab. **Test Hills** is a made-up 12 mi loop for testing.
2. **Start at mile** (in the course's overview) defaults to where your last ride on that course ended. Change it, or press **From the start**.
3. Press **Next**, then **Ride this workout** on a workout, or **Done: go to Ride** for a free ride. The course is on the Ride tab only after that.
4. Connect, then press **Start ride** (or **Start workout**). Speed comes from power and grade: climbs slow you down, descents speed you up. With no workout the trainer follows the hills (Grade mode); with a workout it follows the workout.
5. The FIT file is marked as a virtual ride with elevation, so Strava shows it as a Virtual Ride.

Import your own GPX on the **Profile** tab. An imported course is picked in step 1 of the Workout tab; it is not on the Ride tab until you confirm it there.

### Add a built-in course

1. Put the `.gpx` file in `public/courses/`.
2. Add an entry to `public/courses/index.json`: `id`, `name`, `file`, and an optional `description`.
3. Push. It shows up in everyone's course list after the deploy.

`scripts/make-test-hills.mjs` regenerates the Test Hills file.

## Ride with the Kickr

1. Open https://rullo.vercel.app in Chrome or Edge.
2. Close the Wahoo app and Zwift on your phone and computer. The Kickr allows only one controlling connection.
3. Press **Connect** and pick the Kickr in the browser's device list. The status shows **Not recording**. Power, cadence and speed are live and the trainer already takes your resistance level, ERG target or the course's grade, but time and distance stay at zero and nothing is saved.
4. Press **Start ride** (**Start workout** with a workout loaded). It is the blue button where Connect was. Time, distance and the recording start from zero at that moment. If you forget, the ride is not saved. Pressed while you are not pedaling, the ride starts paused at 0:00 and begins on your first pedal stroke. Press **Disconnect** to back out before Start. You can still change the course or workout on the Workout tab until you press Start.
5. Change resistance with the step buttons (-10 / -5 / -1, +1 / +5 / +10) or keys: **Arrow Up / Down** 1%, **+ / -** 5%, **Shift + Arrow** 10%. Stay in one gear. The level is remembered for next time and re-sent after a reconnect.
6. Stop pedaling and the ride **auto-pauses** after 3 seconds (power and cadence both 0). Time, distance, the workout clock and recording stop; the first pedal stroke resumes. The FIT file marks each pause, so Strava shows moving time. If you stop and never resume, the file ends where you stopped pedaling.
7. Press **End Ride**, then **Confirm end**. The FIT file downloads. It carries power, cadence, speed, distance, laps, heart rate if a sensor was connected, and work and calories from your power (1 kJ of work counts as 1 kcal). Upload it to Strava or Garmin Connect.

If the trainer drops, the app retries every 2 seconds, up to 30 times. After a page reload, Chrome needs you to pick the trainer again.

## How it works

| File | Job |
| --- | --- |
| `src/config.ts` | Profile defaults, drag by position, rolling resistance, ERG limits, timeouts |
| `src/lib/ble.ts` | Web Bluetooth connect and reconnect loop, and the ERG release sequence (a low ERG target, then minimum resistance) |
| `src/lib/ftms.ts` | FTMS parsing, the control point queue (Request Control, Reset, Set Target Resistance, Set Target Power), resistance range |
| `src/lib/cyclingPower.ts` | Cycling Power fallback, cadence from crank revolutions |
| `src/lib/heartRate.ts` | Heart rate sensor: the standard Heart Rate service, its own connection and reconnect loop |
| `src/lib/fakeTrainer.ts` | `?fake=1` trainer |
| `src/lib/fakeHeartRate.ts` | `?fake=1` heart rate sensor |
| `src/lib/strava.ts` | Strava in the browser: sign-in, the tokens kept here, upload and waiting for Strava to process |
| `api/strava/*.js`, `server/strava.js` | The only server code: four small Vercel functions that hold the Strava client secret (see Deploy) |
| `src/lib/physics.ts` | Speed from power and grade, with a light indoor inertia and a 4 s coast-down |
| `src/lib/profile.ts` | Rider profile (weights, position, FTP), saved in the browser |
| `src/lib/gpx.ts` | Reads GPX track points |
| `src/lib/course.ts` | Course model: distance along the slope, two-pass 75 m elevation smoothing, grade over 50 m |
| `src/lib/courses.ts` | Built-in courses plus imported ones (IndexedDB) |
| `src/lib/ride.ts` | Ride state, smoothing, stale detection, auto-pause, time and distance from timestamps |
| `src/lib/recorder.ts` | One sample per wall-clock second to IndexedDB (Dexie); skipped seconds are filled when the gap is 3 s or less. Every saved ride, course and workout is stamped with its rider, and every read returns only that rider's |
| `src/lib/rider.ts` | The riders on this browser and who is riding: add, switch, rename, remove. Switching swaps the profile and settings in place and reloads (see `docs/riders.md`) |
| `src/lib/history.ts` | Ride history for the Home tab: each finished ride's time, distance, power and climbing from its saved samples, with the FIT writer's own totals; worked out once per ride, then kept in localStorage so Home opens at once |
| `src/lib/rideDetail.ts` | One finished ride in full for its summary: totals, bests, time in zone and the per-second lines |
| `src/lib/backup.ts` | Back up and restore: one JSON file, checked field by field on the way in; restore only adds |
| `src/lib/fit.ts` | FIT file writer: records (with heart rate when there is a sensor), one lap per workout interval, timer stop / start events around pauses, work and calories on every lap and the ride |
| `src/lib/wakeLock.ts` | Keeps the screen on while riding |
| `src/lib/customWorkouts.ts` | Workouts built in the app: stored step lists, cleaned and validated on load |
| `src/lib/workoutDraft.ts` | The workout builder's draft: field parsing, checks, kept in the browser |

Speed comes from power on a flat road, not from the trainer, so it reads the same in any gear. Set your weights and position in **Profile**.

## Deploy

Hosted on Vercel at https://rullo.vercel.app. The GitHub repo is connected, so every push to `main` deploys automatically. The app used to live at `weem-watts.vercel.app`. Rides are saved per address, so rides made there do not show up here: on the old address, open **Profile** and press **Back up**, then press **Restore** on the new one. Vercel detects Vite: build `npm run build`, output `dist`.

The app runs entirely in the browser, with one exception: Strava upload. Strava's sign-in needs a client secret that must not reach a browser, so four small functions in `/api/strava` do that part. They keep nothing: no database, no accounts, no logs of tokens or rides. Everything else works without them.

**To turn Strava upload on:**

1. Create an API application at https://www.strava.com/settings/api. Set **Authorization Callback Domain** to `rullo.vercel.app`.
2. In the Vercel project, open Settings, Environment Variables, and add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` from that page, for Production. Never put the secret in a file, a commit or a chat.
3. Redeploy (Deployments, the latest one, Redeploy), so the functions see the variables.

Without the variables the Profile tab reads "Strava upload is not set up yet" and the upload button does not show.

A new Strava application can connect one athlete, its owner ("single player mode"). More riders need Strava's review.

`npm run dev` and `npm run preview` do not run the functions, so Strava reads as not set up there. `vercel dev` runs them.
