# Dark theme (Nov 24, 2026)

Asked for by Nate on Nov 24, 2026. Most indoor rides happen early or late in a dim room, and a near-white screen is harsh there. Built ahead, like the other exceptions. No trainer, sensor, recording or FIT code changed, so it needs no ride test to be safe. It does need a look in a dim room (see "Needs a real ride").

The rules are in `DESIGN.md`: Color tokens (both tables, "How Dark is built", "How the theme is set"), Power zones, The Strava exception, Logo and icons, Spacing and shape (the shadow), Motion ("A theme switch does not animate"), the Profile page paragraph under Layout, and Banned.

## What was built

- **One setting: Appearance.** Profile tab, Your numbers, the last panel, under Interval sounds. A `SegmentedControl`: Light, Dark, Match my computer.
- **Light is the default.** A rider who never touches it sees the app as it was, pixel for pixel.
- **Open mid-ride,** like Interval sounds: a rider can go dark when the sun goes down. It applies at once and the ride carries on.
- **Per rider** (`ww.appearance`, in `RIDER_KEYS`), and in a backup's settings, as Interval sounds is. A restore brings it only where this browser has no choice saved, and applies it at once.
- **Match my computer** follows the computer's own light or dark setting live, with no reload.
- **Dark values for every color token,** in `tokens.css` only, under `:root[data-theme='dark']`. No component knows about themes.
- **No flash.** A rider who chose Dark never sees a light frame on load.
- **`npm run contrast`** (`scripts/contrast.mjs`): every pair the design rules depend on, in both themes, read from `tokens.css`. It exits 1 when a rule fails.

| What | Where |
| --- | --- |
| The dark tokens, `color-scheme: dark`, `shade` | `src/styles/tokens.css` |
| The setting, applying it, following the computer and other tabs | `src/lib/theme.ts` (new) |
| The theme before the first paint | a small inline script in `index.html` |
| Started before the first render | `src/main.tsx` |
| The Appearance row | `src/components/ProfilePage.tsx` |
| Per rider | `RIDER_KEYS` in `src/lib/rider.ts` |
| In a backup | `SETTING_KEYS` in `src/lib/backup.ts`; `applyTheme()` after a restore in `src/App.tsx` |
| No color eases during a switch | `:root[data-theme-switch]` in `src/styles/index.css` |
| The contrast check | `scripts/contrast.mjs`, `npm run contrast` |
| Comments only | `src/components/Button.tsx`, the Strava rule in `index.css` |

`ride.ts`, `ble.ts`, `ftms.ts`, `heartRate.ts`, `recorder.ts`, `fit.ts` and every chart component are untouched. No new dependency.

## The tokens

| Token | Light | Dark |
| --- | --- | --- |
| `bg` | #F5F2EC | #121110 |
| `surface` | #FFFFFF | #1E1D1A |
| `raised` | #EEEAE3 | #2E2C28 |
| `line` | #E2DDD4 | #3B3935 |
| `line-strong` | #B9B2A6 | #6E6961 |
| `fg` | #1B1A18 | #F0ECE4 |
| `fg-muted` | #5C5850 | #B9B3A8 |
| `fg-subtle` | #6E6960 | #9A958C |
| `accent` | #4B5320 | #A3AC6B (`accent-on-dark`) |
| `accent-hover` | #42491C | #B0B97A |
| `accent-press` | #393F18 | #BCC48A |
| `accent-ink` | #FFFFFF | #121110 |
| `cadence` | #0F7591 | #4FB3CE |
| `state-on` | #1B7A43 | #6ED399 |
| `state-under` | #8A5A00 | #E8B65A |
| `state-over` | #C0282F | #F58282 |
| `z1` | #474C55 | #C4CBD6 |
| `z2` | #44648B | #7C9ABB |
| `z3` | #2E9A58 | #3FA568 |
| `z4` | #B5850E | #C4911F |
| `z5` | #D9661F | #E57A35 |
| `z6` | #CC2F36 | #EE5D62 |
| `z7` | #A8306A | #D65A93 |
| scrim | `fg` at 32% | `shade` (#080706) at 60% |
| shadow layer | `fg` at 7% | `shade` at 28% |

## Contrast

WCAG contrast ratio, from `npm run contrast`. Text needs 4.5:1, live numbers and graphics 3:1. Every rule passes in both themes.

**Text, 4.5:1**

| Pair | Light | Dark |
| --- | --- | --- |
| `fg` on surface / bg / raised | 17.39 / 15.56 / 14.50 | 14.31 / 16.01 / 11.83 |
| `fg-muted` on surface / bg / raised | 7.08 / 6.33 / 5.90 | 8.09 / 9.05 / 6.69 |
| `fg-subtle` on surface / bg / raised | 5.45 / 4.88 / 4.55 | 5.66 / 6.33 / 4.68 |
| `fg` on line (a hovered secondary button) | 12.86 | 9.78 |
| `accent-ink` on accent / hover / press | 8.21 / 9.54 / 11.06 | 7.79 / 9.04 / 10.24 |
| `state-on` on surface / bg | 5.37 / 4.80 | 9.18 / 10.28 |
| `state-under` on surface / bg / raised | 5.93 / 5.30 / 4.94 | 9.05 / 10.12 / 7.48 |
| `state-over` on surface / bg | 5.86 / 5.24 | 6.74 / 7.54 |
| `state-over` on raised (a `danger` button) | 4.88 | 5.57 |
| `state-over` on surface (its hover) | 5.86 | 6.74 |

**Graphics, 3:1**

| Pair | Light | Dark |
| --- | --- | --- |
| `accent` on surface / bg / raised | 8.21 / 7.35 / 6.85 | 6.96 / 7.79 / 5.75 |
| `cadence` on surface | 5.28 | 6.96 |
| `fg-muted` on surface (training bars, the focus ring) | 7.08 | 8.09 |
| `fg-subtle` on surface / raised (profile line) | 5.45 / 4.55 | 5.66 / 4.68 |
| Status dot on raised: on / under / over | 4.48 / 4.94 / 4.88 | 7.59 / 7.48 / 5.57 |
| `fg` on raised (picked card border, cursor line) | 14.50 | 11.83 |

**Zones**

| Zone | On surface, Light | On surface, Dark | On raised, Light | On raised, Dark |
| --- | --- | --- | --- | --- |
| Z1 | 8.63 | 10.32 | 7.20 | 8.53 |
| Z2 | 6.10 | 5.78 | 5.09 | 4.78 |
| Z3 | 3.57 | 5.45 | 2.98 | 4.51 |
| Z4 | 3.32 | 5.95 | 2.77 | 4.92 |
| Z5 | 3.58 | 5.75 | 2.98 | 4.76 |
| Z6 | 5.21 | 5.12 | 4.35 | 4.23 |
| Z7 | 6.37 | 4.61 | 5.31 | 3.81 |

- The rule is 3:1 on `surface`. All pass in both.
- On `raised` three zones are under 3:1 in Light, which is why the trace has its `surface` hairline. In Dark all seven pass there too. The hairline stays.
- **The two-tone outline:** the `surface` hairline against a zone fill is the "on surface" column, so 3.32 or better in Light and 4.61 or better in Dark. The `fg` line on its hairline is 17.39 and 14.31.
- **`fg` alone on a zone** (why the outline needs its hairline): 2.01 on Z1, 2.85 on Z2 and 2.73 on Z7 in Light; in Dark 1.39, 2.48, 2.62, 2.40, 2.49, 2.79, 3.10 for Z1 to Z7.
- **The position line:** `accent` on its `surface` hairline is 8.21 and 6.96. Alone on a zone it is 1.29 to 2.56 in Light and 1.17 to 1.51 in Dark, so the hairlines matter more in Dark.

**The done wash** (`surface` at 60% over a block)

| Zone | Washed, against the panel: Light | Dark | Washed, against the block not done: Light | Dark |
| --- | --- | --- | --- | --- |
| Z1 | 2.01 | 2.79 | 4.30 | 3.71 |
| Z2 | 1.83 | 2.02 | 3.34 | 2.87 |
| Z3 | 1.59 | 1.93 | 2.24 | 2.83 |
| Z4 | 1.55 | 2.02 | 2.14 | 2.94 |
| Z5 | 1.62 | 1.98 | 2.21 | 2.90 |
| Z6 | 1.90 | 1.85 | 2.74 | 2.77 |
| Z7 | 1.96 | 1.76 | 3.26 | 2.61 |

- The check: no zone in Dark may be under the weakest zone in Light (1.55 and 2.14). The weakest in Dark are 1.76 and 2.61.
- Z6 and Z7 wash a little more in Dark than they do in Light (1.85 against 1.90, 1.76 against 1.96; Z7 done against not done 2.61 against 3.26). They are still over every other Light zone.

**Edges and steps** (Dark must be no weaker than Light)

| Pair | Light | Dark |
| --- | --- | --- |
| Panel against page (`surface`, `bg`) | 1.12 | 1.12 |
| Control against panel (`raised`, `surface`) | 1.20 | 1.21 |
| Control against page (`raised`, `bg`) | 1.07 | 1.35 |
| `line` on surface / bg | 1.35 / 1.21 | 1.46 / 1.64 |
| `line-strong` on surface / raised / bg | 2.10 / 1.75 / 1.88 | 3.10 / 2.56 / 3.46 |

- `line-strong` is not 3:1 in Light where it is a control's border. It is never the only edge there: the fill is a step too. In Dark it is 3.10 on `surface`.

**The pop-up card**

| Pair | Light | Dark |
| --- | --- | --- |
| Card fill against the dimmed page | 2.24 | 1.17 |
| Card hairline against the dimmed page | 1.07 | 3.61 |
| The stronger of the two (the check) | 2.24 | 3.61 |
| Page text under the scrim, against its own dimmed panel | 8.57 | 3.17 |

- In Light the white card carries its own edge. In Dark it cannot: a `surface` card on pure black would only be 1.28. The hairline carries it.

**Near neighbors** (quoted in DESIGN.md, never a rule: nothing is told apart by color alone)

| Pair | Light | Dark |
| --- | --- | --- |
| Stale number (`fg-subtle`) against a Z1 number | 1.58 | 1.82 |
| `accent` against `state-on` / `z3` / `state-under` | 1.53 / 2.30 / 1.39 | 1.32 / 1.28 / 1.30 |
| `z3` against `state-on` | 1.50 | 1.68 |
| `z4` against `state-under` | 1.79 | 1.52 |
| `z6` against `state-over` | 1.12 | 1.32 |

## Calls

- **Lighter is nearer.** Page darkest, panel one step up, control one more. The other way (panels darker than the page) mirrors Light more literally but reads as holes. The steps were tuned until they were no weaker than Light's.
- **Warm near-black, not black.** #121110 for the page. `fg` is a warm off-white, #F0ECE4, not pure white: 14.3:1 on a panel is plenty, and pure white glares in the dark.
- **The selected chip is the darker one in Dark.** It is `surface` on a `raised` track in both themes. In Light that is a white chip; in Dark it is a dark chip with a border and a bright label. It reads, and it needs no theme knowledge in the component. A lighter chip would need a new token.
- **Z1 is a light, cool gray, the lightest zone.** This is the call I am least sure of. A stale number is `fg-subtle`, and `fg-subtle` has to be at least #9A958C to keep 4.5:1 as text on `raised`. A Z1 number then has two ways to differ from it: darker (about 3.2:1 on the panel, as faint as Light's Z1, and 1.7:1 from stale, no better than Light) or lighter. Lighter gives 1.82:1, a number that is easy to read in a dim room (10.3:1), and a live number that is never dimmer than a stale one. The cost: easy blocks are the brightest blocks on a strip, where in Light they are the faintest. They are the only blocks with no hue.
- **The other zones are the Light hues, lifted** until each is 4.5:1 or better on a panel and 3.8:1 or better on a control. `z3` was kept darker and `state-on` lighter so the two differ more than in Light (1.68 against 1.50).
- **`accent` is `accent-on-dark`,** as DESIGN.md already named it. The ink on it is the page color. Hover and press go lighter, where Light goes darker: both move away from the page.
- **The scrim and the shadow use `shade`,** a warm near-black of their own, only in Dark. `fg` at 32% over a dark page would light it up. The scrim is 60%: the page is already dark, so it takes more to make it step back. The shadow is the same six layers at 28%. It is honest to say it hardly shows; the card reads by its hairline.
- **Strava's button is untouched.** The white image, on a dark panel, in our hairline frame. It is the brightest thing on that section. Strava's guidelines offer an orange button and a white one, and no dark one. Only the white one is in the repo, and no asset was added. If Nate would rather have the orange one in Dark, that is a new file from Strava and one line; the orange would be a second loud color beside Olive.
- **The app icons and the manifest stay as they are.** The manifest cannot follow a rider's choice.
- **`theme-color` has no dark hex anywhere.** `theme.ts` reads `bg` from the page and writes it to the meta tag. The tag in `index.html` and the manifest still repeat the Light `bg`, as before.
- **The script in `index.html` is nine lines** and holds no color. It reads `ww.appearance` and sets `data-theme`. It can read the plain key because `rider.ts` keeps the current rider's settings under their own names and puts the others away under the rider's id, so there is no rider logic to copy. What must stay in step with `theme.ts`: the key name and the rule (dark when "dark", or "auto" with the computer dark). Both files say so.
- **A switch snaps.** Without help, 35 of the Ride tab's 141 elements eased their colors over 120 to 200ms while the page and panels changed at once: dark numbers on a dark panel for a moment. For two frames no color eases; a glide under way carries on. No page-wide transition was added.
- **In a backup,** as Interval sounds is. Restored only where none is saved, like every setting.
- **Cut:** a key on the Ride tab to switch, a schedule (dark after sunset), a dimmer third theme, per-theme app icons, a dark Strava button.

## Checked

Headless Chromium, production build, 1280x720 unless said. The fake trainer where a ride is needed.

- **`npm ci`, `npm run build`:** pass. **`npm run contrast`:** "Every rule passes in both themes."
- **Light is unchanged.** 44 screens (88 pictures: the window and the full page of each), the new build in Light against the build of `main`, three runs of each with a fixed clock and fixed random numbers. 59 pictures were identical in every run. 27 were identical in at least one pair of runs; these are ride pictures that differ between two runs of `main` itself (the position line and a number land a moment apart). The two that stayed in that group after three runs were run five more times each: identical pairs found for both. 2 differ, as they must: the full page of Your numbers, and the same page mid-ride, are 126px taller. They are identical down to row 1475 (1554 mid-ride), where the new row starts, and the page's last 40 rows match after the shift.
- **Dark, every screen:** Home empty and with a ride, the history rows and Confirm delete; Ride idle, waiting for Start, riding in all four ride types, stale, paused, Confirm end, the strip's hover details, ended; Workout step 1, a course picked, step 2, a workout overview, the Workout tab mid-ride; the builder empty, with blocks and with the step list; all four Profile sections and Your numbers mid-ride; the finish screen for all four ride types, a summary from Home, the chart cursor; the trainer's pairing step and the watch card. Each was looked at.
- **No light color left in Dark.** On those 44 screens, every computed text color, background, border, outline, SVG fill and stroke, placeholder, `::before`, `::after` and backdrop was read and matched against the tokens. None is a Light value. The only colors that are not a plain token: the scrim and the shadow (both `shade`, at 60% and 28%), and the default black fill of SVG `<line>` elements, which draws nothing. Strava's image was left out of the read. The same read in Light found no Dark value.
- **Color only.** On each of the 44 screens every box was measured, the theme was flipped in place with the clock stopped, and every box was measured again: 7,656 boxes at 1280x720 and 7,562 at 1024x768, none moved. No horizontal scroll at either width. The Ride tab is 720 tall at 1280x720 in all four ride types, before Start and riding, in both themes.
- **The setting,** 24 checks, all pass: a new rider gets Light with the computer set to dark; three options in order; Dark applies at once (`data-theme`, `color-scheme`, `theme-color` #121110); each option survives a reload; Match my computer follows the computer both ways with no reload; Dark ignores the computer; a second rider starts in Light and each rider keeps their own through three switches; the backup carries it; a restore into a browser with no choice turns it dark at once and the control shows it; a restore where Light was chosen leaves Light; changed on the locked Profile tab mid-ride, the ride stays Connected and its clock moves on; another tab follows a change.
- **`?fake=1` numbers update every second** in Light and in Dark: seven samples a second apart, every sample different, with power, cadence, speed, distance, time, interval left and workout left all moving.
- **No flash.** Every frame the browser painted was recorded (the DevTools screencast, plus screenshots in a tight loop) across a load and a reload on a slowed network (400 kbit/s, 150ms latency), starting from a page of the right brightness. Dark saved: 197 frames, none light. Match my computer with the computer dark: 210 frames, none light. Light saved with the computer dark: 192 frames, none dark. Nothing saved with the computer dark: 198 frames, none dark. The control, Dark saved with the script taken out of `index.html`: 448 of 460 frames light. So the method sees a flash, and the script is what prevents it.
- **Motion.** A switch mid-ride starts no color transition (it started 76 on 35 elements before the fix); the two glides under way keep running. With reduced motion: no transition and no animation at all.
- **No console errors** in any run.

## Needs a real ride

In a dim room, on the trainer, a few feet from the screen:

- Is the page dark enough, or still too bright at night? Is `fg` too bright on the big numbers?
- **Z1.** Does a light gray Power number read as easy? Do the light gray blocks on the strip bother you?
- Can a stale or paused number be told from a live Z1 number at a glance?
- The zone colors on the Power number and the trace: is each one told apart, most of all Z5 orange from Z6 red, and Z4 amber from the "Not recording" amber?
- The done wash on the strip: can you tell what is behind you?
- The Olive position line and the course dot.
- Switching to Dark mid-ride from the Profile tab.
- The watch card over the dimmed page.

## Not right, or not sure

- **Z1,** as above. The other choice is one hex.
- **Strava's white button** is loud on a dark panel. Left alone on purpose.
- **An installed app** (from the manifest) opens on the Light color for a moment, in the title bar and the splash, before the page loads. The manifest has one color.
- **The dev server** (`npm run dev`) was not checked for a flash. It loads its CSS from JavaScript, so it may show an unstyled page for a moment, as it does today. Only the production build was recorded: its stylesheet blocks the first paint.
- **Checked in Chromium only.** Not in Safari or Firefox.
- **The other docs** (`docs/riders.md`, `docs/profile.md`) were not edited to list the new key and row. `CLAUDE.md` and the scope doc are for the reviewer to update.

## Screenshots

`docs/screenshots/`, 1280x720 at 2x: `dark-home.png`, `dark-ride.png`, `dark-ride-paused.png`, `dark-workout.png`, `dark-builder.png`, `dark-profile.png`, `dark-summary.png`, `dark-watch-card.png`.

Note, Nov 24, 2026: the Light values of `z1` and `z2` were darkened after this was written (see `docs/zone-color.md`, "Darker Z1 and Z2"). The tables above carry the new Light numbers. In Light a Z1 number is now darker than a stale one; in Dark it is still the lighter.
