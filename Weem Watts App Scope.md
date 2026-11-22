# Weem Watts App Scope

A free, browser-based indoor cycling app for the Wahoo Kickr Core 2. Built to replace a Zwift subscription and to train on the Ironman Montana bike course at home.

## Why it exists

- Ride the real bike indoors with clip-in shoes instead of the Peloton
- No Zwift ($19.99/mo) and no ROUVY ($19.99/mo), which holds the official IRONMAN course deal
- Fill the open gap: no free tool lets you rehearse a specific race course, run ERG on that course, or float course-aware numbers over a movie
- Long-term: "I want to ride my Ironman course on my Wahoo, for free"

## Build decisions

- **Platform:** Web app hosted on Vercel, opened in Chrome or Edge on desktop
- **Stack:** Vite + React + TypeScript + Tailwind, with shadcn/ui restyled to the design system. Plain HTML ruled out (rebuild later); Next.js ruled out until server features are needed.
- **Connection:** Web Bluetooth over FTMS, with Cycling Power as a fallback. No Wahoo proprietary protocol.
- **Repo:** GitHub repo "weem-watts" connected to Vercel
- **Design system:** [Weem Watts Design System](https://claude.ai/artifact/MwUnE5KEPgbmD8FAaiLfcs). Claude Code reads its README and tokens before writing any UI. The design prompt also writes DESIGN.md into the repo, and CLAUDE.md points to it.
- **Design rules in short:** warm light theme (off-white page, white panels), Archivo for everything, live power as the one big number in Cobalt (#1F4FD1), color only for actions, channels and states, no gradients, blur, purple or emoji. Switched from dark graphite and Ember orange on Nov 19, 2026.
- **Code reuse:** borrow only from MIT or Apache-2.0 repos (GPX Rider, Croissant Ride, serpentine). Read AGPL code (Auuki, OpenRadlr) and unlicensed code (ride-hud) for ideas only.
- **Units:** Miles
- **Not building:** 3D worlds, multiplayer, accounts
- **Server:** none, with one exception made on Nov 21, 2026: four stateless Vercel functions for Strava upload (see Strava upload below). Nothing else may depend on a server
- **Approach:** Build for personal use first. No accounts or sharing until it has been used through the winter.

## Phases

### v1: Live numbers (shipped Nov 19, 2026)

- Connect to the Kickr over FTMS: Request Control, then Reset
- Live power with a 1s / 3s / 10s toggle (3s default), cadence, speed, distance in miles, elapsed time
- Speed calculated from power on a flat road, so it stays consistent in any gear
- Auto-reconnect every 2 seconds, up to 30 tries. Gray out the numbers and show "Reconnecting" instead of freezing them
- Screen wake lock, a sample saved every second to IndexedDB, and FIT file download
- Time from timestamps, not timers, so a background tab doesn't drift
- A fake trainer for building without the bike
- **Cut:** accounts, heart rate, settings pages, themes, Strava
- **Done when:** open the link, connect the Kickr, ride 10 minutes with every number updating, and download the ride as a FIT file

### v1.5: Manual resistance (shipped Nov 19, 2026)

Ride in one gear and change resistance by hand, the way Nate rides indoors.

- FTMS Set Target Resistance Level (0x04): Request Control again after Reset, read the trainer's supported range (0x2AD6), and map it to 0 to 100%
- Direct step buttons on the ride screen: -10 / -5 / -1 and +1 / +5 / +10. Keys: arrows 1%, + / - 5%, Shift + arrows 10%
- Show the current level. Re-send it after every reconnect, and only send the latest level when the rider taps quickly
- Remember the last level between rides
- A clear message if the trainer doesn't support resistance control (Cycling Power fallback can't)
- The fake trainer responds to resistance so it can be built without the bike
- **Cut:** ERG, workouts, SIM, resistance in the FIT file
- **Done when:** in one gear, tapping plus makes the pedals noticeably harder within a second, and power rises at the same cadence

### v2: Race course

- Course picker before connecting: Free ride (flat road, as in v1) or a course. Each course shows distance and climbing
- Built-in courses ship with the app (`public/courses/`). Start with a generated "Test Hills" course; add an unofficial Montana file when one is found (112-mile single loop from Great Falls, about 3,000 ft of climbing, race Aug 15, 2027)
- Import any GPX from the computer; imported courses are saved in the browser and listed next time
- Elevation profile with a moving position dot as the main course view, plus current grade, miles to go and climbing done
- Speed from power and grade, and distance that accounts for elevation
- Smooth elevation over about 75 m so grades don't spike
- Resume anywhere: pick a start mile, defaulting to where the last ride on that course ended ("continue from mile 47 tomorrow")
- FIT file gets altitude and the virtual sub-sport (Strava: Virtual Ride). No GPS positions yet
- Manual resistance stays as in v1.5. Climbs slow the on-screen speed but the trainer does not change resistance
- **Cut:** 2D map, GPS in the FIT file, trainer control from grade (v4)
- **Done when:** pick Test Hills, ride it with the fake trainer and the Kickr, watch the dot move and speed drop on climbs, stop mid-course, resume from that mile the next ride, and download a FIT that Strava shows as a Virtual Ride with elevation

### v3: Race Rehearsal (the main feature)

Split into three releases, each rideable on its own.

#### v3.1: ERG mode and rider profile

- Rider profile, saved in the browser (no account): rider weight (lb), bike weight (lb), riding position (hoods, drops or aero, which sets drag) and FTP (W). Replaces the constants in `src/config.ts`; speed and distance read from it. Editable only between rides. Changing it never rewrites past rides
- ERG mode: FTMS Set Target Power. One-tap switch between Resistance and ERG; in ERG the step buttons change target watts and show % of FTP
- Low-cadence release: below 50 rpm for 3 seconds ERG lets go; it re-engages at 60 rpm. A ride in ERG starts released until the rider reaches 60 rpm. Changed Nov 20, 2026 after the first ride: a full stop releases after 1 second, re-engage needs 60 rpm held for 1 second, and the target ramps in over 6 seconds
- Target re-sent after every reconnect; mode and target remembered between rides
- Fake trainer follows ERG and can simulate low cadence
- **Done when:** in ERG at a fixed target, changing cadence or gear keeps power within about 10 W of target; dropping below 50 rpm releases the load and spinning back up re-engages it

#### v3.2: Workouts (built Nov 19, 2026; ride test pending)

- Workout = list of steps (duration plus target in % FTP or watts, steady or ramp, repeats)
- Built-in workouts: Endurance 60, Sweet Spot 3x12, VO2 5x3, Ramp FTP test, plus Nate's ZWO files in `public/workouts/`; ZWO import saved in the browser
- Workout screen: current interval, time left, next target, strip of all intervals labeled with their watts. ERG follows the workout
- Course and workout picking live on their own Workout tab; the Ride tab is live data only. Since Nov 20, 2026 the tab is two steps (1. Choose your course, 2. Choose your workout, with difficulty and length filters) and GPX / ZWO import moved to the Profile tab
- A picked workout loads on the Ride tab and waits for Start workout. Since Nov 20, 2026 nothing is recorded until Start (Start ride on a free ride): pedaling before it shows live numbers only, and the FIT begins at Start with the workout's first step as lap 1
- Each interval is a lap in the FIT file
- Decision reversed (Nov 20, 2026): a workout can now run on a course. A course is where you ride (elevation, speed, distance); a workout is what the trainer does (power targets). Pick one of each, or neither. With both, the workout drives ERG and the course drives speed, distance and the profile; the FIT is a virtual ride with altitude and one lap per interval
- Decisions (Nov 19, 2026): ~~free rides only (targets on a course are v3.3)~~; step buttons change overall intensity (50 to 150%); ramp test instead of a 20-minute test, with a one-tap "Set FTP"; when the workout ends ERG holds the cool-down watts until End Ride
- **Cut:** drag-and-drop builder (stretch feature); step-list editor (moved to Later, then built Nov 20, 2026: see Workout builder below); TSS, IF and automatic zones
- **Done when:** ride Sweet Spot 3x12 on the Kickr with ERG changing at each interval, finish a ramp test and set FTP from it, and see one lap per interval in the FIT on Strava

#### v3.3: Race plan on a course

Since Nov 20, 2026 a workout can run on a course, so the race plan becomes a workout generated from the course (one interval per section) instead of a separate player.

- Course auto-split into climbs, flats and descents, each with an editable target (% FTP or watts)
- ERG on the course follows the plan for the current section
- Ahead or behind plan, plus a predicted bike split for the whole course at planned power
- Ghost of your last attempt on the same course

### v4: Real climbs

**Started early, Nov 20, 2026 (Nate's call, before the v3.2 ride test):** Grade mode. On a course with no workout the trainer follows the hills through FTMS simulation: grade smoothed over 2 seconds, held to 0 to 16%, with a hill feel of 0 to 100% (default 50%) set by the step buttons. With a workout, the workout sets the load in ERG. Still to do from the list below: a ride test on the Kickr, and deciding whether feel needs its own slider.

- SIM mode: grade averaged over 2 seconds and clamped to 0 to 16% (the Core 2 limit), with a "gradient feel" slider
- Descents use calculated speed, since the Core 2 can't simulate downhill
- No app-side gearing needed: the Kickr has a regular cassette, so shifting works normally in SIM mode

### Workout builder (built Nov 20, 2026; ride test pending)

Moved out of "Later" on Nov 20, 2026 at Nate's request, ahead of the v3.2 ride test. Laid out after Zwift's workout editor (block palette, a graph to click and drag on, fields above the selected block), with the step list as a second view and cadence cues; decisions and cuts are in `docs/workout-builder.md`.

- Build a workout from nothing, or from a copy of any workout: steady, ramp and repeat steps, time, target in % FTP or watts, cadence cue, label, name, difficulty
- Saved in the browser as the app's own step list; listed in step 2 of the Workout tab and under "Your files" on the Profile tab
- Cadence is a cue for the rider (workout row and Cadence tile); ZWO import now reads it. The trainer never gets it
- **Cut:** ZWO export, free-ride blocks, text events, TSS / IF, text syntax
- **Done when:** build a workout by keyboard, ride it on the Kickr with ERG changing at each step, and see one lap per interval in the FIT

### Home tab and power zones (built Nov 20, 2026; no ride test needed)

Asked for by Nate on Nov 20, 2026, ahead of the v3.2 ride test. No trainer code changed. Laid out after Zwift's home screen (a left rail with the rider, a main column of cards), drawn with this system's tokens; decisions are in `docs/home-tab.md`.

- Home is the first tab and where the app opens (`#/`). The Ride tab moved to `#/ride`
- Rider summary (FTP, weight in lb), power zones chart (Z1 to Z7 with % FTP and watts), totals from saved rides (all rides and the last 7 days: rides, time, miles, feet climbed, best 20-minute power), and ride history with Download FIT and Delete on each ride
- One primary button: Set up a ride, or Go to Ride once a setup is on the Ride tab
- The zones chart is also on the Profile tab under the FTP field. Zone boundaries live in one list that the chart, the workout strip and the builder all use
- Read from the rides already saved in the browser. No new table, no server; a small summary per ride is kept in localStorage so Home opens at once
- Added Nov 21, 2026, from `docs/zwift-accounts-profile-flow-research.md` (items 1, 3 in part and 6 of its build list): a ride summary opened from a history row (numbers, power / cadence / heart rate / elevation lines, time in zone), power bests at 5 s, 1, 5 and 20 min with PR tags, and back up and restore of everything in one file
- **Cut:** W/lb (it needs kg to mean anything), TSS / IF and normalized power, weekly goal and streak, the summary taking over the Ride tab after End Ride, rename, undo for delete, a rider picker, placeholders for anything not built
- **Groundwork for other riders:** a rider id on every saved record was built Nov 21, 2026 (`docs/riders.md`): one rider per browser, nothing visible, every read and write goes through it. The rider picker followed the same day ("Who's riding" on the Profile tab: add, switch, rename, remove a rider with nothing saved; profile and settings per rider). Still not built: optional sign-in that only syncs (this is where a backend such as Supabase would come in). The backup file is the shape a sync would send

### Heart rate (built Nov 20, 2026; ride test pending)

Moved out of "Stretch features" on Nov 20, 2026 at Nate's request (v1 had cut it). Decisions are in `docs/heart-rate-and-strava.md`.

- Any standard Bluetooth heart rate sensor (Heart Rate service 0x180D): a strap, an armband, or an Apple Watch through a relay app (HeartBLE, HeartCast, HR Broadcast)
- A second device with its own connection. It never pauses the ride, stops recording or changes trainer control
- Its own tile on the Ride tab, saved with each one-second sample, and written to the FIT file (records, laps, session)
- **Cut:** heart rate zones, targets, HR-driven ERG, a native watch or phone app
- **Done when:** ride with the Kickr and the watch, see bpm on the tile for the whole ride, and see heart rate on the activity after uploading the FIT

### Strava upload (built Nov 21, 2026; first real upload pending)

Moved out of "Later" on Nov 21, 2026 at Nate's request. It had been parked on Nov 19 because it needs a server function to keep the Strava client secret, and the guardrails hold server features until going public is a real decision. **Nate made an exception for Strava upload only.** Decisions are in `docs/heart-rate-and-strava.md`.

- One click after End Ride: Upload to Strava sends the same FIT as Download FIT (power, laps, heart rate, calories) as a Virtual Ride with the trainer flag, named from the setup. Never on its own
- Connect and Disconnect on the Profile tab. OAuth with the smallest scope that can upload (`activity:write`). Nothing is read from Strava
- The server part is as small as it can be: four stateless Vercel functions in `/api/strava` (is it set up, trade the sign-in code or refresh a token, revoke, pass the FIT on and report its status). No database, no accounts, no logs of tokens or rides. The secret lives only in Vercel's environment variables
- The athlete's tokens are kept in the rider's own browser, like the profile and rides
- Rides from the fake trainer cannot be uploaded: the file carries a mark and the function refuses it
- Single Player Mode covers personal use: a new Strava app can connect its owner only
- **Cut:** upload without a click, Garmin and TrainingPeaks, reading any activity data back from Strava, accounts, a database, uploading old rides from the Home tab
- **Done when:** ride with the Kickr and a heart rate sensor, press End Ride, press Upload to Strava, and see the complete activity on Strava

### Later: Movie Mode overlay

Moved down the road on Nov 19, 2026. Not scheduled; pick it up after v4 or when it earns its place.

- Floating always-on-top window using Chrome's Document Picture-in-Picture: watts, cadence, miles
- "Hide numbers" toggle that keeps recording
- **Test first:** does the window float over fullscreen Netflix on Windows

## Research takeaways

The angle is open: no free tool rehearses a specific race course. ROUVY holds the IRONMAN course deal behind $19.99/mo and no Montana course was found there.

- **Closest products:** MINI WATT ($1.99/mo desktop overlay) and Croissant Ride (free browser app with a mini window). Neither knows the course. Cycloscape's race pacing is paid only.
- **Top complaints to avoid:** frozen numbers after a dropout, ERG spirals at low cadence, competing connections (close the Wahoo app first), noisy GPX grades.
- **Chrome limit:** after a page reload the rider has to pick the trainer again. Reconnecting without a reload works. Since Nov 22, 2026 a Rullo pairing step comes before the browser's device list, and the list is skipped where the browser can hand the trainer back (two Chrome flags today): see `docs/pairing.md`.
- **Strava rules:** the client secret stays in a Vercel function, and Strava data can't be used with AI. (The app reads no Strava data at all, so there is none to use.)
- **Open questions:** Does the overlay float over fullscreen Netflix? Does ROUVY have Montana somewhere?

### Code to borrow

| Pattern | Source | License |
| --- | --- | --- |
| FTMS data parsing | serpentine ftms.ts, GPX Rider trainer.mjs | MIT |
| Request Control, Reset, one write at a time | GPX Rider, Croissant Ride ftms.ts | MIT / Apache-2.0 |
| Reconnect loop and re-send target | Croissant Ride ble.ts, trainer.ts | Apache-2.0 |
| Movie Mode window | Croissant Ride mini.ts | Apache-2.0 |
| Low-cadence ERG release | Croissant Ride main.ts | Apache-2.0 |
| Per-second autosave | Croissant Ride recorder.ts, Dexie for IndexedDB | Apache-2.0 |
| Speed from power and grade | serpentine physics.ts | MIT |
| GPX parsing and grade smoothing | GPX Rider route.mjs, @tmcw/togeojson | MIT / BSD-2 |
| FIT file writer | GPX Rider fit.mjs, Croissant Ride fit.ts | MIT / Apache-2.0 |
| Fake trainer | wklenk demo service | Apache-2.0 |

Keep Apache-2.0 notices in copied files.

## Stretch features (if it goes public)

Not in scope now. This is the ceiling for how big it could get.

### Courses

- Library of Ironman and 70.3 bike courses ready to ride
- Upload any GPX or pick a course from Strava or Ride with GPS
- Street View or photo images along the route at your current position
- Elevation profile with upcoming climbs called out

### Training

- Drag-and-drop workout builder
- Import workouts from common file formats used by other training apps
- FTP test built in, with power zones set automatically
- Training plans that build toward a race date
- Race-day pacing plan for a specific course based on FTP

### Smart coaching

- AI coach that adjusts the day's workout based on HRV, resting heart rate, and sleep
- Post-ride summary with what went well and what to change
- Heart rate zones (the sensor itself was built Nov 20, 2026: see Heart rate above)

### Social

- Ride a course live with a friend and see each other on the map
- Course leaderboards and personal bests per segment
- Share a ride summary card

### Platform

- User accounts and cloud ride history
- Auto-upload to Strava, Garmin, and TrainingPeaks
- Support for other smart trainers beyond Wahoo
- Installable app on desktop and tablet. iPhone and iPad support so other people can connect their Kickr (Web Bluetooth does not work there, so this needs a native app or a workaround browser like Bluefy). Mac already works in Chrome or Edge; Safari users would need a prompt to switch browsers

## Scope guardrails

- Ship each phase before starting the next
- Every stretch feature has to earn its place after real use
- If a feature needs servers or accounts, it waits until going public is a real decision. One exception, Nov 21, 2026: the stateless functions for Strava upload. It is not a precedent: no database, no accounts, and nothing else in the app may depend on a server
- Never copy AGPL or unlicensed code into the repo
- No AI features built on Strava data
