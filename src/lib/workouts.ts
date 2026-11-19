/** Workout catalog: built-ins plus ZWO files the rider imported (saved in IndexedDB). */
import { BUILTIN_WORKOUTS } from './builtinWorkouts'
import * as recorder from './recorder'
import { validateWorkout, type Workout } from './workout'
import { workoutFromZwo } from './zwo'

function fromImported(row: recorder.ImportedWorkoutRow): Workout {
  return workoutFromZwo(row.zwo, row.id, row.name)
}

export async function loadWorkouts(fake: boolean): Promise<Workout[]> {
  const builtins = BUILTIN_WORKOUTS.filter((w) => fake || !w.fakeOnly)
  const rows = await recorder.listImportedWorkouts().catch(() => [] as recorder.ImportedWorkoutRow[])
  const mine: Workout[] = []
  for (const row of rows) {
    try {
      mine.push(fromImported(row))
    } catch (err) {
      console.error(`Imported workout ${row.name} failed to load:`, err)
    }
  }
  return [...builtins, ...mine]
}

/** Parse, validate and save a ZWO file. Throws with a rider-facing message on bad files. */
export async function importZwoFile(file: File): Promise<Workout> {
  const zwo = await file.text()
  const name = file.name.replace(/\.zwo$/i, '')
  const row: recorder.ImportedWorkoutRow = { id: `imported-${Date.now()}`, name, zwo, addedAt: Date.now() }
  const w = fromImported(row)
  validateWorkout(w)
  await recorder.saveImportedWorkout({ ...row, name: w.name })
  return w
}

export async function removeImportedWorkout(id: string): Promise<void> {
  await recorder.deleteImportedWorkout(id)
}
