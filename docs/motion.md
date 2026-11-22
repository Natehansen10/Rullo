# Motion

Make the Ride screen feel alive without breaking "calm while riding". The rules are the Motion section of `DESIGN.md`. This file is the record: what each phase built, what was left alone and why, and what is queued.

## Phase 1 (Nov 21, 2026): the Ride screen

Built ahead as an exception (see `CLAUDE.md`). Ride test pending. No new dependency: CSS transitions and keyframes, plus four small hooks. No trainer, recording or FIT code changed; the one edit in `src/lib/ride.ts` exports `TICK_MS`.

### What was built

| # | What | Where |
| --- | --- | --- |
| 0 | Tokens: `--ww-dur-glide` (250ms, one snapshot), `--ww-dur-breathe` (1600ms), `--ww-enter-shift` (4px), `--ww-enter-shift-interval` (6px). Shared classes: `.ww-breathe`, `.ww-enter`, `.ww-fade-in`, `.ww-fade-out`, `.ww-glide`. | `tokens.css`, `index.css` |
| 1 | The connection moment. The StatusPill's dot breathes while Connecting or Reconnecting. The pill's width eases and its label crossfades when the words change. Power, Cadence and Speed enter once, 0 / 40 / 80ms apart, when "--" becomes a reading; Heart rate on its own first bpm. | `StatusPill.tsx`, `MetricTile.tsx`, `useFirstValue.ts`, `App.tsx` |
| 2 | Zone chip on the Power tile: swatch and code, from `zoneAt()` with the smoothed power. Waits `ZONE_HOLD_S` (2 s). Fixed width. | `MetricTile.tsx`, `useHeld.ts`, `App.tsx`, `config.ts` |
| 3 | Glide. The strip's position line and wash, and the course dot, drop line and ridden stretch, move continuously. | `WorkoutStrip.tsx`, `ElevationProfile.tsx`, `useGlide.ts` |
| 4 | The interval change moment. Interval number, Target, Cadence target and Next enter once. In the last 5 s the next block is outlined. | `Stat.tsx`, `WorkoutRow.tsx`, `WorkoutStrip.tsx` |
| 5 | Stepper direction cue: a stepped value enters from below (up) or above (down). | `Stepper.tsx` |
| 6 | Sliding selected chip in `SegmentedControl` and `TabNav`. | `useSlidingChip.ts` |

### Decisions worth knowing

- **Glide length follows the data, not the snapshot.** The brief set the glide to one snapshot (250ms) on the idea that the playhead and dot step 4 times a second. They do not: the workout clock and the distance advance when a reading arrives, about once a second (exactly once on the fake trainer). A fixed 250ms glide would move for a quarter second and sit for three. So a glide takes as long as the last gap between two position changes, at least `--ww-dur-glide` and at most `GLIDE_MAX_MS` (1200ms). Measured on the fake trainer: the line moved on every frame of 8 s of riding. Set `GLIDE_MAX_MS` to 250 in `config.ts` to get the fixed version.
- **The zone chip waits on time away, not on the new zone holding.** "Change after the new zone has held 2 s" left the chip on Z1 at 359 W during a steady spin-up, because every new zone restarted the wait. The chip now changes once power has been out of the shown zone for 2 s, to the zone of that moment. Hovering at an edge still never flickers.
- **A stale number does not enter again.** Stale readings stay on screen in `fg-subtle`; they never go back to "--". So recovery from stale is the color easing back, and the enter plays only after Connect or after a lost trainer returns.
- **The hover outline wins outright.** While any block is pointed at, the heads-up outline is hidden, so there is never a question of which outline is the pointer's.
- **The stepper cue starts at 40% opacity**, not 0, so the value stays readable while a key repeats.
- **A counter in the pill is not a label change.** "Reconnecting 2/30" to "3/30" updates in place.
- **Position marks are HTML layers over the SVG**, not SVG shapes, so the browser can move them on the compositor. The ridden stretch is a window that slides right over a line that slides back by the same amount.
- **Width and color do ease in four places** (pill width, chip width, the status dot and zone swatch colors), all asked for. None of them moves anything in the ride panel.

### Deliberately not animated

| What | Why |
| --- | --- |
| Live numbers (power, cadence, heart rate, speed, distance, time) | Numbers update in place. A rolling digit is a number you cannot read for a moment. |
| Interval left, Workout left | They are clocks. They change every second and must not draw the eye at the interval change. |
| The control row's status lines and key hint | They are fixed in place so nothing moves at 1280x720. |
| "Not recording" | DESIGN: said in three calm places, nothing flashes. |
| The Power tile and its number | Power stays Olive. A zone tint would give Olive a fourth job. |
| The stale gray-out beyond its color | It already eases over 200ms; a second effect on bad news is noise. |
| The heads-up leaving | It goes when the interval changes, the same moment the values enter. One event, one move. |
| Sounds, countdown numbers, a color on Interval left | Not asked for, and not calm. |
| Notices, the top bar's buttons, End Ride's confirm | They change layout. Left for a later phase, if at all. |
| Anything off the Ride screen, except the shared chip | Phase 2 and 3. |

### How it was tested

Headless Chromium against the dev server with `?fake=1`, at 1280x720 and 1440x900.

- `npm run build` passes. Every number still changes once a second.
- Layout: the position and size of every row, button, stat, tab and the key hint compared with the commit before this work, in 32 states (free, course, workout, both; idle, ready, riding, paused; two window sizes). All identical.
- Glide, sampled every frame: no backwards glide in riding, stale (D), pause and resume (S), jitter (J) or a resize. Skip interval, the pause's step back and a resize are each one frame. During stale the line sat still for the full 5 s.
- Connection: the dot breathes while Connecting, Reconnecting and Reconnecting n/3 (X), and not on Not recording. First readings enter at 0 / 40 / 80ms, once.
- Zone chip: fixed 25.2px in every state; the smoothing control did not move.
- Interval change: values enter on Skip interval and on a natural change; the line glides through a natural change; the outline shows from 5 s left.
- Reduced motion: no animation or transition ran in 13 s of connecting, riding, skipping, stepping, switching mode and tabs.
- 30 s of riding: 5.3 React commits a second, the same as before this work (4 snapshots and 1 reading); `transform` was the only property animating.

Not tested: a real Kickr. The reading rate of the real trainer decides how the glide feels; that is the ride test.

### Screenshots

`docs/screenshots/motion/`: `before-*` and `after-*` of the same states, plus three frames caught mid-move (`after-first-data-entering`, `after-interval-values-entering`, `after-heads-up`). Stills show the chip, the outline and that nothing else moved; the motion itself needs the preview.

## Phase 2 (Nov 22, 2026): the setup flow

Built as an exception (see `CLAUDE.md`). No ride test needed: nothing on the Ride tab, in the trainer code or in recording changed. The one shared file touched is `WorkoutStrip.tsx`, which now passes a `style` through.

### What was built

| What | Where |
| --- | --- |
| `moveLayout`: one helper that draws a state change as a move, with the browser's View Transitions. Tokens `--ww-dur-layout` (320ms), `--ww-dur-draw` (480ms), `--ww-step-shift` (24px). | `src/lib/viewTransition.ts`, `tokens.css`, `index.css` |
| Step slide: step 1 and step 2 trade places, Next from the right, Back from the left. The setup line moves to its new place. | `WorkoutPage.tsx` |
| Card to chart: a workout card opens into its overview and closes back into the card. The small graph becomes the big chart. | `WorkoutPicker.tsx` |
| Filter reflow: cards that stay move, the rest fade. Length, Difficulty and the side menu. | `WorkoutPicker.tsx` |
| Course overview: it fades in under the grid, the setup line moves down, and the profile is drawn in left to right. | `CoursePicker.tsx`, `CourseOverview.tsx` |

### Decisions worth knowing

- **No Motion library.** Phase 1's queue said "likely the Motion library". The app only runs in Chrome and Edge (Web Bluetooth), and both have View Transitions, which do exactly these four moves. So: zero new dependencies, about 40 lines of TypeScript and 100 of CSS. If Phase 3 needs drag physics for the builder, that is the point to look at the library again.
- **Names are live only during a move.** Every card has a name, but only while a reflow or an open runs. At rest nothing is named, and a step slide does not capture 37 cards.
- **The opening panel is never scaled.** The default would stretch the card's picture up to the panel's size, text and all. The panel instead shows its own content at full size, cut to the growing box. Only the chart is stretched, because it is the same chart at another size.
- **The course card does not open into its overview.** The card stays where it is (it is the radio button), so there is nothing to morph. The overview fades in and its profile is drawn.
- **Draw-in is for a pick, not for a visit.** Going Back to step 1 with a course already picked does not draw the profile again.
- **A move freezes the page for about a third of a second.** That is why none is used on the Ride tab. On the Workout tab the only live thing is the StatusPill.
- **A cut-short move is not an error.** Clicking again mid-move drops the first move and starts the next from where the page is.

### Deliberately not animated

| What | Why |
| --- | --- |
| The workout overview's chart drawing in | It already arrives by growing out of the card. Two moves on one chart is one too many. |
| Cards on first load | They arrive with the page. An entrance for 37 cards is decoration. |
| The start mile's Olive hairline | It moves when a number is typed. It should land where the number says, at once. |
| The count ("12 workouts of 37") | A number. It updates in place. |
| Ride this workout / Done (the jump to the Ride tab) | The Ride tab must be live the moment it shows. |
| The builder, Home, Profile | Phase 3. |

### How it was tested

Headless Chromium against the dev server with `?fake=1`.

- `npm run build` passes.
- Every move ran, at about 350 ms: pick a course, step next, filter by click, filter by arrow key, open a card, close it, open it again, step back.
- At 10x slower, each move was looked at mid-flight (`docs/screenshots/motion-2/`): the panel grows from the card, cards cross to their new places, the step comes in from the side.
- Focus stays on the filter after an arrow key. The setup still reaches the Ride tab with its course and workout.
- At rest no element has a move name.
- Reduced motion: no move ran at all, and every change still happened.

Not tested: Edge, and a real machine's frame rate with 37 cards moving at once.

## Queue

### Phase 3: the builder and the rest

Look at the Motion library again here, for drag physics only. Everything else can use `moveLayout`.

- Builder blocks with weight: a dragged block settles, neighbors make room.
- Time-axis rescale: the graph eases when the workout gets longer or shorter.
- FTP change effects: zones and watt labels ease to their new values.
- Ride history row: a new ride arrives in the table; a deleted one leaves.
