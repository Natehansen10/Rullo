# Power trace (Nov 24, 2026)

Asked for by Nate on Nov 24, 2026. On the Ride tab the Power tile is two fifths of the panel, and on a free ride most of it was blank. A number shows power now. It cannot show whether the rider is holding it. Built ahead, like the other exceptions. Its ride test is pending.

The rules are in `DESIGN.md`: `PowerTrace` in the Components table, "One ride panel" and "Fit a laptop" under Layout, and "Power trace" under Motion.

Later the same day Nate asked for zone color on live power. The line is now colored by zone, a second at a time, and no longer Olive. Where this doc says Olive, or "never tinted by zone", read `docs/zone-color.md`. Everything else here stands.

## What was built

- **A line of the last 3 minutes of power** in the Power tile, between the label row and the big number. Newest at the right edge, one point a second. `POWER_TRACE_WINDOW_S` (180) in `src/config.ts`.
- **The line is the number over time.** Each point is the number the tile showed in that second. The trace keeps all three smoothing windows (1 s, 3 s, 10 s) for every second, so the line follows the smoothing control, and changing it redraws the whole line at once.
- **A target band behind the line** when something sets a target power: a flat `raised` area from 0 W up to the target of each second, with a 1px `line-strong` top edge. An interval change is a vertical step. A ramp slopes.
- **A gap for a second with no reading.** Nothing is held or filled in.
- **Olive**, 1.5px, like `RideChart`'s line weight, over a 1px `line` baseline at 0 W. Nothing else new is Olive. No fill under the line, no gradient, no axis, no labels.
- **It costs no height.** It is drawn only in space the tile already has spare, and not at all when that is under 48px.

| What | Where |
| --- | --- |
| The buffer (`PowerTrace` class), the scale rule (`traceTopW`) | `src/lib/powerTrace.ts` (new) |
| The component | `src/components/PowerTrace.tsx` (new) |
| `chart` slot between the label row and the number | `src/components/MetricTile.tsx` |
| Feeding the buffer, `powerTrace` on the snapshot | `src/lib/ride.ts` |
| The four constants | `src/config.ts` |
| `.ww-tile-chart`, `.ww-power-trace` | `src/styles/index.css` |

## What changed in `ride.ts`, and what did not

The trace is reading state only. Eight small edits:

- `onReading` pushes one entry after the reading has been handled as before.
- `pause()` takes back the still seconds. `resume()` asks for a break in the line.
- `beginRide()`, `resetRide()` and the two places the phase changes on a connect or a lost trainer clear it.
- Two private helpers read the tile's number and the current target. The snapshot carries `powerTrace`.

Nothing that is sent to the trainer reads the trace. No control code, no recording code and no FIT code changed. `ble.ts`, `ftms.ts`, `heartRate.ts` and `recorder.ts` are untouched. The trace is in memory only and is never saved.

## Calls

- **Three minutes.** Long enough to see an interval and the recovery after it. Short enough that a second is still 2.4px wide at 1280.
- **The line follows the smoothing control.** The other choice was raw 1 second power whatever the control says. Then the line and the number would disagree, and the newest point would not be the number on the tile. Now it always is.
- **Before Start ("Not recording") the trace is live**, in Olive, like the number above it. **Start clears it.** Time and distance start from zero at Start, and so does the trace: what was pedaled before Start is not part of the ride. The line is gone for a second when Start is pressed. That is the one visible cost.
- **A pause takes no width.** While auto-paused nothing is added. The pause is backdated to the first still second (as the recording is), so the three seconds of falling power drawn while the pause was pending are taken back. Pedaling again leaves a break of one empty second, so the line before and after are not joined as if nothing happened.
- **A dropout takes its real width.** Five seconds without data is a gap five seconds wide. The rider was riding; the data is what was lost. This is on purpose not the same as a pause. During the dropout the trace does not move at all, because nothing arrives to draw. The gap shows when data comes back.
- **A reconnect mid-ride is the same: a gap** as wide as the time away. More than 3 minutes away and the trace starts again from empty.
- **A lost trainer before Start clears the trace.** There is no ride for it to belong to.
- **After End Ride the trace stays**, in `fg-subtle`, until New ride. Distance and Time stay too. The Power number goes to "--".
- **The band is what was asked, not what was commanded.** During a soft start the trainer is sent less than the target for 6 s. The band shows the target. While ERG is released at low cadence it still shows the target.
- **The band shows the workout target whenever the workout is running**, also when the rider has switched to Resistance ("Workout targets are off."). The workout is still asking. After the workout is done, the band goes on only in ERG ("Holding the last target").
- **In ERG with no workout the band is the ERG target**, also before Start. No band on a resistance or Grade ride.
- **The band is `raised` with a `line-strong` edge.** `raised` alone on `surface` is too faint to read from the saddle. The edge is the target; the fill makes it a shape and not a second line.
- **Scale.** 0 at the bottom. The top is the larger of 120% of FTP and 110% of the highest power or target in the window, rounded up to 50 W. At an FTP of 220 W it is 300 W until something passes 272 W. It can only step up when a new high arrives and step down when that high leaves the window 3 minutes later.
- **No number on the scale.** The big number is right under the line's newest point, and the band gives the line something to be read against. A watt label would be one more number on the Ride tab. If the height turns out hard to read on a free ride, a mono label at the top is the first thing to add.
- **Seconds are counted from the readings, not from the wall clock.** A trainer's clock drifts against the computer's. Cutting time at wall-clock seconds would leave an empty second every minute or two with nothing lost. A reading up to 0.75 s late still lands in the next second. One that is later leaves a gap. Several readings in one second share a point, and the latest wins.
- **Redraw, not glide.** The line is drawn again when a reading arrives and holds still in between. A slide between seconds would have to move a line whose newest end is not known yet, which is motion the data does not back. The only thing that eases is the color, with the number's, when the data goes stale or comes back.
- **The trace hides, it never squeezes.** `MetricTile` gives it a slot that takes the free height and asks for none (a negative margin takes back the gap a third child would add). Under 48px the slot is empty.
- **Room for zones.** The line is built as a list of runs, each drawn as its own path. To color by zone later, split a run where the zone changes and give each piece its token. Not done now: the tile, the number and the line are never tinted by zone.

## Where it shows

| Window | Free ride | Course | Workout | Course and workout |
| --- | --- | --- | --- | --- |
| 1280x720 | 241px | 50px | 78px | not drawn (17 to 26px spare) |
| 1440x900 | 421px | 230px | 258px | 197px |
| 1920x1080 | 601px | 410px | 438px | 377px |
| 1024x768 | not drawn | not drawn | not drawn | not drawn |

Under 1280 wide the panel stacks and the Power tile is as tall as its content, so there is nothing spare at 1024x768. A taller window at that width leaves the tile height to spare, and the trace then runs the full width of the panel: at 1024x1000 it is 236px on a free ride and 153px with a workout row. At 1240x720 there is none.

## Checked

Headless Chromium against `vite preview` of the production build, `?fake=1`. The build from before this work was served beside it for the comparison.

- `npm ci`, then `npm run build`: passes.
- **Nothing moved.** The boxes of the panel, all six tiles, their label rows and numbers, every row, the control row, its buttons, the key hint, the header and the footer, in 48 states: free, course, workout and both; idle, waiting for Start and riding; 1280x720, 1440x900, 1920x1080 and 1024x768. Before and after are identical in all 48. At 1280x720 the page is 720 tall in all twelve, with no scroll.
- **The points are the readings.** With 1 s smoothing, at 386 reads of the page over 40 s the newest point was the Power number (worst difference 0.06 W, which is the path's rounding). The last 35 points were the last 35 numbers shown, in order. With 3 s smoothing the same held (0.06 W).
- One point a second, 2.43px apart, the newest at the right edge. The path changed 39 times in 40 s, not 160.
- **D (dropout):** the trace did not change while no data came, turned `fg-subtle` with "Reconnecting", and came back Olive with two runs and a gap 6.0 s wide (61 points in 66 slots).
- **S (auto-pause):** 69 slots before, 72 while the pause was pending, 69 once paused. No change in 4 s of pause, in `fg-subtle`. Pedaling again: a new run after a break of one slot.
- **X mid-ride, then Reconnect:** the trace stayed in `fg-subtle`, then a new run after a gap 6.0 s wide.
- **X before Start:** the trace was cleared.
- **Test Intervals:** the band's levels were 132, 264, 110, 264, 110 W, then a ramp up 3 or 4 W a second. Four vertical steps. From the start of the first hard interval to the end of the second was 55.0 s (planned 55). After the workout, in ERG, the band held 176 W.
- **ERG with no workout:** the band was at the ERG target (145 W).
- **The cap:** in 200 s of riding the trace never held more than 180 slots or drew more than 180 points, and the scale top stayed at 300 W.
- **End Ride, New ride:** gray after End Ride, nothing after New ride, and the next connect started from empty. Start cleared the trace (1 slot right after it).
- **Every number still updates:** in 10 s, Time changed 10 times, Power 10, Cadence 6, Distance 5 (it has two decimals), Speed 4.
- **Motion:** while riding no animation or transition ever ran on the trace. Across a dropout the only property that eased was the line's color. With reduced motion: none at all in 421 reads over 23 s of riding, a dropout and a pause, and the color snapped.
- No console errors in any run.
- Screenshots in `docs/screenshots/`, 1280x720 at 2x after 80 s of riding: `trace-free.png`, `trace-workout.png` (the band across four interval changes), `trace-gap.png` (D at 50 s), `trace-both.png` (course and workout: no trace at this size, by the rule above) and `trace-both-1440.png` (the same ride at 1440x900, where it shows).

## Not checked

- **A real Kickr.** The fake trainer sends exactly one reading a second. How often the real one does, and how late, decides how often a second is empty. This is the ride test.
- **That the path is not rebuilt on every snapshot** was read from the code (`useMemo` on the snapshot's trace, which is a new object only after a reading), not measured. The path string changing once a second does not prove it by itself.
- **J (jittery delivery).** Readings 0.3 to 2.6 s apart will leave many one or two second gaps. That is the rule working, and it stands for a hidden tab, but it was not looked at.
- **A trainer that sends faster than once a second.** The buffer merges those readings into one second. Run in the head only.
- **Edge.**
- **The course row at 1280x720 has 50px, 2px over the limit.** Any later change that costs the tile 2px will make the trace vanish there. That would be the rule working, but it is close.

## Ride test

1. Free ride, Resistance. Hold a steady effort for 3 minutes. The line should be level and calm, and its right end should be the number under it.
2. Switch the smoothing between 1s, 3s and 10s. The whole line should change at once, and nothing else should move.
3. Stop pedaling for 10 seconds. The line should stop and turn gray. Pedal again: it should go on after a small break.
4. Ride a workout. The band should step at each interval change, and the line should sit on it in ERG.
5. Watch for gaps while riding steadily. A gap means a second came with no power reading. A few an hour is the trainer. Many means the rule for counting seconds needs a wider tolerance (`SLOT_TOLERANCE_MS` in `src/lib/powerTrace.ts`).
6. From the saddle: is 1.5px enough to read the line? Is the band's edge clear?

## Not built

- Color by zone on the line, and any tint on the tile or the number. A separate feature.
- A watt label or grid lines on the scale. A time label.
- A slide between seconds.
- A longer window, or a setting for it.
- Heart rate or cadence on the same chart.
- Hover details. The trace takes no clicks.
- Saving the trace. The ride summary's `RideChart` draws the saved ride.
