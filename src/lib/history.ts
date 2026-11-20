/**
 * Ride history for the Home tab, read from the rides and samples already
 * saved in IndexedDB. Nothing new is stored: each ride's numbers are worked
 * out from its samples with the FIT writer's own totals, and kept in memory
 * for the session (an ended ride never changes).
 */
import { downloadFit, rideTotals, stoppedBetween } from './fit'
import * as recorder from './recorder'
import type { SampleRow } from './recorder'

/** The window for the best-power number, in seconds. */
export const BEST_POWER_WINDOW_S = 20 * 60
export const LAST_DAYS = 7

export interface RideSummary {
  id: number
  /** Time of the first sample, the same start the FIT file has. */
  startedAt: number
  /** Moving time: pauses and dropouts left out. */
  movingMs: number
  distanceM: number
  avgPowerW: number
  ascentM: number
  /** Best average power over 20 minutes without a stop, or null for a shorter ride. */
  best20W: number | null
  courseId?: string
  workoutId?: string
  /** The name saved with the ride (custom workouts keep a copy), for when the workout has since been renamed or deleted. */
  workoutName?: string
}

export interface Totals {
  rides: number
  movingMs: number
  distanceM: number
  ascentM: number
  best20W: number | null
}

/**
 * Best average power over `windowS` seconds of riding with no stop in it.
 * Samples are one per second between stops, so a window is that many samples
 * in a row. A pause or dropout starts a new run: resting never counts toward
 * an effort.
 */
export function bestPowerW(samples: SampleRow[], windowS = BEST_POWER_WINDOW_S): number | null {
  let best: number | null = null
  let runStart = 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    if (i > 0 && stoppedBetween(samples[i - 1], samples[i])) {
      runStart = i
      sum = 0
    }
    sum += samples[i].powerW
    if (i - runStart >= windowS) sum -= samples[i - windowS].powerW
    if (i - runStart + 1 >= windowS) {
      const avg = sum / windowS
      if (best === null || avg > best) best = avg
    }
  }
  return best
}

function summarize(ride: recorder.RideRow, samples: SampleRow[]): RideSummary | null {
  // Start pressed, never pedaled: an ended ride with nothing in it.
  if (samples.length === 0) return null
  const t = rideTotals(samples)
  const snap = ride.workoutSnapshot as { name?: unknown } | null | undefined
  return {
    id: ride.id,
    startedAt: t.startT,
    movingMs: t.timerMs,
    distanceM: t.distanceM,
    avgPowerW: t.avgPowerW,
    ascentM: t.ascentM,
    best20W: bestPowerW(samples),
    ...(ride.courseId ? { courseId: ride.courseId } : {}),
    ...(ride.workoutId ? { workoutId: ride.workoutId } : {}),
    ...(snap && typeof snap.name === 'string' && snap.name.trim() ? { workoutName: snap.name.trim().slice(0, 80) } : {}),
  }
}

/** Summaries of ended rides, by ride id, for this session. `null`: the ride has no samples. */
const cache = new Map<number, RideSummary | null>()
/** The last full list read, so a return to Home in the same session shows it at once. */
let lastFull: RideSummary[] | null = null

/** Rides read per step. The newest step comes first, so the top of the list shows before the rest is read. */
const BATCH = 10

function listed(rides: recorder.RideRow[]): RideSummary[] {
  const out: RideSummary[] = []
  for (const r of rides) {
    const s = cache.get(r.id)
    if (s) out.push(s)
  }
  return out.sort((a, b) => b.startedAt - a.startedAt)
}

/** The list from the last full read this session, or null before the first one. */
export function peekHistory(): RideSummary[] | null {
  return lastFull
}

/**
 * Every finished ride that has samples, newest first. Reading a ride's
 * samples is the slow part (about 20 ms per hour ridden), so rides are read
 * newest first in steps and `onPartial` gets the list so far after each step
 * but the last. A ride already read this session is not read again.
 */
export async function loadHistory(onPartial?: (rides: RideSummary[]) => void): Promise<RideSummary[]> {
  const rides = (await recorder.listEndedRides()).sort((a, b) => b.startedAt - a.startedAt)
  const todo = rides.filter((r) => !cache.has(r.id))
  for (let i = 0; i < todo.length; i += BATCH) {
    await Promise.all(
      todo.slice(i, i + BATCH).map(async (r) => {
        cache.set(r.id, summarize(r, await recorder.getSamples(r.id)))
      }),
    )
    if (onPartial && i + BATCH < todo.length) onPartial(listed(rides))
  }
  lastFull = listed(rides)
  return lastFull
}

export function totalsOf(rides: RideSummary[]): Totals {
  const t: Totals = { rides: rides.length, movingMs: 0, distanceM: 0, ascentM: 0, best20W: null }
  for (const r of rides) {
    t.movingMs += r.movingMs
    t.distanceM += r.distanceM
    t.ascentM += r.ascentM
    if (r.best20W !== null && (t.best20W === null || r.best20W > t.best20W)) t.best20W = r.best20W
  }
  return t
}

/** Rides that started in the last 7 days (7 x 24 hours back from now, not a calendar week). */
export function lastDays(rides: RideSummary[], now: number, days = LAST_DAYS): RideSummary[] {
  const from = now - days * 24 * 3600 * 1000
  return rides.filter((r) => r.startedAt >= from)
}

/** Rebuild a finished ride's FIT file from its saved samples and download it. */
export async function downloadRide(id: number): Promise<void> {
  const samples = await recorder.getSamples(id)
  if (samples.length === 0) throw new Error('That ride has no samples.')
  downloadFit(samples, samples[0].t)
}
