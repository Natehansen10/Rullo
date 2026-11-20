/**
 * A ridable course built from GPX points.
 *
 * The track is resampled every STEP_M meters of horizontal distance, elevation
 * is smoothed (two 75 m passes) so GPS noise doesn't create fake grade spikes,
 * and position is measured along the slope (so climbs add real distance).
 * All internal units are SI; the UI converts to miles and feet.
 */
import type { GpxPoint } from './gpx'

const STEP_M = 5
const SMOOTH_HALF_WINDOW = 7 // samples each side: 15 x 5 m = 75 m window
const MAX_GRADE = 0.25
const EARTH_R = 6371008.8

export interface Course {
  id: string
  name: string
  source: 'builtin' | 'imported'
  description?: string
  /** Total distance along the slope, meters. */
  lengthM: number
  /** Total climbing on the smoothed profile, meters. */
  ascentM: number
  /** Cumulative slope distance at each sample, meters. */
  s: Float64Array
  /** Smoothed elevation at each sample, meters. */
  ele: Float64Array
}

function haversine(a: GpxPoint, b: GpxPoint): number {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Moving average with a +/- half-window; the window shrinks at the ends. */
function movingAverage(src: Float64Array, half: number): Float64Array {
  const n = src.length
  const out = new Float64Array(n)
  let sum = 0
  let lo = 0
  let hi = -1
  for (let k = 0; k < n; k++) {
    const wantLo = Math.max(0, k - half)
    const wantHi = Math.min(n - 1, k + half)
    while (hi < wantHi) sum += src[++hi]
    while (lo < wantLo) sum -= src[lo++]
    out[k] = sum / (hi - lo + 1)
  }
  return out
}

export function buildCourse(
  points: GpxPoint[],
  meta: { id: string; name: string; source: Course['source']; description?: string },
): Course {
  // Horizontal distance per point; drop duplicates.
  const xs: number[] = []
  const es: (number | null)[] = []
  let x = 0
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const d = haversine(points[i - 1], points[i])
      if (d < 0.5) continue
      x += d
    }
    xs.push(x)
    es.push(points[i].ele)
  }
  if (xs.length < 2 || x < 100) throw new Error('This GPX has too few points to ride.')

  // Fill missing elevation from neighbors (all missing: flat at 0).
  // One pass each way finds the nearest known elevation on both sides of every point.
  const nextKnown = new Int32Array(es.length).fill(-1)
  for (let i = es.length - 1, k = -1; i >= 0; i--) {
    if (es[i] !== null) k = i
    nextKnown[i] = k
  }
  const eFilled: number[] = new Array(es.length)
  for (let i = 0, prev = -1; i < es.length; i++) {
    const e = es[i]
    if (e !== null) {
      eFilled[i] = e
      prev = i
      continue
    }
    const next = nextKnown[i]
    if (prev < 0 && next < 0) eFilled[i] = 0
    else if (prev < 0) eFilled[i] = es[next] as number
    else if (next < 0) eFilled[i] = es[prev] as number
    else {
      const t = (xs[i] - xs[prev]) / (xs[next] - xs[prev])
      eFilled[i] = (es[prev] as number) + t * ((es[next] as number) - (es[prev] as number))
    }
  }

  // Resample on a fixed horizontal grid.
  const n = Math.floor(x / STEP_M) + 1
  const raw = new Float64Array(n)
  let j = 0
  for (let k = 0; k < n; k++) {
    const target = k * STEP_M
    while (j < xs.length - 2 && xs[j + 1] < target) j++
    const t = Math.min(1, Math.max(0, (target - xs[j]) / (xs[j + 1] - xs[j])))
    raw[k] = eFilled[j] + t * (eFilled[j + 1] - eFilled[j])
  }

  // Two passes of a 75 m moving average. One pass still leaves 1-3% grade
  // jitter from GPS noise; two passes (a triangular kernel) remove it.
  const ele = movingAverage(movingAverage(raw, SMOOTH_HALF_WINDOW), SMOOTH_HALF_WINDOW)

  // Clamp grades, then rebuild elevation so the profile matches the clamped grades.
  for (let k = 1; k < n; k++) {
    const g = (ele[k] - ele[k - 1]) / STEP_M
    if (Math.abs(g) > MAX_GRADE) ele[k] = ele[k - 1] + Math.sign(g) * MAX_GRADE * STEP_M
  }

  // Slope distance and climbing.
  const s = new Float64Array(n)
  let ascentM = 0
  for (let k = 1; k < n; k++) {
    const dh = ele[k] - ele[k - 1]
    s[k] = s[k - 1] + Math.hypot(STEP_M, dh)
    if (dh > 0) ascentM += dh
  }

  return { ...meta, lengthM: s[n - 1], ascentM, s, ele }
}

/** Index of the sample segment containing slope distance pos. */
function segmentAt(c: Course, pos: number): number {
  const p = Math.min(Math.max(pos, 0), c.lengthM)
  let lo = 0
  let hi = c.s.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (c.s[mid] <= p) lo = mid
    else hi = mid
  }
  return lo
}

const GRADE_BASELINE_M = 50

/**
 * Grade (rise / run) at a position along the course, measured over a 50 m
 * stretch centered on it so leftover GPS noise averages out. 0 past the finish.
 */
export function gradeAt(c: Course, pos: number): number {
  if (pos >= c.lengthM) return 0
  const a = Math.max(0, pos - GRADE_BASELINE_M / 2)
  const b = Math.min(c.lengthM, pos + GRADE_BASELINE_M / 2)
  const ds = b - a
  if (ds < 1) return 0
  const dh = elevationAt(c, b) - elevationAt(c, a)
  return dh / Math.sqrt(Math.max(1, ds * ds - dh * dh))
}

/** Elevation (m) at a position along the course. */
export function elevationAt(c: Course, pos: number): number {
  const i = segmentAt(c, pos)
  const span = c.s[i + 1] - c.s[i]
  const t = span > 0 ? Math.min(1, Math.max(0, (Math.min(pos, c.lengthM) - c.s[i]) / span)) : 0
  return c.ele[i] + t * (c.ele[i + 1] - c.ele[i])
}

/** Downsampled [slope distance, elevation] pairs for drawing. */
export function profilePoints(c: Course, max = 600): [number, number][] {
  const n = c.s.length
  const stride = Math.max(1, Math.floor(n / max))
  const out: [number, number][] = []
  for (let k = 0; k < n; k += stride) out.push([c.s[k], c.ele[k]])
  if (out[out.length - 1][0] !== c.s[n - 1]) out.push([c.s[n - 1], c.ele[n - 1]])
  return out
}
