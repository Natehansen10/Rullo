# CLAUDE.md

Read `Weem Watts App Scope.md` and `DESIGN.md` before any work. Use only DESIGN.md tokens and components. Stay inside the current phase.

- **Current phase:** v1, Live numbers. Do not start the next phase until v1 has shipped. Movie Mode is unscheduled ("Later" in the scope doc).
- **Units:** lb and miles everywhere, in UI and config. Never show kg or km. Convert to SI only inside `src/lib/physics.ts`.
- **Colors:** hex values live only in `src/styles/tokens.css`.
- **Code reuse:** MIT or Apache-2.0 only (GPX Rider, Croissant Ride, serpentine). Keep license notices in copied files. Never copy from AGPL repos (Auuki, OpenRadlr) or unlicensed repos (ride-hud).
- **Check before committing:** `npm run build` passes, and `?fake=1` still updates every number once a second.
