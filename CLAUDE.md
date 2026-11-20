# CLAUDE.md

Read `Weem Watts App Scope.md` and `DESIGN.md` before any work. Use only DESIGN.md tokens and components. Stay inside the current phase.

- **Current phase:** v3.2, Workouts (built, ride test pending). v1 and v1.5 have shipped. v2 and v3.1 are built; their ride tests are pending (Nate chose to build ahead). Do not start v3.3 until v3.2 has been ride-tested. Exception, Nov 20, 2026: Nate asked for Grade mode (the trainer follows course hills when no workout is picked), which is part of v4; it is built and its ride test is pending too. Movie Mode, Strava auto-upload and the workout step-list editor are unscheduled ("Later" in the scope doc).
- **Units:** lb, miles and feet everywhere a person reads them (UI and config). Never show kg, km or meters. SI stays inside `src/lib` (physics, course, FIT) and is converted at display.
- **Colors:** hex values live only in `src/styles/tokens.css`.
- **Code reuse:** MIT or Apache-2.0 only (GPX Rider, Croissant Ride, serpentine). Keep license notices in copied files. Never copy from AGPL repos (Auuki, OpenRadlr) or unlicensed repos (ride-hud).
- **Check before committing:** `npm run build` passes, and `?fake=1` still updates every number once a second.
