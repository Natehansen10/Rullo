# Weem Watts Design Rules

Numbers first, dark graphite, and every color has one job. Built to be read from the saddle, a few feet from the screen.

Source: [Weem Watts Design System](https://claude.ai/artifact/MwUnE5KEPgbmD8FAaiLfcs). In code, `src/styles/tokens.css` is the single source of truth. No hex color may appear anywhere else.

## Principles

- **One big number.** Live power is the hero. Everything else supports it.
- **Color means something.** Chrome is neutral graphite. Color appears only for an action, a channel, or a state.
- **Ember is rare.** `accent` has three jobs: the primary action, live power, and route progress (the ridden stretch and position dot on the elevation profile). It never fills anything bigger than a button.
- **Calm while riding.** Numbers update in place. Nothing jumps, bounces, or flashes.
- **Never show frozen numbers as live.** Stale data turns `fg-subtle` and the StatusPill says "Reconnecting".
- **Units are lb and miles.** Never show kg or km.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `bg` | #0A0B0D | App canvas |
| `surface` | #111316 | Panels (one level, never nested) |
| `raised` | #181B1F | Pills, inputs, secondary buttons, hover |
| `line` | #23272C | Hairlines and panel borders |
| `line-strong` | #30353B | Input borders, active segment |
| `fg` | #F2F4F5 | Primary text, live numbers |
| `fg-muted` | #9AA1A9 | Labels, units |
| `fg-subtle` | #7C848D | Empty or stale values, tertiary text |
| `accent` (Ember) | #FF6A3D | Primary action, live power |
| `accent-hover` | #FF7F59 | Primary button hover |
| `accent-press` | #E85A2F | Primary button press |
| `accent-ink` | #140703 | Text on accent |
| `cadence` | #5EC8E5 | Cadence chart lines and dots only |
| `state-on` | #3DDC84 | Connected, on target |
| `state-under` | #FFC247 | Connecting, reconnecting, under target |
| `state-over` | #FF5A5F | Errors, destructive confirm, over target |

Dark only. No light theme.

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
- Depth comes from surface steps (`bg` to `surface` to `raised`) and 1px hairlines. No shadows.

## Motion

- 120ms for hover and press. Press scales to 0.98 (`.ww-press`).
- 200ms for state changes (stale gray-out, status dot).
- Ease-out `cubic-bezier(0.2, 0, 0, 1)`. No bounce or overshoot.
- `prefers-reduced-motion` sets every duration to 0 and turns off the press scale.
- Live power updates in place. No digit rolling.

## Layout

- **Top bar:** "Weem Watts" wordmark left. StatusPill and the Connect / End Ride button right.
- **Course picker:** its own panel above the ride panel, shown only before a ride starts. Rows split by hairlines; the selected row is `raised`.
- **One ride panel:** hero power tile on the left, 2x2 grid of cadence, speed, distance, time on the right, split by `line` hairlines. On a course, a full-width elevation profile row comes next. A full-width resistance row sits along the bottom. All rows are in the same panel, split by hairlines.
- **Fit a laptop:** at 1280x720 the resistance row must stay on screen during a course ride.
- Left-aligned. No centered hero layouts.

## Components (`src/components`)

| Component | Use |
| --- | --- |
| `MetricTile` | One live number with label and unit. `size="hero"` for power only. `dim` grays it out. |
| `StatusPill` | Connection state. Tones: `on`, `warn`, `error`, `idle`. |
| `Button` | `primary` (Ember, one per screen), `secondary`, `danger` (confirm End Ride). |
| `SegmentedControl` | Small option sets, like the 1s / 3s / 10s smoothing toggle. |
| `ElevationProfile` | Course stats row plus an SVG profile: `raised` fill, `fg-subtle` line, Ember for the stretch ridden and the position dot. Mile ticks in mono. |
| `ProfilePanel` | Rider weight, bike weight, FTP (number inputs) and position (SegmentedControl). Shown from the top-bar Profile button between rides. |
| `CoursePicker` | Free ride or a course (radio rows), Import GPX, and the start-mile input. |
| `Stepper` | Its label slot can hold a control: the control row puts the Resistance / ERG SegmentedControl there. Value flanked by direct step buttons (largest step outside: -10 -5 -1 value +1 +5 +10), 48px tall, for adjusting from the saddle. Status text after, key hint in mono on the right. |

Inputs use `raised` with a `line-strong` border and `radius-md`. Build new UI from these. Add a component here before using a new pattern.

## Banned

Purple, gradients, blur, glow, shadows, emoji, nested panels, centered hero layouts, Inter, Geist, default shadcn or Tailwind palette colors, hex values outside `tokens.css`.
