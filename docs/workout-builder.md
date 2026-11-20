# Workout builder

Built Nov 20, 2026, ahead of the v3.2 ride test at Nate's request. Research: `docs/workout-builder-research.md`. Reference screenshots: `docs/builder-screenshots/` (interaction ideas only; the look is DESIGN.md).

## What was built

Option S from the research: a step-list editor, not a drag canvas.

- **Builder page** at `#/workout/build`. Name, difficulty (easy, medium, hard), description, a live strip (`WorkoutStrip`), total time, interval count, and one row per step.
- **Steps:** steady, ramp, and repeat (one level, any number of inner steps). Per step: time, target, optional cadence in rpm, optional label.
- **Typing:** time takes `12` (minutes), `12:00`, `90s`, `1h30`, `1:30:00`. Target takes `90` or `90%` (% FTP) and `225w` (watts). Leaving a field tidies it (`12` becomes `12:00`). Beside each target the row shows the zone and the other unit at the rider's current FTP.
- **Actions:** add, edit, reorder (↑ ↓), duplicate (Copy) and delete, for steps and repeats. Keyboard: every control is a Tab stop; Alt + ↑ / ↓ moves a row, Ctrl + D duplicates it, focus stays with the row.
- **New, Edit, Edit a copy, Remove.** Any workout (built-in, imported, custom) can be copied into an editable one. Only custom workouts can be edited or removed.
- **Entry points:** step 2 of the Workout tab (New workout in the filter row; Edit and Edit a copy in the selected workout's detail card) and Profile, Your files (New workout; Edit or Edit a copy and Remove per row).
- **Save** returns to step 2 with the workout selected. **Cancel** returns to where the rider came from.
- **Drafts:** every change is written to `localStorage` at once. A reload or a tab switch loses nothing. Cancel on unsaved work asks a second time.
- **Storage:** the app's own step list in a new IndexedDB table, `customWorkouts` (Dexie version 4). Rides, samples, courses and imports are untouched.
- **Cadence, end to end:** `cadenceRpm` on steps and intervals; ZWO import reads `Cadence` (and `CadenceResting` on `IntervalsT`); the builder edits it; the Ride tab shows it in the workout row and in the Cadence tile ("target 90 rpm · on / under / over", within 5 rpm). It is never sent to the trainer.
- **Limits:** the same as an imported file, through `validateWorkout`: 2,000 intervals, 6 hours, targets up to 500% or 2,500 W.
- **Mid-ride:** the builder is locked, like the rest of the Workout tab.
- **Crash recovery:** a ride on a custom workout stores a copy of the workout with the ride. Recovery uses that copy, so editing or deleting the workout in another tab can't break a ride in progress.

## Files

| File | Job |
| --- | --- |
| `src/lib/workout.ts` | `cadenceRpm` on steps and intervals, `custom` source, `countIntervals` |
| `src/lib/zwo.ts` | Reads `Cadence` and `CadenceResting` |
| `src/lib/customWorkouts.ts` | Cleans stored rows, save with conflict check, remove, ride snapshots |
| `src/lib/workoutDraft.ts` | Draft model, field parsing, `checkDraft`, the draft store |
| `src/lib/recorder.ts` | Dexie v4 `customWorkouts` table, `workoutSnapshot` on a ride |
| `src/lib/ride.ts` | `saveCustomWorkout`, `getWorkout`, cross-tab list sync, snapshot in recovery |
| `src/components/WorkoutBuilder.tsx` | The page, `StepRow`, `RepeatGroup` |
| `src/components/TextField.tsx` | Text field used by the builder |

## Judgment calls

| Call | Why |
| --- | --- |
| Route `#/workout/build`, Workout tab stays current | The research suggested a path under Profile "for example". Save lands on step 2 of the Workout tab, so the builder sits under that tab. |
| New workout button in step 2's filter row | The brief asks for an obvious way in from step 2. DESIGN.md bans import buttons there, not this; DESIGN.md is updated. |
| Explicit Steady / Ramp control per row | The research named it. A single field that reads `50-75` as a ramp would be faster but harder to discover. |
| New steps come prefilled (5:00 at 75%; ramp 10:00, 50 to 75%; repeat 3 x 5:00 at 100% and 3:00 at 50%) | A row is valid the moment it exists, the strip draws at once, and fields select their content on focus so typing replaces it. |
| Difficulty defaults to Medium | A tag is required for the filters. Medium is the least wrong guess. |
| A bare number is minutes for time and % for targets | Matches the research; the hint line under the list says so. |
| A step inside a repeat moves out when moved past either end | Gives a way out of a repeat without drag. There is no move into a repeat; use Add step to repeat. |
| Builder holds 500 step rows at most | A longer workout is not hand-editable and slows the page. Imports of up to 2,000 intervals still ride; a copy of one over 500 steps is refused with a message. |
| Repeat count field: 1 to 999 | The 2,000-interval limit is the real cap; 999 keeps the field to 3 digits of sense. |
| Cadence range 30 to 200 rpm | Outside that is a typo. Imported values outside it are dropped. |
| `CadenceResting` is read on import | The research put it in M, but it is one attribute and without it the off phase of every imported interval set would show no target. |
| Cadence shown in two places | The research said the Cadence tile; the brief said the workout row. Both are done. The row shows a Cadence column for the whole workout when any interval has a cue, so the row never shifts mid-ride. |
| Cadence tint is on the small "target" text, not the big number | "Calm while riding." The word on, under or over is always there, so color is not the only signal. |
| Alt + ↑ / ↓ and Ctrl + D pulled in from option M | The brief requires every action to work by keyboard; these make reorder and duplicate one keystroke. |
| Removing a custom workout asks twice | A built workout can't be re-imported. Imported files keep the one-click Remove. |
| A copy of the ramp test becomes a normal workout | The ramp-test behavior (fail detection, FTP estimate) belongs to the built-in. |
| Save conflict: stop and offer Overwrite or Save as a copy | Two tabs editing the same workout must not silently lose one edit. |
| A workout deleted in another tab is recreated by a later Save | The rider pressed Save on purpose. |
| The draft is shared by all tabs (one `localStorage` key) | Simple. A tab is told when the draft changed elsewhere; the last change wins. |
| Opening something else over an unsaved draft asks: keep or discard | Never throws work away silently. |
| IndexedDB unavailable: Save fails with a message, draft stays | No pretend save. The draft still survives a reload through `localStorage`. |
| Ride snapshot only for custom workouts | Built-ins and imports can't be edited; their recovery path is unchanged. |

## Defaults chosen for the research's open questions

1. **Phase.** Built now, at Nate's request, ahead of the v3.2 ride test. Recorded in CLAUDE.md and the scope doc.
2. **Backup.** No ZWO export. Custom workouts live in this browser only; clearing site data deletes them. This is option S as written. Export is the first thing to add if this worries you (about half a day).
3. **Entry point.** The detail card in step 2 carries Edit and Edit a copy, and the filter row carries New workout. The brief required a way in from step 2.
4. **Low cadence.** The editor warns under 60 rpm ("ERG may let go"). The 50 / 60 rpm release rule is unchanged.
5. **TSS / IF.** Still cut, as in v3.2.
6. **Free ride inside a workout.** Not built. Riding before Start workout is already a free ride.
7. **intervals.icu text syntax.** Not built.

## Conflicts between the research and the repo

- **Phase rule.** CLAUDE.md says stay in phase and the research said to wait. Nate overruled both in the brief. CLAUDE.md now records the exception.
- **"No import buttons" on the Workout tab.** Kept. The new buttons open the builder; none imports a file. DESIGN.md says so.
- **Danger button hover.** The existing `danger` hover (`line` background) put the red text at 4.3:1. It now goes to `surface` (5.9:1). This also applies to Confirm end on the Ride tab.

## What was cut, and pushback

- **From the research's S list: nothing.**
- **Not built (M and L):** free-ride steps, timed text cues, ZWO export, TSS / IF / NP, cadence ranges, a text syntax, a drag graph, undo, snippets, nested repeats, FIT workout-step messages.
- **Pushback:** ZWO export is the one cut I would reverse first. Without it a browser-data wipe takes every custom workout with it.
- **No new dependencies.**

## Also fixed along the way

- A workout imported (or saved) in the first moments after page load was dropped from the list until a reload. The loaded list is now merged with anything added meanwhile.
- `validateWorkout` expanded repeats before counting them, so a stored repeat of a trillion would hang the page. It now counts first.
- The Ride tab's workout row stays on one line at desktop width; the name truncates instead of the button wrapping.

## Checks run (headless Chromium, `?fake=1`)

- `npm run build` passes on every commit. No hex colors outside `src/styles/tokens.css`.
- Fake trainer: power, cadence, speed and time update about once a second; D, C, S and J still work.
- Keyboard only: built "10 min warm-up, 3 x 12 min at 90% with 5 min easy, 8 min cool-down" (1:09:00, 8 intervals), saved, reloaded, found under Medium and 1 h, not under Hard or 30 min. Then edited, duplicated (a built-in and a custom one) and deleted.
- Ride: a short custom workout on a flat road and on Test Hills. ERG followed every step and the ramp; the cadence cue read on, under and over; the cadence cue changed nothing the trainer did. The Ride tab fits 1280x720 with no scroll in both.
- FIT: validated with `@garmin/fitsdk` in a scratch folder. No decode errors; 8 laps (the free ride before Start workout, then one per interval); lap time and distance add up to the session.
- Recovery: workout edited, and deleted, in another tab mid-ride, then a reload. Resume kept the original intervals in both cases and ran to the end.
- Break-it: empty name, zero and negative times, a 7-hour step, 8 hours in total, 999 x 3 repeats, 3,000 steps planted in storage, a 5,000 W target, pasted junk in number fields, two tabs editing one workout, IndexedDB unavailable. All refused or handled with a message.
- Widths 1024 to 1920: no page overflow, rows on one line. Text contrast at least 4.5:1 on the builder, step 2 and Profile. Reduced motion: every builder control has a 0 s transition. Focus rings show; Tab order runs left to right, top to bottom.

## Needs a real Kickr ride

- ERG following a custom workout's steps and ramps on the trainer (only the fake trainer was used).
- Reading the cadence cue from the saddle: is "target 90 rpm · under" in the Cadence tile big enough?
- A step with a cadence target under 60 rpm: how it feels against the ERG release.
- Recovery after a real reload mid-workout (Chrome asks to pick the trainer again).
