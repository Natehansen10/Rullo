# Zone color on live power (Nov 24, 2026)

Asked for by Nate on Nov 24, 2026. The zone a rider is in should be readable at a glance from the saddle, by color, on the biggest thing on the screen. Until now the zone was an 8px swatch and a code. Built ahead, like the other exceptions. Its ride test is pending.

The rules are in `DESIGN.md`: "Zone color on live power" under Power zones, the Olive principle, "Color means something", the Type section, "Zone chip and zone color" under Motion, and the `MetricTile`, Zone chip and `PowerTrace` rows.

## The rule that changed

- **Before:** live power was Olive, one of Olive's three jobs. The tile and the number were never tinted by zone, and the trace was never colored by zone.
- **Now:** the Power number and the trace line are in the color of the power zone. Olive has two jobs: the primary action and route progress.
- **Why:** Nate approved it. A color on a 144px number can be read from a few feet away without looking for the chip.
- **What did not change:** color is never the only signal. The zone chip and its code are in the same place at the same size.

## What was built

- **The Power number takes the zone's color** (`z1` to `z7`). It is the zone the chip shows: the same held value (`ZONE_HOLD_S`, 2 s), so the number and the chip change in the same render and neither flickers at a zone edge.
- **The color eases** over `--ww-dur-base` (200ms). The digits change in place and never animate. The number's size and place are the same as before.
- **The trace line is colored a second at a time.** Each stretch of the line is in the zone of the power at the second it ends on. Same `zoneAt()`, same profile FTP, no hold: it is history.
- **Stale, paused or empty,** the number and the line are `fg-subtle`, as before. The gray-out still eases.
- **The unit "W" stays `fg-muted`.** The tile's background is not tinted.
- **A 1px `surface` hairline on each side of the zone-colored line.** See Contrast.
- **One switch:** `POWER_ZONE_COLOR` in `src/config.ts`.

| What | Where |
| --- | --- |
| `POWER_ZONE_COLOR` | `src/config.ts` |
| `tint` on the number | `src/components/MetricTile.tsx` |
| One path per zone, the hairline | `src/components/PowerTrace.tsx` |
| Passing the held zone to both | `src/App.tsx` |
| The seven stroke rules, `.ww-power-trace-halo` | `src/styles/index.css` |
| A comment only (no value changed) | `src/styles/tokens.css` |

`ride.ts`, `ble.ts`, `ftms.ts`, `heartRate.ts`, `recorder.ts`, `fit.ts`, `powerTrace.ts` and `workout.ts` are untouched. Nothing sent to the trainer changed. No new dependency.

## Contrast

WCAG contrast ratio, worked out from the hex values in `tokens.css`. Live numbers and graphics need 3:1.

| Zone | Token | On `surface` (the number, the line) | On `raised` (the line over the target band) |
| --- | --- | --- | --- |
| Z1 | #8C9096 | 3.21 | 2.68 |
| Z2 | #6E86A0 | 3.76 | 3.14 |
| Z3 | #2E9A58 | 3.57 | 2.98 |
| Z4 | #B5850E | 3.32 | 2.77 |
| Z5 | #D9661F | 3.58 | 2.98 |
| Z6 | #CC2F36 | 5.21 | 4.35 |
| Z7 | #A8306A | 6.37 | 5.31 |

- **On `surface` all seven pass.** No zone token was changed.
- **Z1 (3.21) and Z4 (3.32) are close to the limit.** Olive was 8.2. The number is much lighter than it was in every zone up to Z5.
- **On the target band four zones fail** (Z1, Z3, Z4, Z5). In ERG and in a workout the line rides on the band's top edge, so half of it is over `raised`. The fix used is the two-tone rule DESIGN.md already has for zone blocks: a 1px `surface` hairline on each side of the line. The line is then always next to `surface`. It is drawn under the target's edge and the baseline, so it clears only the band's fill.
- With `POWER_ZONE_COLOR` off there is no hairline: Olive is 6.8 on `raised`.

## Calls

- **The line takes the zone of the second it ends on.** A point is the end of its second (see `docs/power-trace.md`), so the stretch that leads up to a point belongs to it. A jump from Z1 to Z6 in one second is one Z6 stretch. It is not split into the zones it passes through: no reading was in them.
- **One path per zone, not one path per run.** All Z2 stretches are one path, all Z3 another. At most seven paths and the hairline. A path never changes zone, so the stroke's 200ms ease can only ever run for the gray-out. With a path per run, a run would take a new color each time the oldest one left the window, and the whole line would shimmer once a second.
- **No hold on the line.** The number waits 2 s to change zone. The line does not. So right after a zone edge the newest stretch of line can be in the new zone's color for up to 2 s before the number is. That is the hold working.
- **No zone means Olive.** The number is Olive when it is live and has no zone. Today that happens only with the switch off: FTP is always 50 to 600 W, so live power always has a zone.
- **The hairline** is the one thing here that is not only a color. It adds no size to anything. It is not seen on `surface`.
- **Other power numbers are not tinted:** the workout row's Target, the ERG target in the control row, Home, the ride summary and its chart. Checked in the code: none of them goes through `tint`.
- **The switch is a constant, not a setting.** It is there because this is a matter of taste Nate may reverse. It is not on the Profile tab.

## What the screenshots show

In `docs/screenshots/`, 1280x720 at 2x: `zone-sheet.png` (the Power tile in each of Z1 to Z7, ERG holding the power), `zone-z2.png`, `zone-z4.png`, `zone-z6.png` (free rides in Resistance) and `zone-trace.png` (Test Intervals near its end).

- **Z3 to Z7 read strongly.** Green, amber, orange, red and berry are told apart at once.
- **Z1 is the weak one.** It is a mid gray. It is the lightest thing in the ride panel, lighter than the Cadence and Speed numbers beside it, so the hero number looks quieter than its neighbors. It is also close to the stale gray (`fg-subtle`, 1.7:1 apart). Side by side they differ: Z1 is lighter and cooler. Alone, a rider could take a Z1 number for a stale one. The chip (hidden when stale) and the pill ("Reconnecting", "Paused") tell them apart. Color does not.
- **Z2 is better than Z1 but still soft.** The blue shows at this size. Z1 and Z2 are near each other: gray and gray-blue. An easy ride is mostly these two, so most of an easy ride the number is pale.
- **Z6 is the red of an error** (`state-over`, 1.1:1 apart). A big red number can read as an alarm. Nothing else on the screen says error at that moment.
- **On the line, Z1 and Z2 are hard to tell apart** at 1.5px. Z3 and up are clear. The steep stretches between intervals are short pieces of several colors.
- **The hairline is hardly seen.** A faint light edge where the line crosses the band.

If Z1 and Z2 are too pale in a real ride, the options are: darker `z1` and `z2` tokens (this also changes the strip, the builder and the zone table, so it is a design decision, not a fix), or zone color only from Z3 up with `fg` or Olive below. Neither was done.

## Checked

Headless Chromium against `vite preview` of the production build, `?fake=1`, FTP 220 W. The build from before this work was served beside it, and a build with the switch off.

- `npm ci`, then `npm run build`: passes.
- **Each zone.** ERG held 90, 145, 182, 215, 248, 297 and 380 W. In all seven the number's computed color was the zone token's value, the chip showed the same code, the swatch was the same token and the unit was `fg-muted`.
- **The hold.** With 1 s smoothing, at six zone edges the number's color changed 1.97 to 2.01 s after the number left the old zone, in the same read as the chip's code every time. The color reached the token 169 to 214 ms later. In 1,620 reads the tint and the chip never disagreed.
- **The trace.** After the seven zones: 7 paths, one per zone, each stroked in its token. All 67 stretches matched `zoneAt` of the watts at their end point (read back from the path), none off.
- **Stale (D):** the number and every path `fg-subtle`, chip hidden, "Reconnecting". Back to zone colors after.
- **Paused (S):** the same, with "Paused". Zone colors again when pedaling.
- **The number never moves.** Across a zone change its box, opacity and transform were the same as in the old build.
- **Switch off:** in 908 live reads across Z1 to Z7 the number was Olive (and `fg-subtle` easing to Olive on first data), the trace was one `accent` path with no hairline, and the chip still showed Z1 to Z7. Stale was `fg-subtle`.
- **Nothing moved.** Before and after, the boxes of the Power tile, its label row, the label, the chip, the swatch, the smoothing control, the number, the unit, the chart slot, the trace, the panel and the other five tiles were identical, idle and riding, at 1280x720 in all four ride types (free, Test Hills, Test Intervals, both). The page was 720 by 1280 in all eight.
- **Every number still updates.** In 10 s: Power 7 to 9 changes, Cadence 5 to 9, Speed 7 to 10, Distance 5, Time 10. Heart rate had no sensor.
- **Reduced motion:** the number's transition is 0 s and the line's is 0 s. In 830 reads across a zone change, a dropout and a pause, no color or stroke transition ever ran and every color read was a token.
- **Motion on:** a stroke was mid-ease only around the dropout. Never while riding.
- **The path is not rebuilt on a snapshot.** In 20 s of riding (80 snapshots) the five paths were rewritten 100 times: 20 redraws, one a reading. No path element was added or removed.
- No console errors in any run.

## Not checked

- **A real ride, from the saddle.** Whether Z1 and Z2 read at a few feet is a judgment about a real screen in a real room. This is the ride test.
- **Color vision.** Z3 green, Z4 amber, Z5 orange and Z6 red are the pairs red-green color blindness joins. The code is always there, but the big number's color will not help those riders. Not simulated.
- **The switch-off build against the old build, pixel for pixel.** Its line is one path where the old one had a path per run. The geometry is the same. The boxes were compared; the pixels were not.
- **1440x900 and 1024x768.** Only colors changed and the box check passed at 1280x720, so other sizes were not run.
- **J (jitter) and X (lost trainer).** Stale and paused cover the same `dim` path. Not run.
- **Edge.**

## Ride test

1. Easy spin in Z1 and Z2 for a few minutes. Can the number be read as easily as before? Does a Z1 number look stale?
2. Ride across a zone edge and sit on it. The number's color should change with the chip, about 2 s after, and not flicker.
3. A workout with hard intervals. Is a red Z6 number alarming?
4. Look at the line after a few intervals. Do the colors help, or is it noise at 1.5px?
5. Stop pedaling. Number and line go gray together.

## Not built

- A tint on the tile's background, the label or the unit.
- Zone color on any other power number, or on the ride summary's power chart.
- Zone color for heart rate. Heart rate has no zones in this app.
- A setting on the Profile tab. The switch is a constant.
- Darker `z1` or `z2`. No token changed.
- A legend for the line's colors. The chip names the current zone; the zone table is on Home and Profile.

## Switching it off

Set `POWER_ZONE_COLOR` to `false` in `src/config.ts` and build. The number and the line are Olive, the hairline is gone and the chip is as it was. Then put the old sentences back in `DESIGN.md` (the Olive principle and Power zones are the two that matter).
