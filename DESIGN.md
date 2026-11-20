# Weem Watts Design Rules

Numbers first, a warm light page, and every color has one job. Built to be read from the saddle, a few feet from the screen.

Source: [Weem Watts Design System](https://claude.ai/artifact/MwUnE5KEPgbmD8FAaiLfcs). In code, `src/styles/tokens.css` is the single source of truth. No hex color may appear anywhere else.

## Principles

- **One big number.** Live power is the hero. Everything else supports it.
- **Color means something.** Chrome is neutral warm gray. Color appears only for an action, a channel, or a state.
- **Cobalt is rare.** `accent` has three jobs: the primary action (one per screen: Connect, except on the Workout page, where the step button is primary, and in the workout builder, where Save is primary; Connect is secondary on both), live power, and route progress (the ridden stretch and position dot on the elevation profile). It never fills anything bigger than a button.
- **Calm while riding.** Numbers update in place. Nothing jumps, bounces, or flashes.
- **Never show frozen numbers as live.** Stale data turns `fg-subtle` and the StatusPill says "Reconnecting". An auto-paused ride does the same with "Paused" (`idle` tone), and the control row status reads "Paused. Pedal to resume."
- **Units are lb and miles.** Never show kg or km.

## Color tokens

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `bg` | #F5F2EC | App canvas, warm off-white | |
| `surface` | #FFFFFF | Panels (one level, never nested), selected segment | |
| `raised` | #EEEAE3 | Pills, inputs, secondary buttons, segment track | |
| `line` | #E2DDD4 | Hairlines and panel borders, secondary hover | |
| `line-strong` | #B9B2A6 | Input borders, selected segment border | |
| `fg` | #1B1A18 | Primary text, live numbers | 17.4 on surface, 15.6 on bg |
| `fg-muted` | #5C5850 | Labels, units | 7.1 on surface, 5.9 on raised |
| `fg-subtle` | #6E6960 | Empty or stale values, tertiary text | 5.5 on surface, 4.9 on bg, 4.6 on raised |
| `accent` (Cobalt) | #1F4FD1 | Primary action, live power, route progress | 6.8 on surface |
| `accent-hover` | #1A43B3 | Primary button hover | |
| `accent-press` | #163996 | Primary button press | |
| `accent-ink` | #FFFFFF | Text on accent | 6.8 on accent |
| `cadence` | #0F7591 | Cadence chart lines and dots only | 5.3 on surface |
| `state-on` | #1B7A43 | Connected, on target | 5.4 on surface, 4.8 on bg |
| `state-under` | #8A5A00 | Connecting, reconnecting, under target | 5.9 on surface, 5.3 on bg |
| `state-over` | #C0282F | Errors, destructive confirm, over target | 5.9 on surface, 4.9 on raised |

Light only. Text meets 4.5:1 on every background it sits on; live numbers and graphics meet 3:1.

### Power zones

For workout blocks and zone codes (v3.2). Each meets 3:1 on `surface`. Z2 is gray-blue, not blue, so it never reads as the accent. Always pair a zone color with its code (Z1 to Z7).

| Token | Value | Zone |
| --- | --- | --- |
| `z1` | #8C9096 | Active recovery, gray |
| `z2` | #6E86A0 | Endurance, gray-blue |
| `z3` | #2E9A58 | Tempo, green |
| `z4` | #B5850E | Threshold, amber |
| `z5` | #D9661F | VO2 max, orange |
| `z6` | #CC2F36 | Anaerobic, red |
| `z7` | #A8306A | Neuromuscular, berry |

## Type

- **Archivo** (variable, with the width axis) for everything. JetBrains Mono for small technical text only (smoothing toggle, footer).
- Installed through `@fontsource-variable`. No CDN.
- **Live numbers:** weight 600, `font-stretch: 112%`, `tabular-nums`, line-height 0.9 (`.ww-num`).
  - Power: 144px in `accent` (96px under 1200px wide).
  - Other tiles: 56 to 64px in `fg`.
  - Control values (resistance level): 40px in `fg` (`.ww-num-control`).
  - Course stats (grade, elevation, climbed, to go): 28px in `fg` (`.ww-num-sm`).
  - Units: 40% of the number size, `fg-muted`, 4px after the number (`.ww-unit`).
- **Labels:** 12px, weight 500, uppercase, letter-spacing 0.06em, `fg-muted` (`.ww-label`).
- Never Inter or Geist.

## Spacing and shape

- Spacing steps only: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (Tailwind `1 2 3 4 6 8 12 16`). Other steps are removed from the theme.
- Radius: 4 for chips and pills (`rounded-sm`), 6 for buttons (`rounded-md`), 10 for panels (`rounded-lg`). Fully round only for status dots.
- Depth comes from surface steps (white `surface` panels on the `bg` page, `raised` for controls) and 1px hairlines. No shadows.

## Motion

- 120ms for hover and press. Press scales to 0.98 (`.ww-press`).
- 200ms for state changes (stale gray-out, status dot).
- Ease-out `cubic-bezier(0.2, 0, 0, 1)`. No bounce or overshoot.
- `prefers-reduced-motion` sets every duration to 0 and turns off the press scale.
- Live power updates in place. No digit rolling.

## Layout

- **Top bar:** "Weem Watts" wordmark and the page tabs (Ride, Workout, Profile) left. StatusPill and the Connect / End Ride button right, on every page. Connect from another page jumps to Ride.
- **Ride page (`#/`):** live data only: the ride panel, plus notices (recovery, errors). No pickers.
- **Workout page (`#/workout`):** two steps, one at a time, under a mono "Step n of 2", the step title and one line of help. What is picked here is staged: it reaches the Ride tab only through Ride this workout or Done. The setup line says so in plain words. Its first row is the `ww-label` "Picked", the setup name and a mono detail; under it, in `fg-muted`, either "This is on the Ride tab now." or "Not on the Ride tab yet. The Ride tab has Flat road · Free ride." (naming what the Ride tab has). Locked from the first pedal stroke until New ride (the ride's own setup line only, labeled Riding or Last ride).
  - **Step 1, the course:** a grid of cards on the page, the same card as step 2 (2 columns, 3 from 1280px, 4 from 1536px): Flat road first (a `line-strong` baseline where the profile would be), then one card per course with a small elevation profile (48px, `raised` fill, `fg-subtle` line), the name, and a mono line with miles, feet of climbing and source. The card picked on this tab is `raised` with an `fg` border (picked, not yet on the Ride tab). Under the grid, the selected course's overview in one panel: name, `CourseOverview`, and the start mile. Then the setup line in its own panel with Next (primary).
  - **Step 2, the workout library** (laid out after Zwift's Workouts page): a side menu on the left (All workouts, Custom, each with a mono count; the current one is a `surface` chip with a `line-strong` border, as in TabNav), then the filter row (Length and Difficulty, both SegmentedControl, and a mono count) over a grid of cards (2 columns, 3 from 1280px, 4 from 1536px). Cards sit straight on the page (`bg`), never inside a panel. The first card is always the Custom Workout tile (`raised`, `line-strong` border, a plus, the name at title size); then Free ride; then one card per workout: a small `WorkoutStrip` without labels (48px), the name, and a mono line with length, difficulty and source. The card of the picked workout (or Free ride) is `raised` with an `fg` border. Clicking a workout card opens its **overview** in place of the grid; looking does not pick it. Ride this workout picks it, puts the course and that workout on the Ride tab and goes there. The Free ride card picks "no workout" and stays on the page. The overview's mono line adds "on the Ride tab now" for the workout the Ride tab has: one panel with ← All workouts and the name, `Stat inline` for duration and intervals, the buttons (Edit for a custom workout, Edit a copy, Delete with a `danger` confirm for the rider's own, and the primary Ride this workout), the description, and the strip at `ww-builder-graph` height. Under both, the setup line in its own panel with Back, and "Done: go to Ride" (primary) when no overview is open, so there is one primary per screen. Done puts exactly the setup line beside it on the Ride tab. No import buttons here.
- **Workout builder (`#/workout/build`):** a side trip from the Workout tab (the Workout tab stays current in the top bar). One panel, laid out after Zwift's workout editor and drawn with this system's tokens. Top to bottom, split by hairlines: a header row (← Back, the workout's name as the title in `ww-title-field`, a mono note); the details (Description left, the Difficulty tag right); the block area (`BuilderGraph`: the selected block's fields in a bordered `surface` box right above it, the graph, the block palette on the right, then Undo, Delete block and the key hint); the bottom bar (Display: % FTP / Watts, `Stat inline` for workout duration and intervals, a mono line, and the Step list toggle); the optional step list (`StepRow`, `RepeatGroup`, the add row); and a footer row with status text left and Save (primary) right. Back turns into `danger` "Discard changes" on the first click when there is unsaved work. The page may scroll. Locked mid-ride (one line in a panel).
- **Profile page (`#/profile`):** the rider panel, then "Your files": one panel with a Courses block and a Workouts block, each a heading, one line of help and its buttons (Import GPX; New workout and Import ZWO), followed by the rider's own files as rows: a custom workout has Edit and Remove (Remove asks twice, `danger` "Confirm remove"), an imported workout has Edit a copy and Remove, an imported course has Remove.
- **One ride panel:** hero power tile on the left, 2x2 grid of cadence, speed, distance, time on the right, split by `line` hairlines. On a course, a full-width elevation profile row comes next; with a workout, a workout row. With both, both rows show in compact form: labels sit beside their numbers on one line (`Stat inline`), the profile is 48px and the strip 56px, and the workout name truncates before anything wraps. A full-width control row sits along the bottom. All rows are in the same panel, split by hairlines. When the workout's current interval has a cadence target, the Cadence tile's label row shows it in mono ("target 90 rpm"): `fg-muted` before the workout starts, then `state-on`, `state-under` or `state-over` within or outside 5 rpm, always with the word (on, under, over) so color is never the only signal. It is a cue; the trainer never gets it.
- **Fit a laptop:** at 1280x720 the control row and its key hint must stay on screen in every ride type. With a course or workout row the tiles and control row use 16px vertical padding (24px on a free ride). Keep control status text short so the key hint stays on one line.
- Left-aligned. No centered hero layouts.

## Components (`src/components`)

| Component | Use |
| --- | --- |
| `MetricTile` | One live number with label and unit. `size="hero"` for power only. `dim` grays it out. `action` puts a small control or mono note in the label row (the smoothing toggle, the cadence cue). |
| `StatusPill` | Connection and ride state. Tones: `on` (Ready, Connected), `warn` (Connecting, Reconnecting), `error` (Disconnected, Not supported), `idle` (Not connected, Paused, Ride ended). |
| `Button` | `primary` (Cobalt, one per screen), `secondary`, `danger` (the second click of a two-click confirm: End Ride, Discard changes, Confirm remove; hover goes to `surface` so the red text keeps 4.5:1). `size="sm"` (8px by 4px padding) only for dense rows: the builder's step rows. |
| `SegmentedControl` | Small option sets, like the 1s / 3s / 10s smoothing toggle. Selected option is a `surface` chip with a `line-strong` border; hover only darkens text. One Tab stop, Left / Right arrows move the selection. |
| `ElevationProfile` | Course stats row plus an SVG profile (`compact`: stats on one line, profile at `ww-profile-compact`): `raised` fill, `fg-subtle` line, `accent` for the stretch ridden and the position dot. Mile ticks in mono. |
| `TabNav` | Page tabs in the top bar: links on a `raised` track; the current page is a `surface` chip with a `line-strong` border (same look as SegmentedControl, body size). |
| `WorkoutPage` | Its own screen at `#/workout`: the two-step setup (CoursePicker, then WorkoutPicker) with the setup line and step buttons. The picks are staged; the setup line says whether the Ride tab has them. While locked, the ride's setup line only. |
| `ProfilePage` | Its own screen at `#/profile`. Rider panel: rows split by hairlines, label and help text left, input right. "Your files" panel: Import GPX; New workout and Import ZWO; the rider's files as rows with their buttons (Edit or Edit a copy, Remove). Locked mid-ride. |
| `TextField` | A typed field at body size: `raised`, `line-strong` border, `radius-md` (`.ww-field`). Optional `ww-label` above it. Takes text so "12:00", "90%" and "225w" can be typed; a bad value turns the border `state-over` once the field is left, and the reason is always written out in the builder's status line. |
| `WorkoutBuilder` | Its own screen at `#/workout/build` (see Layout). Every change is kept as a draft in the browser and can be undone. |
| `BuilderGraph` | The builder's block canvas at `ww-builder-graph` height (264px): a `raised` plot with `line-strong` zone lines, Z1 to Z6 codes and time ticks in mono `fg-muted`; each block's width is time, height is % FTP and fill is its zone token, ramps sloped, `surface` hairlines between blocks. The selected block has a 2px `fg` outline; the same outline is its focus ring. A drop position is a 2px `fg` line. Cobalt is never used here. A cadence target shows as a mono note on a `surface` chip at the foot of the block. Beside the graph, the palette: small `raised` buttons, each a 28 by 16 swatch (zone color, slope or bars) and its name (Z1 to Z6, Warm up, Cool down, Intervals, Cadence). Click adds after the selected block; drag drops at a spot. Drag a block's top edge for power, right edge for time, body to move or onto Delete block. Keys on a block: ← → select, ↑ ↓ power, Shift + ← → time, Alt + ← → move, Delete, Ctrl + D, Ctrl + Z. |
| `StepRow` | One step in the builder's step list (the typed view of the same blocks, behind the Step list toggle), one line on the shared grid (`.ww-step-row`): mono step number, Steady / Ramp `SegmentedControl`, time, target (two fields and an arrow for a ramp) followed by a mono echo of what it comes to at the rider's FTP (zone code and the other unit), cadence, label, then small buttons: ↑, ↓, Copy, Delete. Alt + ↑ / ↓ moves the row, Ctrl + D duplicates it; focus stays with the row. |
| `RepeatGroup` | A repeat in the builder: a header row (number, "Repeat", a count field, "times", a mono summary, the same row buttons), then its steps numbered 2.1, 2.2 and set in from a `line-strong` rule, then small Add step to repeat / Add ramp to repeat buttons. Indentation and the rule group it; never a nested panel. |
| `CoursePicker` | Step 1: Flat road or a course, as cards (`role="radio"`) with a small elevation profile. The selected course opens `CourseOverview` and the start-mile input in a panel under the grid. |
| `CourseOverview` | The route at a glance: distance, climbing, low and high (`Stat inline`) over an elevation profile at `ww-profile` height (`raised` fill, `fg-subtle` line). A Cobalt hairline marks a start mile above 0. |
| `WorkoutPicker` | Step 2: the workout library (side menu, filters, card grid led by the Custom Workout tile) and the selected workout's overview. See Layout. Cards are `role="radio"`; the picked workout stays listed whatever the filters say. |
| `WorkoutStrip` | Every interval as a block: width is duration, height is % FTP, fill is the zone token (`z1` to `z7`), ramps sloped, `surface` hairlines between blocks. `labels={false}` drops the watt labels (the small graph on a workout card). Each block is labeled with its watts after intensity (ramps as start→end) in mono `fg-muted` above it, when the block is wide enough. The part done is washed with `surface` at 60%; a Cobalt line marks the position. |
| `WorkoutRow` | Ride panel row for a workout, one line at desktop width (the name truncates first): name, interval (label, n of N), target (W and %), a cadence target in rpm when any interval of the workout has one ("--" on intervals without; labeled RPM in `compact`), interval left, next target (or best minute in a ramp test), workout left, then the strip at `ww-profile` height (`compact`: one line, shorter labels, strip at `ww-strip-compact`). Before it starts: `Start workout` (primary, disabled with "Connect to start" until connected). After: Skip interval / End test. No buttons once the ride has ended. |
| `Stat` | Small live number with its label (`ww-num-sm`), for the course and workout rows. `inline` puts the label beside the number. |
| `Stepper` | At 1280px and wider the row never wraps: the status text takes the space left (two lines at most inside the row's height) and the key hint stays on one line. Its label slot can hold a control: the control row puts the Resistance / ERG / Grade SegmentedControl there (Grade only on a course). In Grade the value is hill feel in %. Value flanked by direct step buttons (largest step outside: -10 -5 -1 value +1 +5 +10), 48px tall, for adjusting from the saddle. Resistance (%), ERG target (W) and workout intensity (%) all use the same 1 / 5 / 10 steps and keys (arrows 1, + / - 5, Shift + arrows 10). Status text after, key hint in mono on the right. |

Inputs use `raised` with a `line-strong` border and `radius-md` (`.ww-field` for text fields). Build new UI from these. Add a component here before using a new pattern.

## Banned

Purple, gradients, blur, glow, shadows, emoji, nested panels, centered hero layouts, Inter, Geist, default shadcn or Tailwind palette colors, hex values outside `tokens.css`.
