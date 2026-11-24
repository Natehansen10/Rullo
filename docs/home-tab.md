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

On Nov 24, 2026 the Next panel became the next ride, drawn, a training chart was added, and "Last 7 days" moved into it: see `docs/home-training.md`.

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
- **Best 20-minute power** is built (and since Part 5, 5 s, 1 min and 5 min too): one pass over the samples. It is the best average over 1,200 recorded seconds in a row with no stop in them. A pause or a dropout starts a new run, so rest never counts toward an effort. A ride shorter than 20 minutes has none ("--").
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
- The totals did not make one second with 50 hours of rides on a first load. Fixed in Part 4 below with summaries saved in localStorage.

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

## Part 4: saved summaries, Nov 21, 2026

Nate said yes to fixing the totals wait and left the choice of where to keep the summaries (localStorage or one new table) open.

- **Call: localStorage**, one key, `ww.rideSummaries.v1`. A new table would have meant a new database version. That is safe going forward, but once a browser has opened the newer version, an older build of the app (a rollback) can no longer open the database, rides included. localStorage has no such risk, and it is read before the page draws, so Home shows rows and totals on its first frame.
- **Size:** about 190 characters a ride. A thousand rides is under 200 KB of a 5 MB allowance.
- **The saved rides stay the truth.** A summary is used only for a ride that is still in the database with the same start and end. A ride with no summary is read from its samples and saved. A summary whose ride is gone is dropped. Unreadable or half-broken storage is ignored and rebuilt.
- **Deleting a ride** drops its summary in the same step.
- **When the numbers' code changes** (`rideTotals` or `bestPowerW`), bump the `v1` in the key: every ride is worked out again once.
- **The first visit after this ships** still reads every ride once (the old 1.1 to 1.4 s with 50 hours of rides). So does a browser with storage blocked, every time.

Measured, same 50 one-hour rides, headless Chromium, production build:

| | Before | Now |
| --- | --- | --- |
| First load ever (nothing saved) | totals 1.1 to 1.4 s | the same, once |
| Every load after | totals 1.1 to 1.4 s | rows and totals 0.12 to 0.16 s |

Checked: totals are identical with and without saved summaries. A summary with the wrong end time, a garbage entry, a wrong field type, an entry for a ride that does not exist, and unreadable JSON each leave the totals correct and the store repaired. Deleting a ride removes its entry and it stays gone after a reload. The three-ride FIT comparison, the 1280x720 fit and the live numbers still pass.

## Part 5: power bests and PR tags, Nov 21, 2026

From the research doc (`docs/zwift-accounts-profile-flow-research.md`, "Progress card"). Nate said go on three items: this, the ride summary and back up and restore.

- **Four stretches:** 5 s, 1 min, 5 min, 20 min, the four Zwift shows. Same rule as the 20-minute best: recorded seconds in a row with no stop.
- **Home has a Power bests panel:** the standing best for each stretch and the day it was set. "Best 20 min" left the two totals rows, so each number is in one place.
- **PR means "beat every earlier ride when it was ridden"**, by at least one whole watt. A ride keeps its tag when a later ride goes faster. The first ride with a number for a stretch sets the mark and gets no tag: there was nothing to beat.
- **Tags are worked out, not stored.** Delete a ride and the tags after it follow.
- **The PR chip is neutral** (mono on `raised`). The state colors mean connection and target states, and Cobalt is taken.
- **Bests and tags wait for the full list.** On a first load they show "--" until every ride is read, like the totals.
- **Saved summaries moved to `ww.rideSummaries.v2`** because each one now holds four bests. Every ride is read once more on the first visit; the old key is removed.

## Part 6: ride summary, Nov 21, 2026

The research calls the missing summary "the biggest gap". Click a ride in history to open it at `#/rides/<id>`.

| Research (Ride Summary) | Here |
| --- | --- |
| Name, time, miles, climbing, avg W, kJ, avg cadence | Built, with max power and heart rate. The title is the day and time |
| Normalized W | Cut, with TSS and IF, as the scope doc already had it |
| Power and cadence chart, HR later, intervals shaded | Built: a line each for power, cadence, heart rate and elevation; interval starts are hairlines |
| Time-in-zone bar | Built: one bar per zone with time and share |
| Best 5 s / 1 / 5 / 20 min with a PR tag | Built |
| Download FIT (primary), Ride again, New ride | Download FIT (primary) and Delete. Ride again is not built |
| The Ride tab turns into the summary after End Ride | Not built. The summary opens from Home |

Calls:

- **A side trip from Home**, like the builder is from the Workout tab. The Home tab stays lit.
- **Small stacked charts, one per signal,** on one time axis, in place of one chart with two or three scales. Each line has its numbers written beside it, so the chart needs no axis of its own.
- **The x axis is moving time.** Pauses take no room; the help line says how much was left out.
- **Colors:** power is `fg`, not Cobalt (Cobalt is live power). Cadence uses the `cadence` token, which exists for this. Heart rate is `fg-muted`; no new color was added.
- **Time in zone uses your FTP today**, and says so. A ride does not store the FTP it was ridden at.
- **Every number in the top row is the FIT file's own** (`rideTotals`). Checked against the decoded session: time, miles, feet, average and max power, work, cadence, average and max heart rate.
- **Nothing is stored for it.** The page reads the ride's samples when it opens, about 20 ms per hour ridden.
- **Delete** is here too, with the same two presses, and goes back to Home.
- **No hover on the charts** in this pass. Added Nov 24, 2026: see `docs/scrubbable-charts.md`.
- **A ride that is not saved here** (deleted, never ended, a bad link) shows one sentence and a way back.

## Part 7: back up and restore, Nov 21, 2026

The research's item 6: "browser storage can be wiped. This is your stand-in for a cloud account." It is also the first piece of groundwork for other riders: the file is the shape a sync would send.

- **Where:** the last block of the Profile tab.
- **What is in the file:** finished rides with every sample, imported courses, imported and built workouts, the profile, and six settings (resistance level, mode, hill feel, ERG target, and the builder's two display choices). One JSON file, `weem-watts-backup-<date>.json`, about 220 KB per hour ridden.
- **What is not:** a ride that was never ended, an ended ride with no samples, the saved summaries (they are rebuilt), the builder's unsaved draft, and the picks on the Workout tab.
- **Restore only adds.** A ride with the same start time, or a course or workout with the same id, is left exactly as it is. Nothing is ever changed or removed, so restoring twice, or restoring an old backup, is safe. The note says how many were added and how many were already here.
- **Profile and settings are restored only where this browser has none saved.** A fresh browser gets them back. A browser you have been using keeps its own.
- **All or nothing.** The whole file is checked first, field by field (types, lengths, every sample a real number, times in order). Then everything is written in one transaction. A damaged file, a file that is not a backup, or one from a newer version is refused with "Nothing was changed."
- **A built workout that can no longer be ridden is left out**, the same as the app's own list leaves it out.
- **No reload.** Restored courses and workouts are listed at once; the ride and the picks on the Workout tab are not disturbed.
- **Restore is locked mid-ride.** Back up is not.
- **Cut:** "Download all FITs" as a zip. It needs a zip writer, and the rule is no new dependencies. Each ride's FIT is one click on Home.
- **No schema change.**

Checked: back up in one browser profile, restore in a clean one. Home (rows, totals, bests) is identical, and each ride's FIT is byte for byte the same as before the backup. Restoring again adds nothing. A saved profile is not overwritten. Six bad files (not JSON, another format, a newer version, a column one value short, text where numbers go, an object where a name goes) are each refused and write nothing. The unfinished ride and the empty ride are not in the file.

## Not built from the research, and why

- **Weekly goal and streak:** held until these three have been used.
- **Rename a ride, undo for delete:** asked about, not chosen.
- **Rider picker:** not built. The rider id on every record was built later the same day: see `docs/riders.md`.
- **First-visit setup, sign-in:** only matter once other people arrive.

## Supabase, Nov 21, 2026

Nate offered to set up a Supabase backend. Not needed for anything built here, and not recommended yet:

- The one slow spot (totals with many long rides) was a local read. A saved summary per ride in this browser fixed it with no server (Part 4).
- A backend means accounts and sync. The scope guardrails hold those until going public is a real decision.
- Where it would earn its place later: ride history across devices, and Strava auto-upload (the client secret has to live on a server).

### Left for later

- Two rides that start in the same minute get the same FIT file name. This was already true of End Ride.
