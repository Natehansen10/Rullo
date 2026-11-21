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
- **Retry refused commands.** Any control command the trainer answers "failed" to is sent again 2 s later (`CONTROL_RETRY_MS`), once the rider is pedaling. This also covers the resistance level sent at connect, when the flywheel is stopped. The status text changed from "Tap again" to "Trainer refused it. Retrying."
- **Release sooner on a stop:** below 20 rpm for 1 s (`ERG_STOPPED_RPM`, `ERG_STOPPED_AFTER_MS`). The brief said cadence 0; 20 rpm was chosen because a trainer's cadence estimate can read a few rpm while the flywheel coasts down. The 50 rpm for 3 s rule stays.
- **Re-engage needs 60 rpm held for 1 s** (`ERG_RESUME_AFTER_MS`).
- **Soft start, 6 s** (`ERG_SOFT_START_MS`): the commanded target ramps in a straight line from the rider's current 3 s power (at least 25 W) to the real target, one update per second. Why 6 s: long enough for the flywheel to be at speed before the full load lands, short enough to cost little of an interval. Wahoo's own "ERG Easy Ramp" takes 10 to 15 s, which felt too long for 3-minute intervals. No ramp when the rider is already at or above the target.
- The soft start runs on every engage: ride start, after a release, switching Resistance to ERG while pedaling, after a reconnect, and when Start workout is pressed.
- Every connect and reconnect now starts released (it used to engage at once if the last cadence seen was 60 or more).

**Considered and not done:** releasing into simulation mode at 0% grade (op 0x11), which Croissant Ride does. It is a command this app has never sent to the Kickr, and with normal road coefficients a flat road at 60 rpm in a big gear is over 100 W, so it is not obviously lighter. The two-step release uses only commands the Kickr has already accepted. Worth trying if restarts are still heavy.

**Why it can't get stuck:**

- Released while pedaling normally: re-engage is 60 rpm for 1 s, checked on every cadence reading. A rider who settles between 50 and 59 rpm stays released with the "Released. Spin up to 60 rpm." message.
- Stuck in the ramp: the ramp is a function of time since engage, so it ends 6 s later whatever happens.
- Stuck at 25 W: that target is only sent as part of a release, and every engage sends the real one.

**Fake trainer:** ERG now holds its target at any cadence above 0, and a resistance level is refused while stopped, so each restart shows the 25 W fallback, the retry, the re-engage and the ramp. Trace from the fake (1 s power): stop, then `0 0 0` paused, restart `23 28 91 130` (released, spinning up), `46 65 81 92 113 126 144` (easing in), `141 147 148` (target 145 W).

**Test on the next ride (ERG, small ring, middle cog):**

1. **Stop pedaling.** The load should let go within about 2 s, well before the flywheel stops. Before, it fought you for 3 s.
2. **Restart from a full stop.** The first pedal strokes should feel like spinning up a flywheel and nothing more. If it is still heavy, check the status text: "Trainer refused it. Retrying." means the Kickr refused a command, which confirms suspect 1. Tell me what it said.
3. **Spin to 60 rpm and hold.** About 1 s later the status reads "Easing in to target" and the load builds for 6 s. It should feel like a ramp, not a wall.
4. **Start of the ride in ERG:** same soft start.
5. **Drop to 40 rpm for 5 s mid-interval, then spin up.** It should release at 3 s and ease back in.
6. **Grind at 55 rpm on purpose.** ERG must hold. It should only let go below 50.
7. If the 6 s ramp feels too slow or too quick, say so. It is one constant.
8. Gear matters: a big gear makes any restart heavy because you are accelerating the flywheel. Small chainring, middle cog.

## Part 5: Speed and distance that feel right indoors

**What was wrong.** The model was a real road bike: all 203 lb of rider and bike carried momentum. After a stop, speed took about 2 minutes to reach 0 and added over 1,100 ft. After a power change, speed took about 40 s to settle, so it always looked stuck near 19 mph.

**Chose:**

- **`INERTIA_SHARE = 0.15`.** Only 15% of the mass resists a change of speed. Gravity, rolling resistance and drag still use the full mass, so steady speed at any power and grade is exactly what it was. Why 15%: speed covers 90% of a change in about 6 s, and 1 Hz power noise of ±8 W moves speed only ±0.25 mph. Lower shares made speed twitchy.
- **`COAST_DOWN_S = 4`.** With 0 W, speed runs down in a straight line to 0 in 4 s from wherever it was, including on a descent. This is a flywheel, not a road bike. Auto-pause then freezes distance at 3 s and puts it back to where the pedaling stopped, so a stop adds nothing.
- Speed still comes from power only. Cadence is not in the formula.

**Numbers (203 lb, hoods), old model then new:**

| Check | Old | New |
| --- | --- | --- |
| Steady speed at 145 / 180 W | 18.3 / 19.9 mph | 18.3 / 19.9 mph |
| 180 W to 145 W, 90% of the change | 39 s | 6 s |
| Stop pedaling at 19.9 mph, time to 0 | 116 s, 1,155 ft | 4 s, 54 ft |
| Standstill to 90% of speed at 180 W | 30 s | 5 s |
| 180 W on a 5% climb / 3% descent | 7.7 / 29.9 mph | 7.7 / 29.9 mph |

Courses: climbs still slow the rider and descents still speed them up while pedaling. The elevation profile and resume-from-mile are untouched.

**Why speed barely moves with power on a flat road.** Above about 15 mph nearly all your power goes into pushing air, and the power needed to push air rises with the cube of speed. Going 10% faster takes about 33% more power. So 145 W to 180 W is 24% more power but only 1.6 mph (18.3 to 19.9). That is physics, not a bug, and it is the same outdoors. Speed swings much more on hills, where gravity takes over from air.

**Test on the next ride:**

1. Stop pedaling: speed should be at 0 within about 4 s and distance should not move while paused.
2. Step the ERG target by 20 W: speed should start moving at once and settle within about 6 s, by roughly 1 mph.
3. Speed should not flicker second to second at a steady target. If it does, the share needs to go up.

## Part 6: Is power calibrated?

**Finding: no bug in the power path. The number on screen is the Kickr's own.**

- **Field order.** `parseIndoorBikeData` reads the flags in FTMS 1.0 order: speed (present when bit 0, "More Data", is 0), average speed, cadence, average cadence, total distance (3 bytes), resistance level, power. Checked with 13 hand-built packets: a typical Kickr packet (flags 0x0044), More Data set, every optional field before power, trailing fields, a reading split across two packets, negative power, and truncated packets.
- **No scaling.** Power is read as a signed 16-bit watt value and used as is. The only change anywhere is clamping negatives to 0.
- **Smoothing.** 1 s shows the last reading, 3 s the mean of the last 3, 10 s the mean of the last 10 (checked at 1 Hz). The FIT file stores the unsmoothed reading.
- **FTMS was in use.** The app only falls back to Cycling Power when the trainer has no FTMS service, and ERG cannot work over the fallback. ERG held the target, so FTMS was in use. The footer also shows the protocol while connected.
- **ERG agreed.** The trainer held 145 to 179 W within about 1 W of what the app asked for. The app and the Kickr agree on what a watt is; whether the Kickr's watt is a true watt is the spindown's job.

**Changed anyway (hardening, not a fix):** both parsers now stop cleanly on a packet shorter than its flags claim. Before, that would have thrown inside the Bluetooth event handler.

**Why 180 W may have felt brutal:**

1. **Calibration drift.** Run a spindown in the Wahoo app after a 10-minute warm-up. Close the Wahoo app before opening Weem Watts.
2. **Gear.** In ERG the trainer sets the load; the gear sets flywheel speed. A big gear spins the flywheel fast (more momentum, feels like a flat road). A small gear feels like a climb but is quieter and more accurate. Use the small chainring and a middle cog.
3. **The restarts.** Each one was a low-cadence grind at full target, which costs far more than steady riding (part 4).
4. **FTP may be set high.** The app default is 220 W, so 180 W is 82% of FTP, tempo. If true FTP is nearer 200 W, 180 W is 90%, which is hard to hold for long. The ramp test will settle it.

**Test on the next ride:** after the spindown, ride 5 minutes at 150 W in ERG and see whether it feels like the same effort as before.

## Part 7: Course and workout together

**Chose:**

- Picking a course no longer clears the workout, or the other way round. Both are remembered between rides.
- With both: the workout drives ERG, the course drives speed, distance and the profile. Crash recovery restores both (tested: reload mid-interval, Resume, the workout clock and course position carry on). The FIT is a virtual ride with altitude and one lap per interval (tested: 4 laps, lap totals equal session totals).
- **Workout tab is one panel.** The top line is the setup ("Test Hills · Test Intervals", with distance and duration in mono). Below it are two halves, "Where" and "What", each with one line saying what it controls. The course list's first row is now "Flat road" (it was "Free ride"); "Free ride" now means neither a course nor a workout.
- **Ride tab with both rows:** each row goes compact. Labels sit beside the numbers on one line, the profile is 48 px tall and the strip 56 px. Workout labels shorten ("Left", "Total left"). The numbers stay 28 px.
- The workout name truncates before anything wraps. After a ramp test the FTP estimate replaces "Best min" and "Total left" in the compact row so it stays on one line.
- **Fit at 1280x720.** Before this work a course ride was already 86 px too tall at 1280x720 and a workout ride 58 px (the control row was off screen). Now every ride type fits: with a course or workout row, tiles and the control row use 16 px vertical padding, and the ride page's outer padding went from 24 to 16 px.
- Idle status text shortened ("66% FTP · on connect", "Applies on connect") because the longer text wrapped the key hint onto a second line.
- If the course ends before the workout, the rider carries on along a flat road and the workout keeps going. If the workout ends first, ERG holds the cool-down watts. Both as before.

**Measured at 1280x720 (page height must be 720 or less):** free ride 720, course 720, workout 720, course + workout 720, course + ramp test after End test 720, course + a 58-interval workout 720, not connected with both picked 720.

**Not handled:** a notice above the panel (crash recovery, trainer lost) still pushes the control row down while it shows.

## Part 8: Quality pass

Findings and their status are in `docs/quality-pass.md`. Judgment calls:

- **Control row never wraps at 1280 px and up.** Shortening the status strings was not enough on its own, so the status text now takes whatever space is left and may run to two lines inside the row.
- **File limits:** ZWO 1 MB and 2,000 intervals; GPX 30 MB and 500,000 points. A 112-mile course at one point per second is about 3 MB, so real files are far inside these.
- **`ride.ts` was not split.** It is the right refactor, at the wrong time: every path in it was changed and tested this round.
- **No new dependencies** were added in any part. `@garmin/fitsdk` was installed only in a scratch folder for validation.

## Next ride checklist (needs the real Kickr)

Before: spindown in the Wahoo app after a 10-minute warm-up, then close the Wahoo app. Small chainring, middle cog. ERG mode.

| # | Do | Expect | If not |
| --- | --- | --- | --- |
| 1 | Start pedaling in ERG | Light until 60 rpm holds for a second, then "Easing in to target" for 6 s | Note the status text |
| 2 | Stop pedaling | Load lets go within 2 s. Speed at 0 within 4 s. "Paused" within 4 s, numbers gray, Time stopped | Time how long "Paused" took |
| 3 | Restart from a full stop | First strokes are just the flywheel. Then the 6 s ramp | If heavy: was the status "Trainer refused it. Retrying."? |
| 4 | Drop to 40 rpm for 5 s, spin back up | Releases at 3 s, eases back in | |
| 5 | Hold 55 rpm | ERG keeps holding | |
| 6 | Step the target 20 W | Speed moves about 1 mph and settles in about 6 s | |
| 7 | Put the tab in the background for 10 minutes (YouTube) | FIT has a record every second | Send me the FIT |
| 8 | Stop 30 s before End Ride | Strava: moving time below elapsed time, no flat zero tail | |
| 9 | Pick Test Hills plus a workout | Both rows on screen with the control row, ERG follows the workout, speed follows the hills | |
| 10 | 5 minutes at 150 W | Same effort as before the spindown? | Tells us if calibration was the issue |

## Workout tab redo and Grade mode (Nov 20, 2026, later the same day)

Asked for by Nate after the parts above shipped.

**Chose:**

- **Two steps on one tab, not two URLs.** "1. Choose your course" then "2. Choose your workout", with Next, Back and Done. The step lives in the page, so the browser Back button leaves the tab; the Back button in the panel goes to step 1.
- **Step buttons are the primary action on this page.** DESIGN.md allows one Cobalt button per screen, so Connect in the top bar is secondary while the Workout tab is open. DESIGN.md updated.
- **Detail card under the selected row.** Clicking a course selects it and opens its overview (distance, climbing, low, high, profile, start mile). Clicking a workout opens its full description and strip. One row open at a time.
- **Filters.** Difficulty: All, Easy, Medium, Hard. Length: Any, Up to 1 h, 1 to 1.5 h, Over 1.5 h. The picked workout stays in the list even if the filters would hide it. Built-ins got tags: Endurance 60 easy, Sweet Spot 3x12 medium, VO2 5x3 and FRNKLN hard. The ramp test and imported files have no tag and show under All.
- **Imports moved to Profile**, under "Your files", with the imported files listed there and Remove next to each.
- **Row names.** Step 1's none option is "Flat road". Step 2's is "Free ride". The setup line always shows both halves ("Test Hills · Free ride").

**Grade mode. This is v4 work, started early at Nate's request. CLAUDE.md and the scope doc record the exception.**

- A third trainer mode beside Resistance and ERG, offered only when a course is picked. Picking a course with no workout selects it; picking a workout selects ERG; the rider can switch at any time (E cycles the modes).
- The trainer gets FTMS Set Indoor Bike Simulation Parameters (op 0x11): no wind, rolling resistance 0.004, wind resistance from the rider's position, and the grade.
- **Hill feel instead of a separate slider.** The step buttons set 0 to 100% (default 50%), which is also the "adjust by hand" control. 50% is the common default on other apps and keeps a 6% climb rideable without a full gear range.
- Grade is smoothed over 2 s, sent at most once a second, and held to 0 to 16%. Descents ride as flat on the trainer; speed on screen still uses the real grade.
- If the trainer answers "not supported", the row says so and falls back to the resistance level. A refused command is retried like any other.
- The fake trainer takes a grade: power at the same cadence rises with it.

**Fake-trainer check:** starting at mile 3 of Test Hills (a 6.3 to 6.8% climb), the trainer grade read 3.0 to 3.3% at 50% feel and 6.3% at 100%, and fake power rose from about 290 W to 373 W.

**This is the least-proven change in the repo.** Op 0x11 has never been sent to Nate's Kickr by this app. Test on the next ride:

1. Pick Test Hills, Free ride. The control row should read Grade, 50%.
2. On the first climb (mile 2.5 to 4) the pedals should get steadily harder and the status should read about half the course grade.
3. Shift down. It should get easier at the same speed, like outdoors.
4. On the descent it should feel like a flat road, not a free spin.
5. Step feel to 100% on a climb: clearly harder within a couple of seconds.
6. Switch to ERG, then back to Grade. Each switch should take effect within about 2 s.
7. If the status says "No grade control on this trainer" or "Trainer refused it. Retrying.", tell me which.

## After the first workout ride (Nov 20, 2026)

Five fixes from Nate's first real workout ride. Part 5 is written up before part 4 because part 4 builds on it.

### Part 1: nothing reaches the Ride tab until it is confirmed

**What was wrong.** Clicking a course card in step 1 put the course on the Ride tab at once and switched the trainer mode to Grade. The last course and workout also came back onto the Ride tab on every page load (from `ww.courseId` and `ww.workoutId`). Importing a GPX on Profile did the same.

**Chose:**

- **Two setups, kept apart.** The Workout tab holds a staged setup: course, start mile, workout. The Ride tab holds the confirmed setup. In `RideController` the staged one is `stagedCourse`, `stagedStartM`, `stagedLastEndM` and `stagedWorkoutId`; the confirmed one is still `course`, `startOffsetM`, `lastEndM` and `workout`. The snapshot has a new `staged` field: `{ course, workout, onRide }`.
- **One way across.** `confirmSetup(workoutId?)` copies the staged course, start mile and workout onto the ride, then picks the trainer mode. Ride this workout calls it with that workout's id. Done calls it with no id. Nothing else writes the ride's course or workout, except resuming an unfinished ride.
- **Actions.** `stageCourse(id)` replaces `selectCourse`. `stageWorkout(id)` replaces `selectWorkout`. `setStartMi` now moves the staged start. None of them touch the ride or the trainer mode.
- **Done confirms the line beside it.** The setup line reads "Picked: Test Hills · Free ride" and Done puts exactly that on the Ride tab. If a workout is still picked from an earlier Ride this workout, the line names it and Done rides it again. Click the Free ride card first for a ride with no workout. One rule, and the button never does something the line does not say.
- **The highlight means picked.** A highlighted card is the pick on the Workout tab, nothing more. Under the setup line one sentence says where the Ride tab stands: "This is on the Ride tab now." or "Not on the Ride tab yet. The Ride tab has Flat road · Free ride." A workout's overview adds "on the Ride tab now" for the confirmed workout.
- **Reloads.** The picks are saved under new keys, `ww.stagedCourseId` and `ww.stagedWorkoutId`, and come back on the Workout tab only. The start mile is not saved; it goes back to where the last ride on that course ended. The old keys are no longer read and are deleted on load. A fresh page is always a free ride on a flat road.
- **Removing and editing.** A removed course or workout is dropped from the picks and from the Ride tab. Editing the confirmed custom workout updates the Ride tab's copy and keeps the trainer mode. A ride in progress keeps what it started with, as before.
- **Import GPX** picks the new course in step 1. It is not on the Ride tab.
- **Resume** of an unfinished ride still restores that ride's course and workout. The picks on the Workout tab are left alone.
- **Lock.** While locked the Workout tab shows the ride's own setup. It was locked from Connect until New ride; part 5 moved the lock to Start.
- **Picking a course that is already on the Ride tab changes nothing there.** Clicking its card again puts the staged start mile back to the default. The ride keeps the start mile it was confirmed with until Done or Ride this workout. (Found in the final check: the ride's start moved from mile 0 to mile 3 on a card click. Fixed in `stageCourse`.)

**Checks (fake trainer, headless Chromium, 1280x720):** 63 assertions, 0 failed. The Ride tab had no course row and no workout row after a fresh load, a GPX import, each of 3 course cards, a start mile change, 5 workout overviews opened and closed, the Free ride card, a reload, and a reload with the old `ww.courseId` and `ww.workoutId` seeded. The trainer mode never moved to Grade while browsing. After Ride this workout the Ride tab had Test Hills and the workout, in ERG. After Done with Free ride it had Test Hills alone, in Grade. Browsing after a confirm left the Ride tab as it was. Reload mid-ride, then Resume: both rows came back and the workout was still running.

### Part 2: New ride clears the setup

**What was wrong.** New ride picked the same course and workout again on purpose, so a finished workout stayed on the Ride tab.

**Chose:**

- **New ride** puts the Ride tab back to a free ride on a flat road: no course row, no workout row. Grade mode drops to Resistance; ERG stays ERG at the rider's own target. The picks on the Workout tab stay, so the same ride is two clicks away (Workout, then Done or Ride this workout). If the ride was on the picked course, its start mile moves to where the ride ended.
- **Disconnect before the ride starts keeps the setup.** There was no ride, so there is nothing to clear, and the rider just confirmed it. Disconnect now resets the counters only. (Since part 5 that means before Start, and the Workout tab is not locked until then.)
- Inside the controller `newRide()` is `resetRide()` (counters) plus `clearRideSetup()`. `disconnect()` calls `resetRide()` only.

**Checks:** rode Test Hills with a workout for about 20 s, End Ride, New ride: no rows, mode ERG, and the Workout tab still showed the picks with "Not on the Ride tab yet. The Ride tab has Flat road · Free ride." Connect without pedaling, then Disconnect: both rows stayed. Removing a confirmed imported course on Profile cleared it from the Ride tab and from the picks, and Grade dropped back. With the fake trainer connected, power, speed and time changed on 5 of 5 one-second reads, cadence on 3 to 4, distance (two decimals of a mile) on 2.

### Part 3: Hover on the workout strip

**What it does.** Pointing at a block of the workout strip outlines it (1px `fg`) and shows one mono line on a small chip: the label if the block has one, the zone (swatch and code), the target watts after intensity, % FTP, the length (m:ss or h:mm:ss) and the cadence target in rpm if it has one. A ramp shows start and end ("155→177 W  70→80% FTP"). It works on the Ride tab's workout row (full and compact) and in the workout overview on the Workout tab (100% intensity, your FTP).

**Chose:**

- **An overlay, not a row.** The chip is positioned inside the strip, 4px below it on the Ride tab (it lands in the padding between the workout row and the control row, so it covers no number and no button) and above it in the overview (so the "watts at your FTP" note stays readable). It is centered on the block, kept inside the strip's width at the first and last block, and flips to the other side if it would leave the window. That happens at 1024 wide with a course and a workout, where it covers part of the stats line while you hover.
- **It never takes a click and never takes space**, so nothing on the Ride tab moves or resizes.
- **The whole column over a block is the hover target**, so 20-second blocks are easy to hit. The chip is tied to the block, not the mouse, so it does not slide around.
- **% FTP is worked out from the watts shown**, the same way the row's Target does it, so the two always agree.
- **Look:** `surface` chip, 1px `line-strong` border, radius 4, mono 11px, values in `fg` (17.4:1), units in `fg-muted` (7.1:1). No shadow, blur or gradient. It fades in over 120ms; with reduced motion there is no fade.
- **Not on the small card graphs.** The card is a button; its click opens the overview, which has the details.
- **Not in the builder.** It did not come free: the builder's graph is a separate canvas with drag handlers, and it already shows the selected block's fields.
- **Mouse and pen only.** No tab stops were added to the Ride tab. Touch is ignored.

**Checks (headless Chromium, 1280x720, 1024x768, 1920x1080; workout only and course + workout):** every block of four workouts (ramps, steady blocks, repeats, fixed-watt steps, blocks with and without a cadence target) hovered before the start, after the start, and after raising intensity to 110%. 5,591 checks on the Ride tab and 48 in the overview, all passing. The text matched the workout data, FTP and intensity each time. The chip stayed inside the panel and the window at every block. The bounding boxes of the panel, the tiles, the workout row, the control row and everything inside them were the same before and during hover. The key hint stayed on screen at 1280x720.

**Gaps:** the shipped workouts have no ramp with a cadence target, so that pair was not hovered (same code path as a steady block with cadence). The 1px `fg` outline is 2.7:1 against a Z7 block, under the 3:1 rule for graphics; Z1 to Z6 pass. The builder's selected-block outline has the same limit.

### Part 5: nothing is recorded until Start

**What was wrong.** The ride started on the first pedal stroke. Spinning up before a workout was recorded, and it became a free-ride lap ahead of the workout in the FIT file.

**Chose:**

- **Connect shows live numbers only.** Power, cadence and speed are live. Time, distance, course position and climbing stay at zero. No ride row and no samples are written to IndexedDB. The first pedal stroke does nothing but move the live numbers.
- **One Start button, in the top bar, where Connect was.** Its label is "Start ride", or "Start workout" when a workout is loaded. It is the one primary button on the Ride tab. Disconnect sits to its left as a secondary button. Why the top bar and not a line in the ride panel: it costs no height, so all four ride types still fit 1280x720; both labels are in one place; and the pointer is already there after pressing Connect. The workout row's own Start workout button is now plain text ("Press Start workout"), so there is still one primary on screen.
- **Start begins everything together, from zero:** the clock, the distance, the recording and, with a workout, the workout from its first step. The workout's warm-up is lap 1.
- **Start while not pedaling starts paused.** The clock reads 0:00, the pill reads "Paused" and the control row reads "Paused. Pedal to resume." The first pedal stroke resumes, so the FIT file begins there. This reuses the auto-pause that already existed; the other choice (start the clock, then backdate a pause 3 s later) would have made the clock count to 0:03 and jump back.
- **The first record is never before Start.** The first sample is stamped on the first whole second after the press.
- **Speed is live before Start.** The speed model runs on every reading at the grade of the start point, and its distance is thrown away. Distance counts from the moment Start is pressed, not from the reading before it.
- **Trainer control works before Start.** Resistance level, your own ERG target (with the cadence release and soft start) and Grade all work. Grade used to sit at 0% until the ride moved; it now starts at the grade of the start point, so a start on a climb is a climb from the first second. A refused command is retried while waiting too, as long as the pedals are turning.
- **Making the wait obvious, calmly.** The pill reads "Not recording" in the `warn` tone. The Time tile's label row reads "Not recording". Time and Distance are gray at 0:00 and 0.00. The control row's second line reads "Press Start ride." Nothing flashes or moves.
- **A stop or a dropout before Start creates nothing.** The pill goes to "Reconnecting" during a dropout and back to "Not recording".
- **The setup stays open until Start.** The Workout tab used to lock at Connect. Now it locks at Start, so you can connect first and pick after. Confirming a setup with the trainer connected sends the new command at once. The profile is open until Start too. A resumed ride is locked from Resume, as before.
- **Crash recovery.** A reload before Start has nothing to recover. A reload after Start resumes as before: Connect goes straight back to riding, with no Start. Resume now also puts the trainer mode back to what the setup calls for (ERG with a workout, Grade on a course alone).
- **Old unfinished rides.** A ride recorded before this change may have a workout that was never started. After Resume the workout row shows a secondary "Start workout" button, so it can still be started mid-ride.
- **End Ride guard.** End Ride lands where Start was. A click on it in the first second after Start is ignored, so a double click on Start cannot arm "Confirm end".
- **New ride guard.** New ride lands where Confirm end was. A click on it in the first second after Confirm end is ignored, so a double click on Confirm end cannot clear the ride that just ended (its totals and the Download FIT button). Added in the final check, same 1 s.
- **Start pressed and never pedaled, then End Ride:** the notice reads "Nothing was recorded." and there is no Download button. An empty ride row is left in the browser, marked ended. It has no samples and nothing reads it.
- **No keyboard shortcut for Start.** One key that starts recording is easy to hit by accident, and the hint line has no room at 1280.
- **No database change.** Dexie is still at version 4.

**Checks (fake trainer, headless Chromium, FIT decoded with @garmin/fitsdk in a scratch folder):**

Pedaled 20 s before Start in each ride type. In all four: Time read 0:00 and Distance 0.00 the whole time, the pill read "Not recording", and IndexedDB had 0 rides and 0 samples. Over seconds 9 to 20, power changed on 10 to 11 of 11 one-second reads, cadence on 6 to 9, speed on 7 to 11. After Start, Time read 0:00, 0:01, 0:02, 0:03, 0:04, 0:05 on six one-second reads.

| Ride | First record after Start | Records | Holes | Laps | Lap timer sum / session | Lap distance sum / session | Decode errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free ride, flat | 0.29 s | 21 | 0 | 1 | 21 / 21 s | 197.23 / 197.23 m | 0 |
| Test Hills from mile 3, free ride | 0.52 s | 20 | 0 | 1 | 20 / 20 s | 89.95 / 89.95 m | 0 |
| Test Intervals, flat | 0.52 s | 40 | 0 | 5 | 40 / 40 s | 333.98 / 333.98 m | 0 |
| Test Hills from mile 3 + Test Intervals | 0.60 s | 40 | 0 | 5 | 40 / 40 s | 96.80 / 96.80 m | 0 |

Laps of the Test Intervals ride (Start, 20 s of warm-up, then Skip interval three times, 6 s apart):

| Lap | Interval | Starts after Start | Timer | Distance | Avg power |
| --- | --- | --- | --- | --- | --- |
| 1 | Warm-up, 132 W | 0.5 s | 19 s | 152.8 m | 132 W |
| 2 | Hard, 264 W | 19.5 s | 3 s | 25.4 m | 221 W |
| 3 | Easy, 110 W | 22.5 s | 6 s | 48.9 m | 109 W |
| 4 | Hard, 264 W | 28.5 s | 6 s | 56.3 m | 262 W |
| 5 | Easy, 110 W | 34.5 s | 6 s | 50.6 m | 109 W |

Other checks:

- **Dropout (D) before Start:** pill "Reconnecting", then "Not recording". 0 rides, 0 samples.
- **Stop (S) before Start:** power 0, cadence 0, speed 0.0, pill still "Not recording". 0 rides, 0 samples.
- **Start while stopped:** pill "Paused", Time 0:00, 1 ride row, 0 samples after 5 s. On the first pedal stroke Time counted 0:00 to 0:07 over 8 reads. The first sample was 0.06 s after the pedaling began and 5.1 s after Start.
- **After Start:** auto-pause (S) froze Time at 0:08; resume, dropout (D) and low cadence (C) behaved as documented above. FIT timer events: start 0, stop 7, start 14, stop 20, start 26, stop 37; timer 27 s, elapsed 38 s; 0 decode errors.
- **Start while stopped, never pedal, End Ride:** "Nothing was recorded.", no Download button, no recovery notice after a reload.
- **Double click on Start:** the ride started and End Ride was not armed.
- **Reload before Start:** no recovery notice, no course row, no workout row, 0 rides, 0 samples.
- **Reload 26 s into a workout on Test Hills:** Resume brought back the course row, the workout row (running, Skip interval showing) and the position (9.0 mi to go before and after). Connect went straight to riding. End Ride gave a FIT with 0 decode errors, 2 laps, timer 32 s, elapsed 38 s.
- **Old ride with an unstarted workout (seeded in IndexedDB):** Resume, Connect, then the row's Start workout started it; FIT had 0 decode errors.
- **Setup changed while connected and waiting:** flat free ride (about 217 W in Resistance) to Test Hills from mile 3 (Grade, about 303 W within 3 s) to the same course from mile 0 (about 159 W) to course + workout (ERG at the rider's 145 W: 145 W). Still 0 rides and 0 samples.
- **Layout:** at 1280x720 in free, course, workout and course + workout, waiting and started, the page did not scroll (scroll height 720), the key hint was one line (17 px tall) ending at y 631 or 639, and no status line was cut off. Same at 1440x900 and 1920x1080, and with reduced motion. With a strip block hovered the chip stayed on screen (bottom at y 604 and 608). At 1024x768 the panel is one column and the page scrolls, as it did before (course + workout: 948 px tall waiting, 940 px before this change; the course note wraps to its own line there).
- **Contrast:** no new pairs. "Not recording" is `state-under` on `surface` (5.9:1). Status lines are `fg` (17.4:1) and `fg-muted` (7.1:1) on `surface`.

**Test on the next Kickr ride:**

1. Connect and pedal for a minute without pressing Start. Power, cadence and speed should move. Time and Distance should stay at 0:00 and 0.00, and the pill should read "Not recording". Is it obvious enough from the saddle that nothing is being saved?
2. Before Start, change the resistance level, then switch to ERG. The Kickr should respond to both.
3. Press Start workout while pedaling. Time and Distance should count from zero and the workout should begin at its first step.
4. On another ride, press Start ride while stopped. It should read "Paused" at 0:00 and begin on your first pedal stroke.
5. Upload the FIT to Strava. It should begin at Start, with one lap per interval and no lap for the spin-up.
6. Connect first, then pick a course and workout on the Workout tab and press Ride this workout. The Ride tab should show them and the Kickr should take the new mode without a reconnect.

### Part 4: what sets the load

**The rule, confirmed.** Course + workout: the workout sets the load (ERG) and the course only sets speed, distance and the profile. Course + free ride: the hills set the load (Grade). `autoMode()` already did this at `confirmSetup`. Two gaps were fixed: Grade before Start sat at 0% (see part 5), and a resumed ride kept whatever mode was last saved instead of the mode its setup calls for.

**Chose:**

- **The control row says who is in charge, always.** Its status is now two fixed lines. The first is who sets the load. The second is the detail. Both follow the trainer mode, so they change when the rider presses E or uses the mode switch.
- **The course row says the course's part.** At the right end of its stats line: "The course sets speed, not the load." or, in Grade, "The course sets speed and the load." The suggested one-liner "Workout sets the load. Course sets speed." did not fit the control row at 1280 (about 180 px there), so the course half moved to the course row.
- **A workout loaded but not started, on a course or not:** ERG at the rider's own target, and the words say so: "You set the load for now." Kept as it was. It is the right load for spinning up, and Start workout hands over to the workout with the soft start.
- **Switching by hand mid-workout:** the first line follows the mode ("Hills set the load." or "You set the load.") and the second reads "Workout targets are off." The workout clock keeps running, as before.
- **After the workout ends:** "Workout is done." and "Holding the last target". ERG holds the last interval's watts until End Ride, as before.
- **Shorter detail lines,** so each fits on one line: "Released until 60 rpm.", "Hill feel · trainer 3.3%", "Refused. Retrying.", "No ERG on this trainer."
- **One key hint for every mode:** "↑↓ 1 · +/− 5 · shift ↑↓ 10 · E mode". The unit is on the value beside it. With the Stepper's gaps at 16 px this gives the status about 180 px at 1280 on a course. The longest line is 159 px.

| State | Mode | Line 1 | Line 2 | Course row |
| --- | --- | --- | --- | --- |
| Free ride, flat | Resistance | You set the load. | (empty) | |
| Free ride, flat | ERG | You set the load. | 66% FTP | |
| Course + free ride | Grade | Hills set the load. | Hill feel · trainer 3.3% | The course sets speed and the load. |
| Workout only, before Start | ERG, own target | You set the load for now. | Press Start workout. | |
| Workout only, after Start | ERG | Workout sets the load. | Intensity, every target | |
| Course + workout, before Start | ERG, own target | You set the load for now. | Press Start workout. | The course sets speed, not the load. |
| Course + workout, after Start | ERG | Workout sets the load. | Intensity, every target | The course sets speed, not the load. |
| Workout finished, ride goes on | ERG | Workout is done. | Holding the last target | The course sets speed, not the load. |
| Mid-workout, switched to Grade | Grade | Hills set the load. | Workout targets are off. | The course sets speed and the load. |
| Mid-workout, switched to Resistance | Resistance | You set the load. | Workout targets are off. | The course sets speed, not the load. |
| Any, waiting for Start | any | as above | Press Start ride. | as above |
| Any, paused (this wins over every other second line, "Workout targets are off." included) | any | as above | Paused. Pedal to resume. | as above |

**Checks (fake trainer, Test Hills from mile 3, a 6.3 to 6.8% climb):**

- **Course + workout holds the target on the climb.** Target 132 W: power averaged 134 W over 5 s while speed was 4.6 mph. After the workout ended, power averaged 178 W against the last target of 176 W.
- **Course + free ride follows the grade.** Power averaged 289 W at 9.4 mph with the trainer at 3.3% (50% feel). The same rider on a flat road in Resistance: 217 W at 19.6 mph.
- **Grade before Start.** Connected at mile 3 and not started: 283 to 303 W. At mile 0 (flat): 159 W.
- **Switching by hand on a course free ride:** Grade 289 W, E to Resistance 233 W, E to ERG 144 W (target 145 W), E back to Grade. The words changed with each switch, as in the table.
- **Switching by hand mid-workout:** E to Grade 241 W with "Workout targets are off.", then Resistance, then ERG by the mode switch: back to "Workout sets the load."
- Every line in the table was read from the screen. None was cut off at 1280.

**Test on the next Kickr ride:**

1. Ride a course with a workout. On a climb the Kickr should hold the workout's target and only the speed should drop. The control row should read "Workout sets the load."
2. Ride a course with no workout. The control row should read "Hills set the load." and a climb should feel harder.
3. Connect at a start mile that is on a climb and pedal before Start. It should already feel like the climb.
4. Mid-workout press E. The words should change to match what you feel, and "Workout targets are off." should show until you are back in ERG.
5. Can you read both lines of the control row from the saddle?

### Part 6: known gaps

The final review of parts 1 to 5 left a short list. Closed here.

**Notice title after a lost trainer (gap 1)**

- **What was wrong.** Connected and waiting for Start, a lost trainer showed the notice title "Pairing failed". The phase goes back to idle on a failed connection, and the title was picked from the phase.
- **Chose.** The failed status now says whether a connected trainer was lost. The title is "Trainer lost" after a loss, waiting or mid-ride, and "Pairing failed" only when the connection never came up.
- **After a loss while waiting:** the pill reads "Not connected", the button is Connect, and the confirmed setup stays on the Ride tab. Nothing was saved.
- **After a loss mid-ride:** the pill reads "Disconnected" and the button is Reconnect, as before.
- **The text under the title** now ends "then connect again." The button is Connect in one case and Reconnect in the other, so the text no longer names it.
- **Fake trainer.** X loses the trainer for good: 3 reconnect attempts, 1 second apart, then failed. It is in the footer hint.
- **Checks.** Title, pill and button read in all three cases. Never connected was read on the real connection code with Web Bluetooth stubbed. Lost while waiting on Test Hills + Test Intervals: both rows stayed, 0 rides, 0 samples, and Connect then Start workout worked.
- **Not run:** the real 30-attempt reconnect loop to its end. Needs the Kickr (unplug it mid-ride and wait).

**Old unfinished ride whose workout never started (gap 5)**

- **Re-tested** with a seeded ride: 30 samples, a workout id, no `workoutS`. Steps: reload, Resume, Connect, the row's Start workout, Skip interval twice, End Ride.
- The workout started from its first step. No screen had more than one primary button.
- **FIT:** 0 decode errors, 55 records, 4 laps. The earlier free riding is lap 1 (34 s), then Warm-up 8 s, Hard 6 s, Easy 7 s. Lap sums against the session: timer 55 / 55 s, elapsed 119 / 119 s, distance 414.97 / 414.97 m.
- **One fix.** Lap distances were rounded to the centimeter one by one, so their sum could be 1 cm off the session. Laps are now cut in whole centimeters. This covers every ride with laps.

**Two leftovers (gap 6)**

- `cancelPendingPause` wrote held samples even when there was no ride row (IndexedDB unavailable). It now skips the write, as `record()` does. Type-checked only.
- **Paused wins.** Paused mid-workout in Grade or Resistance, the control row's second line stayed "Workout targets are off." It now reads "Paused. Pedal to resume." in every mode, so a stopped rider is told how to go on. "Workout targets are off." comes back on the first pedal stroke. The words table in part 4 says so.

**Regression after the merge with main:** 20 s of pedaling before Start on a workout and on a free ride: Time 0:00, Distance 0.00, 0 rides and 0 samples. After Start both counted from zero.
