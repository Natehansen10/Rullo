# Weem Watts

A free browser app for riding a Wahoo Kickr Core 2. It shows live power, cadence, speed, distance, and time, lets you change resistance while riding in one gear, rides GPX courses with an elevation profile, saves every second to the browser, and exports a FIT file.

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
- Press **D** to drop data for 5 seconds. The numbers gray out and the status shows "Reconnecting", then recover.
- Press **End Ride** twice (the second click confirms) to end and download the FIT file.
- Reload mid-ride to test crash recovery: an "Unfinished ride found" bar offers Resume or End and download.

## Ride a course

1. Before connecting, pick **Free ride** or a course in the Course panel. **Test Hills** is a made-up 12 mi loop for testing.
2. **Start at mile** defaults to where your last ride on that course ended. Change it, or press **From the start**.
3. Connect and ride. Speed comes from power and grade: climbs slow you down, descents speed you up. The trainer does not change resistance with grade yet (that's v4), so use the resistance buttons on climbs.
4. The FIT file is marked as a virtual ride with elevation, so Strava shows it as a Virtual Ride.

**Import GPX** loads any GPX file from your computer. It's saved in this browser and listed next time. **Remove** deletes an imported course.

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
6. Press **End Ride**, then **Confirm end**. The FIT file downloads. Upload it to Strava or Garmin Connect.

If the trainer drops, the app retries every 2 seconds, up to 30 times. After a page reload, Chrome needs you to pick the trainer again.

## How it works

| File | Job |
| --- | --- |
| `src/config.ts` | Rider and bike weight (lb), drag, rolling resistance, timeouts |
| `src/lib/ble.ts` | Web Bluetooth connect and reconnect loop |
| `src/lib/ftms.ts` | FTMS parsing, the control point queue (Request Control, Reset, Set Target Resistance), resistance range |
| `src/lib/cyclingPower.ts` | Cycling Power fallback, cadence from crank revolutions |
| `src/lib/fakeTrainer.ts` | `?fake=1` trainer |
| `src/lib/physics.ts` | Speed from power and grade, with inertia |
| `src/lib/gpx.ts` | Reads GPX track points |
| `src/lib/course.ts` | Course model: distance along the slope, two-pass 75 m elevation smoothing, grade over 50 m |
| `src/lib/courses.ts` | Built-in courses plus imported ones (IndexedDB) |
| `src/lib/ride.ts` | Ride state, smoothing, stale detection, time and distance from timestamps |
| `src/lib/recorder.ts` | One sample per second to IndexedDB (Dexie) |
| `src/lib/fit.ts` | FIT file writer |
| `src/lib/wakeLock.ts` | Keeps the screen on while riding |

Speed comes from power on a flat road, not from the trainer, so it reads the same in any gear. Edit `RIDER_WEIGHT_LB` and `BIKE_WEIGHT_LB` in `src/config.ts` for a different rider.

## Deploy

Hosted on Vercel at https://weem-watts.vercel.app. The GitHub repo is connected, so every push to `main` deploys automatically. Vercel detects Vite: build `npm run build`, output `dist`. No environment variables.
