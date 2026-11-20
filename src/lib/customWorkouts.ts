/**
 * Workouts built in the app (the workout builder). Stored as the app's own
 * step list in IndexedDB. A stored row is as untrusted as an imported file:
 * it is rebuilt field by field and run through validateWorkout on every load.
 */
import * as recorder from './recorder'
import {
  cleanCadence,
  countIntervals,
  MAX_INTERVALS,
  validateWorkout,
  type RampStep,
  type SteadyStep,
  type Step,
  type Target,
  type Workout,
} from './workout'

export const CUSTOM_TAGS = ['easy', 'medium', 'hard'] as const
export type CustomTag = (typeof CUSTOM_TAGS)[number]
export const MAX_NAME_CHARS = 80
export const MAX_DESCRIPTION_CHARS = 400
export const MAX_LABEL_CHARS = 40
const ID_PREFIX = 'custom-'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function cleanTarget(v: unknown): Target {
  if (isObject(v)) {
    if (typeof v.pct === 'number') return { pct: v.pct }
    if (typeof v.w === 'number') return { w: v.w }
  }
  throw new Error('A step has a bad target.')
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function cleanSimpleStep(v: unknown): SteadyStep | RampStep {
  if (!isObject(v) || typeof v.durS !== 'number') throw new Error('A step has no duration.')
  const label = cleanText(v.label, MAX_LABEL_CHARS)
  const cadenceRpm = cleanCadence(v.cadenceRpm)
  const extra = { ...(label ? { label } : {}), ...(cadenceRpm !== undefined ? { cadenceRpm } : {}) }
  if (v.type === 'steady') return { type: 'steady', durS: v.durS, target: cleanTarget(v.target), ...extra }
  if (v.type === 'ramp') return { type: 'ramp', durS: v.durS, from: cleanTarget(v.from), to: cleanTarget(v.to), ...extra }
  throw new Error('A step has an unknown type.')
}

/** Rebuild a step list from stored or copied data. Throws on anything that is not a step list. */
export function cleanSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) throw new Error('The workout has no steps.')
  if (raw.length > MAX_INTERVALS) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
  const steps: Step[] = raw.map((v): Step => {
    if (isObject(v) && v.type === 'repeat') {
      if (typeof v.times !== 'number' || !Number.isInteger(v.times) || v.times < 1) throw new Error('A repeat has a bad count.')
      if (!Array.isArray(v.steps) || v.steps.length === 0) throw new Error('A repeat has no steps.')
      if (v.steps.length > MAX_INTERVALS) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
      return { type: 'repeat', times: v.times, steps: v.steps.map(cleanSimpleStep) }
    }
    return cleanSimpleStep(v)
  })
  if (!(countIntervals(steps) <= MAX_INTERVALS)) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
  return steps
}

export function cleanTag(v: unknown): CustomTag {
  return CUSTOM_TAGS.includes(v as CustomTag) ? (v as CustomTag) : 'medium'
}

/** A stored row (or a ride's snapshot) as a workout. Throws with a rider-facing message if it can't be ridden. */
export function customFromRow(row: { id: unknown; name: unknown; description: unknown; tag: unknown; steps: unknown; updatedAt?: unknown }): Workout {
  const w: Workout = {
    id: typeof row.id === 'string' ? row.id : '',
    name: cleanText(row.name, MAX_NAME_CHARS) || 'Untitled workout',
    description: cleanText(row.description, MAX_DESCRIPTION_CHARS),
    source: 'custom',
    tag: cleanTag(row.tag),
    steps: cleanSteps(row.steps),
    ...(typeof row.updatedAt === 'number' ? { updatedAt: row.updatedAt } : {}),
  }
  if (!w.id) throw new Error('The workout has no id.')
  validateWorkout(w)
  return w
}

export async function loadCustomWorkouts(): Promise<Workout[]> {
  const rows = await recorder.listCustomWorkouts()
  const out: Workout[] = []
  for (const row of rows) {
    try {
      out.push(customFromRow(row))
    } catch (err) {
      // The row is untrusted: its name may not even be a string, so it is not put in the message.
      console.error('A custom workout failed to load and was skipped:', err)
    }
  }
  return out
}

export interface CustomWorkoutInput {
  /** The workout being edited, or null for a new one. */
  id: string | null
  name: string
  description: string
  tag: CustomTag
  steps: Step[]
  /** updatedAt of the copy the edit started from. */
  baseUpdatedAt: number | null
}

/** The saved copy changed (another tab) since this edit started. */
export class WorkoutConflictError extends Error {
  constructor() {
    super('This workout was changed in another tab since you opened it.')
  }
}

/**
 * Validate and save a built workout. The same limits as an imported file
 * (validateWorkout). Throws WorkoutConflictError when the saved copy moved on,
 * unless `overwrite` is set.
 */
export async function saveCustomWorkout(input: CustomWorkoutInput, overwrite = false): Promise<Workout> {
  const name = cleanText(input.name, MAX_NAME_CHARS)
  if (!name) throw new Error('Give the workout a name.')
  const now = Date.now()
  const id = input.id ?? `${ID_PREFIX}${now}-${Math.random().toString(36).slice(2, 8)}`
  // Through the same cleaner as a stored row, so what is saved is what loads.
  const w = customFromRow({ id, name, description: input.description, tag: input.tag, steps: input.steps, updatedAt: now })
  let createdAt = now
  if (input.id) {
    const current = await recorder.getCustomWorkout(input.id)
    if (current) {
      if (!overwrite && current.updatedAt !== input.baseUpdatedAt) throw new WorkoutConflictError()
      createdAt = current.createdAt
    }
  }
  await recorder.saveCustomWorkout({
    id,
    name: w.name,
    description: w.description,
    tag: w.tag ?? 'medium',
    steps: w.steps,
    createdAt,
    updatedAt: now,
    v: 1,
  })
  return w
}

export async function removeCustomWorkout(id: string): Promise<void> {
  await recorder.deleteCustomWorkout(id)
}

/** What a ride row keeps of a custom workout, so recovery rides the workout as it was. */
export function snapshotOf(w: Workout): unknown {
  return { id: w.id, name: w.name, description: w.description, tag: w.tag, steps: w.steps }
}

export function workoutFromSnapshot(snap: unknown): Workout | null {
  try {
    if (!isObject(snap)) return null
    return customFromRow({ id: snap.id, name: snap.name, description: snap.description, tag: snap.tag, steps: snap.steps })
  } catch (err) {
    console.error('Ride workout snapshot could not be read:', err)
    return null
  }
}
