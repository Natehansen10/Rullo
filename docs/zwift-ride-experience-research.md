# Zwift's ride experience, and how Weem Watts can feel like it

Researched 20 Nov 2026. Research only: no app code changed.

**Marks:** **[V]** = verified on the source page. **[I]** = my inference. **(pre-2024)** = the source is older than 2024; Zwift's HUD has changed several times since.

**Source keys** (full list in Sources at the end). Zwift's support pages carry no publish date. I read them all on 20 Nov 2026, and their screenshots are labelled with game versions up to v1.124, so I treat them as current.

**Reference screenshots:** your two attached screenshots did not come through with the request (only the text did). I worked from your written description plus Zwift's own support screenshots. Four corrections to the description:
- **"WP" is Weighted Power** in watts, added 15 Jul 2025 (v1.93). Zwift doesn't publish the formula. [V] F-193
- **The small number by the bike icon is your rider level**, with an XP bar. It's not a rider count; that's the "+N more" at the foot of Zwifters Nearby. [V] S-HUD
- **"Lap 1/1" sits in the minimap's route profile**, not the top bar. [V] S-HUD, F-180
- **Splits and best efforts came in two updates.** Splits shipped 20 May 2025 (v1.90). The 5 s / 1 min / 5 min / 20 min / 60 min "Ride Stats" panel came 15 Jul 2025 (v1.93). [V] F-190, F-193

---

## 1. Recommendation

Seven changes, in order of feel gained per hour of work. Each fits DESIGN.md and the 1280x720 Ride tab.

1. **Ride summary after End Ride.** Today the panel goes to dashes, plus Download FIT and New ride (`weem-04-ride-ended.png`). Zwift's Ride Report is the moment that tells you the ride counted. Show these in the same panel:
   - totals: time, miles, average and weighted power, kJ, average cadence, climbed;
   - best 5 s / 1 min / 5 min / 20 min;
   - time in zone;
   - a power chart;
   - one row per lap or interval.

   Every sample is already in IndexedDB. Effort: medium.
2. **Power target cue in the Power tile.** Show "target 198 W · on" in the label row, coloured on, under or over, like the cadence cue already is. It gives you Zwift's "HOLD 160w FOR 40 sec" box at zero height. Effort: small.
3. **Next-change line in the control row.** In the last 10 s of an interval the status text reads "Next 198 W in 0:08". It also shows ZWO text events: your FRNKLN January 6 file has 24, and the parser ignores them today. Effort: small.
4. **Lap key (L).** It starts a FIT lap, the current lap shows as one Stat, and the summary lists laps. This is Zwift's Splits (v1.90) and the 176-vote lap request. Effort: small.
5. **Best efforts and running totals on a free ride.** A "Ride stats" row shows average power, kJ, best 5 s / 1 min / 5 min / 20 min and the current lap. A free ride has about 480 px of mostly empty tiles today, so it fits. Effort: small.
6. **Next climb on a course.** "Next climb 0.8 mi · 1.4 mi at 4.2%" in the course row. This is the top Reddit ask of 2026 (371 upvotes). Effort: medium, because it needs climb detection, which v3.3 needs anyway.
7. **Optional interval sounds, off by default.** Three soft beeps before a change. Audio keeps the screen calm. Audio cues are the fastest-growing Zwift request (69 votes in 2 months). Effort: small.

**Where I'd push back:**
- **Don't colour the power number by zone.** Live power is Cobalt. Use a zone code chip and a thin time-in-zone bar instead.
- **No big centre-screen text.** DESIGN.md bans centred layouts, and the text would jump. Cues go in the existing status slot.
- **No stars, XP, Drops, badges or OK countdowns.** They are game rewards, and they move.
- **No W/kg.** It needs kg, which the units rule bans, and "W/lb" means nothing to anyone.
- **No left-hand interval list.** There's no room at 1280x720 with a course. The WorkoutStrip already shows every interval.
- **No minimap.** The scope cut the 2D map. The elevation profile does that job.
- **HUD hide and customise wait for Movie Mode.**

---

## 2. Screen-by-screen: a Zwift ride from launch to save

| # | Screen | What's on it | What you can click | Leads to | Source |
|---|---|---|---|---|---|
| 1 | Launcher / login | Profile photo, name, ride and run levels (launcher v1.1.18) | Log in, Let's go | Pairing or Home | [V] ZI-1122 (22 Sep 2026). Current login layout not confirmed |
| 1a | First launch only | Licence, About you, Goals, Paired devices, Gender, Body measurements (Save), Avatar, Bike | Next / Save / Finish | Home | [V] S-FIRST, screenshots from v1.32 (pre-2024 UI) |
| 2 | **Paired Devices** | Tiles: Power source (or Speed sensor), Resistance, Cadence, Controls (steering moved here), Heart rate. Each shows a live value and "✓ Connected" or "Search". Ride/Run toggle, BLE/ANT+ icons, Pairing Options | A tile opens a device list (Recommended / All), then Close. OK continues. Pairing Options has Background Pairing and Companion Bridging | Home | [V] S-PAIR; F-1122 (22 Sep 2026). Screenshots `zwift-paired-devices-*.png` |
| 2a | Background pairing (default since v1.121/1.122) | Pairing screen is skipped. A corner toast says "LOOKING FOR EQUIPMENT… x/5" and warns if a saved device is missing | — | Home | [V] F-PAIR26 (22 Sep 2026) |
| 3 | **Home** | Text tabs HOME / EVENTS / ROUTES / WORKOUTS (since v1.64). Top right: Join a Zwifter, Pairing (device count), Garage, profile, exit. Body: Theater Card hero, Progress card (weekly goal, XP, badges), For You row, What's New | Any tab or card. Settings via initials → My settings | Route or workout pick | [V] F-HOME24 (29 Apr 2024); F-THEATER (22 Sep 2026); S-SET |
| 4a | **Route pick** | World (Watopia or guest world, World Schedule), route list. Time estimate uses your FTP and weight. Lead-in shown in blue | Route, START RIDE | Riding | [V] S-ROUTE (v1.122 image) |
| 4b | **Workout pick** | Collections / Custom / All Workouts / Plans → workout overview. A Fitness Level screen asks for FTP if none is set. "Use Erg Mode" option | START RIDE → pick a route → START WORKOUT | Riding (workout HUD) | [V] S-WM. Screenshots `zwift-workout-start-ride-v1.102.png`, `zwift-workout-select-route-v1.102.png` |
| 5 | **Riding** | The HUD (section 3) | Keys, action bar, MENU (Esc) | Pause / End | [V] S-HUD |
| 6 | **Pause** | No pause in a free ride. "Moving Time" stops when you stop. Coffee Stop pauses distance, XP and Drops but needs another rider nearby and isn't allowed in races or workouts. Workouts have a Pause button. Stop pedalling in a workout and ERG goes to "bailout" (neutral) resistance | Coffee Stop (action bar), Pause workout (action bar or Companion) | Riding | [V] S-HUD; S-COFFEE (v1.124); S-WM; F-ERG26 (9 Feb 2026, Zwift staff) |
| 7 | **End ride** | MENU → END RIDE | End Ride | Ride Report | [V] S-SAVE |
| 8 | **Ride Report** | Title "Zwift – <Route> in <World>", average power, distance, elapsed time, kcal, Ride Ons, XP bar. Tabs: General (route map, Rode With, goals, highlights incl. new power bests), Timeline (power, cadence and HR by the second, Stress Points), Critical Power (power curve). OK auto-selects after a countdown | Tabs, follow buttons, OK | Save screen | [V] S-RR (v1.101 images); ZI-1101 (4 Nov 2025). Shows only when ending from the game menu, not Companion |
| 9 | **Save** | Activity title field, visibility (Public / Followers / Private), Share to Club, photos to include, SAVE, trash can (discard) | Save, Discard | Progress Report | [V] S-SAVE. No current official screenshot found |
| 9a | Discard confirm | "DISCARD ACTIVITY? This activity will be permanently deleted…" Cancel / Discard | — | Home | [V] F-DISCARD (9 Sep 2026); a forum regular says it only appears for rides of 2 km or more |
| 10 | **Progress Report** (replaced Streaks in v1.104) | Career progress (level, XP, upgrades, badges), Fitness Trends (weekly goal, streak, training score, Fresh/Productive/Overreaching), Performance (1-year bests at 5 s / 1 / 5 / 20 min, FTP, Racing Score). Camera icon saves it as an image | Continue (auto-selects) | Home | [V] F-1104 (16 Dec 2025); S-PROG |
| 11 | After the ride | Auto-upload to Strava, Garmin, Wahoo and others. FIT kept locally: `%LOCALAPPDATA%\Zwift\Activities` on PC since Feb 2026 (before that `Documents\Zwift\Activities`), `~/Documents/Zwift/Activities` on Mac, or zwift.com → activity → Download FIT. Rename later in Companion or on zwift.com. Last 250 activities listed | — | — | [V] STRAVA-ZW (21 Sep 2026); S-3P; S-FIT; S-ACT |

**Weem Watts today, for comparison** (screenshots taken 20 Nov 2026 with `?fake=1`):
- Connect → device picker → Ready → first pedal stroke starts the ride.
- Auto-pause after 3 s at 0 W and 0 rpm. The pill says "Paused", the numbers dim, and the control row says "Paused. Pedal to resume." (`weem-03-ride-paused.png`)
- End Ride → Confirm end → the FIT downloads, then the panel shows dashes, with Download FIT and New ride (`weem-04-ride-ended.png`).

There's no report step. That is the biggest gap in the flow. Auto-pause is something Zwift doesn't have.

---

## 3. HUD inventory per ride type

Zwift publishes no update rates for any element. Sizes are my measurements from Zwift's 768x448 support screenshot, as a share of screen width by height [I].

### 3.1 HUD changes, 2024 to 2026

| Date | Version | Change | Source |
|---|---|---|---|
| 30 Apr 2024 | — | HUD refresh announced: configurable power tile, climb-mode profile, new minimap | [V] ZNEWS-HUD; ZI-HUD24 (6 May 2024) |
| 3 Sep 2024 | v1.73 | Power panel: zone distribution bar, 4 configurable slots. Centre: dynamic elevation display (next ~800 m when a climb is ahead) | [V] F-173 |
| 12 Nov / 17 Dec 2024 | v1.78 / v1.80 | Minimap route profile: full route, progress, segment banners, distance to finish, event lap counter, blue lead-in. All worlds by v1.80. TSS renamed Stress Points | [V] ZI-178; F-180 |
| 20 May 2025 | v1.90 | **Splits** panel and New Split button. Tab starts a split. Splits are written to the FIT | [V] F-190; ZI-190 |
| 15 Jul 2025 | v1.93 | **Ride Stats** panel (best 5 s / 1 / 5 / 20 / 60 min), off by default. New metrics: WP, CORE temperature, HSI, L/R, average speed | [V] F-193; ZI-193 |
| 4 Nov 2025 | v1.101 | Power Segments (best average power over a set time). New power bests in the Ride Report | [V] F-1101; ZI-1101 |
| 16 Dec 2025 | v1.104 | Draft indicator bar; Progress Report replaces Streaks | [V] F-DRAFT; F-1104 |
| 12 May 2026 | v1.113 | **Customisable workout HUD**: 4 centre fields; Ride Stats usable in workouts | [V] F-HUDW |
| 26 May / 8 Jun 2026 | v1.114 / v1.115 | Interval (split) averages for power, HR, cadence; new icons for split vs ride averages | [V] ZI-1114; F-1115 |
| 7 Jul 2026 | v1.117 | Target-watts field in the workout HUD made larger | [V] F-1117 |
| 20 Oct 2026 | v1.124 | **Watt Lock**: hold a fixed wattage outside workouts, ±1 W | [V] F-1124; S-WL |

### 3.2 Free ride (the base for every type)

| Element | Shows | Units | Position, size [I] | Appears | Source |
|---|---|---|---|---|---|
| Power panel | Big live power, zone-coloured bolt, zone distribution bar, 4 slots chosen from 16 metrics (rpm, avg W, bpm, kJ, cal, W/kg, Stress Points, WP, CORE, HSI, L/R, splits…). Device alerts on top for up to 60 s | W, rpm, bpm, kJ | Top left, ~16% x 23% | Always | [V] S-HUD |
| Zone colours | Z1 grey <60% FTP, Z2 blue 60–75, Z3 green 76–89, Z4 yellow 90–104, Z5 orange 105–118, Z6 red >118 | % FTP | In the power panel | Always | [V] S-HUD |
| Gear | "GEAR 8" of 24 virtual gears | — | Foot of the power panel | Virtual shifting on; hidden in ERG | [V] S-HUD; S-VSHIFT |
| PowerUp | Held power-up icon | — | Right of the power panel, ~9% wide | After an arch; never in workouts | [V] S-HUD; S-WM |
| Top-centre bar | Speed, distance, elevation gained, elapsed time; under it rider level + XP bar, Drops | mph or km/h, mi or km, ft or m | Top centre, ~35% x 10% | Always | [V] S-HUD; ZI-DIST (29 Aug 2026) |
| Dynamic elevation | Next ~800 m of profile with the current grade flag | % | Grows the centre panel to ~50% x 22% | When a climb is ahead | [V] F-173 |
| Draft indicator | Blue bar that widens with draft | — | Under the centre panel | On a wheel; not on a TT bike | [V] F-DRAFT |
| Side display | Leaderboards, or Ride Stats + Splits, or nothing | — | Left, under power, ~16% x 40% | Action-bar toggle | [V] S-HUD; S-SPL |
| Splits | Per split: time, distance, avg power, avg HR, zone bar | s, mi, W, bpm | Side display | After New Split | [V] S-SPL. `zwift-hud-splits-v1.115-support.png` |
| Ride Stats | Best 5 s, 1 min, 5 min, 20 min, 60 min, plus 2 slots | W | Side display | Off by default each ride | [V] F-193; ZI-193 |
| Minimap | Map, grade % top right, route name, distance / time / laps left; profile strip (lead-in blue, done green, segment marks) | %, mi | Top right, ~24% x 24% | Always | [V] S-HUD |
| Zwifters Nearby | Riders by gap, W/kg, distance, icons; "+N more" | s, W/kg | Right column, ~16% x 70% | Always | [V] S-HUD. **Out of scope** |
| Action bar | Discard PowerUp, camera, U-turn, message, screenshot, video, teleport, Coffee Stop, Watt Lock ±, graphs, HUD, emotes, New Split, side display. The selected icon's label shows under it | — | Bottom centre, ~42% x 12% | Up arrow, swipe or Companion | [V] S-HUD |
| W/kg and rpm graph | Rolling bar history | — | Full-width strip at the bottom | Graph toggle (G) | [V] S-HUD |

### 3.3 Route and event additions

| Element | Shows | Appears | Source |
|---|---|---|---|
| Route progress | Route name, progress bar, finish flag, distance left | On a route | [V] S-HUD |
| Segment approach | Leaderboard, name, average grade, length; glowing line on the road | Near a segment start | [V] S-SEG. Leaderboards **out of scope** |
| In-segment timer | Time vs the rider ahead, distance left, PR | Inside a segment | [V] S-SEG (v1.74 image) |
| Power segment | Time left, avg power, 90-day and 1-year PR | Since v1.101 | [V] S-SEG |
| Climb Portal | 10 sections with time, avg HR, avg power, PR each; % done | In a portal | [V] wiki only (FANDOM-CP, 29 Jul 2026); not confirmed on support |
| Race list | Placing, gaps (from distance at an assumed 30 km/h), W/kg, category | Events | [V] ZI-RACE (pre-2024); ZI-GAPS (pre-2024). **Out of scope** |
| Laps left | In the minimap profile | Lap events | [V] F-180 |
| No-HUD events | Organiser can force the HUD off | Some events | [V] ZI-NOHUD (pre-2024) |

### 3.4 Structured workout (v1.113 layout, `zwift-hud-workout-v1.113-support.png`)

| Element | Shows | Position, size [I] | Source |
|---|---|---|---|
| Workout panel (replaces the power panel) | Name, "Finish in 13:56" with a bar, block list ("3 x 30sec @ 170w / 30sec @ 130w") coloured by zone, current block highlighted with "1 of 3", stars on finished blocks, "− 100% +" and "★ 1/12" at the foot | Top left, ~16% x 55% | [V] S-WO |
| Centre workout box | Target tile "HOLD 160w FOR 40 sec" filled in zone colour, time left in the block with a bar, big live power, 4 configurable fields | Top centre, ~35% x 18% | [V] S-WO; F-HUDW; bigger target F-1117 |
| Text cue | Coach line, e.g. "Push, Push, Push." | Screen centre | [V] S-WO |
| Cadence cue (older layout) | Target tile includes rpm; "^ SPIN FASTER!" and red rpm when off | In the target tile | [V] S-INT (v1.77 image) |
| Ride Stats | Best efforts, avg W/kg, Stress Points | Left, under the list | [V] S-WO (since v1.113) |
| Auto splits | One split per block | Side display | [V] S-SPL |
| Action bar | Pause, skip, intensity ±, ERG, Harder / Easier with ERG off | Bottom centre | [V] S-WO |
| Removed | No PowerUps, no "Close the Gap"; gear only in free-ride blocks | — | [V] S-WM; S-VSHIFT |

### 3.5 FTP test

- Same layout as a workout. FTP may read 100 at the start of a ramp test. [V] S-FTP
- Ramp test: +20 W a minute (Lite +10 W). FTP = 75% of the best 1-minute power. "New FTP set!" popup. [V] ZI-FTP (28 Jan 2025)
- The ramp test shows the last-minute average live. [V] F-612505 (Sep 2023, pre-2024)
- "I'm toast" appears when you stop pedalling. [V] ZI-RAMP (pre-2024), not reconfirmed in the current UI.
- **Weem Watts already matches this:** +20 W a minute, "Best minute" Stat, End test, and Set FTP.

### 3.6 Layout sketch (free ride and workout)

```
FREE RIDE                                                     WORKOUT (v1.113)
+-----------+ (o)  +---- spd  dist  elev  time ----+ +------+   +-----------+  +- spd dist elev time -+ +------+
| 160 W  ⚡  |PwrUp |  lvl/XP bar        Drops     | | map  |   | Name      |  | HOLD   35 sec ===   | | map  |
| ==zones== |      +-------- [next 800 m climb] ---+ |grade |   | Finish in |  | 160w   163 W   f1 f2| |prof. |
| rpm  bpm  |                                      | +------+   | block list|  | 40sec         f3 f4 | +------+
| avg  kJ   |                                      | nearby     | ★ current |  +----------------------+ nearby
| GEAR 8    |                                      | riders     | - 100% +  |                           riders
+-----------+                                      | list       +-----------+   "Push, Push, Push."    list
| SPLITS /  |                                      |            | Ride Stats|
| RIDE STATS|                                      |            +-----------+
+-----------+      [ action bar icons, label ]     |                       [ action bar ]
||||||||||||||||| w/kg + rpm graph ||||||||||||||||||           ||||||||||||| graph |||||||||||||
```

---

## 4. Toggles and controls

| Control | What it does | How to toggle | Default | Weem Watts today | Source |
|---|---|---|---|---|---|
| Hide HUD | All HUD on or off. No "minimal HUD" mode is documented | **H**, or the action-bar icon | Shown [I] | No | [V] S-KB; S-HUD |
| Data graph | W/kg and rpm history strip | **G** or action bar | Not stated | No | [V] S-KB |
| Side display | Leaderboards, Ride Stats + Splits, or nothing | Action bar or Companion | Ride Stats off each ride | No | [V] S-HUD; ZI-193 |
| Camera views | 9 views plus drone | **1–9**, **0** drone | View 1 [I] | Skip (no 3D) | [V] S-KB; ZI-KB (4 Aug 2025) |
| Action bar | Opens the icon strip | **Up arrow**, swipe, click near the bottom | Hidden | Control row is always shown | [V] S-HUD |
| Menu / End ride | Menu, End Ride → Ride Report | **Esc** | — | End Ride → Confirm end | [V] S-KB |
| Units | Metric or imperial | Settings → Preferences → Measurements | Not confirmed | Fixed imperial (rule) | [V] S-SET. A **U** key appears only in pre-2024 lists [I] |
| Power smoothing | 3 s average or instant | Settings → Hardware → Power Display | 3 s [I], from a 2019 forum post (pre-2024) | **Better:** 1 / 3 / 10 s on screen, 3 s default | [V] S-SET |
| Watts vs W/kg | Fill the HUD slots with W/kg or avg W/kg | Settings → HUD → slots. No one-key toggle | Not stated | Skip (needs kg) | [V] S-SET; F-HUDW |
| Workout HUD fields | 4 of 16 metrics, set apart from the free-ride HUD | Settings → HUD → Workouts | Not stated | Fixed | [V] F-HUDW; ZI-1114 |
| ERG on/off | Trainer holds the target | Action-bar ERG icon; "Use Erg Mode" on the workout screen | On with a smart trainer | **E** key and Resistance / ERG / Grade switch | [V] S-WM; S-ERG; ZI-ERG (30 Sep 2025). Sources conflict on whether Companion can toggle it |
| Harder / Easier | Resistance with ERG off | Action bar; Companion incline | — | Resistance steps ±1/5/10 | [V] S-WM |
| Trainer difficulty | Share of road grade you feel (not in workouts) | Settings → Hardware (with a controllable trainer) | **50%** | **Has:** hill feel 0–100%, default 50% | [V] S-SET; ZI-TD (pre-2024); F-650233 (8 Mar 2025) |
| Workout intensity | Scales all targets ±25%, this workout only | **Page Up / Page Down**, "− 100% +" on HUD, action bar, Companion, controller | 100% | **Has:** 50–150% in 1 / 5 / 10 steps | [V] S-KB; S-INT; F-668257 (1 May 2026). Step size varies by input |
| Skip block | Next interval | **Tab** (in a workout), action bar, Companion swipe, Play Y | — | **Has:** Skip interval button (no key) | [V] S-KB; S-WM |
| Pause workout | Holds the workout clock | Action bar or Companion. No key | — | Partial: auto-pause when you stop | [V] S-WM |
| New split | Starts a split (time, distance, avg HR, avg power) | **Tab** (outside workouts), action bar, Companion, Zwift Ride | — | No (laps only from intervals) | [V] S-SPL |
| Screenshot / video | Photo; last 15 s of video | **F10** / **F9** | — | Skip (OS screenshot) | [V] S-SS |
| Music and volume | Title music, game sound, world volume | Settings → Audio & Video | Not stated | No sound at all | [V] S-SET |
| Watt Lock (Oct 2026) | Fixed watts outside workouts, ±1 W, ≥50 W, off below 25 rpm | Action bar, **+ / −**, controller, Companion | Off | **Has since v3.1:** ERG in a free ride, ±1/5/10 W, release under 50 rpm | [V] S-WL; F-WL (Oct 2026) |
| U-turn, turns | Turn round; pick a road | **Down**, **Left / Right** | — | Skip | [V] S-KB |
| PowerUp, emotes, chat | Game and social | **Space**, **F1–F8**, **M** | — | Skip (out of scope) | [V] S-KB |
| Drafting | Always on; blue bar since v1.104 | None | On | Skip | [V] S-FAQ; F-DRAFT |
| Virtual shifting | Gears via Click / Play / Ride; style and range | Settings → Hardware | — | Skip (real cassette) | [V] S-SHIFT |
| Other settings | Workout pain effect, screen shake, battery saver, rider highlight, HoloReplay, group chat | Settings | — | Skip | [V] S-SET |
| Other keys | **A** pairing, **T** garage, **E** workouts, **P** promo | Keyboard | — | — | [V] S-KB |
| Show FPS | — | Not found in official docs | — | — | Not confirmed |

Saved: `zwift-settings-categories.png`, `zwift-icon-*.png` (action-bar icons), `zwift-keyboard-shortcuts-zwiftinsider-2025.pdf`.

---

## 5. Workout player and ride summary

### 5.1 Workout player

- **Targets:** a zone-coloured tile, "HOLD 160w FOR 40 sec", next to the big live power. The time left in the block counts down above it with a bar. [V] S-WO (v1.113 image). The tile was made larger in v1.117 (7 Jul 2026). [V]
- **Block list:** zone-coloured rows. The current one is highlighted ("1 of 3"), finished ones get a star, and "★ 1/12" runs at the foot. [V] S-WO
- **On target:**
  - Live power reads black within about ±5% of target and red outside it. Cadence turns red the same way. [V] YT-SDS 17:46–17:56 and 20:16–20:24 (29 Jan 2022, pre-2024)
  - Older layout: "^ SPIN FASTER!". [V] S-INT (v1.77)
- **Stars:**
  - Support says a block earns a star "when power and cadence requirements are met". [V] S-WO
  - Zwift Insider says full, half or no star, the half star kicks in at about 12% off, and cadence doesn't count. [V] ZI-XP (pre-2024). The two sources conflict.
  - Recovery blocks under 60% always earn a full star. [V] ZNEWS-STARS (1 Apr 2022, pre-2024)
- **Text cues:**
  - Shown in the centre of the screen, e.g. "Push, Push, Push." [V] S-WO
  - They come from `<textevent timeoffset= message=>` in the ZWO file. [V] F-509360 (Oct 2020, pre-2024)
- **Interval changes:**
  - Coloured arches mark the change. [V] 360VELO (pre-2024)
  - Riders report a bell or "ding" at each arch. [V] user reports only: F-13821 (Mar 2023), F-629931 (May 2024)
  - Companion had 3-2-1 beeps behind an "In Game Sound Effects" switch. [V] F-17073 (2018, pre-2024)
  - I could not confirm a visual flash or any official sound documentation.
- **ERG in free-ride blocks:**
  - ERG turns off, you get flat-road resistance and shift yourself, and ERG comes back after the block. [V] S-ERG; S-FAQ
  - **Weem Watts differs:** `zwo.ts` turns FreeRide into a steady ERG block at a fixed %. [V] repo
- **Low cadence:**
  - Zwift drops to "bailout" resistance when you stop or fail an interval. It re-engages after 5–10 s at target or at the next block. [V] S-ERGT; F-ERG26
  - Weem Watts releases below 50 rpm and eases back in over 6 s.
- **Intensity:** ±25%, this workout only. Staff say "usually 75–125%". Targets round to 5 W. [V] S-INT; F-668257 (1 May 2026)
- **End of workout:**
  - A banner: "Finished Workout: The Endurance Groove, 21 of 21 stars". [V] F-651708 (22 Apr 2025)
  - Then you're in free ride until you end the ride. [V] F-504385 (Sep 2022 and Nov 2025)
  - No XP for skipped blocks. [V] S-PLANFAQ

### 5.2 Ride summary and end-ride flow

- **What's shown:** see screens 8 to 10 in section 2.
  - Ride Report: average power, distance, time, kcal, XP; route map; power, cadence and HR timeline; power curve; highlights with new bests.
  - Progress Report: 1-year bests at 5 s / 1 / 5 / 20 min, training status, streaks.
  - Screenshots: `zwift-ride-report-general-v1.101.png`, `…-timeline-…`, `…-critical-power-…`, `zwift-progress-report-v1.104.png`.
- **Naming:** default title "Zwift – <Route> in <World>". You can edit it on the save screen, or later in Companion or on zwift.com. [V] S-SAVE; S-ACT
- **Strava and FIT:**
  - Auto-sync once connected on zwift.com. No back-sync. [V] STRAVA-ZW (21 Sep 2026)
  - FIT kept locally and downloadable from zwift.com. [V] S-FIT
  - Splits go into the FIT as laps. [V] F-190
- **What riders complain about:**
  - **Discard with no undo.** One rider deleted a race while removing screenshots on the same screen and asked for a 2-hour trash bin. [V] F-DISCARD (9 Sep 2026)
  - **Saved but broken.** No FIT download, never reached Strava; linked to the Feb 2026 folder move. [V] F-667078 (25 Mar 2026)
  - **Corrupted ride after a Climb Portal ride.** [V] F-671840 (10 and 15 Oct 2026)
  - **Network drop leaves a partial ride.** [V] F-661847 (24 Dec 2025)
  - **Save spinner for an hour, ride lost.** [V] F-455228 (post of 22 Mar 2024)
  - **Average power includes Coffee Stop zeros.** [V] F-673353 (8 Nov 2026)
  - **Strava title mix-ups.** [V] F-521154 (2020), F-605794 (2023), all pre-2024
  - **Most-voted request ever:** "Allow Saves Without Exit", 1,358 votes. [V] see `docs/zwift-complaints-research.md`

**Weem Watts today:**
- Saving is never a problem: 1 s autosave, crash recovery, and a local FIT downloaded at End Ride.
- But there's no summary. After End Ride you only see distance and time.
- Ride names are the FIT file name. Strava upload is manual.

---

## 6. Best features and top requests

### 6.1 What riders and reviewers praise most

| # | Feature | Why | Source |
|---|---|---|---|
| 1 | **Dynamic climb display** (next ~800 m, by grade) | "The most obvious addition… Nice!" (Zwift Insider). Reddit: "Finally we get an elevation map fit for purpose" (24), "finally I could see how long and steep the next hill is" (25) | [V] ZI-173 (3 Sep 2024); RD-1f168cj (25 Aug 2024); RD-1f9qlqm (5 Sep 2024) |
| 2 | **Configurable data slots** | "Overall a great update"; "odd that it took this long to make the screen mimic a bike computer" (14) | [V] RD-1f9qlqm (5 Sep 2024); ZI-1114 (26 May 2026) |
| 3 | **Zone colouring and time-in-zone bar** | Shows a ride's character at a glance: "a lot of grey and blue" on recovery, "yellows, oranges, and reds" in races | [V] ZI-173 (3 Sep 2024); ZI-190 (20 May 2025) |
| 4 | **Splits** | "Much-requested… working well, as far as we can see." Laps in the FIT | [V] ZI-190 (20 May 2025) |
| 5 | **Minimap route overview** | "Clearly shows your full route, your progress… how far you have left." It replaced a profile Reddit called "the worst" (178 points, pre-2024) | [V] ZI-178 (12 Nov 2024); F-638400 (Nov 2024); RD-10kxi2y (2023) |
| 6 | **Workout list, target, countdown, text cues** | Colour-coded blocks, stars, time left, "pick it up / ease off" messages | [V] ROADCC (19 Mar 2020, pre-2024); S-WO. No 2024+ reviewer praise found for text cues |
| 7 | **Customisable workout HUD + interval averages** | "As requested by Zwifters" | [V] ZI-1113 (12 May 2026); F-HUDW |
| 8 | **Ride Stats best efforts** | Covered positively, but Zwift Insider asked Zwift to remember the toggle (it resets each ride) | [V] ZI-193 (15 Jul 2025). No strong rider praise found |

- **Counterpoint:** readability. The v1.73 tile is "harder to read" on its see-through background, and one forum thread is titled "New HUD in game is awful" (numbers too small, low contrast). [V] RD-1f9qlqm; F-634939 (18 Sep 2024). Weem Watts's big, high-contrast numbers are already a strength here.
- **Not found:** praise for the Ride Report, and any 2024+ DC Rainmaker or GPLama write-up of the HUD. GPLama has videos (YouTube Udr31DVR4kA, 3 Sep 2024) that I did not watch.

### 6.2 Top requests about the ride view (forum votes as of 20 Nov 2026)

| Request | Votes | Created | Last activity | Status | URL |
|---|---|---|---|---|---|
| Make the course gradient graph much more visible | 678 | 2018-10-03 | 2025-03-17 | **Shipped** (v1.80 route overview; staff, 17 Mar 2025) | forums.zwift.com/t/13507 |
| HUD customisation (choose and move elements) | 578 | 2018-11-22 | 2026-11-11 | Partly shipped (slots in v1.73 and v1.113). Can't move or remove elements. No staff reply in 181 posts | forums.zwift.com/t/14554 |
| Lap button (like Garmin) | 176 | 2019-01-05 | 2026-08-10 | Shipped as Splits, v1.90 [I] | forums.zwift.com/t/19346 |
| Gradient in the Companion app | 169 | 2021-05-21 | 2026-11-15 | No response | forums.zwift.com/t/549888 |
| Large course profile | 145 | 2018-10-01 | 2023-06-24 | Likely covered by v1.80 [I] | forums.zwift.com/t/13455 |
| Drafting indicator | 108 | 2019-03-09 | 2025-08-04 | Shipped in v1.104 [I] (thread not updated) | forums.zwift.com/t/45012 |
| L/R balance | 101 | 2019-02-04 | 2024-12-29 | HUD field in v1.93 | forums.zwift.com/t/38774 |
| More prominent segment start marker | 98 | 2019-01-08 | 2026-11-04 | No response | forums.zwift.com/t/19833 |
| Route progress bar | 76 | 2020-05-04 | 2021-07-27 | Covered by the route overview [I] | forums.zwift.com/t/433189 |
| **Audio cues** for sprints, KOMs and nearby riders | **69** | **2026-09-24** | 2026-09-26 | No response. Fastest-growing request | forums.zwift.com/t/671315 |
| Exact watt goals (no 5 W rounding) | 61 | 2022-01-12 | 2026-08-16 | Staff said "will be implemented" (18 Aug 2023); still open | forums.zwift.com/t/571155 |
| Gradient indicator | 50 | 2018-11-01 | 2020-11-01 | No reply | forums.zwift.com/t/14138 |
| Accessibility for blind cyclists | 44 | 2020-11-09 | 2025-11-01 | Mod: "Zero progress" | forums.zwift.com/t/514123 |
| Colour wattage by zone | 37 | 2019-01-31 | 2019-04-02 | Partly met by the zone bar [I] | forums.zwift.com/t/34617 |
| Hide all stats / maps | 31 | 2018-10-03 | 2021-03-26 | Shipped (H key) | forums.zwift.com/t/13530 |
| Audio coaching | 24 | 2018-10-17 | 2024-10-27 | No reply | forums.zwift.com/t/13821 |
| TSS counter / % FTP | 22 / 21 | 2019 / 2018 | 2020 / 2021 | Stress Points shipped; no %FTP field [I] | forums.zwift.com/t/28992, /t/14123 |
| Distance left on a climb or sprint | 20 | 2018-10-03 | 2018-10-03 | Not shipped. Climb mode shows route distance, not distance to the top (F-634265, Sep 2024) | forums.zwift.com/t/13506 |
| Bigger in-ride text | 19 | 2019-06-02 | 2021-03-27 | Not shipped [I] | forums.zwift.com/t/75605 |
| Average power per workout interval | 13 | 2020-12-28 | 2026-05-27 | Shipped v1.114 | forums.zwift.com/t/523650 |
| HR zone colour | 13 | 2019-12-05 | 2021-03-05 | Not shipped [I] | forums.zwift.com/t/168523 |

**Reddit** (scores as shown on 20 Nov 2026):
- "If Zwift could add or improve one feature in 2026…": 130 points, 463 comments, 7 Feb 2026. **Top comment (371): "Show the distance before sprinter/climbs segments."** Next (71): always show a zoomed gradient profile. [V] RD-1qyl6wt
- "HUD refresh coming on September 4th": 89 points, 25 Aug 2024. Praise for the elevation map and average power. [V] RD-1f168cj
- "How do you like the 1.73 HUD update?": 43 points, 5 Sep 2024. Asks for bigger, scalable numbers (12) and a settable climb-mode trigger (9). [V] RD-1f9qlqm
- "Liking the new HUD. Except…": 59 points, 11 Sep 2024. Confusing icons; riders asked what the zone bar means. [V] RD-1fdzfxx
- "I'm surprised at how poor the single-player experience is": 48 points, 8 May 2022 (pre-2024). Solo riders want ghosts and personal-best pacing. [V] RD-ul7ipz

**What this means for Weem Watts** [I]:
- Riders most want to **see what's coming**: next climb, distance to it, a zoomed profile.
- They want to **pick their numbers**, see them **big and readable**, and get **audio** for changes.
- All of these work without 3D or social features.

---

## 7. Weem Watts fit

### 7.1 Inventory

Verdict: **adopt** (copy the idea), **adapt** (change it to fit DESIGN.md), **skip**.

| Zwift element | What it does | Weem Watts today | Verdict and reason | Component |
|---|---|---|---|---|
| Big live power | The hero number | **Has** | Keep | `MetricTile` hero |
| Power smoothing | 3 s or instant, in settings | **Has** (1/3/10 s on screen) | Keep; ours is better | `SegmentedControl` |
| Zone-coloured power / bolt | Zone at a glance | Missing | **Adapt:** a mono zone code ("Z3") on a chip in the zone token. The number stays Cobalt | `MetricTile` action, new `ZoneChip` |
| Time-in-zone bar | Ride character | Missing | **Adapt:** a thin bar in the summary; optional 8 px bar under the hero number (free ride only) | New `ZoneBar` |
| 4 configurable slots | Pick your stats | Partial (fixed 2x2) | **Adapt later:** pick the 4 small tiles on Profile (large option). Not mid-ride | `MetricTile`, Profile row |
| Average power, kJ | Running totals | Missing | **Adopt:** free-ride Ride stats row and summary | `Stat` |
| Weighted power | NP-like effort | Missing | **Adapt:** summary only, named "Weighted power" (NP is a TrainingPeaks trademark [I]) | `Stat` |
| Heart rate | bpm, avg | Missing (cut in v1) | **Skip for now**; open question 3 | — |
| CORE, HSI, L/R | Extra sensors | Missing | Skip: no sensors | — |
| Gear | Virtual gear | n/a | Skip: real cassette | — |
| PowerUps, XP, level, Drops | Game rewards | — | Skip | — |
| Speed, distance, elevation, time | Top-centre stats | **Has** | Keep | `MetricTile`, `ElevationProfile` |
| Route progress, distance to finish | Where you are | **Has** (To go, Cobalt ridden stretch and dot) | Keep | `ElevationProfile` |
| Dynamic climb display | Next 800 m zoomed | Missing | **Adapt:** "Next climb" Stat now; look-ahead zoom in the large option | `Stat`; new `ClimbAhead` |
| Grade % | Current grade | **Has** | Keep | `Stat` |
| Minimap | Map and route | — | Skip: 2D map cut in scope | — |
| Draft, nearby riders, race list, chat, emotes, leaderboards | Social | — | Skip: out of scope | — |
| Segment timers, Climb Portal sections | Timed sections | Missing | Skip now; v3.3 sections and ghost cover it | — |
| Splits + New Split | Manual laps | Partial (laps only from intervals) | **Adopt:** **L** key, lap Stat, lap table in the summary. Not Tab: Tab moves browser focus | `Stat`; new `LapTable` |
| Ride Stats best efforts | 5 s / 1 / 5 / 20 min | Missing | **Adopt:** free-ride row and summary | New `BestEfforts` |
| W/kg + rpm graph | Rolling history | Missing | **Adapt (large option):** power trace in the free-ride row, zone-coloured bars | New `PowerTrace` |
| Action bar | Icon controls | Partial (control row + keys) | Keep the control row. Icon bars hide labels | `Stepper` |
| Hide HUD (H) | Clean screen | Missing | Skip until Movie Mode | — |
| Camera, U-turn, screenshot | 3D and capture | — | Skip | — |
| Watt Lock | Fixed watts in a free ride | **Has** (ERG since v3.1) | Keep. Zwift only got this in Oct 2026 | `Stepper` |
| Trainer difficulty | Grade feel | **Has** (hill feel 50%) | Keep | `Stepper` |
| Workout block list + stars | All intervals, progress | Partial (`WorkoutStrip`) | **Adapt:** keep the strip; no list (no room). Stars become "on target %" per interval in the summary | `WorkoutStrip`, `LapTable` |
| "Finish in" + bar | Time left | **Has** (Workout left, strip line) | Keep | `Stat` |
| Target box + countdown | What to do now | Partial (Target, Left Stats) | **Adapt:** power target cue in the Power tile label row, like the cadence cue | `MetricTile` action |
| Interval averages | Avg W this interval | Missing | **Adopt:** "Avg" Stat in the full workout row (not compact) | `Stat` |
| Text cues | Coach lines | Missing (ZWO text events ignored) | **Adapt:** one line in the control-row status | `Stepper` status |
| Next-interval countdown | Get ready | Missing | **Adapt:** "Next 198 W in 0:08" in the control-row status, last 10 s | `Stepper` status |
| Intensity − 100% + | Scale targets | **Has** (50–150%) | Keep | `Stepper` |
| Skip block | Next interval | **Has** (button) | Keep; maybe a key (N) | `WorkoutRow` |
| Pause workout | Hold the clock | Partial (auto-pause) | Keep auto-pause | `StatusPill` |
| ERG off in free-ride blocks | Shift yourself | Different (steady ERG at a fixed %) | **Adapt (optional):** switch to Resistance for FreeRide blocks | ride logic |
| Bailout / ERG release | Low-cadence safety | **Has** | Keep | — |
| Cadence target + SPIN FASTER | Cadence cue | **Has** (on / under / over in words) | Keep | `MetricTile` action |
| Workout complete banner | End of workout | **Has** ("Workout complete") | Keep | `WorkoutRow` |
| Ride Report | Totals, chart, power curve | **Missing** | **Adopt** | New `RideSummary`, `PowerChart`, `BestEfforts`, `LapTable`, `ZoneBar` |
| Save screen (title, privacy, discard) | Name and keep | Partial (FIT auto-download) | Skip the title and privacy (no accounts). Keep Download FIT | top bar |
| Progress Report (XP, streaks, 1-year bests) | Long-term progress | Missing | Skip the game parts. "New best" marks need a past-rides list first | later |
| Interval sounds | Audio cue | Missing | **Adapt:** optional, off by default | Profile row |
| Auto-pause | Stop the clock | **Has** (Zwift doesn't) | Keep | — |

### 7.2 Layout at 1280x720

These are measured from today's screenshots (20 Nov 2026, `?fake=1`). The panel runs from y 90 to 670 (580 px). The control row is about 80–96 px.

| Ride type | Today | Proposal | Height change |
|---|---|---|---|
| **Free ride** | Tiles take 484 px, mostly white space (`weem-02-ride-free-live.png`) | Add a full-width **Ride stats row** above the control row, one line of `Stat`s: Avg W, kJ, Best 5 s, 1 min, 5 min, 20 min, then Lap n and lap time. The tiles go to dense padding, as on a course | Row ≈ 96 px (stats only) or ≈ 200 px with a `PowerTrace` (large option). The course row already proves ≈ 230 px fits |
| **Course** | Tiles 269 px, course row 231 px (`weem-09-ride-course-only.png`) | Add "Next climb" and "Lap" Stats to the course row's stat line, which has ~650 px free. Large option: the profile splits into the full course (2/3) and a `ClimbAhead` zoom (1/3), same height | 0 px |
| **Workout** | Tiles 297 px, workout row 203 px (`weem-08-ride-workout-only.png`) | Power target cue in the Power label row. "Avg" (this interval) Stat in the workout row, which has ~270 px free before Skip interval. Next-change line and text events in the control-row status | 0 px |
| **Course + workout** | Full: tiles 236, course 136, workout 128 (`weem-07-ride-course-plus-workout.png`) | Zero-height changes only: power target cue, control-row status line, "Next climb" inline in the compact course row (~390 px free). No Ride stats row, no Avg Stat | 0 px |
| **Ended (all types)** | Dashes | **RideSummary** replaces the live panel: a stat line, then `PowerChart` (≈160 px), then `BestEfforts` + `ZoneBar`, then `LapTable`. The page may scroll here, since you're not riding. Top bar keeps Download FIT (primary) and New ride | n/a |

```
FREE RIDE (proposed)                                   ENDED: RIDE SUMMARY (proposed)
+----------------------+-----------+-----------+       +------------------------------------------------------+
| POWER  target… [1s3s]|  CADENCE  |  SPEED    |       | SUMMARY  Test Hills · Sweet Spot 3x12                |
|                      |  92 rpm   | 19.8 mph  |       | TIME 1:09:12  DIST 21.4 mi  AVG 182 W  WEIGHTED 196 W|
|   210 W   Z3         +-----------+-----------+       | kJ 756  CADENCE 90  CLIMBED 1,210 ft                 |
|                      |  DISTANCE |  TIME     |       +------------------------------------------------------+
|                      |  4.12 mi  |  12:40    |       | ▂▃▅█▅▃▂▃▅█▅▃▂  power by minute, zone colours       |
+----------------------+-----------+-----------+       | (course: elevation in `raised` behind)               |
| AVG 182 W  kJ 140  5S 412  1M 268  5M 221      |       +------------------------------------------------------+
| 20M --   LAP 2  3:41                            |       | BEST 5S 412  1M 268  5M 221  20M 205  | Z1▮Z2▮▮Z3▮▮▮ |
+------------------------------------------------+       +------------------------------------------------------+
| [Resistance|ERG]  -10 -5 -1  20 %  +1 +5 +10   |       | LAP  TIME   MILES  AVG W  RPM  ZONE  ON TARGET       |
|                                 ↑↓ 1% · L lap  |       | 1    10:00  2.9    142    88   Z2    96%             |
+------------------------------------------------+       +------------------------------------------------------+
```

**Rules check:**
- **Cobalt** stays on the live power, the route progress, and one primary button. The summary chart uses zone tokens and `fg-subtle`, never Cobalt.
- **No shadows, gradients or blur.** The zone bar and chart are flat fills with `surface` hairlines.
- **Fonts and spacing:** Archivo for numbers and labels, mono for cues and the lap table. Spacing stays on 4 / 8 / 12 / 16 / 24.
- **Calm:**
  - The next-change line counts down in place.
  - Zone chips change text, not size.
  - Nothing flashes at an interval change. The strip's Cobalt line just crosses the boundary.
  - Sound is optional.
- **Key hint:** "L lap" makes the hint longer. Keep the status text short (≤ 24 characters) so the hint stays on one line.

### 7.3 What "feel" means without 3D or social

**Fits a calm, numbers-first app:**
- Countdown to the next interval as text in a fixed slot.
- Target on / under / over with the word, on the power tile like the cadence cue.
- Progress you can see: the strip's position line, the profile's ridden stretch, "To go", "Next climb in 0.8 mi" counting down.
- Best efforts that improve in place during the ride.
- A lap timer that resets when you press L.
- ZWO text events as one quiet line. They make built-in workouts feel coached.
- A ride summary with a zone-coloured chart, so the ride feels finished and counted.
- Zone codes (Z1 to Z7) on power and laps.
- Optional soft beeps before changes.

**Doesn't fit:**
- Centre-screen overlay text.
- A power number that changes colour.
- Stars that pop, XP bars, Drops counters, badges, confetti.
- An OK button that auto-advances on a countdown.
- Arches and flashes at interval changes.
- Rider lists and the draft bar.

### 7.4 New components to add to DESIGN.md

| Component | Use | Rules |
|---|---|---|
| `RideSummary` | The Ride tab after End Ride, replacing the live panel | One panel, rows split by hairlines. Stat line (`Stat inline`), `PowerChart`, `BestEfforts` + `ZoneBar`, `LapTable`. No Cobalt inside. May scroll |
| `PowerChart` | Power over the ride | Bars per 10 s or minute, filled with zone tokens, `surface` hairlines. On a course, elevation in a `raised` fill behind. Mile or time ticks in mono `fg-muted`. Pause gaps left blank |
| `BestEfforts` | Best 5 s / 1 min / 5 min / 20 min | `Stat` group. "--" until the duration has been ridden. Live in the free-ride Ride stats row; final in the summary |
| `LapTable` | One row per lap or interval | Mono columns: lap, time, miles, avg W, avg rpm, zone code, on-target % (workouts). Hairline rows like `PickerRow`, no radio |
| `ZoneBar` | Time in zone | 8 px flat bar, segments in `z1`–`z7` with codes under them in the summary. Never alone: always with codes or a table |
| `ZoneChip` | Current zone beside live power | Mono "Z3" on a `raised` chip with a 4 px zone-token square. Text only changes. Hero number stays Cobalt |
| Ride stats row | Free-ride only row | One line of `Stat`, then (large option) a `PowerTrace`. Same padding as the course row |
| Status line rules | Control-row status | Priority: errors > paused > released > text event > "Next 198 W in 0:08" (last 10 s) > default. ≤ 24 characters |
| `ClimbAhead` (large) | Zoomed next-climb profile | Same drawing as `ElevationProfile` over the next 0.5 mi; grade labels in mono; no Cobalt except the position dot |
| Sound setting | Profile row | "Interval sounds" with Off / On `SegmentedControl`, default Off. Web Audio, no files |

---

## 8. Three build options

| | **Small** | **Medium** | **Large** |
|---|---|---|---|
| **What the rider gets** | Power target cue; next-change line; ZWO text events; **L** lap key with lap Stat; a basic **ride summary**: stat line, best efforts, lap table | Small, plus: summary `PowerChart` and `ZoneBar`; free-ride **Ride stats row** with live best efforts and avg W / kJ; interval Avg Stat; **Next climb** Stat; optional sounds | Medium, plus: `ClimbAhead` look-ahead; `PowerTrace` on a free ride; choose the 4 small tiles on Profile; past-rides list that reopens any summary and its FIT; "new best" marks; FreeRide blocks switch to Resistance |
| **Rough effort** | 1–2 sessions | 3–4 sessions | 6–8 sessions |
| **Defers** | Charts, climbs, sound, free-ride row | Look-ahead zoom, tile picker, ride history | Heart rate, Movie Mode, HUD hide |
| **Risks** | Summary maths (pauses, dropouts) must match the FIT. Text-event timing on repeats | Climb detection on noisy GPX (needs the 75 m smoothing). Sound must never fire when muted or paused. Free-ride row must keep the key hint on one line | The tile picker adds settings, which v1 cut. Ride history needs storage limits and delete. Scope creep ahead of the v3.2 ride test |

**My pick:** Small, then Medium after the v3.2 ride test. Small touches only display code and data already recorded, so it doesn't add ride-test risk.

---

## 9. Open questions only you can answer

1. **Your two reference screenshots didn't attach.** Do you want me to check this against them?
2. **Phase:** CLAUDE.md says no new work before the v3.2 ride test. Is this an exception like Grade mode and the builder, or does it wait?
3. **Heart rate:** do you ride with a strap? Zwift's HUD leans on HR (splits, averages). If you do, HR becomes a tile and a summary column.
4. **Sound:** any audio at all, even off by default?
5. **Summary placement:** replace the live panel on the Ride tab (my default), or a new page such as `#/summary`?
6. **Laps in a workout:** should L also split inside an interval, or only work with no workout running?
7. **Zone chip next to live power:** OK to use zone colours in the hero tile (a small chip, number still Cobalt)?
8. **FreeRide blocks in ZWO files:** keep a steady ERG target (today), or switch to Resistance like Zwift?

---

## Screenshots

Saved with this research in the session's `artifacts/screenshots/` folder (not in the repo). The original Zwift images are on the source pages listed.

**Weem Watts today** (live app, `?fake=1`, 1280x720, 20 Nov 2026):
- `weem-01-ride-idle.png`
- `weem-02-ride-free-live.png`
- `weem-03-ride-paused.png`
- `weem-04-ride-ended.png`
- `weem-05-workout-step1-course.png`
- `weem-06-workout-step2-workout.png`
- `weem-07-ride-course-plus-workout.png`
- `weem-08-ride-workout-only.png`
- `weem-09-ride-course-only.png`
- `weem-10-profile.png`

**Zwift HUD** (S-HUD, S-WO, S-SPL, S-SEG, F-DRAFT, S-WL):
- `zwift-hud-cycling-overview-v1.93-support.png`
- `zwift-hud-left-display-support.png`
- `zwift-hud-center-display-support.png`
- `zwift-hud-workout-v1.113-support.png`
- `zwift-hud-splits-v1.115-support.png`
- `zwift-hud-segment-start-leaderboard-v1.74-support.png`
- `zwift-hud-segment-timer-v1.74-support.png`
- `zwift-hud-segment-complete-v1.98-support.png`
- `zwift-hud-power-segment-support.png`
- `zwift-hud-draft-indicator-support-0.png`
- `zwift-hud-watt-lock-2026.png`
- `zwift-watt-lock-actionbar.png`

**Workout** (S-INT, F-HUDW, S-ZC, S-HUD):
- `zwift-workout-intensity-hud.png` (v1.77, SPIN FASTER cue)
- `zwift-workout-hud-custom-fields-2026.jpg`
- `zwift-workout-hud-settings-2026.png`
- `zwift-workout-ride-stats-panel-2026.jpg`
- `zwift-companion-workout-controls.png`
- `zwift-icon-*.png` (pause, skip, intensity ±, harder, easier, ERG, new split, HUD, graphs, side display)

**Flow** (S-PAIR, ZI-1122, S-ROUTE, S-WM, S-COFFEE, S-SET, S-RR, S-PROG, ZI-1101, F-DISCARD, F-THEATER):
- `zwift-paired-devices-connected-ok-v1.122.png`
- `zwift-paired-devices-device-options-v1.122.png`
- `zwift-pairing-options-zi-2026-09.png`
- `zwift-pairing-screen-top-zi-2026-09.png`
- `zwift-home-screen-zi-2026-09.jpg`
- `zwift-home-screen-routes-v1.122.png`
- `zwift-home-theater-card-forum-2026-09.jpg`
- `zwift-home-workout-anytime-v1.122.png`
- `zwift-home-my-settings-v1.122.png`
- `zwift-routes-start-ride.png`
- `zwift-workouts-collections-v1.122.png`
- `zwift-workout-start-ride-v1.102.png`
- `zwift-workout-select-route-v1.102.png`
- `zwift-coffee-stop-start-v1.124.png`
- `zwift-in-ride-menu-v1.74.png`
- `zwift-ride-report-general-v1.101.png`
- `zwift-ride-report-timeline-v1.101.png`
- `zwift-ride-report-critical-power-v1.101.png`
- `zwift-ride-report-zi-2025-11.jpg`
- `zwift-progress-report-v1.104.png`
- `zwift-progress-report-zi-2025-12.jpg`
- `zwift-discard-warning-forum-2026-09.png`

**Settings:**
- `zwift-settings-categories.png`
- `zwift-keyboard-shortcuts-zwiftinsider-2025.pdf`

No YouTube timestamps were gathered except YT-SDS.

## Sources

**Zwift support** (support.zwift.com; undated pages, read 20 Nov 2026):
- **S-HUD:** /en_us/using-the-heads-up-display-when-cycling-rJepA4beS
- **S-WO:** /en_us/using-the-heads-up-display-when-working-out-HkdGPmSJGl
- **S-SPL:** /splits-HkFgZWrzgl
- **S-SEG:** /en_us/segments-jerseys-and-time-limits-BkGig0kZS7
- **S-KB:** /en_us/keyboard-shortcuts-rkGrgwd4B
- **S-SET:** /in-game-settings-for-cycling-Hy_tSDDnt
- **S-WM:** /en_us/workout-mode-for-cycling-HkhS0S0F
- **S-ERG:** /erg-mode-in-workouts-SkQJC8OEH
- **S-ERGT:** /erg-mode-troubleshooting-SJ4ziYOcr
- **S-FAQ:** /en_us/features-in-zwift-faq-HkA_Qfadr
- **S-INT:** /en_us/adjusting-your-workout-intensity-B1PftWd1g
- **S-SS:** /en_us/taking-screenshots-and-capturing-video-in-zwift-HJylsU_4H
- **S-WL:** /en_us/watt-lock-ry231aIhzg
- **S-SHIFT:** /en_us/shift-style-and-gear-range-rksYezzIC
- **S-VSHIFT:** /en_us/virtual-shifting-faq-r16UiRFlT
- **S-ZC:** /en_us/zwift-companion-app-in-game-controls-rJ7ayD_ES
- **S-RR:** /en_us/your-ride-report-HJ8dAVer
- **S-PROG:** /en_us/your-progress-report-SkJeye5GWe
- **S-SAVE:** /en_us/saving-your-cycling-activity-ry3GI9i2K
- **S-ACT:** /en_us/your-activities-in-zwift-SJbHywdNH
- **S-FIT:** /en_us/locating-your-activity-log-and-workout-files-BykKO63fr
- **S-3P:** /zwift-and-third-party-platforms-SypU0LdVr
- **S-PAIR:** /connecting-your-devices-for-cycling-HJIFDrw5S
- **S-FIRST:** /en_us/launching-zwift-for-the-first-time-SJdaHbd6o
- **S-ROUTE:** /en_us/selecting-a-world-and-route-for-your-ride-HkO4WB8nY
- **S-COFFEE:** /en_us/coffee-stop-rJ9nZrO43
- **S-FTP:** /en_us/ftp-test-HypJnI_NH
- **S-PLANFAQ:** /en_us/training-plan-faq-Sys_LJpGH

**Zwift forum release notes and threads** (forums.zwift.com/t/…):
- **F-173:** game-update-v1-73-september-2024/633662 (3 Sep 2024)
- **F-180:** game-update-v-1-80-december-2024/640742 (17 Dec 2024)
- **F-190:** zwift-game-v1-90-may-2025/652853 (20 May 2025)
- **F-193:** zwift-game-v-1-93-july-2025/654245 (15 Jul 2025)
- **F-1101:** game-update-v-1-101-november-2025/658050 (4 Nov 2025)
- **F-1104:** game-update-v-1-104-december-2025/660561 (16 Dec 2025)
- **F-DRAFT:** introducing-draft-indicator-december-2025/661276 (16 Dec 2025)
- **F-HUDW:** customizable-workout-hud-may-2026/668331 (12 May 2026)
- **F-1115:** game-update-v-1-115-june-2026/668812 (8 Jun 2026)
- **F-1117:** game-update-v-1-117-july-2026/669550 (7 Jul 2026)
- **F-1122:** game-update-v-1-122-september-2026/671090 (22 Sep 2026)
- **F-PAIR26:** device-pairing-updates-in-zwift-september-2026/671102 (22 Sep 2026)
- **F-THEATER:** home-screen-theater-card-and-progress-card-september-2026/671249 (22 Sep 2026)
- **F-1124:** game-update-v-1-124-october-2026/671722 (20 Oct 2026)
- **F-WL:** introducing-watt-lock-hold-your-target-power/671983 (Oct 2026)
- **F-HOME24:** my-list-and-home-screen-updates-april-2024/629572 (29 Apr 2024)
- **F-ERG26:** erg-mode-not-working-since-latest-update/665011 (9 Feb 2026)
- **F-DISCARD:** does-zwift-actually-care-about-people/670927 (9 Sep 2026)
- **Ride and save threads:**
  - 667078 (25 Mar 2026)
  - 671840 (Oct 2026)
  - 661847 (24 Dec 2025)
  - 455228 (2024-03-22 post)
  - 673353 (8 Nov 2026)
  - 521154 (2020)
  - 605794 (2023)
- **Workout and other threads:**
  - 668257 (1 May 2026)
  - 651708 (22 Apr 2025)
  - 504385 (2022 and 2025)
  - 650233 (8 Mar 2025)
  - 509360 (2020)
  - 13821 (2023)
  - 629931 (2024)
  - 17073 (2018)
  - 612505 (2023)
  - 634939 (18 Sep 2024)
  - 634265 (Sep 2024)
  - 638400 (Nov 2024)
- **Feature request vote counts:** see the table in 6.2 (read from the forum's JSON, 20 Nov 2026).

**Reviews and news:**
- **Zwift Insider** (zwiftinsider.com):
  - **ZI-173:** /update-1-73-0-134871 (3 Sep 2024)
  - **ZI-178:** /update-1-78-0-136426 (12 Nov 2024)
  - **ZI-190:** /update-1-90-146371 (20 May 2025)
  - **ZI-193:** /update-1-93-149576 (15 Jul 2025)
  - **ZI-1101:** /update-1-101-154518 (4 Nov 2025)
  - **ZI-1113:** /update-1-113-161309 (12 May 2026)
  - **ZI-1114:** /update-1-114-161738 (26 May 2026)
  - **ZI-1122:** /update-1-122-166297 (22 Sep 2026)
  - **ZI-HUD24:** /hud-refresh-closer-look (6 May 2024)
  - **ZI-DIST:** /hud-distances (29 Aug 2026)
  - **ZI-KB:** /keyboard-shortcuts (4 Aug 2025)
  - **ZI-ERG:** /erg-mode-in-zwift (30 Sep 2025)
  - **ZI-FTP:** /zwift-ftp-tests (28 Jan 2025)
  - **Pre-2024:**
    - ZI-TD (2019)
    - ZI-XP (2019)
    - ZI-RAMP (2019)
    - ZI-RACE (2020)
    - ZI-GAPS (2019)
    - ZI-NOHUD (2021)
- **Other:**
  - **ZNEWS-HUD:** news.zwift.com/en-WW/236781 (30 Apr 2024)
  - **ZNEWS-STARS:** zwift.com/news/14254 (1 Apr 2022, pre-2024)
  - **STRAVA-ZW:** support.strava.com/en-us/articles/15401915-zwift-and-strava (21 Sep 2026)
  - **ROADCC:** road.cc …-269225 (19 Mar 2020, pre-2024)
  - **360VELO:** (10 Jan 2019, pre-2024)
  - **FANDOM-CP:** zwift.fandom.com/wiki/Climb_Portals (29 Jul 2026)
  - **YT-SDS:** youtube.com/watch?v=KWsmb7iIlN4 (29 Jan 2022, pre-2024)

**Reddit** (reddit.com/r/Zwift/comments/…):
- **RD-1qyl6wt** (7 Feb 2026)
- **RD-1f168cj** (25 Aug 2024)
- **RD-1f9qlqm** (5 Sep 2024)
- **RD-1fdzfxx** (11 Sep 2024)
- **RD-10kxi2y** (25 Jan 2023, pre-2024)
- **RD-ul7ipz** (8 May 2022, pre-2024)

**Weem Watts repo** (main, read 20 Nov 2026):
- **Docs:**
  - CLAUDE.md
  - Weem Watts App Scope.md
  - DESIGN.md
  - README.md
  - docs/zwift-complaints-research.md
- **Code:**
  - src/App.tsx
  - src/components/*
  - src/lib/zwo.ts (text events skipped; FreeRide becomes a steady block)
  - src/lib/recorder.ts (every sample kept in IndexedDB)
  - src/lib/ride.ts (End Ride disconnects and downloads the FIT)
