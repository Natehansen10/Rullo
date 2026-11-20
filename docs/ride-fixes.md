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

## Part 4: Light restarts in ERG

**What the investigation found.** The released state sent one command: Set Target Resistance Level (FTMS op 0x04) at the bottom of the trainer's range. On the ride, restarts made 135 to 165 W at 40 to 52 rpm, which is about the ERG target. So the trainer was most likely still holding ERG. Four things could cause that, and the code had all four:

1. **The Kickr may refuse the release.** An open-source Kickr Core 2 project (kickrBridge, MIT) records that a real Core 2 "sometimes returns FTMS Control Point result 0x04 Operation Failed for Set Target Resistance when the flywheel is nearly stationary." Our release was sent exactly then (3 s after the rider stopped), and a failed command was never sent again. The trainer would stay in ERG at the full target. This is the leading suspect. It is one third-party report, not confirmed on Nate's trainer.
2. **Release took 3 s.** For those 3 s the brake fights a slowing flywheel. Wahoo's own support pages say ERG at low rpm can "apply 100% of its force."
3. **One cadence reading of 60 re-engaged ERG.** A single stray reading during a hard first pedal stroke would put the full target on at 45 rpm.
4. **Re-engage went straight to the full target.**

Level 0 itself is fine: the same project reports the Core 2's range as raw bytes `00 00 64 00 01 00` (0 to 100, step 1), and our 0% maps to raw 0, the lightest brake setting.

**Chose:**

- **Release in two steps** (`release()` in `src/lib/ble.ts`): first Set Target Power at 25 W (`ERG_RELEASE_W`), then Set Target Resistance Level at the minimum. The first stays inside ERG, which trainers accept at a standstill. If the second is refused, the trainer is holding 25 W, not 150 W.
- **Retry refused commands.** Any control command the trainer answers "failed" to is sent again 2 s later (`CONTROL_RETRY_MS`), once the rider is pedaling. This also covers the resistance level sent at connect, when the flywheel is stopped. The status text changed from "Tap again" to "Retrying".
- **Release sooner on a stop:** below 20 rpm for 1 s (`ERG_STOPPED_RPM`, `ERG_STOPPED_AFTER_MS`). The brief said cadence 0; 20 rpm was chosen because a trainer's cadence estimate can read a few rpm while the flywheel coasts down. The 50 rpm for 3 s rule stays.
- **Re-engage needs 60 rpm held for 1 s** (`ERG_RESUME_AFTER_MS`).
- **Soft start, 6 s** (`ERG_SOFT_START_MS`): the commanded target ramps in a straight line from the rider's current 3 s power (at least 25 W) to the real target, one update per second. Why 6 s: long enough for the flywheel to be at speed before the full load lands, short enough to cost little of an interval. Wahoo's own "ERG Easy Ramp" takes 10 to 15 s, which felt too long for 3-minute intervals. No ramp when the rider is already at or above the target.
- The soft start runs on every engage: ride start, after a release, switching Resistance to ERG while pedaling, after a reconnect, and when Start workout is pressed.
- Every connect and reconnect now starts released (it used to engage at once if the last cadence seen was 60 or more).

**Considered and not done:** releasing into simulation mode at 0% grade (op 0x11), which Croissant Ride does. It is a command this app has never sent to the Kickr, and with normal road coefficients a flat road at 60 rpm in a big gear is over 100 W, so it is not obviously lighter. The two-step release uses only commands the Kickr has already accepted. Worth trying if restarts are still heavy.

**Why it can't get stuck:**

- Released while pedaling normally: re-engage is 60 rpm for 1 s, checked on every cadence reading. A rider who settles between 50 and 59 rpm stays released with the "Spin above 60 rpm" message, as before.
- Stuck in the ramp: the ramp is a function of time since engage, so it ends 6 s later whatever happens.
- Stuck at 25 W: that target is only sent as part of a release, and every engage sends the real one.

**Fake trainer:** ERG now holds its target at any cadence above 0, and a resistance level is refused while stopped, so each restart shows the 25 W fallback, the retry, the re-engage and the ramp. Trace from the fake (1 s power): stop, then `0 0 0` paused, restart `23 28 91 130` (released, spinning up), `46 65 81 92 113 126 144` (easing in), `141 147 148` (target 145 W).

**Test on the next ride (ERG, small ring, middle cog):**

1. **Stop pedaling.** The load should let go within about 2 s, well before the flywheel stops. Before, it fought you for 3 s.
2. **Restart from a full stop.** The first pedal strokes should feel like spinning up a flywheel and nothing more. If it is still heavy, check the status text: "Trainer didn't take the change. Retrying." means the Kickr refused a command, which confirms suspect 1. Tell me what it said.
3. **Spin to 60 rpm and hold.** About 1 s later the status reads "Easing in to target" and the load builds for 6 s. It should feel like a ramp, not a wall.
4. **Start of the ride in ERG:** same soft start.
5. **Drop to 40 rpm for 5 s mid-interval, then spin up.** It should release at 3 s and ease back in.
6. **Grind at 55 rpm on purpose.** ERG must hold. It should only let go below 50.
7. If the 6 s ramp feels too slow or too quick, say so. It is one constant.
8. Gear matters: a big gear makes any restart heavy because you are accelerating the flywheel. Small chainring, middle cog.
