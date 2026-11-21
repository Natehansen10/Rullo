# Home tab and power zones

Asked for by Nate on Nov 20, 2026. Built ahead of the v3.2 ride test as a third exception (see `CLAUDE.md`). No trainer code changed, so there is nothing to ride-test.

## Part 1: power zones chart

One component, `ZoneTable`: a row per zone, Z1 to Z7, with the swatch and code, the name, the % FTP range and the watt range at the rider's FTP. It sits on the Profile tab right under the FTP field, and on Home.

### One source for the boundaries

`ZONES` in `src/lib/workout.ts` is the only place a zone boundary is written: tops at 55, 75, 90, 105, 120 and 150% FTP (Coggan levels), with the names. Built from it:

- `zoneOf(pct)`: the zone of a % FTP. Same answers as before.
- `zoneRanges(ftpW)`: the chart's rows.
- `zoneAt(pct, ftpW)`: the zone a block is drawn in.
- The builder graph's zone lines (they were a second copy of the numbers).

### Calls

- **Watts are rounded, not cut off.** A zone's last watt is its top % FTP times FTP, rounded to a whole watt, the way every watt on screen is rounded. At 249 W: Z1 ends at 137 W (55% is 136.95 W), Z2 starts at 138 W, Z7 is "375 W and up".
- **No gap, no overlap.** Each zone starts one watt above the last. Z1 starts at 0 W.
- **A block is colored by its whole watts.** The strip used to color a block by its exact % FTP. A block set in watts at 137 W (55.02% of 249 W) was Z2, while a 55% block, labeled 137 W, was Z1. The chart would have disagreed with one of them. Now the strip, the builder graph and the builder's "Z2 · 187 W" echo all use `zoneAt`: the zone of the whole watts the block comes to. For a whole % FTP nothing changes. Only a block within half a watt of a boundary can change color. This is the one change the Ride tab's workout strip gets.
- **Below 100 W FTP** a whole percent is less than a watt, so two neighboring percents can land on the same watt. The watt decides.
- **The block color is the workout's own zone.** It does not move with the intensity setting, as before.
- **% FTP column:** whole numbers ("up to 55%", "56 to 75%", "over 150%").
- **No panel of its own.** On Profile it is a block inside the rider panel, so there is no panel in a panel.

### Checked

At FTP 249, 220, 100 and 317, a workout with a block on each side of every boundary, set in watts and in % FTP (24 blocks): each block's color on the strip matches the chart row that holds its watt label. Ranges have no gap or overlap.

## Part 2: Home tab

A new first tab: Home, Ride, Workout, Profile. Laid out after Zwift's home screen, drawn with this system's tokens.

| Zwift | Here |
| --- | --- |
| Opens on Home after pairing | Opens on Home. Connect is in the top bar, as on every tab |
| Rider summary top right (initials, level, Drops) | A left rail: Rider (FTP, weight) and Power zones |
| A hero card for the next ride | A plain "Next" panel: one sentence and the one primary button |
| Progress card (weekly goal, XP, badges) | Totals: all rides and the last 7 days. No goals, XP or badges |
| For You and What's New rows | Not built. There is nothing to recommend or announce |
| Activity list in the Companion app | Ride history on Home, with Download FIT on each ride |

### Routes

- **Home is `#/`.** The app opens there, and so does any unknown or old link.
- **Ride moved from `#/` to `#/ride`.** Nothing broke: every link in the app goes through `href()` and `go()` in `useRoute.ts`, and nothing outside it wrote the hash. An old bookmark of `#/` now lands on Home.
- Workout (`#/workout`), the builder (`#/workout/build`) and Profile (`#/profile`) are unchanged.
- The wordmark links to Home.
- Connect and Start from Home jump to Ride, as from the other tabs.

### Calls

- **Where things sit.** The rail holds what describes the rider (summary, zones). The main column holds what the rider does and has done (next step, totals, history). The zones chart is in the rail so history is not pushed down the page.
- **One primary button.** The Next panel's button is the only Cobalt button on Home. Every top bar button is secondary there, as Connect and Start already were on the Workout tab.
- **Next step.** "Set up a ride" goes to the Workout tab. It becomes "Go to Ride" when a course or a workout is on the Ride tab, when the trainer is connected, during a ride, after a ride, and when an unfinished ride is waiting. A confirmed "Flat road · Free ride" looks the same as nothing confirmed, so it still reads "Set up a ride"; the sentence says Connect rides free.
- **Rider summary:** FTP and rider weight in lb. No W/lb. Bike weight and position stay on Profile.
- **Totals** are "All rides" and "Last 7 days". Last 7 days is the 7 x 24 hours before the page opened, not a calendar week. The Totals panel shows only when there is at least one ride.
- **Time is moving time** everywhere on Home (the FIT timer: pauses and dropouts left out).
- **One set of numbers.** A ride's time, distance, average power and climbing come from `rideTotals` in `fit.ts`, the same code that writes the FIT session message. Average power counts every recorded second, zeros included, as the FIT does.
- **Best 20-minute power** is built: one pass over the samples. It is the best average over 1,200 recorded seconds in a row with no stop in them. A pause or a dropout starts a new run, so rest never counts toward an effort. A ride shorter than 20 minutes has none ("--").
- **History rows:** newest first. The day, then a small line with the start time, course and workout. "Flat road" and "Free ride" stand in when there is none, the same words the Workout tab uses. A course or workout that has since been removed reads "Removed course" or "Removed workout"; a custom workout keeps the name saved with the ride.
- **10 rows, then Show more** adds 10 each press. Ten rows fit about one screen under the totals.
- **Skipped:** rides with no samples (Start pressed, never pedaled), and any ride that was never ended. An unfinished ride shows in the Next panel ("An unfinished ride is waiting on the Ride tab.") and the recovery notice stays on the Ride tab.
- **Download FIT** rebuilds the file from the saved samples with the same writer as End Ride. The bytes are identical to the file End Ride downloaded.
- **During a ride** Home is readable and changes nothing. Ride keys (arrows, +, -, E) only work on the Ride tab, as before. History is read again when a ride starts or ends.
- **Empty state:** the rider summary, the zones chart, the Next panel and one line: "No rides yet. Each ride you finish will be listed here."
- **No Dexie schema change.** One read-only query was added to `recorder.ts` (`listEndedRides`).
- **Not built:** charts of past rides, TSS / IF, goals, streaks, any placeholder.

### Speed, measured

Headless Chromium, production build, 50 rides of one hour each (180,000 samples):

| | Time |
| --- | --- |
| Page drawn (rider, zones, Next) | about 0.12 s |
| First 10 history rows | 0.31 to 0.37 s |
| Totals filled in | 1.1 to 1.4 s |
| Back to Home later in the same session | about 0.08 s |

Reading the samples is the whole cost: a plain IndexedDB read of all 180,000 took 1.1 to 1.3 s on its own, about 20 ms per hour ridden. So:

- Rides are read newest first, 10 at a time. The first rows show after the first step. The totals wait as "--" and fill in when every ride is read, and nothing moves when they do.
- Each ride's summary is kept in memory for the session, as asked (no new table). An ended ride never changes, so it is read once.
- The totals do not make one second with 50 hours of rides on a first load. They would be instant with a saved summary per ride. That needs somewhere to keep it (a new table, or localStorage), which was ruled out for now. It is the first thing to do if the wait gets noticed.

### Checked

- Three fake rides (free, course, course and workout with a pause): each row's time, miles and average power match the FIT session decoded with @garmin/fitsdk (kept in a scratch folder, not a dependency). The file from history decodes with no errors and is byte for byte the End Ride file.
- Empty state on a clean browser profile.
- 50 rides: timings above. An ended ride with no samples and an unfinished ride are not listed.
- Reload mid-ride: the recovery notice shows on the Ride tab, Home lists nothing for that ride, and Next says a ride is waiting.
- Ride tab at 1280x720 with four tabs in the bar: free, course, workout, and both still fit with no scroll.
- Home at 1024, 1280, 1536 and 1920 px: no sideways scroll, no clipped cell.
- Reduced motion: durations are 0. Lowest text contrast on Home is 5.45:1 (`fg-subtle` on `surface`). No shadow, gradient or filter on the page.
- `?fake=1`: power, cadence, speed, distance and time still update each second on the Ride tab.

## Part 3: delete a ride, Nov 21, 2026

Nate asked for it after the first pass.

- **Delete on every history row**, beside Download FIT. It asks twice, like Remove on the Profile tab: the first press turns the button into red "Confirm delete" for 3 seconds, the second deletes.
- **It is for good.** The ride's row and every sample of it are deleted in one transaction. There is no undo; the help line says so. Download the FIT first to keep a copy.
- **Only finished rides.** A ride in progress or one waiting to be recovered is not in the list and the delete refuses it.
- **Side effects, both intended:** the totals drop the ride at once. A course's default start mile comes from the last saved ride on it, so deleting that ride moves the default back to the ride before it, or to mile 0.
- **A ride that just ended** is in the list while the Ride tab still shows it. Deleting it there leaves the Ride tab's own Download FIT with nothing to build; it says "Nothing was recorded."
- **Layout change:** two buttons did not fit the row at 1024 px. Under 1200 px the rail now sits on top (Rider and Power zones side by side) and the history rows get the full width. The row buttons are the small size.
- **No schema change.** `deleteEndedRide` in `recorder.ts` uses the tables as they are.

Checked at 1024 and 1280 px: the first press deletes nothing and the row does not move; the confirm times out; the second press deletes that ride's row and its 1,800 samples and nothing else; totals update; it stays gone after a tab switch and a reload; the other rides still download; deleting every ride gives the empty state; an unfinished ride is untouched and its recovery notice still shows.

## Supabase, Nov 21, 2026

Nate offered to set up a Supabase backend. Not needed for anything built here, and not recommended yet:

- The one slow spot (totals with many long rides) is a local read. A saved summary per ride in this browser fixes it with no server.
- A backend means accounts and sync. The scope guardrails hold those until going public is a real decision.
- Where it would earn its place later: ride history across devices, and Strava auto-upload (the client secret has to live on a server).

### Left for later

- A saved summary per ride, if the totals wait is noticed (see Speed).
- Two rides that start in the same minute get the same FIT file name. This was already true of End Ride.
