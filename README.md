# Weem Watts

A free browser app for riding a Wahoo Kickr Core 2. It shows live power, cadence, speed, distance, and time, lets you change resistance or hold a target power (ERG) while riding in one gear, rides GPX courses with an elevation profile, runs structured workouts in ERG (built-ins or imported ZWO files), saves every second to the browser, and exports a FIT file.

**Live:** https://weem-watts.vercel.app

**Try it without the bike:** https://weem-watts.vercel.app/?fake=1

Chrome or Edge on desktop only (needs Web Bluetooth).

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

Open http://localhost:5173/?fake=1 and press **Connect**. A fake trainer sends power and cadence once a second. The first 3 seconds are 0 W (rider getting on), so you see the Ready state before the ride starts.

- Change resistance with the step buttons or keys. Fake power rises and falls with it.
- In **ERG**, fake power follows the target. Press **C** to drop cadence to 40 rpm for 6 seconds and watch ERG release, re-engage and ease back in. Like a Kickr Core 2 is reported to, the fake trainer refuses a resistance level while stopped, so restarts show the 25 W fallback and the retry.
- Press **S** to stop pedaling until you press it again. After 3 seconds the ride auto-pauses; the status shows "Paused" and time, distance and recording stop. Press **S** again and the fake rider spins back up from 0 rpm.
- Press **J** (or open `?fake=1&jitter=1`) for jittery delivery: readings arrive 0.3 to 2.6 s apart. The FIT file should still have a record every second.
- Press **D** to drop data for 5 seconds. The numbers gray out and the status shows "Reconnecting", then recover.
- Press **End Ride** twice (the second click confirms) to end and download the FIT file.
- On the **Workout** tab pick **Test Intervals** (2 minutes) to watch ERG follow each interval, or **Test Ramp** and press **C** mid-ramp to fail the test and get an FTP estimate. These two show only with `?fake=1`.
- Reload mid-ride to test crash recovery: an "Unfinished ride found" bar offers Resume or End and download.

## Workouts

Open the **Workout** tab before connecting. It is two steps:

1. **Choose your course.** A flat road or a course. Click a course to open its overview (distance, climbing, low and high points, the elevation profile) and set the start mile. Press **Next**.
2. **Choose your workout.** A free ride or a workout. Filter by **Difficulty** (easy, medium, hard) and **Length** (15 min, 30 min, 45 min, 1 h, 1.5 h, 2 h+). Click a workout to open its description and interval strip. Press **Done** to go to the Ride tab.

What sets the load:

| Setup | Trainer mode | The load comes from |
| --- | --- | --- |
| Course + workout | ERG | the workout's targets; the course sets speed, distance and the profile |
| Course + free ride | Grade | the course's hills (see Grade mode below) |
| Flat road + workout | ERG | the workout's targets |
| Flat road + free ride | Resistance or ERG | you |

The mode is picked for you and you can always switch it on the Ride tab (or press **E**).

Built-ins: Endurance 60, Sweet Spot 3x12, VO2 5x3, a Ramp FTP test, and the ZWO files in `public/workouts/`: FRNKLN - January 6, five 15-minute rides (Quick 15: Recovery Flush, Zone 2 Spin, Ironman Race Pace, Tempo Bursts, Sweet Spot Hit), five easy rides (Long Haul III, The Causeway IV, The Levee IV, The Long Road V, Coastal Cruise V), five medium (The Forge IV, Sweat Factory V, Copper Wire IV, Over the Top V, The Rolling Mill V) and five hard (Hour of Power V, The Heat V, The Smelting Pot IV, The Millstone V, Critical Mass IV).

**Your own files:** Import GPX and Import ZWO are on the **Profile** tab, under "Your files". Imports are saved in this browser and listed there with Remove.

To add a built-in ZWO: put the file in `public/workouts/` and add `{ "id": "...", "file": "....zwo" }` to `public/workouts/index.json`. An optional `"tag"` of `easy`, `medium` or `hard` puts it under that Difficulty filter.

- A picked workout loads on the Ride tab but doesn't start on its own. Connect, warm up as long as you like (a free ride: your own ERG target or resistance), then press **Start workout**. That switches to ERG and the trainer follows each interval.
- In ERG the step buttons and keys change workout intensity (every target, 50 to 150%). In Resistance the workout keeps running but targets aren't applied.
- **Skip interval** jumps ahead. In the ramp test, dropping below 50 rpm (or **End test**) ends the test, starts the cool-down and offers **Set FTP**.
- When the workout ends, ERG holds the cool-down watts until you press End Ride.
- Each interval is a lap in the FIT file.

## Profile

Open the **Profile** tab (`#/profile`) and set rider weight, bike weight, FTP, and riding position (hoods, drops or aero). Speed and distance use these. The profile is saved in this browser and applies to your next ride; past rides don't change.

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
3. Connect and ride. Speed comes from power and grade: climbs slow you down, descents speed you up. With no workout the trainer follows the hills (Grade mode); with a workout it follows the workout.
4. The FIT file is marked as a virtual ride with elevation, so Strava shows it as a Virtual Ride.

Import your own GPX on the **Profile** tab.

### Add a built-in course

1. Put the `.gpx` file in `public/courses/`.
2. Add an entry to `public/courses/index.json`: `id`, `name`, `file`, and an optional `description`.
3. Push. It shows up in everyone's course list after the deploy.

`scripts/make-test-hills.mjs` regenerates the Test Hills file.

## Ride with the Kickr

1. Open https://weem-watts.vercel.app in Chrome or Edge.
2. Close the Wahoo app and Zwift on your phone and computer. The Kickr allows only one controlling connection.
3. Press **Connect** and pick the Kickr in the browser's device list. The status shows **Ready**.
4. Start pedaling. The timer starts on the first pedal stroke. Spinning the flywheel by hand reads 0 W and does not start a ride. Press **Disconnect** to back out before pedaling.
5. Change resistance with the step buttons (-10 / -5 / -1, +1 / +5 / +10) or keys: **Arrow Up / Down** 1%, **+ / -** 5%, **Shift + Arrow** 10%. Stay in one gear. The level is remembered for next time and re-sent after a reconnect.
6. Stop pedaling and the ride **auto-pauses** after 3 seconds (power and cadence both 0). Time, distance, the workout clock and recording stop; the first pedal stroke resumes. The FIT file marks each pause, so Strava shows moving time. If you stop and never resume, the file ends where you stopped pedaling.
7. Press **End Ride**, then **Confirm end**. The FIT file downloads. Upload it to Strava or Garmin Connect.

If the trainer drops, the app retries every 2 seconds, up to 30 times. After a page reload, Chrome needs you to pick the trainer again.

## How it works

| File | Job |
| --- | --- |
| `src/config.ts` | Profile defaults, drag by position, rolling resistance, ERG limits, timeouts |
| `src/lib/ble.ts` | Web Bluetooth connect and reconnect loop, and the ERG release sequence (a low ERG target, then minimum resistance) |
| `src/lib/ftms.ts` | FTMS parsing, the control point queue (Request Control, Reset, Set Target Resistance, Set Target Power), resistance range |
| `src/lib/cyclingPower.ts` | Cycling Power fallback, cadence from crank revolutions |
| `src/lib/fakeTrainer.ts` | `?fake=1` trainer |
| `src/lib/physics.ts` | Speed from power and grade, with a light indoor inertia and a 4 s coast-down |
| `src/lib/profile.ts` | Rider profile (weights, position, FTP), saved in the browser |
| `src/lib/gpx.ts` | Reads GPX track points |
| `src/lib/course.ts` | Course model: distance along the slope, two-pass 75 m elevation smoothing, grade over 50 m |
| `src/lib/courses.ts` | Built-in courses plus imported ones (IndexedDB) |
| `src/lib/ride.ts` | Ride state, smoothing, stale detection, auto-pause, time and distance from timestamps |
| `src/lib/recorder.ts` | One sample per wall-clock second to IndexedDB (Dexie); skipped seconds are filled when the gap is 3 s or less |
| `src/lib/fit.ts` | FIT file writer: records, one lap per workout interval, timer stop / start events around pauses |
| `src/lib/wakeLock.ts` | Keeps the screen on while riding |

Speed comes from power on a flat road, not from the trainer, so it reads the same in any gear. Set your weights and position in **Profile**.

## Deploy

Hosted on Vercel at https://weem-watts.vercel.app. The GitHub repo is connected, so every push to `main` deploys automatically. Vercel detects Vite: build `npm run build`, output `dist`. No environment variables.
