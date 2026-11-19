# Weem Watts

A free browser app for riding a Wahoo Kickr Core 2. v1 shows live power, cadence, speed, distance, and time, saves every second to the browser, and exports a FIT file.

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

Open http://localhost:5173/?fake=1 and press **Connect**. A fake trainer sends power and cadence once a second.

- Press **D** to drop data for 5 seconds. The numbers gray out and the status shows "Reconnecting", then recover.
- Press **End Ride** twice (the second click confirms) to end and download the FIT file.
- Reload mid-ride to test crash recovery: an "Unfinished ride found" bar offers Resume or End and download.

## Ride with the Kickr

1. Close the Wahoo app and Zwift on your phone and computer. The Kickr allows only one controlling connection.
2. Press **Connect** and pick the Kickr in the browser's device list.
3. Start pedaling. The timer starts on the first pedal stroke.
4. Press **End Ride**, then **Confirm end**. The FIT file downloads. Upload it to Strava or Garmin Connect.

If the trainer drops, the app retries every 2 seconds, up to 30 times. After a page reload, Chrome needs you to pick the trainer again.

## How it works

| File | Job |
| --- | --- |
| `src/config.ts` | Rider and bike weight (lb), drag, rolling resistance, timeouts |
| `src/lib/ble.ts` | Web Bluetooth connect and reconnect loop |
| `src/lib/ftms.ts` | FTMS parsing and the Request Control / Reset control point queue |
| `src/lib/cyclingPower.ts` | Cycling Power fallback, cadence from crank revolutions |
| `src/lib/fakeTrainer.ts` | `?fake=1` trainer |
| `src/lib/physics.ts` | Flat-road speed from power, with inertia |
| `src/lib/ride.ts` | Ride state, smoothing, stale detection, time and distance from timestamps |
| `src/lib/recorder.ts` | One sample per second to IndexedDB (Dexie) |
| `src/lib/fit.ts` | FIT file writer |
| `src/lib/wakeLock.ts` | Keeps the screen on while riding |

Speed comes from power on a flat road, not from the trainer, so it reads the same in any gear. Edit `RIDER_WEIGHT_LB` and `BIKE_WEIGHT_LB` in `src/config.ts` for a different rider.

## Deploy

Connect the GitHub repo to Vercel. It detects Vite: build `npm run build`, output `dist`. No environment variables.
