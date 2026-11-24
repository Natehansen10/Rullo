/**
 * Ride history for the Home tab, read from the rides and samples already
 * saved in IndexedDB. Each ride's numbers are worked out once from its samples
 * with the FIT writer's own totals, then kept in memory and in localStorage
 * (an ended ride never changes). No table is added.
 */
import { downloadFit, rideTotals, stoppedBetween } from './fit'
import * as recorder from './recorder'
import type { SampleRow } from './recorder'
import { currentRider, SUMMARIES_KEY_PREFIX } from './rider'

/** The windows power bests are kept for, in seconds: 5 s, 1 min, 5 min, 20 min. */
export const BEST_WINDOWS_S = [5, 60, 300, 1200] as const
export type BestWindow = (typeof BEST_WINDOWS_S)[number]
export const BEST_LABEL: Record<BestWindow, string> = { 5: '5 s', 60: '1 min', 300: '5 min', 1200: '20 min' }
/** Best average power for each window, or null when the ride has no stretch that long without a stop. */
export type Bests = Record<BestWindow, number | null>
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
  /**
   * Work in joules, the FIT file's own number. Absent only on a summary saved
   * before Nov 24, 2026, and only until the read that follows works it out.
   */
  workJ?: number
  /** Best average power over 5 s, 1 min, 5 min and 20 min without a stop. */
  bests: Bests
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
}

/**
 * Best average power over `windowS` seconds of riding with no stop in it.
 * Samples are one per second between stops, so a window is that many samples
 * in a row. A pause or dropout starts a new run: resting never counts toward
 * an effort.
 */
export function bestPowerW(samples: SampleRow[], windowS: number): number | null {
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

export function bestsOf(samples: SampleRow[]): Bests {
  return { 5: bestPowerW(samples, 5), 60: bestPowerW(samples, 60), 300: bestPowerW(samples, 300), 1200: bestPowerW(samples, 1200) }
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
    workJ: t.workJ,
    bests: bestsOf(samples),
    ...(ride.courseId ? { courseId: ride.courseId } : {}),
    ...(ride.workoutId ? { workoutId: ride.workoutId } : {}),
    ...(snap && typeof snap.name === 'string' && snap.name.trim() ? { workoutName: snap.name.trim().slice(0, 80) } : {}),
  }
}

/**
 * Summaries are also saved in localStorage, so a first load does not have to
 * read every sample again (about 20 ms per hour ridden). The saved rides in
 * IndexedDB stay the truth: an entry is used only for a ride that is still
 * there with the same start and end, and is dropped when its ride is gone.
 * Bump the version when rideTotals or bestPowerW changes what they return, so
 * old numbers are worked out again.
 */
/** One store per rider, so a rider's first frame never shows another rider's rides. Null before the first visit has made a rider. */
const storeKey = (): string | null => {
  const id = currentRider()?.id
  return id ? SUMMARIES_KEY_PREFIX + id : null
}
/** Older versions of the saved summaries, removed on load. */
const OLD_STORE_KEYS = ['ww.rideSummaries.v1', 'ww.rideSummaries.v2']

interface Saved {
  /** The ride row's own start and end, to tell this ride from a later one that got the same id. */
  rideStartedAt: number
  endedAt: number
  /** Null: the ride has no samples. */
  summary: RideSummary | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A saved entry, rebuilt field by field: localStorage is as untrusted as a file. */
function cleanSaved(id: number, v: unknown): Saved | null {
  if (typeof v !== 'object' || v === null) return null
  const e = v as Record<string, unknown>
  if (!isNum(e.rideStartedAt) || !isNum(e.endedAt)) return null
  if (e.summary === null) return { rideStartedAt: e.rideStartedAt, endedAt: e.endedAt, summary: null }
  if (typeof e.summary !== 'object' || e.summary === undefined) return null
  const r = e.summary as Record<string, unknown>
  if (!isNum(r.startedAt) || !isNum(r.movingMs) || !isNum(r.distanceM) || !isNum(r.avgPowerW) || !isNum(r.ascentM)) return null
  if (typeof r.bests !== 'object' || r.bests === null) return null
  const b = r.bests as Record<string, unknown>
  const best = (w: BestWindow) => (isNum(b[w]) ? (b[w] as number) : null)
  return {
    rideStartedAt: e.rideStartedAt,
    endedAt: e.endedAt,
    summary: {
      id,
      startedAt: r.startedAt,
      movingMs: r.movingMs,
      distanceM: r.distanceM,
      avgPowerW: r.avgPowerW,
      ascentM: r.ascentM,
      ...(isNum(r.workJ) ? { workJ: r.workJ } : {}),
      bests: { 5: best(5), 60: best(60), 300: best(300), 1200: best(1200) },
      ...(typeof r.courseId === 'string' ? { courseId: r.courseId } : {}),
      ...(typeof r.workoutId === 'string' ? { workoutId: r.workoutId } : {}),
      ...(typeof r.workoutName === 'string' ? { workoutName: r.workoutName.slice(0, 80) } : {}),
    },
  }
}

/** Null when nothing has ever been saved (or storage is off). */
function readStore(): Map<number, Saved> | null {
  try {
    for (const k of OLD_STORE_KEYS) localStorage.removeItem(k)
    const key = storeKey()
    const raw = key === null ? null : localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    const out = new Map<number, Saved>()
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [k, v] of Object.entries(parsed)) {
        const id = Number(k)
        const e = Number.isInteger(id) ? cleanSaved(id, v) : null
        if (e) out.set(id, e)
      }
    }
    return out
  } catch {
    // storage unavailable or corrupt: read from samples, as before
    return null
  }
}

const hadStore = readStore()
const saved: Map<number, Saved> = hadStore ?? new Map()

function writeStore(): void {
  try {
    const key = storeKey()
    if (key !== null) localStorage.setItem(key, JSON.stringify(Object.fromEntries(saved)))
  } catch {
    // storage full or unavailable: the summaries still hold for this session
  }
}

/** Summaries of ended rides, by ride id, for this session. `null`: the ride has no samples. */
const cache = new Map<number, RideSummary | null>()
/**
 * The last full list read. Before the first read of a session it is the saved
 * list, so Home can draw its rows and totals at once; the read that follows
 * puts right anything that changed.
 */
let lastFull: RideSummary[] | null = hadStore
  ? [...hadStore.values()].flatMap((e) => (e.summary ? [e.summary] : [])).sort((a, b) => b.startedAt - a.startedAt)
  : null

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

/** The list to draw before reading: the last full read this session, else the saved one, else null. */
export function peekHistory(): RideSummary[] | null {
  return lastFull
}

/**
 * Every finished ride that has samples, newest first. A ride whose summary is
 * saved is not read at all. The rest are read from their samples newest first
 * in steps, and `onPartial` gets the list so far after each step but the last.
 */
export async function loadHistory(onPartial?: (rides: RideSummary[]) => void): Promise<RideSummary[]> {
  const rides = (await recorder.listEndedRides()).sort((a, b) => b.startedAt - a.startedAt)
  let dirty = false
  for (const r of rides) {
    if (cache.has(r.id)) continue
    const e = saved.get(r.id)
    // A summary saved before work was kept is drawn at first (peekHistory) and read again here, once.
    if (e && e.rideStartedAt === r.startedAt && e.endedAt === (r.endedAt ?? -1) && (e.summary === null || e.summary.workJ !== undefined)) {
      cache.set(r.id, e.summary)
    }
  }
  // Saved entries whose ride is gone (deleted in another tab, site data cleared in part).
  const ids = new Set(rides.map((r) => r.id))
  for (const id of [...saved.keys()]) {
    if (!ids.has(id)) {
      saved.delete(id)
      cache.delete(id)
      dirty = true
    }
  }
  const todo = rides.filter((r) => !cache.has(r.id))
  for (let i = 0; i < todo.length; i += BATCH) {
    await Promise.all(
      todo.slice(i, i + BATCH).map(async (r) => {
        const summary = summarize(r, await recorder.getSamples(r.id))
        cache.set(r.id, summary)
        saved.set(r.id, { rideStartedAt: r.startedAt, endedAt: r.endedAt ?? -1, summary })
      }),
    )
    dirty = true
    if (onPartial && i + BATCH < todo.length) onPartial(listed(rides))
  }
  if (dirty || !hadStore) writeStore()
  lastFull = listed(rides)
  return lastFull
}

export function totalsOf(rides: RideSummary[]): Totals {
  const t: Totals = { rides: rides.length, movingMs: 0, distanceM: 0, ascentM: 0 }
  for (const r of rides) {
    t.movingMs += r.movingMs
    t.distanceM += r.distanceM
    t.ascentM += r.ascentM
  }
  return t
}

/** The best ride for one window: its watts and the ride that set it. */
export interface BestHolder {
  w: number
  rideId: number
  startedAt: number
}

/** The standing best for each window across these rides. The earlier ride keeps a tie. */
export function bestHolders(rides: RideSummary[]): Record<BestWindow, BestHolder | null> {
  const out: Record<BestWindow, BestHolder | null> = { 5: null, 60: null, 300: null, 1200: null }
  for (const r of [...rides].sort((a, b) => a.startedAt - b.startedAt)) {
    for (const win of BEST_WINDOWS_S) {
      const w = r.bests[win]
      if (w !== null && (out[win] === null || Math.round(w) > Math.round(out[win].w))) out[win] = { w, rideId: r.id, startedAt: r.startedAt }
    }
  }
  return out
}

/**
 * The PRs each ride set when it was ridden: the windows where it beat every
 * earlier ride, by at least one whole watt. The first ride with a number for a
 * window sets the mark and is not a PR: there was nothing to beat.
 */
export function prsByRide(rides: RideSummary[]): Map<number, BestWindow[]> {
  const out = new Map<number, BestWindow[]>()
  const mark: Record<BestWindow, number | null> = { 5: null, 60: null, 300: null, 1200: null }
  for (const r of [...rides].sort((a, b) => a.startedAt - b.startedAt)) {
    const set: BestWindow[] = []
    for (const win of BEST_WINDOWS_S) {
      const w = r.bests[win]
      if (w === null) continue
      const prev = mark[win]
      if (prev !== null && Math.round(w) > prev) set.push(win)
      if (prev === null || Math.round(w) > prev) mark[win] = Math.round(w)
    }
    if (set.length) out.set(r.id, set)
  }
  return out
}

/** Rides that started in the last 7 days (7 x 24 hours back from now, not a calendar week). */
export function lastDays(rides: RideSummary[], now: number, days = LAST_DAYS): RideSummary[] {
  const from = now - days * 24 * 3600 * 1000
  return rides.filter((r) => r.startedAt >= from)
}

/** Delete a finished ride for good: its row, its samples and its place in this session's list. */
export async function deleteRide(id: number): Promise<void> {
  await recorder.deleteEndedRide(id)
  cache.delete(id)
  if (saved.delete(id)) writeStore()
  if (lastFull) lastFull = lastFull.filter((r) => r.id !== id)
}

/** Rebuild a finished ride's FIT file from its saved samples and download it. */
export async function downloadRide(id: number): Promise<void> {
  const samples = await recorder.getSamples(id)
  if (samples.length === 0) throw new Error('That ride has no samples.')
  // The file keeps the ride's origin mark (real or fake trainer), the same as the download after End Ride.
  const origin = (await recorder.getRide(id))?.origin
  downloadFit(samples, samples[0].t, origin === 'trainer' || origin === 'fake' ? origin : undefined)
}
