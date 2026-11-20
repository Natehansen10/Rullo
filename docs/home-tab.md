# Home tab and power zones

Asked for by Nate on Nov 20, 2026. Built ahead of the v3.2 ride test as a third exception (see `CLAUDE.md`). No trainer code changed, so there is nothing to ride-test.

## Part 1: power zones chart

One component, `ZoneTable`: a row per zone, Z1 to Z7, with the swatch and code, the name, the % FTP range and the watt range at the rider's FTP. It sits on the Profile tab right under the FTP field, and on Home.

### One source for the boundaries

`ZONES` in `src/lib/workout.ts` is the only place a zone boundary is written: tops at 55, 75, 90, 105, 120 and 150% FTP (Coggan levels), with the names. Built from it:

- `zoneOf(pct)`: the zone of a % FTP. Same answers as before.
- `zoneRanges(ftpW)`: the chart's rows.
- `zoneAt(pct, ftpW)`: the zone a block is drawn in.
- The builder graph's zone lines (they were a second copy of the numbers).

### Calls

- **Watts are rounded, not cut off.** A zone's last watt is its top % FTP times FTP, rounded to a whole watt, the way every watt on screen is rounded. At 249 W: Z1 ends at 137 W (55% is 136.95 W), Z2 starts at 138 W, Z7 is "375 W and up".
- **No gap, no overlap.** Each zone starts one watt above the last. Z1 starts at 0 W.
- **A block is colored by its whole watts.** The strip used to color a block by its exact % FTP. A block set in watts at 137 W (55.02% of 249 W) was Z2, while a 55% block, labeled 137 W, was Z1. The chart would have disagreed with one of them. Now the strip, the builder graph and the builder's "Z2 · 187 W" echo all use `zoneAt`: the zone of the whole watts the block comes to. For a whole % FTP nothing changes. Only a block within half a watt of a boundary can change color. This is the one change the Ride tab's workout strip gets.
- **Below 100 W FTP** a whole percent is less than a watt, so two neighboring percents can land on the same watt. The watt decides.
- **The block color is the workout's own zone.** It does not move with the intensity setting, as before.
- **% FTP column:** whole numbers ("up to 55%", "56 to 75%", "over 150%").
- **No panel of its own.** On Profile it is a block inside the rider panel, so there is no panel in a panel.

### Checked

At FTP 249, 220, 100 and 317, a workout with a block on each side of every boundary, set in watts and in % FTP (24 blocks): each block's color on the strip matches the chart row that holds its watt label. Ranges have no gap or overlap.
