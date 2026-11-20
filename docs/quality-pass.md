# Quality pass (Nov 20, 2026)

A pass over UI, bugs, code and security after the ride fixes shipped. No features added.

Severity: **High** loses data or hangs the app. **Medium** shows something wrong or blocks a control. **Low** is polish.

Each fixed bug was reproduced in headless Chromium against the build before the fix, then re-run after.

## Bugs

| # | Sev | File | Finding | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | High | `src/lib/zwo.ts` | A ZWO with `Repeat="100000000"` hung the page (repeats were expanded without a limit). Reproduced: page frozen for 8 s and counting. | Interval count is capped at 2,000 and checked before anything is expanded. After: "Import failed: The workout has more than 2000 intervals." in 0.3 s. | Fixed |
| 2 | High | `src/lib/ride.ts` | With IndexedDB unavailable, a ride ran normally, then End Ride did nothing: no file, no message, and unhandled promise rejections. | The rider is told at the first pedal stroke that the ride isn't being saved. End Ride and Download FIT no longer throw. | Fixed |
| 3 | Medium | `src/lib/ride.ts` | Failing a ramp test by stopping (the normal way to fail one): auto-pause put the workout clock back into the ramp. The row showed "Ramp, 140 W" when it should show "Cool-down, 90 W". Same for Skip interval pressed in the 3 s before a pause. Introduced by auto-pause in this round. | A deliberate jump of the workout clock also moves the pause's restore point. | Fixed |
| 4 | Medium | `src/lib/course.ts` | A GPX with many missing elevations took 7.5 s to import (80,000 points, half without elevation). The gap fill searched the whole list per point. | One pass each way. After: 1.3 s. | Fixed |
| 5 | Medium | `src/App.tsx`, `Stepper.tsx` | The control row wrapped to two lines with longer status text ("Released...", "applies when connected"), pushing the panel 24 to 40 px past 720. | At 1280 px and up the row never wraps: status text takes the space left (two lines at most inside the row), the hint stays on one line. Status strings shortened. Tested 9 strings x 2 value widths. | Fixed |
| 6 | Medium | Ride tab | Course rides were 86 px and workout rides 58 px too tall at 1280x720 before this round. | See part 7 in `ride-fixes.md`. Seven ride states measured at exactly 720. | Fixed |
| 7 | Low | `src/components/WorkoutRow.tsx` | After End Ride, a workout that was never started still showed "Connect to start" and a disabled Start workout button. | No workout buttons once the ride has ended. | Fixed |
| 8 | Low | `src/lib/ride.ts` | `connect()` could run twice (the button is disabled while connecting, but the method had no guard). Three synchronous clicks tested: one clock, no errors, before and after. | Guard added anyway. | Fixed |
| 9 | Low | `src/lib/ftms.ts`, `cyclingPower.ts` | A packet shorter than its flags claim threw inside the Bluetooth event handler. | Parsers return the fields that fit. | Fixed (part 6) |
| 10 | Low | `src/lib/fit.ts` | A lap that ended in a pause got a timestamp inside the pause. | Lap timestamp is its last record. | Fixed (part 3) |
| 11 | Low | `src/lib/ride.ts` | Removing an imported course or workout with IndexedDB failing left an unhandled rejection. | Caught and logged; the item still leaves the list. | Fixed |
| 12 | Low | `src/App.tsx`, `fakeTrainer.ts` | Shortcuts had no guard against typing. Not reachable today (the Ride tab has no text fields and the handler checks the route), but the fake trainer's keys fired while typing a start mile. | Both handlers ignore keys pressed in a field. | Fixed |

## Checked, no bug found

- **FIT edge cases** (decoded with @garmin/fitsdk, lap totals equal session totals): 1 sample; 2 samples; 6 hours with 3 pauses, altitude and 40 laps (21,600 records); a ride recorded before this round (unaligned times, 20 s dropout); a pause after the first sample and before the last; out-of-range power, cadence, speed and altitude.
- **Double clicks:** End Ride, Confirm end and Start workout are guarded by ride phase.
- **Async races:** course selection re-checks the selection after its database read; crash recovery waits for courses and workouts to load.
- **Corrupt localStorage:** every read is range-checked or inside try / catch. A profile of `null` or bad JSON falls back to defaults.
- **Timers and listeners:** the controller is a single instance for the tab's life. The control-point listener, key handlers, resize observers and wake lock are all removed or released.
- **Bad number input:** start mile and profile fields reject non-numbers and clamp to their ranges.
- **Tile widths at 1280:** "1:23:45", "112.34 mi" and "28.8 mph" all fit their tiles.
- **Widths:** no horizontal scroll at 1024, 1280, 1440 or 1920. Under 1280 the ride panel stacks and scrolls, as designed.
- **States screenshotted and reviewed:** not connected, unsupported browser, ready, riding (free, course, workout, both), paused, stale, confirm end, ended, crash recovery, resuming, Workout tab open and locked, Profile open and locked, ramp test ended, ERG released, easing in.

## Security

| # | Sev | Finding | Fix | Status |
| --- | --- | --- | --- | --- |
| S1 | High | ZWO repeat bomb (bug 1). | Capped. | Fixed |
| S2 | Medium | No size limit on imported files. A 12 MB "ZWO" was read and parsed. | ZWO limit 1 MB, GPX limit 30 MB, checked before the file is read and again on the text. GPX points capped at 500,000. | Fixed |
| S3 | Low | Imported names and descriptions had no length limit. | Names 80 characters, descriptions 400, whitespace collapsed. | Fixed |
| S4 | Low | Workout targets had no upper limit (ERG clamps to 1,500 W when sending, so the trainer was safe). | Targets over 500% FTP or 2,500 W are rejected as a bad file. | Fixed |
| S5 | Low | GPX latitude, longitude and elevation were not range-checked. | Points off the globe are skipped; elevations beyond 10,000 m count as missing. | Fixed |
| S6 | Low | Imported rows read back from IndexedDB were parsed without validation. | Stored rows go through the same parse and validation as a fresh file. | Fixed |
| S7 | Info | `innerHTML` / `dangerouslySetInnerHTML`. | None in the code. File content only reaches the page as React text. XML is parsed with `DOMParser` as `application/xml`, which runs no scripts and loads no external entities. | No change |
| S8 | Info | Secrets and personal data. | None committed. No environment variables. | No change |
| S9 | Info | `npm audit`. | 0 vulnerabilities. No upgrades made. | No change |

## Code

| # | Finding | Fix | Status |
| --- | --- | --- | --- |
| C1 | Dead code: `ResistanceResult` alias, `recorder.getRide`, `SpeedModel.setSpeed`. | Removed. | Fixed |
| C2 | A doc comment for `skipInterval` sat on `startWorkout`. | Moved. | Fixed |
| C3 | Three root-level screenshots from an earlier session. | Moved to `docs/screenshots/`. | Fixed |
| C4 | `ride.ts` is about 1,250 lines. | Left whole. A split (workout player, ERG state) would be cleaner, but it touches every path tested this round and behavior would be hard to prove identical. | Open |
| C5 | `formatTime` (App) and `formatClock` (WorkoutRow) are near twins. One rounds down (time ridden), one rounds up (time left). | Left: the difference is deliberate. | No change |

## Open, not fixed

| # | Sev | Finding | Why left |
| --- | --- | --- | --- |
| O1 | Medium | In a tab hidden for more than 5 minutes, Chrome can slow chained timers to once a minute. Recording is safe (it runs on Bluetooth events), but the reconnect loop waits on a timer, so a reconnect could take much longer while hidden. | Could not be reproduced in headless Chromium. Needs a real hidden tab and a real dropout. |
| O2 | Low | A notice above the ride panel (crash recovery, trainer lost) pushes the control row below 720 px while it shows. | Rare and short-lived. A fix means overlaying notices, which is a design change. |
| O3 | Low | Picker rows are radio buttons that each take a Tab stop; arrow keys don't move between them. | Works by keyboard. A roving tab index is the fuller pattern. |
| O4 | Low | The strip's watt label can sit under the position line for the first seconds of an interval. | Cosmetic. |
