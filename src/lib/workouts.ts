/**
 * Workout catalog: built-ins (TS constants plus ZWO files listed in
 * public/workouts/index.json) and ZWO files the rider imported (IndexedDB).
 */
import { BUILTIN_WORKOUTS } from './builtinWorkouts'
import * as recorder from './recorder'
import { validateWorkout, type Workout } from './workout'
import { MAX_ZWO_BYTES, workoutFromZwo } from './zwo'

interface BuiltinZwoEntry {
  id: string
  file: string
  tag?: string
}

const WORKOUTS_BASE = `${import.meta.env.BASE_URL}workouts/`

async function loadBuiltinZwo(): Promise<Workout[]> {
  const res = await fetch(`${WORKOUTS_BASE}index.json`)
  if (!res.ok) throw new Error('Could not load the workout list.')
  const entries = (await res.json()) as BuiltinZwoEntry[]
  const out: Workout[] = []
  for (const e of entries) {
    try {
      const text = await (await fetch(WORKOUTS_BASE + e.file)).text()
      const w = workoutFromZwo(text, e.id, e.file.replace(/\.zwo$/i, ''), 'builtin')
      validateWorkout(w)
      out.push(typeof e.tag === 'string' && e.tag ? { ...w, tag: e.tag.slice(0, 20) } : w)
    } catch (err) {
      console.error(`Workout ${e.id} failed to load:`, err)
    }
  }
  return out
}

/** Parse and validate: a stored row is as untrusted as the file it came from. */
function fromImported(row: recorder.ImportedWorkoutRow): Workout {
  const w = workoutFromZwo(String(row.zwo), String(row.id), String(row.name))
  validateWorkout(w)
  return w
}

export async function loadWorkouts(fake: boolean): Promise<Workout[]> {
  const builtins = BUILTIN_WORKOUTS.filter((w) => fake || !w.fakeOnly)
  const [zwoBuiltins, rows] = await Promise.all([
    loadBuiltinZwo().catch((err) => {
      console.error(err)
      return [] as Workout[]
    }),
    recorder.listImportedWorkouts().catch(() => [] as recorder.ImportedWorkoutRow[]),
  ])
  const mine: Workout[] = []
  for (const row of rows) {
    try {
      mine.push(fromImported(row))
    } catch (err) {
      console.error(`Imported workout ${row.name} failed to load:`, err)
    }
  }
  // Fake-only test workouts last, so real ones lead the list.
  return [...builtins.filter((w) => !w.fakeOnly), ...zwoBuiltins, ...builtins.filter((w) => w.fakeOnly), ...mine]
}

/** Parse, validate and save a ZWO file. Throws with a rider-facing message on bad files. */
export async function importZwoFile(file: File): Promise<Workout> {
  if (file.size > MAX_ZWO_BYTES) throw new Error('The file is too large for a workout (limit 1 MB).')
  const zwo = await file.text()
  const name = file.name.replace(/\.zwo$/i, '')
  const row: recorder.ImportedWorkoutRow = { id: `imported-${Date.now()}`, name, zwo, addedAt: Date.now() }
  const w = fromImported(row)
  await recorder.saveImportedWorkout({ ...row, name: w.name })
  return w
}

export async function removeImportedWorkout(id: string): Promise<void> {
  await recorder.deleteImportedWorkout(id)
}
