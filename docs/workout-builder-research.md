# Workout builder research

Researched 20 Nov 2026 against repo `natehansen10/weem-watts` (HEAD on that date). No app code was changed.

How to read this:
- **V** = verified from the linked source. **I** = my inference. **NC** = not confirmed. Do not treat NC items as fact.
- Source keys like `[ZW-SUP]` are listed with full URL and date in section 8.
- Click and keystroke counts marked "est." are estimates. Nobody publishes real counts.

---

## 1. Recommendation

**Ship a step-list editor, not a drag-and-drop builder.** Every app with a graph you drag draws the same complaints: it's slow, there's no copy/paste, and you can't make multi-step repeats ([ZW-F-COPY], [ZW-F-3PARAM], [RD-ZWERM], [TP-RD-1], [TR-F-FIX]). This app is desktop Chrome with a keyboard, so typed fields beat dragging.

**Smallest version worth shipping (option S):**
- New workout, Edit, Duplicate (from any built-in, imported or custom workout) and Delete.
- Steps: Steady, Ramp, and Repeat (one level, any number of inner steps). `src/lib/workout.ts` already supports all three.
- Per step: duration (`12`, `12:00`, `90s`), target in % FTP or watts (`90` or `225w`, with the other unit shown next to it), optional cadence in rpm, and an optional label.
- Live preview: the existing `WorkoutStrip` plus total time. Nothing else.
- Workout fields: name, description, and a difficulty tag (easy, medium, hard), so the Workout tab filters still work.
- Stored as the app's own step list in IndexedDB, not as ZWO text (trade-off in 5.2).
- Cadence is a cue only. It shows in the Cadence tile ("target 90") and never changes the trainer. Every app does the same.
- The ZWO importer also starts reading `Cadence`, so imported Zwift workouts get cadence cues for free.

**Cut from S:** free-ride steps, timed text cues, ZWO export, a text syntax, TSS/IF/NP, nested repeats, distance or lap-button durations, heart-rate or slope targets, folders, and drag on the graph.

**Push back:**
- **Phase rule.** CLAUDE.md says to stay in the current phase. v3.2 workouts aren't ride-tested yet, and the builder is listed under "Later". Ride-test v3.2 first, since the builder rests on the workout player being right. Then move the builder into the scope doc as its own small phase.
- **A drag builder is a large project.** It needs new patterns (pointer drag, hit targets, snapping, undo) and probably a dependency like `@dnd-kit` (both MIT editors I found use it). It also solves a problem the evidence says riders dislike. Only consider it after S has been used for a winter.
- **Backup risk in S.** Custom workouts live only in this browser. Clearing site data deletes them. If that worries you, pull the ZWO export from M into S (about half a day more).

---

## 2. Comparison table

| App (sources dated) | Building blocks | Per-block settings | Interaction model | Live feedback while building | Formats and sync |
| --- | --- | --- | --- | --- | --- |
| **Zwift** in-game editor | Zone blocks Z1 to Z6, warm-up, cool-down, 2-step Interval (repeat N), free ride, text event, cadence block dropped onto a power block [AHURO 2020] | Duration (time), power typed or dragged (stored as % FTP), cadence, text event at a time. Free ride turns ERG off [ZW-SUP], [ZW-ERG]. HR and slope NC | Drag blocks onto a timeline, drag edges, plus number fields [ZI-HOWTO 2018], [ZW-F-ARROW 2023]. Only 2-step repeats; no multi-step sets [ZW-F-3PARAM 2026] | Stress Points (= TSS) [AHURO 2020], [ZW-F-MENU22]. IF and kJ NC | ZWO files in Documents/Zwift/Workouts/<id>, synced via Zwift cloud (flaky) [ZW-SUP], [ZW-F-SYNC23], [ZW-F-SYNC26]. TrainingPeaks: today's % FTP workouts only [ZW-SUP] |
| **ROUVY** Workout Creator | Segments added with + or a zone preset; Free Ride and Ramp Up/Down since app 4.0.4 [RV-CHANGE], [RV-APR25]. No repeat block found (NC) | Duration hh:mm:ss, % FTP with watts shown, one cadence rpm, a Commentary tab [RV-MAY24 2024], [RV-BLOG 2026]. ERG is set in the ride, not per block [RV-ERG] | A graph you drag plus a segment list; shift-click multi-select, then duplicate [RV-YT 2024]. Repeats by duplicating (I) | Duration, TSS, IF, average/min/max % FTP, zone-coloured graph [RV-MAY24 screenshot] | Import MRC, ERG, ZWO [RV-WIO]. No export of your own builds [RV-RD-EXPORT 2025]. Inbound sync from TrainingPeaks, intervals.icu, TrainerRoad and others [RV-TP], [RV-ICU], [TR-ROUVY 2026] |
| **TrainingPeaks** Structured Workout Builder (web) | Warm up, Active, Recovery, Cool down, Two Step Repeats, Three Step Repeats, Ramp Up, Ramp Down. No free ride [TP-BUILD 2026-11-17], [TP-UV-FREE 2024] | Time or distance; % FTP, % HR, % LTHR, % pace or RPE; single value or range; zone; cadence; notes; "end step on lap button" [TP-BUILD]. No raw watts [TP-RD-1 2025] | Drag blocks into a graph, drag the right edge, edit in a step list, +/- repeat count [TP-BUILD]. No text syntax [TP-RD-1] | Duration, TSS, IF [TP-STRUCT 2024], [TP-LEARN 2016]. Time in zone NC | Export ERG, MRC, FIT, ZWO; import ZWO only [TP-EXPORT 2025], [TP-ZWO 2024]. Push to Garmin, Wahoo, Zwift, TP Virtual and others [TP-EXPORT], [TP-COMPAT 2025] |
| **TrainingPeaks Virtual** | No in-app builder; it's a "Future Opportunity" idea on the feature board [TPV-UV] | Plays power and cadence ranges, text messages, HR ERG [TPV-REL 2025-2026] | Copy files into a TPVirtual/workouts folder, then restart [TPV-CUSTOM 2026] | Preview shows timings and intensity spread [CYC-TPV 2026] | Import ERG, MRC, ZWO, JSON, FIT; sync from TrainingPeaks, intervals.icu, Humango, Garmin [TPV-CUSTOM], [TPV-REL] |
| **Wahoo** SYSTM / Wahoo app | **No builder.** "We don't currently have this functionality in the app" [WH-NOBUILD, updated 2026-10-24] | n/a. SYSTM's own workouts target % of FTP, MAP, AC or NM, plus cadence and RPE [WH-4DP] | n/a. Build in TrainingPeaks, intervals.icu, TrainerDay and others, then sync to "My plan" [WH-PLAN 2026] | n/a | Planned workouts sync for today and tomorrow in the Wahoo app [WH-PLAN]. ELEMNT files by USB [WH-USB] |
| **TrainerRoad** Workout Creator (secondary) | Snippets: stepped and sweet-spot warm-ups, 1/5/20-min intervals, over-unders; save your own snippets [TR-SNIP] | % FTP only, watts shown. Text on an interval. No cadence goals. No mode switch inside a workout [TR-WC 2026-08-17], [TR-TEXT], [TR-F-UPD 2025] | Drag dots on a graph. Ctrl + arrows to multi-select, then "Repeat Selection" [TR-CREATE 2026], [TR-F-FIX 2024] | Watts shown as you set % FTP [TR-WC]. TSS, IF NC | Import ERG and MRC [TR-ERG 2026]. No export (2020, NC since) [TR-F-EXPORT]. Separate Mac/Windows desktop app [TR-WC] |
| **intervals.icu** (secondary) | Text steps, section headers, repeats (`3x`), `ramp`, `freeride`, an Add Step form [ICU-WB 2020+] | Time or distance; `90%`, `225w`, ranges, zones, % MMP; HR, pace; `90rpm` or `90-100rpm`; cue text; timed prompts `33^text <!>` [ICU-QG 2026-08-10] | **Text syntax**, copy-paste between workouts. No nested repeats [ICU-QG] | Duration, load, zone-coloured bars, time in zone, NP, average power, kJ [ICU-WB], [ICU-WB70 2020], [ICU-GUIDE 2022] | Up/download ZWO, MRC, ERG, FIT; API accepts JSON events; pushes to Garmin, Wahoo, Zwift [ICU-WB], [ICU-FIT 2022], [ICU-API 2024], [ICU-ZWIFT 2024] |

---

## 3. Per-app notes

### 3.1 Zwift (in-game Workout Editor)

Verified:
- Blocks: Z1 to Z6 with defaults of 50, 65, 81, 95, 110 and 125% FTP, plus warm-up, cool-down, Interval (two levels, repeated N times), free ride, text event, and a cadence block you drop onto a power block [AHURO, 2020-03-02]. The 2015 launch had warm-up, cool-down, zones, intervals, free ride and text events [ZI-2015].
- Settings: type a power value or drag the block up or down [ZW-SUP]. Drag edges up or down for power and sideways for duration [ZW-F-ARROW, 2023-05]. Text events appear at a set time for a duration you choose [ZW-WIKI, 2026-07-29].
- Free ride turns ERG off and turns it back on after [ZW-ERG].
- Repeats come only from the 2-step Interval block. You can't group and repeat a multi-step set [ZW-F-3PARAM, 2026-01-29], [ZW-F-COPY, 2018-10-03]. The workaround is editing the ZWO by hand [ZI-MANUAL].
- Feedback: the editor shows Stress Points [AHURO]. Zwift says Stress Points are the same as TSS [ZW-F-MENU22, 2022-10].
- Saving: rename, tags, description, copy an existing workout to edit it, delete. Limit of 250 blocks [ZW-SUP]. Folders are made by creating directories in the Workouts folder [ZW-F-MENU22].
- Sync: files in Documents/Zwift/Workouts/<Zwift ID> show on other devices after a restart. Files over 64 KB stay on the computer they were imported on [ZW-SUP], [ZW-F-64KB, 2022-10-31].
- Watts typed in the editor are saved as a fraction of FTP, so they scale when FTP changes. Users have asked for a "don't scale" option [ZW-F-ROUND, 2022 to 2025], [ZW-F-FTP23, 2023-08-30].
- Platforms: building works on PC, Mac, Android tablets and iPads (not iPad Mini). Not on phones or Apple TV [ZW-SUP], [ZW-F-NOCREATE, 2025-04]. The Companion app can't manage custom workouts [ZW-F-ZC, 2025-12-16].

Cadence (community testing, not Zwift docs): `Cadence` sets an on-screen target with prompts at about ±5 rpm. `CadenceLow` and `CadenceHigh` do nothing. In `IntervalsT`, `CadenceResting` is the off-phase cadence [TJ-ZWO, 2026-07], [ZW-WIKI].

Inferred / not confirmed:
- I: cadence is a cue only, since ERG holds power at any cadence [ZW-ERG]. No source says cadence changes the trainer.
- NC: whether today's palette has a standalone Ramp or Max Effort block. Both exist in the ZWO format [H4L].
- NC: HR targets, distance durations, slope, or a per-block ERG toggle in the editor.

Top three friction points:
1. No copy/paste and no multi-step repeats. "Fine for simple workouts, terrible for anything more complicated" [ZW-F-COPY], [ZW-F-3PARAM], [RD-ZWERM, 2025-06-22], [RD-ZWCUSTOM, ~2026-05].
2. Fragile input. Arrow keys broke field editing in 1.39 [ZW-F-ARROW, 2023-05], and typing numbers crashed the game in 1.98 [ZW-F-CRASH, 2025-09].
3. Sync and platform limits: unreliable sync across devices, and no building on phones [ZW-F-SYNC23, 2023-07], [ZW-F-SYNC26, 2026-01-14], [ZW-F-NOCREATE].

### 3.2 ROUVY (Workout Creator)

Caveat: the creator needs a login, so this comes from ROUVY's screenshots, tutorial video and articles. I did not sign in.

Verified:
- A workout is a list of segments. Add one with + or a zone preset [RV-YT, 2024-07-06], [RV-BLOG, 2026-07-08]. Free Ride and Ramp Up/Down came in app 4.0.4 [RV-CHANGE], [RV-APR25, ~2025].
- Per segment: hh:mm:ss duration, % FTP with watts shown next to it, "+ Add cadence" (one rpm value), duplicate and delete [RV-MAY24, 2024-06-12], [RV-BLOG]. There's also a Commentary tab [RV-MAY24].
- Two views: a graph you drag at the top and a list below. ROUVY suggests the list on a phone. Shift-click selects several segments to move, duplicate or delete [RV-YT].
- Feedback header: Duration, TSS, IF, average/min/max % FTP, and a Z1 to Z7 graph [RV-MAY24 screenshot].
- Saving: name, description, training-effect tags, private/public, a default route, "Save to My Workouts". You can "Duplicate and Edit" any workout [RV-BLOG].
- ERG is switched in the ride, not per block. With ERG off the trainer simulates a 1% slope [RV-ERG].
- When FTP changes, the whole library adjusts [RV-WORKOUTS, 2026-11-06].
- Import: MRC, ERG, ZWO [RV-WIO].

Inferred / not confirmed:
- I: repeats are made by duplicating. No repeat control is documented. A user says "make a block and then copy/paste" [RV-RD-EDITOR, 2025-01].
- I: cadence is a cue only. No source says it changes resistance.
- NC: absolute-watt targets, power ranges, HR targets, slope segments, folders.
- Conflict: the creator launched as web-only [RV-MAY24], but the tutorial also says it's in the app [RV-YT].

Top three friction points:
1. No export of workouts you build, so they're locked into ROUVY [RV-RD-EXPORT, 2025-07-19].
2. No repeat block and no saved blocks, so sets get rebuilt by duplicating [RV-RD-EDITOR, 2025-01-27], [RV-RD-2023, 2023-01-29].
3. Limited target types: no ramps before 4.0.4, ranges from intervals.icu arrive as ramps, no slope segments [RV-RD-RAMP, 2022-07-27], [ICU-RV, 2025-07-25], [RV-YT comments].

### 3.3 TrainingPeaks (Structured Workout Builder) and TrainingPeaks Virtual

Builder, verified:
- Eight blocks: Warm up, Active, Recovery, Cool down, Two Step Repeats, Three Step Repeats, Ramp Up, Ramp Down [TP-BUILD, updated 2026-11-17].
- Per step: duration or distance; % FTP, % max HR, % LTHR, % threshold pace or RPE; a single value or a range; zone; cadence; notes; name; "end step on lap button" [TP-BUILD]. Minimum step is 5 s [TP-STRUCT, 2024-07-09].
- Mixed interaction: drag blocks into a graph pane, drag the right edge for length, edit numbers in the step list, +/- for repeat count, drag to reorder, an icon to duplicate [TP-BUILD]. Multi-step repeats shipped in 2022 [TP-UV-BLOCKS].
- Feedback: duration, TSS and IF are calculated automatically. For ranges, TSS uses the middle of the range [TP-STRUCT], [TP-LEARN, 2016-11-16].
- Saving: library folders (premium). Basic accounts get 5 library workouts [TP-LIB, 2025-09-10]. Hold E and click to edit; hold C and drag to copy [TP-KEYS, 2026-01-23]. Changing the intensity type overwrites the workout [TP-BUILD].
- Targets are stored as %. Watts come from current thresholds when the workout is put on the calendar, so library workouts scale with FTP [TP-STRUCT].
- Ramps are stepwise, not smooth. Imported ZWO ramps become 1-minute steps [TP-UV-RAMP, 2025], [TP-ZWO, 2024-12-16].
- The mobile app can't use the builder [TP-MOBILE, 2025-04-23].
- Export: ERG, MRC, FIT (no cadence), ZWO. Import: ZWO only [TP-EXPORT, 2025-04-22], [TP-ZWO].

TrainingPeaks Virtual, verified:
- No in-app builder. "Workout Builder within the app" is marked "Future Opportunity" [TPV-UV].
- Imports ERG, MRC, ZWO [TPV-CUSTOM, 2026-08-07], JSON (0.4.17, 2025-03-17) and FIT (0.4.36, 2026-06-03) [TPV-REL].
- Plays power and cadence ranges (0.4.18, 2025-03-24) and text messages (0.4.27, 2025-08-29). Has a setting to ignore cadence targets (0.3.3, 2024-07-22) [TPV-REL].
- A request to override FTP in ZWO files for fixed watts is marked "Planned" [TPV-UV-FTP, 2024-12-18].

Inferred / not confirmed:
- NC: nested repeats in the builder. NC: time in zone while building.
- I: cadence is a cue only in both. Conflict: TrainingPeaks says cadence carries to Garmin [TP-EXPORT], but its own compatibility table says no [TP-COMPAT].

Top three friction points (builder):
1. Slow entry: no text input, no reusable blocks. One user spent about 20 minutes on one repeat set [TP-RD-1, 2025-12-28], [TP-RD-2, 2024-02-20].
2. Ramps are stepwise only [TP-UV-RAMP].
3. No raw watts, no free ride, no building on mobile [TP-RD-1], [TP-UV-FREE], [TP-MOBILE].

For TP Virtual: no builder [TPV-UV]; only today's synced workout shows [TPV-UV], [CYC-TPV, 2026-01-14]; ERG lag on short intervals [TPV-UV], [TR-F-TPV, 2024-11-06].

### 3.4 Wahoo (SYSTM, Wahoo app)

Verified:
- **No custom workout builder or import in SYSTM** [WH-NOBUILD, updated 2026-10-24].
- The official route is planned workouts: build in TrainingPeaks, TrainerRoad, intervals.icu, TrainerDay and others, and they sync to the Wahoo app's "My plan" for today and tomorrow [WH-PLAN, 2026-10-24], [WH-PARTNERS].
- Neither the Android release notes (to 7.5.0, 2026-11-17) nor the SYSTM release notes (to 7.114.0, 2026-10-28) list a builder [WH-AND-REL], [WH-SYSTM-REL].
- SYSTM's own workouts target a % of one of four numbers (FTP, MAP, AC, NM), with HR as % of LTHR [WH-4DP]. Intensity can be scaled per metric. Warm-up, recovery and cool-down can be left out of the scaling [WH-INTENSITY].
- In ERG the trainer holds the power target and the rider is told to "meet the cadence targets" [WH-ERG, 2026-10-24].
- After a new 4DP test, future workouts update. Workouts already in a plan stay as they were [WH-F-4DP, 2025-01].
- Files copied to an ELEMNT over USB live only on that device [WH-USB].

Inferred: cadence is a cue only in SYSTM.

Top three friction points:
1. No builder, requested since 2020 and still asked for in Dec 2025 [WH-F-2020], [WH-F-2022], [WH-F-2025], [DCR-WAHOO, 2021].
2. You need a third-party tool, often paid. A new KICKR CORE owner asked how to do basic intervals without paying [WH-RD-CORE, 2024-10-25].
3. Loading files by hand is fragile [ICU-WAHOO-1, 2022-23], [ICU-WAHOO-2, 2022-12].

This is the gap Weem Watts can fill for a Kickr Core 2 owner.

### 3.5 TrainerRoad Workout Creator (secondary)

Verified:
- Snippets (stepped and sweet-spot warm-ups, 1/5/20-minute intervals, over-unders), and you can save your own [TR-SNIP].
- You drag dots on a graph: the centre moves an interval, the top sets intensity, the side sets length, and the corner slopes it into a ramp [TR-CREATE, 2026-08-13].
- % FTP only, watts shown, no ranges. No mode switch inside a workout [TR-WC, 2026-08-17].
- Text cues per interval [TR-TEXT]. No cadence goals, and staff said "no immediate plans" to update the creator [TR-F-UPD, 2025-09-25].
- Ctrl + arrows to multi-select, then "Repeat Selection" [TR-F-FIX, 2024-08-08]. Undo and redo with Ctrl+Z and Ctrl+Y [TR-KEYS].
- Clone Workout; edit and republish [TR-CAT], [TR-F-PROG, 2025-09-27]. A user says custom workouts can't be deleted [TR-F-ENJOY, 2026-06].
- Separate Mac/Windows desktop app, not on mobile [TR-WC].

Top three friction points:
1. macOS key conflicts ("e" and "d"), a login loop, broken copy/paste [TR-WC], [TR-F-WORKS, 2025-05-06].
2. Repeats are tedious and stray 1-second intervals appear [TR-F-FIX], [TR-F-SNIP, 2022-04].
3. Stale app: no cadence, no export, no delete [TR-F-UPD], [TR-F-ENJOY], [TR-F-EXPORT, 2020].

### 3.6 intervals.icu (secondary)

Verified [ICU-QG, 2026-08-10] unless noted:
- Line format: `- [duration] [target] [cadence]`. `m` means minutes; meters are `mtr`.
- Targets: `75%`, `95-105%`, `220w`, `200-240w`, `Z2`, `60% MMP 5m`, HR and pace forms.
- Cadence: `90rpm` or `90-100rpm`.
- `- 10m ramp 50%-75%` makes a ramp. `- 20m freeride` turns ERG off.
- Repeats: `Main Set 5x` or `5x` on its own line, with blank lines around the block. Nested repeats are not supported.
- Text before the duration becomes the cue. Timed prompts inside a step use `33^text <!>`.
- Feedback: duration, load, zone colours [ICU-WB], time in zone [ICU-WB70], NP, average power, kJ [ICU-GUIDE].
- % workouts rescale when FTP changes; fixed-watt workouts need editing by hand [ICU-FTP, 2026-02-04].

Top three friction points:
1. No nested repeats [ICU-QG].
2. Numbers in cue text get read as durations or targets, and `m` vs meters trips people up [ICU-WB p56, 2026-03-17], [ICU-QG].
3. Mixing HR, pace and power targets breaks the graph [ICU-WB p49, 2025-04-13].

---

## 4. Table stakes vs nice-to-have vs skip

### 4.1 Shared (table stakes) and distinctive

Every builder that exists has these: steady blocks, ramps, time durations, % FTP targets with watts shown, at least an on/off repeat, a live graph, a name, and copy-then-edit. Wahoo is the exception because it has no builder.

What's distinctive to one app:
- **Zwift:** a cadence block you drop onto a power block; free ride turns ERG off and back on [AHURO], [ZW-ERG].
- **ROUVY:** graph and list side by side; a default route per workout; public/private [RV-YT], [RV-BLOG].
- **TrainingPeaks:** lap-button step end, HR/pace/RPE targets, Three Step Repeats [TP-BUILD].
- **TP Virtual:** no builder, but imports nearly every format [TPV-CUSTOM].
- **Wahoo SYSTM:** scaling intensity can leave warm-up, recovery and cool-down alone [WH-INTENSITY].
- **TrainerRoad:** saved snippets [TR-SNIP].
- **intervals.icu:** a text syntax, MMP targets, timed cues inside a step [ICU-QG].

### 4.2 What to build

| Feature | Verdict | Why |
| --- | --- | --- |
| Steady and ramp steps | **Table stakes (S)** | Every builder has them, and `workout.ts` already does. |
| Repeat with any number of inner steps | **Table stakes (S)** | Zwift's 2-step-only limit is a top complaint [ZW-F-3PARAM]. The model already allows it. |
| Duration as time | **Table stakes (S)** | Universal. ERG riding is time-based. |
| % FTP target with watts shown | **Table stakes (S)** | Universal [RV-BLOG], [TR-WC], [TP-STRUCT]. |
| Watts target option | **Table stakes (S)** | Missing raw watts is a TrainingPeaks complaint [TP-RD-1], and the ramp test already uses watts. |
| Live strip and total time | **Table stakes (S)** | Universal. `WorkoutStrip` already exists. |
| Name, description, difficulty tag | **Table stakes (S)** | The picker filters by tag. Untagged custom workouts would only show under "All". |
| Duplicate and edit any workout | **Table stakes (S)** | Zwift, ROUVY, TrainingPeaks and TrainerRoad all have it. It's also the fastest way to build (see Q3). |
| Delete | **Table stakes (S)** | Missing in TrainerRoad and a complaint there [TR-F-ENJOY]. |
| Cadence target (single rpm, cue only) | **Table stakes (S)** | Zwift, ROUVY, TrainingPeaks and intervals.icu have it; it's missing in TrainerRoad and users complain [TR-F-UPD]. You asked for it. |
| Free-ride step (ERG off) | **Nice-to-have (M)** | Zwift, ROUVY and intervals.icu have it, and its absence is a TrainingPeaks complaint [TP-UV-FREE]. But it touches the ERG and mode logic in `ride.ts`. |
| Text cues at a time inside a step | **Nice-to-have (M)** | Common [ZW-WIKI], [TR-TEXT], [ICU-QG]. The S step label already gives a per-step cue. |
| ZWO export | **Nice-to-have (M)** | No export is the top ROUVY complaint [RV-RD-EXPORT]. It's also a backup. |
| TSS, IF, NP | **Nice-to-have (M)** | Zwift, ROUVY, TrainingPeaks and intervals.icu show them. But the scope doc cut them in v3.2, so this is your call. |
| Cadence range (low to high) | **Nice-to-have (M)** | intervals.icu and TP Virtual support ranges [ICU-QG], [TPV-REL]. Zwift ignores `CadenceLow`/`CadenceHigh` [TJ-ZWO]. |
| Keyboard shortcuts (add row, move, duplicate) | **Nice-to-have (M)** | The drag-only editors are the slow ones [ZW-F-COPY]. Cheap on desktop. |
| Text syntax (intervals.icu-style) | **Nice-to-have (L)** | Fastest entry (Q3), but parser edge cases are a known pain [ICU-WB p56]. |
| Graph you drag | **Skip for now (L)** | Slowest for exact values and the most complained-about model. Needs a new pattern and likely a dependency. |
| Nested repeats | **Skip** | Not supported in intervals.icu or Zwift, and unclear in TrainingPeaks. Rarely needed. |
| Distance or lap-button durations | **Skip** | No head unit, and Skip interval already exists. Distance would bring meters and km into the syntax. |
| HR, pace, RPE targets | **Skip** | The app has no HR strap support. |
| Slope or grade steps | **Skip** | Grade mode is course-driven. Mixing SIM into workouts is a v4 question. |
| Folders, public sharing, AI generator | **Skip** | No accounts, a small library, personal use. |

---

## 5. Fit with this codebase

### 5.1 What `src/lib/workout.ts` supports today

Supported:
- `SteadyStep` and `RampStep` with `durS`, a `Target` of `{ pct }` or `{ w }`, and an optional `label`.
- `RepeatStep` with `times` and any number of inner steady or ramp steps (one level deep).
- `flatten()` turns steps into `Interval[]` with labels. `wattsAt()` handles ramps linearly. `zoneOf()` handles zones.
- `validateWorkout()` caps intervals at 2,000, length at 6 h, and targets at 500% / 2,500 W.
- `rampTest` and `fakeOnly` flags.

Missing:
- **Cadence target:** no field on steps or `Interval`. `zwo.ts` ignores `Cadence`.
- **Text cues:** only the per-step `label`. `zwo.ts` skips `textevent` on purpose.
- **Free ride:** no step type. `zwo.ts` turns `FreeRide` into a 50% ERG step and `MaxEffort` into 150%.
- **Nested repeats:** inner steps can't be repeats (type `(SteadyStep | RampStep)[]`). Fine, keep it that way.
- **Custom source:** `source` is only `'builtin' | 'imported'`. Tags only come from `public/workouts/index.json`.
- **Duration types:** time only. Good.

### 5.2 Storage: ZWO text or the app's own step list

How it works today: imported rows are `{ id, name, zwo, addedAt }` in Dexie table `workouts` (schema version 3), parsed again on every load (`src/lib/recorder.ts`, `src/lib/workouts.ts`).

| | Store as ZWO text | Store as the app's step list (JSON) |
| --- | --- | --- |
| Reuse | Same table and parser. No schema change. | New Dexie table (version 4) and a small validator. |
| Repeats | `IntervalsT` is on/off only [H4L], so 3+ step repeats must be unrolled. Re-opening shows a flat list, not what you built. | Lossless. Matches `RepeatStep`. |
| Watts targets | ZWO `Power` is a fraction of FTP. `ftpOverride` is whole-file, and its current Zwift behaviour isn't confirmed [H4L], [ZW-F-ROUND]. Fixed watts don't round-trip. | Lossless (`{ w }`). |
| Labels, cadence | Labels have no standard attribute (only textevents). Cadence fits (`Cadence`). | Lossless. |
| Export | Free | Needs a ZWO writer (M). Lossy in the same ways. |

**Pick: the step list.** The point of a builder is re-editing. With ZWO as the stored form, you'd reopen a different workout than you saved whenever a repeat has 3+ steps or a target is in watts.

Suggested row: `{ id, name, description, tag, steps, createdAt, updatedAt, v: 1 }` in a new `customWorkouts` table. Treat it as untrusted on load: run it through `validateWorkout`, like imported ZWO.

Generate ZWO only on export (M), and show the rider what export will flatten.

### 5.3 Where the builder lives

- **Entry points:**
  - Profile → "Your files" → Workouts block: add a **New workout** button next to Import ZWO. Each custom row gets **Edit** and **Remove**.
  - Workout tab step 2: the selected workout's detail card gets one secondary **Edit a copy** button. DESIGN.md bans import buttons there, not edit links, but you should confirm (open question 3).
- **The editor:** its own page (for example `#/profile/workout/<id>`), not a third step on the Workout tab. The two-step flow is for picking a ride. Building is a separate, longer task. Save returns you to step 2 with the new workout selected.
- **Lock:** locked mid-ride, like Profile.
- **Layout:** one `surface` panel of step rows split by hairlines, the strip preview and total time above them, and Save (primary) / Cancel (secondary) in a footer row like the Workout tab's.
- **Repeat groups:** an indented block under a mono "3x" row. No nested panels (banned).
- **Reuse:** `SegmentedControl` (Steady / Ramp per row), the Profile `NumberInput` style (`raised` with a `line-strong` border, `rounded-md`), `Button`, `WorkoutStrip`.
- **New patterns to add to DESIGN.md:** `WorkoutEditor`, `StepRow`, `RepeatGroup`, and a text-input variant of `NumberInput`.
- **Units:** min:sec, %, W and rpm only. Nothing metric.

### 5.4 How each new field reaches the ride screen and the FIT file

| Field | Ride screen | FIT file |
| --- | --- | --- |
| Step label | Already shown as the interval name in `WorkoutRow` | Not written. FIT laps have no name, and the app writes laps by index |
| Cadence target (S) | Put "target 90" in the Cadence tile's unit text. Optionally tint the value `state-under` / `state-over` outside ±5 rpm (Zwift's tolerance [TJ-ZWO]). No new row, so 1280x720 is unaffected. **Never sent to the trainer.** | Cadence is already recorded and lap average cadence is written. **Don't write the target.** FIT records have no target field. FIT `workout_step` messages can hold `custom_target_cadence_low/high` and `notes`, and laps can point to them with `wkt_step_index` [FIT-WKT], [FIT-ACT]. Whether Strava uses them is NC. Defer to L. |
| Watts vs % | Already handled (`targetWatts`, `targetPct`). Intensity scales both. | No change |
| Free-ride step (M) | The workout target is null for that step and the mode switches to Resistance at the rider's level, then back to ERG with the existing 6 s soft start. Show "Free ride" as the target. Must work with the low-cadence release. | One lap like any interval |
| Timed text cue (M) | Replace the interval label in `WorkoutRow` for a few seconds. No new row (1280x720). | Skip |

**Codebase catch:** ERG releases below 50 rpm (3 s) and re-engages at 60 rpm. A low-cadence strength step (say 55 rpm) would fight that rule. Either warn in the editor when cadence is under 60 rpm, or decide whether to change the release rule for those steps (open question 4).

---

## 6. Answers to the research questions

**Q1, Q2:** see sections 2 to 4.

**Q3. Fastest input for "10 min warm-up, 3 x 12 min at 90% with 5 min easy, 8 min cool-down"**

| Method | Effort | Basis |
| --- | --- | --- |
| Duplicate built-in "Sweet Spot 3x12" (same structure) and save | about 3 clicks plus the name | est., this app (design not built) |
| Proposed S step list, starting from a warm-up and cool-down template | about 8 clicks, about 16 keystrokes plus the name | est., this app (design not built) |
| intervals.icu text, steady version | 42 keystrokes, 0 clicks plus save | counted from [ICU-QG] |
| intervals.icu text with ramps (below) | 58 keystrokes | counted from [ICU-QG] |
| Zwift editor | about 3 drags, 7 to 9 clicks, 20 to 25 keystrokes | est. from [ZW-SUP], [AHURO] |
| TrainingPeaks builder | about 15 to 22 clicks/drags, 25 to 40 keystrokes | est. from [TP-BUILD] |
| ROUVY creator | about 25 to 30 clicks, about 40 keystrokes | est. from [RV-YT], [RV-BLOG] |
| TrainerRoad creator | about 25 to 40 clicks, 30 to 45 keystrokes | est. from [TR-CREATE], [TR-F-FIX] |
| Wahoo | not possible natively | [WH-NOBUILD] |

The ramp version of the intervals.icu text:

```
- 10m ramp 50-75%

3x
- 12m 90%
- 5m 55%

- 8m ramp 60-45%
```

Takeaways:
- Text and keyboard-first step lists are fastest. Drag builders are slowest.
- Copy-then-edit beats all of them when a close workout exists.
- Note: in intervals.icu, ZWO `IntervalsT` and the built-in Sweet Spot 3x12, the repeat includes the 5 minutes after the last interval.

**Q4. Cadence:** a cue in every app. None change the trainer.
- Zwift prompts at about ±5 rpm [TJ-ZWO], [ZW-WIKI].
- SYSTM says ERG holds power and the rider should "meet the cadence targets" [WH-ERG].
- TP Virtual can ignore cadence targets [TPV-REL]. TrainerRoad has none [TR-F-UPD].
- In this app: cue only, plus the 50/60 rpm release catch in 5.4.

**Q5. Watts vs % FTP:**
- % FTP is the default everywhere and scales when FTP changes [TP-STRUCT], [RV-WORKOUTS], [TR-WC], [ICU-FTP].
- Zwift saves typed watts as % [ZW-F-ROUND].
- TrainingPeaks has no raw watts [TP-RD-1]. intervals.icu keeps `w` targets fixed [ICU-FTP].
- Wahoo leaves workouts already in a plan unchanged after a new test [WH-F-4DP].
- This app already does both, and FTP changes never rewrite past rides. Keep each target as entered and show the other unit next to it, so it's clear which steps will move when FTP changes.

**Q6. Small screens vs desktop:**
- Zwift: desktops and tablets, not phones [ZW-SUP].
- TrainingPeaks: web builder only, not in the mobile app [TP-MOBILE].
- TrainerRoad: desktop app only [TR-WC].
- ROUVY: suggests the list view on phones [RV-YT].
- intervals.icu: web, with better phone support since Sep 2026 [ICU-NEWS].
- For this app: design for 1280 px and a keyboard. No touch dragging needed.

**Q7. Licensed code worth borrowing** (checked through the GitHub API on 20 Nov 2026; don't copy anything yet)

| Repo | License | What's reusable | Notes |
| --- | --- | --- | --- |
| [breiko83/zwo-editor](https://github.com/breiko83/zwo-editor) (zwiftworkout.com) | **MIT** (LICENSE.md, © 2020 Carlo Schiesaro). Last push 2026-11-17 | ZWO writing logic (`src/components/Editor/createWorkoutXml.ts`, `src/services/xmlService.ts`), its text grammar (`textParserService.ts`: `steady 200w 5m`, `message "text" 30s`), keyboard shortcuts (arrows change time and power, undo/redo hook) | React 16 / CRA, uses `xmlbuilder`, `@dnd-kit`, `moment`. Borrow logic, not the dependencies. Keep the MIT notice in any copied file |
| [h4l/zwift-workout-file-reference](https://github.com/h4l/zwift-workout-file-reference) | **MIT OR CC-BY-4.0** | The best ZWO element and attribute reference (cadence attributes, `textevent`, `FreeRide`, `ftpOverride`), with how often each is used | Documentation, not code. Last commit 2021-02-22 |
| [tomjelen/zwift-workout-skills](https://github.com/tomjelen/zwift-workout-skills) | **MIT** | `skills/zwo-format/SKILL.md`: community-tested ZWO behaviour (cadence, ramp direction) | Documentation. 2026-07 |
| [pablo-albaladejo/kaiord](https://github.com/pablo-albaladejo/kaiord) | **MIT** | `packages/zwo` mapping between ZWO and FIT, a ZWO XSD (`packages/core/schema/zwift-workout.xsd`), `docs/zwift-format-extensions.md` | Uses `fast-xml-parser` and Zod. Read for mapping rules; don't add it as a dependency |
| [chrishunt/zw2fit](https://github.com/chrishunt/zw2fit) | **MIT** | Mapping from ZWO to FIT workout steps (Ruby) | For an L-size FIT workout export only |
| [helderlopes/MRC_creator](https://github.com/helderlopes/MRC_creator) | **MIT** | The TrainerDay-style 3-column text format (`min pct [pct2]`), and MRC/ERG/ZWO/FIT output rules | C++ |
| [veelenga/zwo-generator](https://github.com/veelenga/zwo-generator) | **MIT** (LICENSE file) | Same stack (React 19, Vite, Tailwind). Drag-segment builder patterns | Uses `@dnd-kit`, Zustand, OpenAI. Only relevant to the L option |
| [steffenr/zwo-trainer](https://github.com/steffenr/zwo-trainer) | **MIT** | A ZWO player (not a builder): ideas for how a player handles ZWO | Tauri app |

**Do not copy:**
- `nene/zwiftout` and `nene/workout-editor`: no LICENSE file, and zwiftout's package.json says GPL-3.0-or-later. Its syntax (`Interval: 15:00 100% 90rpm`, `@ 01:00 cue`) is a good idea to read only.
- No license: `MaysenTG/zwift-workout-creator`, `tcrevel/ZwiftWorkoutBuilder`.
- GPL: `Artilody-Workout-Creator`, `sven-v-t-veer/zwift-workout-creator`.
- BSD-3: `tare/zwog`. BSD-3 isn't on the CLAUDE.md allow list.
- ZWOFactory: a closed website.

None of the options below need a new dependency. ZWO can be written with `XMLSerializer` or plain strings, the way `zwo.ts` already reads with `DOMParser`.

---

## 7. Three build options

Effort is rough: Claude Code build days plus a ride test, assuming the current codebase.

### S. Step-list editor (recommended)

- **What the rider can do:**
  - New, edit, duplicate and delete workouts.
  - Steps: steady, ramp, and repeat with any inner steps.
  - Targets typed as % or W, with optional cadence rpm and a label.
  - A name, description and difficulty tag.
  - A live strip and total time.
  - Custom workouts show on the Workout tab with "custom" in the meta.
  - Cadence target shows in the Cadence tile.
  - ZWO import reads `Cadence`.
- **Effort:** about 2 to 3 days.
  - Model: `cadenceRpm?` on steps and `Interval`, a `custom` source.
  - Dexie v4 table, editor page, two DESIGN.md entries, and the Cadence tile hint.
- **Defers:** free ride, timed cues, ZWO export, TSS, text syntax, drag.
- **Risks:**
  - Custom workouts can be lost when browser data is cleared (no export).
  - The editor's row layout is a new pattern; keep it to one panel.
  - Cadence under 60 rpm fights the ERG release.
  - Duration parsing ("12" means minutes) needs a clear hint.

### M. Editor plus round-trip

- **What the rider can do:** everything in S, plus:
  - Free-ride steps (ERG off, then back on with the soft start).
  - Timed text cues inside a step.
  - Download as ZWO. 3+ step repeats are unrolled, and watts become % at current FTP, with a warning.
  - ZWO import keeps `textevent`, `FreeRide` (as real free ride), and `CadenceResting`.
  - TSS, IF and NP readout.
  - Cadence range.
  - Keyboard shortcuts: Enter for a new row, Alt+Up/Down to move, Ctrl+D to duplicate.
- **Effort:** about 4 to 6 more days.
- **Defers:** text syntax, drag, FIT workout messages, nested repeats.
- **Risks:**
  - Free ride changes mode mid-workout in `ride.ts`, the riskiest code path. It needs a Kickr ride test, not only `?fake=1`.
  - Lossy export can surprise people.
  - Cues must not grow the Ride panel past 1280x720.
  - TSS was cut in v3.2, so decide first.

### L. Full builder

- **What the rider can do:** everything in M, plus:
  - A graph you drag (edges for time and power).
  - A two-way text mode (intervals.icu syntax, so workouts paste in from there).
  - Undo and redo.
  - Saved snippets (TrainerRoad-style).
  - Time in zone.
  - FIT `workout` / `workout_step` messages with `wkt_step_index` on laps.
  - Maybe nested repeats.
- **Effort:** about 2 to 4 weeks.
- **Defers:** nothing in this list.
- **Risks:**
  - Probably needs `@dnd-kit` or a hand-built drag layer, which breaks "no new dependencies".
  - Brand-new interaction patterns for DESIGN.md.
  - A parser with edge cases [ICU-WB p56].
  - Strava's use of FIT workout steps is NC.
  - It's the stretch feature the scope doc says must earn its place after real use.

---

## 8. Sources

All accessed 20 Nov 2026. The date is the source's own date, or "undated".

**Zwift**
- [ZW-SUP] https://support.zwift.com/custom-workouts-ryGOTVEPs (undated)
- [ZW-ERG] https://support.zwift.com/en_us/erg-mode-in-workouts-SkQJC8OEH (undated)
- [ZI-2015] https://zwiftinsider.com/custom-workouts-now-supported-in-zwift (2015-12-14)
- [ZI-HOWTO] https://zwiftinsider.com/creating-custom-workouts (2018-10-12)
- [ZI-MANUAL] https://zwiftinsider.com/manually-editing-zwift-workouts/ (2017-12-12, edited 2019-01-03)
- [ZI-187] https://zwiftinsider.com/update-1-87-143212 (2025-04-02)
- [AHURO] https://www.ahuro.com/archives/9197 (2020-03-02)
- [ZW-WIKI] https://zwift.fandom.com/wiki/Workouts (2026-07-29)

**Zwift forums and Reddit**
- [ZW-F-MENU22] https://forums.zwift.com/t/workout-menu-update-october-2022/591819 (2022-10)
- [ZW-F-ARROW] https://forums.zwift.com/t/arrow-keys-do-not-work-as-expected-custom-workout-editor-end-ride-screen-drone-camera-u-turn-intersections-1-39-0-may-2023/606408?page=2 (2023-05)
- [ZW-F-CRASH] https://forums.zwift.com/t/zwift-closing-while-trying-to-create-or-edit-a-custom-workout-sept-2025/656793 (2025-09)
- [ZW-F-COPY] https://forums.zwift.com/t/customer-workout-copy-paste-intervals/13496 (2018-10-03)
- [ZW-F-3PARAM] https://forums.zwift.com/t/3-parameter-intervals-repeat/664304 (2026-01-29)
- [ZW-F-ROUND] https://forums.zwift.com/t/bring-back-the-exact-watt-goals-for-workouts-stop-the-rounding/571155 (2022-01 to 2025-02)
- [ZW-F-FTP23] https://forums.zwift.com/t/custom-workouts-and-ftp/611303 (2023-08-30)
- [ZW-F-SYNC23] https://forums.zwift.com/t/syncing-custom-workouts/609395 (2023-07-11)
- [ZW-F-SYNC26] https://forums.zwift.com/t/custom-work-outs-on-pc-app-not-syncing-to-ipad-and-iphone/663261 (2026-01-14)
- [ZW-F-64KB] https://forums.zwift.com/t/some-custom-workout-not-syncing-64kb-maximum-zwo-size/592520 (2022-10-31)
- [ZW-F-NOCREATE] https://forums.zwift.com/t/no-workout-create-option/651983 (2025-04)
- [ZW-F-ZC] https://forums.zwift.com/t/custom-workouts-in-companion-app/661310 (2025-12-16)
- [RD-ZWERM] https://www.reddit.com/r/Zwift/comments/1lhex3c/ (2025-06-22)
- [RD-ZWCUSTOM] https://www.reddit.com/r/Zwift/comments/1tttg0j/custom_trainings/ (about 2026-05)

**ZWO format**
- [H4L] https://github.com/h4l/zwift-workout-file-reference (last commit 2021-02-22)
- [TJ-ZWO] https://github.com/tomjelen/zwift-workout-skills/blob/main/skills/zwo-format/SKILL.md (2026-07)

**ROUVY**
- [RV-BLOG] https://rouvy.com/blog/how-to-create-a-workout (2026-07-08)
- [RV-MAY24] https://rouvy.com/whats-new/may-2024 (2024-06-12)
- [RV-APR25] https://rouvy.com/whats-new/april-25 (about 2025)
- [RV-CHANGE] https://support.rouvy.com/hc/en-us/articles/360018747798-Changelog (undated)
- [RV-WIO] https://support.rouvy.com/hc/en-us/articles/33398875835921-Workouts-in-ROUVY (undated)
- [RV-ERG] https://support.rouvy.com/hc/en-us/articles/40289751085201 (undated)
- [RV-TP] https://support.rouvy.com/hc/en-us/articles/14771353823121 (undated)
- [RV-ICU] https://support.rouvy.com/hc/en-us/articles/35523188955793 (undated)
- [RV-WORKOUTS] https://rouvy.com/workouts (2026-11-06)
- [RV-YT] https://www.youtube.com/watch?v=7s6yu69nGKQ (2024-07-06, plus comments)
- [RV-RD-EDITOR] https://www.reddit.com/r/Rouvy/comments/1ibboxu/workout_editor/ (2025-01-27)
- [RV-RD-EXPORT] https://www.reddit.com/r/Rouvy/comments/1m41jzn/ (2025-07-19)
- [RV-RD-2023] https://www.reddit.com/r/Rouvy/comments/10omhyq/ (2023-01-29)
- [RV-RD-RAMP] https://www.reddit.com/r/Rouvy/comments/w9t9w7/ (2022-07-27)
- [ICU-RV] https://forum.intervals.icu/t/why-does-rouvy-and-zwift-interpretation-of-power-zones-in-workout/109473 (2025-07-25)
- [TR-ROUVY] https://support.trainerroad.com/hc/trainerroad-support/articles/1790631219-syncing-rouvy-with-trainer_road (updated 2026-09-28)

**TrainingPeaks and TP Virtual**
- [TP-BUILD] https://help.trainingpeaks.com/hc/en-us/articles/235164967 (updated 2026-11-17)
- [TP-STRUCT] https://help.trainingpeaks.com/hc/en-us/articles/115003760832 (2024-07-09)
- [TP-EXPORT] https://help.trainingpeaks.com/hc/en-us/articles/115000325647 (2025-04-22)
- [TP-COMPAT] https://help.trainingpeaks.com/hc/en-us/articles/360001652912 (2025-10-08)
- [TP-ZWO] https://help.trainingpeaks.com/hc/en-us/articles/32432105650573 (2024-12-16)
- [TP-MOBILE] https://help.trainingpeaks.com/hc/en-us/articles/360051133272 (2025-04-23)
- [TP-LIB] https://help.trainingpeaks.com/hc/en-us/articles/204072434 (2025-09-10)
- [TP-KEYS] https://help.trainingpeaks.com/hc/en-us/articles/38847458144013 (2026-01-23)
- [TP-LEARN] https://www.trainingpeaks.com/learn/articles/introducing-trainingpeaks-workout-builder (2016-11-16)
- [TP-RD-1] https://www.reddit.com/r/trainingpeaks/comments/1py54ja (2025-12-28)
- [TP-RD-2] https://www.reddit.com/r/trainingpeaks/comments/1av8cpr (2024-02-20)
- [TP-UV-BLOCKS] https://peaksware.uservoice.com (idea 41933173, completed 2022-11-03)
- [TP-UV-RAMP] https://peaksware.uservoice.com (idea 44765380, comments 2025-02 to 2025-08)
- [TP-UV-FREE] https://peaksware.uservoice.com (idea 49162619, 2024-12-01)
- [TPV-UV] https://peaksware.uservoice.com/forums/964442/status/1229555 (undated)
- [TPV-UV-FTP] https://peaksware.uservoice.com (idea 49227221, 2024-12-18)
- [TPV-CUSTOM] https://help.trainingpeaks.com/hc/en-us/articles/31340506774541 (2026-08-07)
- [TPV-REL] https://help.trainingpeaks.com/hc/en-us/articles/34924247758477 (release notes, updated 2026-10-28)
- [CYC-TPV] https://www.cyclist.co.uk/reviews/trainingpeaks-virtual-training-app-review (2026-01-14)
- [TR-F-TPV] https://www.trainerroad.com/forum/t/88101?page=7 (2024-11-06)

**Wahoo**
- [WH-NOBUILD] https://support.wahoofitness.com/hc/en-us/articles/4407201107090 (updated 2026-10-24; re-checked by me 2026-11-20)
- [WH-PLAN] https://support.wahoofitness.com/hc/en-us/articles/20935304770322 (2026-10-24)
- [WH-PARTNERS] https://support.wahoofitness.com/hc/en-us/articles/23022859474962 (undated)
- [WH-AND-REL] https://support.wahoofitness.com/hc/en-us/articles/360000117504 (to 2026-11-17)
- [WH-SYSTM-REL] https://support.wahoofitness.com/hc/en-us/articles/4407236038930 (to 2026-10-28)
- [WH-4DP] https://support.wahoofitness.com/hc/en-us/articles/7671514838674 (undated)
- [WH-INTENSITY] https://support.wahoofitness.com/hc/en-us/articles/4402733558802 (undated)
- [WH-ERG] https://support.wahoofitness.com/hc/en-us/articles/4402565516946 (2026-10-24)
- [WH-USB] https://support.wahoofitness.com/hc/en-us/articles/28544587410450 (undated)
- [WH-F-4DP] https://wahoox.forum.wahoofitness.com/t/do-workouts-scale-to-individual-values-in-your-4dp-i-e-map/19336 (2025-01-25)
- [WH-F-2020] https://wahoox.forum.wahoofitness.com/t/workout-builder/3101 (2020-08)
- [WH-F-2022] https://wahoox.forum.wahoofitness.com/t/custom-workouts/11615 (2022-03)
- [WH-F-2025] https://wahoox.forum.wahoofitness.com/t/custom-workouts/30565 (2025-12-05)
- [WH-RD-CORE] https://www.reddit.com/r/wahoofitness/comments/1gbqwfn/ (2024-10-25)
- [DCR-WAHOO] https://www.dcrainmaker.com/2021/09/wahoos-training-platform.html (2021-09-28, comment 2021-10-11)
- [ICU-WAHOO-1] https://forum.intervals.icu/t/planned-workout-export-to-tp-or-wahoo-help/25730 (2022-12 to 2023-08)
- [ICU-WAHOO-2] https://forum.intervals.icu/t/wahoo-bolt-and-roam-no-mrc-plan-sync/4680 (2022-12)

**TrainerRoad**
- [TR-WC] https://support.trainerroad.com/hc/trainerroad-support/articles/115003204386-workout-creator (2026-08-17)
- [TR-CREATE] https://support.trainerroad.com/hc/trainerroad-support/articles/201377834-creating-a-custom-workout (2026-08-13)
- [TR-ERG] https://support.trainerroad.com/hc/trainerroad-support/articles/201944204-creating-a-workout-from-an-erg-or-mrc-file (2026-08-13)
- [TR-SNIP] https://support.trainerroad.com/hc/trainerroad-support/articles/201881934-workout-snippets (undated)
- [TR-TEXT] https://support.trainerroad.com/hc/trainerroad-support/articles/201377864-adding-text-to-a-workout (undated)
- [TR-KEYS] https://support.trainerroad.com/hc/trainerroad-support/articles/202806120-trainerroad-keyboard-shortcuts (undated)
- [TR-CAT] https://support.trainerroad.com/hc/trainerroad-support/en/categories/general-usage-workout-creator (undated)
- [TR-F-UPD] https://www.trainerroad.com/forum/t/workout-creator-update/105709 (2025-09-25)
- [TR-F-FIX] https://www.trainerroad.com/forum/t/workout-creator-fix/95260 (2024-08-08)
- [TR-F-ENJOY] https://www.trainerroad.com/forum/t/really-enjoying-the-workout-creator-it-fits-in-seamlessly-with-other-features/113934 (2026-06)
- [TR-F-PROG] https://www.trainerroad.com/forum/t/workout-creator-downgrading-progression-levels/105741 (2025-09-27)
- [TR-F-EXPORT] https://www.trainerroad.com/forum/t/exporting-workouts-from-creator/38932 (2020-07-07)
- [TR-F-WORKS] https://www.trainerroad.com/forum/t/does-the-custom-workout-function-still-work/103022 (2025-05-06)
- [TR-F-SNIP] https://www.trainerroad.com/forum/t/workout-creator-custom-workouts/60771 (2021-07 to 2022-04)

**intervals.icu**
- [ICU-QG] https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701 (2026-08-10; re-checked by me 2026-11-20)
- [ICU-WB] https://forum.intervals.icu/t/workout-builder/1163 (2020-06-16, updated to 2025-11). Page 49 dated 2025-04-13; page 56 dated 2026-03-17
- [ICU-WB70] https://forum.intervals.icu/t/workout-builder/1163/70 (2020-06-27)
- [ICU-GUIDE] https://forum.intervals.icu/t/activities-page-a-guide-to-getting-started/17698/16 (2022-08-20)
- [ICU-FIT] https://forum.intervals.icu/t/import-and-download-workout-and-activity-fit-files/19295 (2022-09-08)
- [ICU-API] https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624 (2024-12-04)
- [ICU-ZWIFT] https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764 (2024-12-04)
- [ICU-FTP] https://forum.intervals.icu/t/how-are-planned-workouts-updated-on-changing-ftp/121386 (2026-02-04)
- [ICU-NEWS] https://forum.intervals.icu/t/intervals-icu-news-2026-09-23/132557 (2026-09-24)

**FIT**
- [FIT-WKT] https://developer.garmin.com/fit/articles/file-types/workout.html (undated)
- [FIT-ACT] https://developer.garmin.com/fit/file-types/activity/ (undated)

---

## 9. Open questions only you can answer

1. **Phase:** build the builder now, or after the v3.2 ride test? CLAUDE.md says stay in phase; my default is after.
2. **Backup:** is losing custom workouts on a browser-data wipe OK for S, or should ZWO export move into S (about half a day)?
3. **Entry point:** may the Workout tab's detail card carry one "Edit a copy" button, or should the builder be reachable only from Profile?
4. **Low cadence:** will you build low-cadence strength steps (under 60 rpm)? If so, should ERG's 50/60 rpm release change during those steps, or should the editor just warn?
5. **TSS / IF:** still cut, as in v3.2, or wanted in the builder (M)?
6. **Free ride inside a workout:** wanted at all, given that riding before Start workout is already a free ride?
7. **intervals.icu:** do you use it? If yes, pasting its text syntax (L) becomes much more valuable.
