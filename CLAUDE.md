# CLAUDE.md

Read `Weem Watts App Scope.md` and `DESIGN.md` before any work. Use only DESIGN.md tokens and components. Stay inside the current phase.

- **Current phase:** v3.1, ERG mode and rider profile. v1 and v1.5 have shipped. v2 is built; its ride test is pending (Nate chose to build v3.1 first). Do not start v3.2 until v3.1 has shipped. Movie Mode and Strava auto-upload are unscheduled ("Later" in the scope doc).
- **Units:** lb, miles and feet everywhere a person reads them (UI and config). Never show kg, km or meters. SI stays inside `src/lib` (physics, course, FIT) and is converted at display.
- **Colors:** hex values live only in `src/styles/tokens.css`.
- **Code reuse:** MIT or Apache-2.0 only (GPX Rider, Croissant Ride, serpentine). Keep license notices in copied files. Never copy from AGPL repos (Auuki, OpenRadlr) or unlicensed repos (ride-hud).
- **Check before committing:** `npm run build` passes, and `?fake=1` still updates every number once a second.
