# Ride fixes after the first real ride (Nov 19, 2026)

Every judgment call made while fixing what the first Kickr ride showed, and what to test on the next ride. Written Nov 20, 2026.

Screenshots: `docs/screenshots/` (before and after, 1280x720).

## Part 1: ERG steps 1 / 5 / 10 W

- **Chose:** `ERG_STEPS_W = [1, 5, 10]`. Keys follow the same order as resistance: arrows 1 W, + / - 5 W, Shift + arrows 10 W.
- **Why:** the key handler already maps small / mid / large steps, so resistance, ERG and workout intensity now share one pattern. Nothing else changed.

## Part 2: Steady 1-second recording

**What was wrong.** Two things left holes in the FIT file:

1. A sample was saved only when a reading landed in a new wall-clock second. The Kickr's 1 Hz clock drifts against the computer's, and a hidden tab delivers readings late, so some seconds got no reading and no sample.
2. The recorder picked seconds by rounding down, but the FIT writer rounded to nearest. Two samples could collapse into one FIT second and leave the next one empty.

**Chose:**

- Every sample is stamped on the whole second (`t = sec * 1000`), so the recorder and the FIT writer always agree.
- When a reading skips one or two seconds and the gap since the last reading is 3 s or less (`MAX_SAMPLE_GAP_MS`), the skipped seconds are filled. Power and cadence hold the last recorded values (that is what the trainer last said for those seconds). Distance, course position, altitude and the workout clock are spread evenly across the gap.
- A gap over 3 s is a real dropout and stays a gap.
- Recording stays driven by readings, not timers. Chrome throttles timers in hidden tabs, but Bluetooth notifications still arrive, and time, distance and the workout clock already come from reading timestamps.
- The first reading in a second wins. A second reading in the same second does not overwrite it.

**Fake trainer:** press **J** or open `?fake=1&jitter=1`. Readings then arrive 0.3 to 2.6 s apart. The fake trainer also moved from `setInterval` to a `setTimeout` chain so the delay can vary.

**Proof (headless Chromium, FIT decoded with @garmin/fitsdk):**

| Run | Records | Span | Holes |
| --- | --- | --- | --- |
| Old recorder, jitter, 57 s | 33 | 56 s | 19 |
| New recorder, jitter, 70 s | 70 | 69 s | 0 |
| New recorder, steady 1 Hz, 72 s | 72 | 71 s | 0 |
| New recorder, timers throttled to once a second on the second (what Chrome does to a hidden tab), 64 s with a workout | 64 | 63 s | 0 |

In the throttled run the ride clock advanced 62 s over 61.5 s of wall time and the workout clock and laps (5) were right.

**Not covered:** headless Chromium would not actually hide the tab, so throttling was emulated by wrapping the page's timers. After 5 minutes hidden, Chrome can slow chained timers to once a minute. Recording is not affected (it runs on Bluetooth events), but a reconnect after a dropout could be slow while the tab is hidden, since the retry loop waits on a timer. Left alone; flagged in the summary.

## Part 3: Auto-pause

**Chose:**

- `AUTO_PAUSE_AFTER_MS = 3000` in `src/config.ts`. Pause when power and cadence are both 0 for 3 s. Resume on the first reading with either above 0.
- **The pause is backdated to the first zero reading.** For the 3 s it takes to confirm, the app keeps running and holds the zero samples in memory. When the pause is confirmed it drops them and puts distance, climbing and the workout clock back to where they were when the pedaling stopped. Why: the brief says a rider who stops and never resumes gets a file with no trailing zeros. The cost is that the clock steps back about 3 s at the moment "Paused" appears.
- If the rider pedals again within 3 s, nothing is paused and the coasting seconds are saved as real zeros.
- **The Time tile is now moving time.** It equals the FIT `total_timer_time`. `total_elapsed_time` still covers the whole ride.
- **Dropouts count as paused time too.** A data gap over 3 s already added no timer time in the FIT; now the clock on screen freezes during it and matches. One mechanism, and the on-screen time always equals the file.
- **Crash recovery resumes as paused.** The time between the last saved second and the first pedal stroke after Resume is a pause, so the clock picks up where it stopped. Each sample stores the total paused time so far (`pausedMs`) to make that possible.
- **FIT:** a timer `stop_all` event at the last record before each pause and a timer `start` at the first record after it. Lap timestamps now use the lap's last record (a lap that ends in a pause used to get a timestamp inside the pause).
- **End Ride while stopped** (paused, or inside the 3 s window): the ride ends at the moment the pedaling stopped.
- **UI:** StatusPill "Paused" in the `idle` tone, every tile and the course / workout stats gray out, and the control row says "Paused. Pedal to resume."
- **ERG:** pause and the low-cadence release are separate states and don't fight. The release is about the trainer (see part 4); the pause is about the ride. A stopped rider is released first and paused at 3 s. The first pedal stroke resumes the ride; ERG re-engages later, at 60 rpm.
- **Fake trainer:** **S** stops pedaling until pressed again, then spins back up from 0 rpm at 22 rpm per second.

**Known trade-off:** coasting a course descent for more than 3 s pauses the ride. Indoors that is right (you are off the pedals), but it is not what a real descent does. Soft-pedal on descents. Not pausing on descents was held back as a feature.

**Proof (fake trainer, FIT decoded with @garmin/fitsdk):** ride 15 s, stop 11 s, ride 12 s, coast 2 s, ride 6 s, stop 9 s, End Ride.

| Check | Free ride | Workout |
| --- | --- | --- |
| Time on screen at the end | 0:35 | 0:35 |
| FIT total_timer_time | 35 s | 35 s |
| FIT total_elapsed_time | 45 s | 45 s |
| Timer events | start 0, stop 15, start 26, stop 44 | same |
| Last three records | 230, 217, 219 W | 268, 262, 267 W |
| Laps (timer / elapsed) | 35 / 45 | 2/2, 20/30, 13/13 |
| Decode errors | 0 | 0 |

**Test on the next ride:**

1. Stop pedaling. Within about 4 s the status should read "Paused", the numbers gray out and Time stops.
2. Start again. Time and distance pick up on the first pedal stroke, with no jump in distance.
3. Stop for a minute mid-ride, then at the end stop pedaling and wait 30 s before End Ride. On Strava, moving time should be shorter than elapsed time by about those stops, and the power graph should not end in a flat zero line.
4. Does the Kickr send cadence 0 promptly when you stop? If "Paused" takes much longer than 4 s to appear, the Kickr is holding its last cadence value and the 3 s timer needs to start from power 0 alone. Tell me how long it took.
