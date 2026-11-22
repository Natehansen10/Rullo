# Profile tab

## Pass 1: layout, Nov 22, 2026

Asked for by Nate on Nov 22, 2026, after a read of the research (`docs/zwift-accounts-profile-flow-research.md`, `docs/zwift-complaints-research.md`). The old page was one 768 px column about 2,000 px tall with six unrelated jobs stacked in it. No trainer code changed, so there is nothing to ride-test.

### What was built

- **A rail and a main column**, the same grid as Home (`.ww-home`; no new CSS).
- **The rail:** the rider at a glance (name, FTP and weight, rides, last ride, riding since, last backup) and a menu of four sections.
- **One section at a time:** Your numbers, Riders, Your files, Data and connections. Nothing inside a section changed except what is listed here.
- **The section is in the address:** `#/profile`, `#/profile/riders`, `#/profile/files`, `#/profile/data`. An unknown section opens the first.
- **"On the road at 200 W":** the old gray footer line, now three numbers under the weight and position rows: flat road, a 5% climb, and rider plus bike in lb. They change as the rows change.
- **"These are starting numbers, not yours."** One line until the rider first sets any number.
- **Last backup:** the day of the last Back up on this browser, in the rail and in the Back up row.

### Calls

- **Weight and position are one panel, FTP and zones another.** The first set is about speed, the second about power. The zones chart is still right under the FTP field.
- **Power bests, totals and history stay on Home.** Zwift riders complain that stats are scattered; each number here lives in one place.
- **Links land on the right section.** Coming back from Strava sign-in and "Connect Strava to upload" open Data and connections. The rider's name in the top bar opens Riders.
- **"Riding since"** is the earlier of the rider's creation date and their first ride: a rider made by the rider-id pass has rides older than their own date.
- **The last backup is per rider** (`ww.lastBackupAt`, in `RIDER_KEYS`). It is not written into a backup and a restore does not set it. It records that Back up was pressed here; it cannot know the file was kept.
- **"Starting numbers" means nothing was ever saved** under `ww.profile`. Setting any number, or a restore that brings a profile, clears it.
- **`steadySpeedMps` takes an optional grade** for the climb number. With no grade its answers are the same as before (checked: 203 lb at 200 W is still 20.7 mph).
- **The notice from an import shows in every section**, above the section.

### Checked (headless Chromium, production build, `?fake=1`)

- Ride tab: power, cadence, speed, distance and time update each second.
- Each section at 1280: the right one is current in the menu and the Profile tab stays lit. An unknown section opens Your numbers.
- Rider weight 185 to 150 lb: flat 20.7 to 20.9 mph, climb 8.5 to 9.9 mph, total 203 to 168 lb, the rail's line follows, and the starting-numbers line goes.
- After one fake ride the rail reads 1 ride with today's date. Back up downloads the file; the rail and the row then show today.
- No sideways scroll at 880, 1024, 1280 and 1920. No console errors.

## Pass 2: FTP history, Nov 22, 2026

The FTP had no memory: no date, no source, and a ramp test left no trace. Old rides showed time in zone at today's FTP.

### What was built

- **FTP history**, a third panel in Your numbers: each change with its day, how it was set (Typed, Ramp test, Best 20 minutes) and what it changed from.
- **The FTP row says when it was set and how.**
- **Each new ride saves the FTP it started at.** Its summary works out time in zone at that FTP and says so. A ride from before this has none and still uses today's FTP, as its help line says.
- **A suggested FTP.** When 95% of the best 20 minutes in the last 60 days is above the FTP, a row says so with the numbers and offers "Set FTP to 247 W" and "Not now".

### Calls

- **Nothing sets the FTP but the rider.** The suggestion is a row with a button, on the Profile tab only. intervals.icu works the same way.
- **Only upward.** A hard 20 minutes shows the FTP is at least that. An easy month shows nothing.
- **95% and 60 days.** The usual 20-minute rule, and the window the research's power curve uses. Both are constants in `src/lib/ftpHistory.ts`.
- **Not now puts that value away.** It is not offered again. A higher value, from a better ride, still is.
- **Typing twice within 10 minutes is one change**, from the value before both. Typing back to where it started leaves no change at all.
- **The history starts empty.** The FTP a rider already had has no known date, so none is made up. The first change records what it changed from.
- **The ride's FTP is the one at Start.** A ramp test that sets a new FTP mid-ride does not move that ride's zones.
- **Storage:** `ww.ftpHistory` and `ww.ftpSuggestionDismissedW` in localStorage, both in `RIDER_KEYS`. The last 50 changes are kept, so the list fits a backup's settings. `ftpW` on a ride is a plain field: no database version change.
- **Backups:** the history travels as a setting (restored only where this browser has none). A ride's FTP travels with the ride. The file version did not change: an older build ignores both fields.
- **`ride.ts` changed in three small places:** `setProfile` and the ramp test's Set FTP note the change, and Start passes the FTP to the recorder. Nothing the trainer is sent changed.
- **Found while testing:** the rail's ride count did not follow a restore until the page was left. It now reads the rides again after a back up or a restore.

### Checked (headless Chromium, production build, `?fake=1`)

- 220 to 230 W makes one row. 240 a moment later: still one row, 220 to 240. Back to 220: no row. A change a day later is its own row.
- A fake ride's backup carries `ftpW: 220` and the history setting.
- A restored 22-minute ride at 260 W, saved with an FTP of 200 W: the suggestion reads 260 W, 247 W and the right day. Not now removes it and the FTP stays; it stays gone after a reload. Set FTP to 247 W sets it, adds a "Best 20 minutes" row and the note under FTP.
- That ride's summary says "the FTP you rode it at, 200 W"; the fake ride's says 220 W.
- Ride tab numbers still update each second. No sideways scroll at 880 and 1024. No console errors.

### Not checked

- The ramp test's own Set FTP on a real or fake ride. It calls the same `logFtpChange` as typing; the path through a finished test was not run.

### Not built yet

- **Pass 3:** storage used, a request for persistent storage, and a nudge after rides with no backup.
- **Left out on purpose:** units, W/lb, a photo, birthday, gender, country, heart rate zones, weekly goal and streak, a first-visit wizard, sign-in.
