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

### Not built yet

- **Pass 2:** FTP history (each change with its date and source), the FTP stamped on each ride, and a suggestion when the best 20 minutes says the FTP is low.
- **Pass 3:** storage used, a request for persistent storage, and a nudge after rides with no backup.
- **Left out on purpose:** units, W/lb, a photo, birthday, gender, country, heart rate zones, weekly goal and streak, a first-visit wizard, sign-in.
