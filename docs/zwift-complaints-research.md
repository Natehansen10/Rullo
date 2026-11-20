# Top Zwift complaints, and what Weem Watts can do about them

Researched 20 Nov 2026. Sources:
- **Zwift forums:** Feature Requests sorted by votes, all-time and past year, read through the forum's own data feed.
- **Reddit r/Zwift**
- **Apple App Store:** the 2025+ 1-2 star reviews out of 500 recent Zwift reviews and 400 Companion reviews.
- **Trustpilot**
- **Reviews:** DC Rainmaker, Zwift Insider, road.cc, Cyclist.

Vote and upvote counts are as of 20 Nov 2026.

**V** = verified from the source. **I** = my inference. App Store theme counts come from keyword matching, so treat them as rough.

## 1. Ranked complaints

| # | Complaint | How big | Evidence | Weem Watts today |
| --- | --- | --- | --- | --- |
| 1 | **Price, and now the Zwift Plus upsell** ($29.99/mo, launched 29 Oct 2026) | Loudest theme of 2026 | 23 of 52 recent 1-2★ App Store reviews mention price or billing (V). Reddit "Zwift has gone too far with Zwift Plus": 186 upvotes, 261 comments, 2026-10-29 (V). "Cancelled my Zwift+ subscription after a few weeks": 134 upvotes, 2026-11-19 (V). Trustpilot 2.2/5 from 257 reviews (V) | **Already solved:** free, no account |
| 2 | **Connections drop** (trainer, Apple Watch HR, Companion) | 15 of 52 recent Zwift 1-2★ reviews; 23 of 38 Companion 1-2★ reviews | "15-45 min some days just trying to reconnect" (App Store, 2026-02-07). "A dozen drops in a 75 min workout" (Reddit, 2026-11-17) (V) | **Mostly solved:** direct FTMS, 2 s reconnect loop, gray-out when stale, target re-sent after reconnect |
| 3 | **A second app (Companion) for basic things**, and it's flaky | Reddit "one feature for 2026" thread: 130 upvotes, 463 comments, 2026-02-07 (V) | Top asks include managing things without the main app | **Solved:** one tab and keyboard controls |
| 4 | **Rides that don't save, or corrupted activities** | The most-voted request ever is "Allow Saves Without Exit" (1,358 votes, 2018 to 2021). Recent threads: "Corrupted activity (October 2026)", 67 posts; "Ride not saved?", 2025-12-24 (V) | Zwift staff tell riders to dig the FIT file out of the laptop and upload it by hand (forum t/671840, 2026-10-10) (V) | **Mostly solved:** 1 s autosave, crash recovery, local FIT. **Gap:** no list of past rides to download again, and End Ride disconnects the trainer |
| 5 | **Interface friction and forced updates**: "hard to end a ride", "no way to repeat a past workout", "defaulted rides to public Strava posts" | 18 of 52 recent 1-2★ reviews (V) | App Store 2025-05 to 2026-06 (V) | **Mostly solved:** no updates forced mid-ride, manual Strava. **Gap:** no "ride this again" |
| 6 | **Can't see the road ahead.** "Make the course gradient graph much more visible": 678 votes. "Large course profile": 145. Reddit: "show distance to sprint and climb segments" (371 upvotes) | Long-running | Forum t/13507, t/13455; Reddit 2026-02-07 (V) | **Partly solved:** full-width elevation profile with grade. **Gap:** no "next climb" callout |
| 7 | **No HUD customisation**: "this thing is like a giant billboard in front of my face" | 578 votes, active to 2026-11-11 | Forum t/14554 (V) | Fixed layout. Movie Mode (Later) would cover the "less on screen" wish |
| 8 | **Lock-in and consolidation.** Zwift bought ROUVY (Apr 2026). Kickr Core 2 Cog/Click virtual shifting "officially only works with Zwift" | "Zwift acquires Rouvy": 415 upvotes, 2026-04-29. DC Rainmaker Core 2 review, 2025-11-19 (V) | — | **Solved:** standard FTMS, open FIT and ZWO, GPX import. (Cog owners can't shift virtually in any third-party app; I) |
| 9 | **One rider per account, no family plan** | "Family and Child Plan Request": 1,310 votes. Reddit "The 10 Year Issue": 193 upvotes, 2026-03-30 (V) | — | Not solved: one profile per browser |
| 10 | **No manual lap button** for marking intervals for a coach or TrainingPeaks | 176 votes, active to 2026-08 | Forum t/19346 (V) | Laps only come from workout intervals |
| 11 | **ERG only inside workouts**, so riders can't hold a fixed wattage in a free ride | Requested "for more than 10 years" (Zwift staff, 2026-07-17) | Forum t/669768 (V) | **Solved:** ERG works in free ride, with target steps |
| 12 | **Kickr Core 2 feels very hard or reads low**: about 4.5 to 15% below pedal power meters in user tests | Several 2026 threads (40+ posts each) | Forum t/669844, t/669928; DC Rainmaker comments (V) | Can't fix accuracy. Ride-test it on your own Core 2 (I) |
| 13 | **Audio cues** for interval changes, sprints and climbs (an accessibility request) | Most-voted new request of the past year: 69 votes, 88 likes, 2026-09-24 | Forum t/671315 (V) | Not built |

## 2. What to add to Weem Watts

These are the gaps Zwift riders complain about that fit your rules: no server, no accounts, Ride tab fits 1280x720. Ordered by value for effort.

1. **Past rides list with Download FIT** (complaint 4)
   - **What:** Profile gets a "Your rides" panel. Each ride is a row with its date, course or workout, time, miles and average watts, plus **Download FIT** and **Remove**.
   - **Why:** lost rides are Zwift's most painful failure. Every ride is already in IndexedDB (`recorder.ts`), but there's no way to get an old one back out.
   - **Effort:** small. The data and the FIT writer already exist.
2. **Ride again** (complaint 5)
   - **What:** after End Ride, add a "Ride again" button next to New ride, keeping the same course and workout. Optionally show the last 3 setups at the top of the Workout tab.
   - **Effort:** small.
3. **Keep the trainer connected between rides** (complaint 4, the 1,358-vote item)
   - **What:** End Ride disconnects today (`ride.ts` `endRide`). Reconnecting is one click with no device picker, because `ble.ts` keeps the device. A "Save and keep riding" option, which closes the FIT and starts a new ride without disconnecting, would fully match the request.
   - **Effort:** small to medium. It touches ride state.
4. **Lap key** (complaint 10)
   - **What:** press **L** (and a small Lap button in the control row) to start a new FIT lap on a free ride or course.
   - **Why:** Strava and TrainingPeaks then show your efforts split out.
   - **Effort:** small. `fit.ts` already writes laps from sample lap numbers.
5. **Next climb callout** (complaint 6)
   - **What:** on a course, the profile row's stats show something like "Next climb 0.8 mi · 1.4 mi at 4.2%".
   - **Why:** this is the most-upvoted Reddit ask in that thread. It's also the start of v3.3's climb, flat and descent split.
   - **Effort:** medium. It needs climb detection, which v3.3 needs anyway.
6. **Sound cues** (complaint 13)
   - **What:** optional beeps in the last 3 seconds before each interval changes, and a tone when the target changes.
   - **Why:** useful with Movie Mode, when you're not looking at the screen.
   - **Effort:** small (Web Audio, no files). It needs a one-line on/off setting on Profile.
7. **Second rider profile** (complaint 9)
   - **What:** a "Rider" switch on Profile for a partner or spouse sharing the Kickr. Weights, FTP and rides are kept per rider.
   - **Effort:** medium. Only worth it if someone else actually rides your trainer.

**Skip:** HUD customisation (complaint 7), until Movie Mode exists.

**Can't fix in the app:** Core 2 accuracy (complaint 12).

## 3. What not to copy

Some of the reasons people are upset have nothing to do with features:
- **Price and the upsell:** stay free.
- **Forced social or Strava posting:** keep upload manual.
- **Updates that change things mid-season:** keep the Ride tab stable, as DESIGN.md's "Calm while riding" rule already does.

## Sources

**Zwift forums** (forums.zwift.com/t/<id>):
- 13113 Allow Saves Without Exit, 2018-08-28 to 2021-04-03, 1,358 votes
- 13112 Family and Child Plan, to 2026-10-30, 1,310 votes
- 13507 Course gradient graph, to 2025-03-17, 678 votes
- 14554 HUD Customisation, to 2026-11-11, 578 votes
- 13669 Custom routes, to 2026-03-04, 343 votes
- 19346 Lap button, to 2026-08-10, 176 votes
- 13455 Large course profile, 145 votes
- 669768 ERG like cruise control, 2026-07-17
- 671840 Corrupted activity, 2026-10-10
- 661847 Ride not saved, 2025-12-24
- 669844 and 669928 Kickr Core 2 harder / low watts, 2026-07
- 671315 Audio cues, 2026-09-24, 69 votes
- 663844 Flat route for non-ERG workouts, 2026-01-22

**Reddit r/Zwift** (reddit.com/r/Zwift/comments/<id>):
- 1xiudum (2026-10-29)
- 1xild4f (2026-10-29)
- 1y06slp (2026-11-19)
- 1xn8r24 (2026-11-03)
- 1syzw68 (2026-04-29)
- 1s84p2h (2026-03-30)
- 1qyl6wt (2026-02-07)
- 1xyttli (2026-11-17)

**Apple App Store** (RSS feed, reviews to 2026-11-15):
- Zwift, id 1134655040: 4.73 from 21,505 ratings
- Zwift Companion, id 934083691: 4.74 from 27,553 ratings

**Other:**
- Trustpilot zwift.com: 2.2 from 257 reviews, checked 2026-11-20
- Zwift Insider, Zwift Plus launch, 2026-10-29
- DC Rainmaker, Kickr Core 2 review, 2025-11-19
- road.cc, 2026-02-12
- Cyclist, 2026-01-20
