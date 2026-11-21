# Riders (Nov 21, 2026)

Two passes, both asked for by Nate after the Home tab work. First the rider id: groundwork with nothing on screen. Then the rider picker, later the same day. The picker's section is first; the id pass it stands on follows, as it was written.

## The rider picker

"Who's riding" from the research doc (`docs/zwift-accounts-profile-flow-research.md`, build list item 4), for a shared trainer.

### What was built

- **Who's riding**, the first panel on the Profile tab: every rider on this browser, who is riding now, Add rider, Switch, Remove, and a name field for yourself.
- **Riders have names.** The rider that already existed is "Rider 1" until renamed. A new one is "Rider 2", "Rider 3".
- **Each rider has their own profile and settings**, as well as their own rides, courses and workouts (those were already apart).
- **The rider's name** is the heading of Home's Rider panel, and sits in the top bar when there is more than one rider.
- **Backups name their rider** by name as well as id.

### Calls

- **On the Profile tab, not a chip in the top bar.** The research suggested a chip. The top bar is the Ride tab's too, and it is full: with one rider a chip would be noise. The name shows in the bar only with two or more riders, and only from 1280 px wide, so the bar stays one row in every ride state.
- **Switching reloads the page.** Everything is read again for the new rider, so no screen or controller code had to learn about riders. The cost: a reload drops the trainer. So Switch, Add rider and Remove are locked while the trainer is connected, connecting, or a ride is on or waiting to resume. The panel says so.
- **Add rider switches to them at once.** The next thing to do is set their numbers.
- **Profile and settings move, they are not copied.** The ten keys that belong to a rider (profile, resistance level, mode, hill feel, ERG target, the Workout tab's picks, the builder's draft and its two display choices) always hold the current rider's. On a switch the old rider's are put away under their id and the new rider's are put in their place. A new rider starts from the defaults.
- **A new per-rider setting must be added to `RIDER_KEYS`** in `rider.ts`, or it will be shared. `CLAUDE.md` says so.
- **Saved ride summaries are per rider now** (`ww.rideSummaries.v3.<rider id>`), so a rider's first frame never shows another rider's rides. Each ride is read once more after this ships.
- **Remove never deletes rides.** It works only for a rider with nothing saved, and never for the rider who is riding. To get rid of a rider with rides, switch to them and delete the rides first.
- **Names:** one line, 30 characters, no two riders the same (case does not count). An empty or taken name is refused and the field turns red until fixed.
- **At most 12 riders.**
- **A lost list now keeps riders apart.** The id pass merged everyone into one rider when the list was lost, because there was no way to reach a second rider. Now there is, so the list is rebuilt with every rider found on the saved records, named "Rider 1", "Rider 2". The one with the most rides is riding. Names and put-away settings of the others are lost with the list; rides are not.
- **A second tab follows a switch.** If it has no ride at stake it reloads as the new rider. If it is connected or riding it says so and stays put; reload it after the ride.
- **Restore and riders.** A rider with nothing saved becomes the backup's rider, id and name. Not when another rider on this browser already has that id: then the rows simply join whoever is riding.
- **Not built:** a "who's riding?" screen at startup, a rider photo or color, copying a workout from one rider to another, moving a ride between riders.

### Checked

- Rename, then add: the new rider has the default profile, no rides, no files, no saved resistance level, and is named Rider 2.
- Rider 2 sets an FTP, rides (the ride is stamped with their id) and changes a setting. Switch back: the first rider's FTP, rides, workout and setting are as they were. Switch again: so are Rider 2's.
- A name another rider has is refused.
- Remove is refused for a rider with a ride and works for an empty one; no ride is lost and their put-away settings are gone.
- Connected: Switch and Add rider are disabled and the panel says why.
- A second tab follows a switch.
- Backup names the rider; a clean browser becomes that rider on restore; restoring another rider's backup on a browser that has them changes nobody's id.
- List lost with two riders saved: both come back, apart.
- Top bar with a 29-character name in idle, connected, riding, confirm end and ended, at 1280 and 1024: one row, no sideways scroll, and the Ride tab still fits 1280x720.
- Every earlier check still passes.

## The rider id pass (earlier the same day)

Groundwork for more than one rider, and for an optional sign-in later. Nothing on screen changed in this pass. Where the picker changed something below, it says so above.

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
- **That rule merged riders when the list was lost.** Changed with the picker: the list is rebuilt with every id found on the records.
- **Two tabs opened together make one rider.** The first-visit step runs under a browser lock.
- **If the rider cannot be worked out at all** (an error in the lookup), the app falls back to the saved rider or a throwaway one and carries on. A record with no rider always reads as yours, so the saved rides still show.
- **Restore and the rider.** A browser with nothing saved takes on the backup's rider, so one person stays one rider across a wipe or a new computer. A browser that already has rides keeps its own rider, and what is restored joins it. The id is switched only after the rows are safely written. A rider id in a file is checked like every other field; a bad one is ignored.
- **The rows in a backup carry no rider id of their own.** The file names its rider once.
- **Not rider-scoped yet:** the profile and the settings (still one set per browser, in localStorage), the builder's draft, and the saved ride summaries (keyed by ride, rebuilt as needed). These move under the rider when a picker is built.

## What this makes easy later

1. **A rider picker:** built, see the top of this file.
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
