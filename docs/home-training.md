# Home that shows training

Asked for by Nate on Nov 24, 2026. Home was a column of white panels of equal weight: Next (a sentence and a button), Totals, Power bests, Ride history. Nothing said where to look first, and nothing showed training over time. No trainer code changed and nothing on the Ride tab changed, so there is nothing to ride-test.

Screenshots: `docs/screenshots/home-training.png` (a course and a workout picked), `home-training-flat.png` (nothing picked), `home-training-hover.png` (a day pointed at), `home-training-empty.png` (no rides).

## What was built

- **The next ride is the one large thing on the page** (`NextRide`). It names what the Ride tab is set up to ride, in the Workout tab's words, and draws it: the course's elevation profile with its miles and feet of climbing, the workout's strip with its length and intervals. It carries the page's one primary button.
- **A training chart** (`TrainingChart`), right under it: one bar per day for the last 6 weeks, today last. Height is the day's moving time.
- **One sentence for the last 7 days** in the chart's panel. It took the place of the "Last 7 days" totals row.
- **A readout line** under the chart: the 6 week totals at rest, the day's numbers when a day is pointed at.
- **Totals is now "All rides"** only, one row.
- **Order of the main column:** Next ride, Training, Back up (when due), All rides, Power bests, Ride history.

## Calls

### The chart

- **42 days ending today,** not six Monday to Sunday weeks. Today is always the last column, and there is never a run of empty future days.
- **The measure is moving time.** It is the one number every ride has that means the same on a flat road, a course and a workout. Distance depends on the course and the rider's weight. Work in kJ is in the readout.
- **A week starts on Monday.** A wider gap before each Monday, and its date under it. Sunday-first calendars are not followed.
- **A day is the rider's local calendar day.** Days are made with the Date constructor (year, month, day), never by adding 24 hours, so the 23 and 25 hour days at a clock change are each one day. A ride counts on the day it started, also when it ran past midnight.
- **"Today" moves on at midnight** without a reload (`useToday`), and is checked again when the tab is shown.
- **The top of the chart** is the longest day rounded up to a half hour, and never under an hour. So one short ride is not drawn as a big day.
- **A ride of any length gets a bar of at least 8px.** A 13 second test ride must not look like a rest day.
- **Rest days are a 2px tick in `fg-subtle`,** not `line-strong`: `line-strong` is 2.1:1 on white, under the 3:1 a graphic needs.
- **Bars are `fg-muted`, today's is `fg`.** Not Olive, not a zone color. Today is also the last column and has the word "Today" under it, so color is not the only sign. A Monday's date is left out within 4 days of today so the two labels never touch.
- **Contrast:** bars 7.1:1 on the panel and 5.9:1 on the hover band; ticks 5.5:1 and 4.6:1; labels 5.5:1; today 17.4:1.
- **A reserved line, not a chip.** The readout is always there, one 16px line, so nothing can move. Each value is one piece of text in a cell of a fixed width. The first build put values and units in separate pieces, and the browser counted a unit sliding sideways inside the line as a layout shift (CLS 0.00015 to 0.0003 over 42 days, by width).
- **"Last 7 days" is now today and the 6 days before it,** the last 7 bars. It was the 7 x 24 hours before the page opened. The sentence and the chart now agree.
- **The sentence has rides, time and miles.** Feet climbed in the last 7 days is gone from Home. It is still in All rides.
- **Time in the sentence is "4 h 00 min",** the form the workout cards use. "4:00" would read as four minutes beside the m:ss times in the history table.
- **Keyboard:** the chart is one Tab stop with slider semantics. Left and Right move the day, Home and End go to the ends. The day's numbers are the value text, so a screen reader reads what the line shows.
- **Draw-in:** the existing `.ww-draw-in` cover, once per page load, the first time there are bars. No new motion. Off with reduced motion.
- **Work in kJ is the FIT file's own number.** `workJ` was added to the ride summaries kept in localStorage. No new key and no version bump: a summary saved before today has no work, is drawn as it is on the first frame, and is read again once in the background. Until that read lands, a day's readout leaves kJ out.
- **Home keeps a full list until the next full list lands.** A partial list from the reader used to replace it when there was already a saved one. With every old summary read again, the bars and totals would have dropped to 10 rides for a moment.
- **The chart waits for the full list,** like the totals. It shows empty days until then.

### The next ride

- **It shows the setup, not the ride.** No position dot or line, also mid-ride. So Olive on Home is the button and nothing else.
- **The button and its states are as before:** "Set up a ride" goes to the Workout tab with nothing confirmed and the trainer not connected; "Go to Ride" in every other state.
- **A label says what the panel is about:** Next ride, Riding now, Last ride (after End Ride), Unfinished ride.
- **Nothing picked is a ride too:** "Flat road · Free ride", a baseline where the profile would be (the Flat road card's own drawing) and "no hills, no targets · you set the load".
- **An unfinished ride that has not been resumed names no setup.** The Ride tab does not have its course yet. It says when it started and how far it got.
- **The course's Distance is the whole course,** as in the course overview. A start mile above 0 is in the line under the profile.
- **No hover details on the strip here.** Its chip measures itself after it appears, which the browser counts as a shift. The details are one click away on the Workout tab.
- **The title is at title size (20px),** the largest text size the system has that is not a number. The panel is large by its room, its drawing and the one Olive button, not by a new type size.
- **Back up moved under Training.** It appears only once the rides are counted. Under the chart, it can push nothing at the top of the page.

## Code

- New: `src/components/NextRide.tsx`, `src/components/TrainingChart.tsx`, `src/lib/training.ts` (day buckets), `src/hooks/useToday.ts`.
- `HomePage.tsx`: the two new panels, the new order, All rides.
- `history.ts`: `workJ` on a summary, and the one re-read for summaries without it.
- `CoursePicker.tsx`: `CardProfile` is exported and takes a height class. `WorkoutPage.tsx`: `rideSetup`, `setupName` and `setupDetail` are exported. Neither changed what it draws.
- `tokens.css`: `--ww-training-height` (104px), `--ww-training-tick` (2px), `--ww-training-bar-min` (8px). No new color.
- No new dependency, no new storage key, no database change. `ride.ts`, `ble.ts`, `ftms.ts`, `heartRate.ts` and `recorder.ts` are untouched.

## Checked

Headless Chromium through Playwright, production build (`vite preview`), `?fake=1`, time zone America/Los_Angeles, on Nov 24, 2026. The 42 days run Oct 14 to Nov 24, across the Nov 1 clock change. Rides were seeded straight into IndexedDB for the current rider: 21 rides on 20 days, one of them older than the chart, a rest week (Nov 4 to 10), two on one day (Nov 21), one today, one that starts at 11:40 PM and runs past midnight, and one at 12:30 AM on the 25 hour day.

- **Build:** `npm ci`, then `npm run build` passes. The JS bundle went from 494.85 kB to 502.87 kB, so Vite now prints its "larger than 500 kB" note. It is a note, not an error.
- **Bar heights:** at 1280, 1024 and 900 wide, each of the 19 days with rides has a bar of (moving time / 120 min) x 103px, within half a pixel (30 min is 25.75px, 65 min is 55.78px). The scale top is 2 h, the longest day.
- **Day buckets:** 42 days in a row ending today, 6 Mondays. The 11:40 PM ride is on its start day. In node with `TZ=America/Los_Angeles`: the spring change (a 23 hour day), the fall change (25 hours, both 1:30 AMs on Nov 1), 23:59 and 00:00, the edges of the span, and over new year.
- **Midnight:** a page opened at 23:59:30 shows Nov 25 as today 40 seconds later, with no reload.
- **Hover:** each of the 42 days, at three widths: the date, rides, time, miles and kJ match the seeded data (Nov 21: 2 rides, 1:05:00, 18.2 mi, 742 kJ). CLS did not change, and no panel moved or changed size.
- **Layout shift on load:** with saved summaries (every load but the first), CLS is 0 at 1280, 1024 and 900, and every panel is where it was on the first frame. With summaries from before `workJ`, the bars and rows are the same on every frame of the re-read, and CLS is 0.
- **One real ride:** Connect, Start ride, about 10 seconds, End Ride, Confirm end. One bar, on today, 8px tall; the readout says 1 ride.
- **Zero rides:** 42 ticks, no bars, "No rides yet. Each day you ride gets a bar here."
- **One Olive element on Home, the button,** in each state: nothing picked, riding, ended, after New ride, course and workout, course only, workout only. Every element's background, fill and stroke was compared with the token.
- **No sideways scroll** at 1280, 1024 and 900, in every setup.
- **Keyboard:** Tab reaches the chart, it shows the focus ring and starts on today. Left three times lands on Nov 21, and the line and the value text agree. Home, End and both ends hold. Leaving the chart puts the totals back.
- **Motion:** the cover runs once on load and is gone within 0.8 s. Coming back to Home does not play it again. With reduced motion there is no animation at all, on load or on hover.
- **Console:** no errors in any run.
- **Ride tab:** after Connect and Start, power, cadence, speed and time changed every second, and distance as its hundredths turned.

## Not right, or not zero

- **The first load after rides arrive with no saved summaries** (a browser with rides and an emptied localStorage) still moves Ride history down when Back up, All rides and Power bests appear: CLS 0.006 at 1280. It was so before. Next ride and Training do not move in that case.
- **The Power zones table shifts by 0.0019** on a first-ever load, on the commit before this one too (10 of 12 loads there, 12 of 12 here). Not looked into.
- **With nothing picked the next ride panel is small.** It is first and has the only Olive button, but All rides has bigger numbers. A larger title would need a new type size in DESIGN.md.
- **A locale that writes long dates** ("mar., 24 nov.") could be wider than the readout's date cell, which then cuts it off. Only US English was checked.

## Not built

- **Weekly totals, goals, streaks, TSS or a fitness line.** One bar per day and one sentence.
- **A choice of span or measure.** 6 weeks of moving time.
- **A click on a bar that opens that day's ride.** A day can hold two rides; the history table is right below.
- **Ride progress on Home.** The next ride panel never shows where a ride in progress is.
- **A chip that follows the pointer.** The line is always there.
