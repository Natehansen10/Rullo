# Weem Watts Design Rules

Numbers first, a warm light page, and every color has one job. Built to be read from the saddle, a few feet from the screen.

Source: [Weem Watts Design System](https://claude.ai/artifact/MwUnE5KEPgbmD8FAaiLfcs). In code, `src/styles/tokens.css` is the single source of truth. No hex color may appear anywhere else.

## Principles

- **One big number.** Live power is the hero. Everything else supports it.
- **Color means something.** Chrome is neutral warm gray. Color appears only for an action, a channel, or a state.
- **Cobalt is rare.** `accent` has three jobs: the primary action, live power, and route progress (the ridden stretch and position dot on the elevation profile). It never fills anything bigger than a button.
- **Calm while riding.** Numbers update in place. Nothing jumps, bounces, or flashes.
- **Never show frozen numbers as live.** Stale data turns `fg-subtle` and the StatusPill says "Reconnecting".
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
- **Workout page (`#/workout`):** Course and Workout picker panels side by side (stacked under 1280px), each with its import button. Picking one clears the other. Locked from the first pedal stroke until New ride. Rows split by hairlines; the selected row is `raised`.
- **One ride panel:** hero power tile on the left, 2x2 grid of cadence, speed, distance, time on the right, split by `line` hairlines. On a course, a full-width elevation profile row comes next; with a workout, the workout row takes that slot instead (never both). A full-width resistance row sits along the bottom. All rows are in the same panel, split by hairlines.
- **Fit a laptop:** at 1280x720 the resistance row must stay on screen during a course or workout ride. Keep control status text short so the key hint stays on one line.
- Left-aligned. No centered hero layouts.

## Components (`src/components`)

| Component | Use |
| --- | --- |
| `MetricTile` | One live number with label and unit. `size="hero"` for power only. `dim` grays it out. |
| `StatusPill` | Connection state. Tones: `on`, `warn`, `error`, `idle`. |
| `Button` | `primary` (Cobalt, one per screen), `secondary`, `danger` (confirm End Ride). |
| `SegmentedControl` | Small option sets, like the 1s / 3s / 10s smoothing toggle. Selected option is a `surface` chip with a `line-strong` border; hover only darkens text. One Tab stop, Left / Right arrows move the selection. |
| `ElevationProfile` | Course stats row plus an SVG profile: `raised` fill, `fg-subtle` line, `accent` for the stretch ridden and the position dot. Mile ticks in mono. |
| `TabNav` | Page tabs in the top bar: links on a `raised` track; the current page is a `surface` chip with a `line-strong` border (same look as SegmentedControl, body size). |
| `WorkoutPage` | Its own screen at `#/workout`: CoursePicker and WorkoutPicker panels, or a one-line "Riding: ..." panel while locked. |
| `ProfilePage` | Its own screen at `#/profile` (Profile tab). One panel of rows split by hairlines: label and help text left, input right. Locked mid-ride. |
| `PickerRow` | One radio row in a picker panel: dot, title, mono meta, optional action (Remove). |
| `CoursePicker` | Free ride or a course (radio rows), Import GPX, and the start-mile input. |
| `WorkoutPicker` | No workout or a workout (radio rows), Import ZWO, and a strip preview of the selection (`ww-strip-preview`, 64px). |
| `WorkoutStrip` | Every interval as a block: width is duration, height is % FTP, fill is the zone token (`z1` to `z7`), ramps sloped, `surface` hairlines between blocks. Each block is labeled with its watts after intensity (ramps as start→end) in mono `fg-muted` above it, when the block is wide enough. The part done is washed with `surface` at 60%; a Cobalt line marks the position. |
| `WorkoutRow` | Ride panel row for a workout: name, interval (label, n of N), target (W and %), interval left, next target (or best minute in a ramp test), workout left, then the strip at `ww-profile` height. Before it starts: `Start workout` (primary, disabled with "Connect to start" until connected). After: Skip interval / End test. |
| `Stat` | Small live number with its label (`ww-num-sm`), for the course and workout rows. |
| `Stepper` | Its label slot can hold a control: the control row puts the Resistance / ERG SegmentedControl there. Value flanked by direct step buttons (largest step outside: -10 -5 -1 value +1 +5 +10), 48px tall, for adjusting from the saddle. Status text after, key hint in mono on the right. |

Inputs use `raised` with a `line-strong` border and `radius-md`. Build new UI from these. Add a component here before using a new pattern.

## Banned

Purple, gradients, blur, glow, shadows, emoji, nested panels, centered hero layouts, Inter, Geist, default shadcn or Tailwind palette colors, hex values outside `tokens.css`.
