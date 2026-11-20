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
