# Rider id (Nov 21, 2026)

Groundwork for more than one rider, and for an optional sign-in later. Asked for by Nate after the Home tab work. Nothing on screen changed: there is still one rider, with no name and no picker.

## What was built

- **A rider.** `src/lib/rider.ts` keeps a list of riders in localStorage (`ww.riders`) with one marked current. The first visit makes one, with a random id (a UUID).
- **A stamp on everything saved.** Each ride, imported course, imported workout and built workout carries its rider's id (`riderId`). Samples do not: they belong to a ride.
- **Old records are claimed.** On each load, any record with no rider gets the current rider's id. Your rides from before this change become yours on the first visit. Only that one field is written.
- **Every read is the rider's own.** Ride history, the unfinished-ride check, a course's last position, the course and workout lists, a ride's summary, delete, and back up all go through the rider. Another rider's ride reads as not there.
- **Backups carry the rider.** The file (now version 2) names whose it is. A version 1 file still restores.

All of it is in `recorder.ts`, the one place that touches the database. No screen or controller code knows about riders.

## Calls

- **No database version change.** `riderId` is a plain field, not an index. The tables are small (rides, not samples), so the rider's rows are picked out in memory. An older build of the app still opens the database after this ships, which a new version would have ended.
- **The id cannot be lost on its own.** It is in localStorage and on every saved record. If the list is gone and the records are not (storage cleared in part, a broken value), the id is taken back from the records: the one with the most rides.
- **Nothing can end up belonging to nobody.** A record whose rider this browser does not know is given to the current rider on load. While there is no picker, a ride that is not yours would be a ride you can never see again, so the rule leans toward showing.
- **That rule merges riders when the list is lost.** If two riders are saved and the list is lost, both sets of rides join the one rider left. With one rider, as now, this cannot matter. **When a picker is built, change this:** rebuild the list with every id found on the records.
- **Two tabs opened together make one rider.** The first-visit step runs under a browser lock.
- **If the rider cannot be worked out at all** (an error in the lookup), the app falls back to the saved rider or a throwaway one and carries on. A record with no rider always reads as yours, so the saved rides still show.
- **Restore and the rider.** A browser with nothing saved takes on the backup's rider, so one person stays one rider across a wipe or a new computer. A browser that already has rides keeps its own rider, and what is restored joins it. The id is switched only after the rows are safely written. A rider id in a file is checked like every other field; a bad one is ignored.
- **The rows in a backup carry no rider id of their own.** The file names its rider once.
- **Not rider-scoped yet:** the profile and the settings (still one set per browser, in localStorage), the builder's draft, and the saved ride summaries (keyed by ride, rebuilt as needed). These move under the rider when a picker is built.

## What this makes easy later

1. **A rider picker** ("Who's riding"): a list, an Add button, and switching `current`. The data is already apart. Left to do: the profile and settings per rider, and the lost-list rule above.
2. **Sign-in that only syncs:** an account maps to a rider id. The backup file is already the payload: one rider, their rides and files. This is where a backend such as Supabase comes in.

## Checked (headless Chromium, production build)

- First visit makes one rider. Two tabs opened together make one, not two.
- Three rides and two workouts saved the old way (no rider): all listed, all stamped, samples untouched (1,800 before and after, none with a rider field).
- A new fake ride is stamped when it starts.
- List removed, records kept: the same id comes back, every ride still listed. Same for a broken list value.
- A record with an unknown rider is claimed, not hidden.
- A second known rider with a finished ride, an unfinished ride and a workout: none of it shows for the first rider (history, power bests, the unfinished-ride notice, files, the ride's summary link, the backup file). Switched to the second rider: only theirs shows.
- Backup: version 2, names the rider, holds only that rider's rows, no rider ids inside the rows.
- Restore into a clean browser takes the backup's rider. Restore into a browser with a ride keeps its own. A version 1 file restores. A file with a bad rider id restores without adopting it.
- Every earlier check still passes: live numbers, zone boundaries, history and summary against the decoded FIT, delete, back up and restore, load times (rows and totals in 0.12 to 0.18 s with 50 one-hour rides), the Ride tab at 1280x720.
