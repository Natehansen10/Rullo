/**
 * Structured workouts: a list of steps, each a duration and a target.
 * Targets are % FTP (scale with the rider's FTP) or fixed watts.
 * Repeats nest one level. Everything is flattened into intervals before riding.
 */

export type Target = { pct: number } | { w: number }

export interface SteadyStep {
  type: 'steady'
  durS: number
  target: Target
  label?: string
  /** Cadence cue in rpm. Shown to the rider; never sent to the trainer. */
  cadenceRpm?: number
}

export interface RampStep {
  type: 'ramp'
  durS: number
  from: Target
  to: Target
  label?: string
  /** Cadence cue in rpm. Shown to the rider; never sent to the trainer. */
  cadenceRpm?: number
}

export interface RepeatStep {
  type: 'repeat'
  times: number
  steps: (SteadyStep | RampStep)[]
}

export type Step = SteadyStep | RampStep | RepeatStep

export interface RampTest {
  /** Best average over this many seconds; FTP estimate is 75% of it. */
  windowS: number
}

export interface Workout {
  id: string
  name: string
  description: string
  source: 'builtin' | 'imported' | 'custom'
  /** Short category shown in the picker, e.g. "easy". Set in public/workouts/index.json, or in the builder. */
  tag?: string
  steps: Step[]
  /**
   * Ramp FTP test. The first interval is the warm-up, the last is the
   * cool-down; everything between is the ramp. Failing (ERG low-cadence
   * release) or ending the test jumps to the cool-down.
   */
  rampTest?: RampTest
  /** Only listed with the fake trainer, for testing. */
  fakeOnly?: boolean
  /** Custom workouts: when the saved copy last changed. The builder uses it to notice an edit in another tab. */
  updatedAt?: number
}

/** One flattened interval. A steady interval has from === to. */
export interface Interval {
  index: number
  startS: number
  durS: number
  from: Target
  to: Target
  label: string
  /** Cadence cue in rpm, if the step has one. */
  cadenceRpm?: number
}

export const RAMP_TEST_FTP_SHARE = 0.75
/** Sanity limits for imported targets. ERG clamps what is sent anyway; these catch broken files. */
export const MAX_TARGET_PCT = 500
export const MAX_TARGET_W = 2500
export const MAX_INTERVALS = 2000
export const MAX_WORKOUT_S = 6 * 3600
/** Cadence cues outside this range are dropped on import and refused in the builder. */
export const MIN_CADENCE_RPM = 30
export const MAX_CADENCE_RPM = 200

/** A cadence cue from outside (a file, a stored row): a whole rpm in range, or none. */
export function cleanCadence(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  const rpm = Math.round(v)
  return rpm >= MIN_CADENCE_RPM && rpm <= MAX_CADENCE_RPM ? rpm : undefined
}

/**
 * Intervals a step list flattens into, counted without expanding it, so a
 * huge repeat count can be refused before flatten() tries to build it.
 */
export function countIntervals(steps: Step[]): number {
  let n = 0
  for (const s of steps) n += s.type === 'repeat' ? Math.max(0, s.times) * s.steps.length : 1
  return n
}

export function flatten(w: Workout): Interval[] {
  const out: Interval[] = []
  let t = 0
  const push = (s: SteadyStep | RampStep) => {
    const from = s.type === 'steady' ? s.target : s.from
    const to = s.type === 'steady' ? s.target : s.to
    out.push({
      index: out.length,
      startS: t,
      durS: s.durS,
      from,
      to,
      label: s.label ?? '',
      ...(s.cadenceRpm !== undefined ? { cadenceRpm: s.cadenceRpm } : {}),
    })
    t += s.durS
  }
  for (const s of w.steps) {
    if (s.type === 'repeat') for (let i = 0; i < s.times; i++) s.steps.forEach(push)
    else push(s)
  }
  return out
}

export function totalS(intervals: Interval[]): number {
  const last = intervals[intervals.length - 1]
  return last ? last.startS + last.durS : 0
}

export function targetWatts(t: Target, ftpW: number): number {
  return 'w' in t ? t.w : (t.pct / 100) * ftpW
}

export function targetPct(t: Target, ftpW: number): number {
  return 'pct' in t ? t.pct : (t.w / ftpW) * 100
}

/** Interval index at a time into the workout. Past the end: the last interval. */
export function indexAt(intervals: Interval[], tS: number): number {
  for (let i = intervals.length - 1; i >= 0; i--) if (tS >= intervals[i].startS) return i
  return 0
}

/** Target watts at a time into the workout, before intensity. Ramps are linear. */
export function wattsAt(intervals: Interval[], tS: number, ftpW: number): number {
  if (intervals.length === 0) return 0
  const iv = intervals[indexAt(intervals, tS)]
  const f = Math.min(1, Math.max(0, (tS - iv.startS) / iv.durS))
  const a = targetWatts(iv.from, ftpW)
  const b = targetWatts(iv.to, ftpW)
  return a + (b - a) * f
}

/** Power zone 1 to 7 for a % FTP (Coggan levels). */
export function zoneOf(pct: number): number {
  if (pct <= 55) return 1
  if (pct <= 75) return 2
  if (pct <= 90) return 3
  if (pct <= 105) return 4
  if (pct <= 120) return 5
  if (pct <= 150) return 6
  return 7
}

export function formatDuration(s: number): string {
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** Throws with a rider-facing message if the workout can't be ridden. */
export function validateWorkout(w: Workout): void {
  // Counted first: a repeat of a billion must not be expanded to find out it is too long.
  if (!(countIntervals(w.steps) <= MAX_INTERVALS)) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
  const intervals = flatten(w)
  if (intervals.length === 0) throw new Error('The workout has no steps.')
  if (intervals.length > MAX_INTERVALS) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
  for (const iv of intervals) {
    if (!(iv.durS > 0) || !Number.isFinite(iv.durS)) throw new Error('A step has no duration.')
    for (const t of [iv.from, iv.to]) {
      const v = 'pct' in t ? t.pct : t.w
      if (!Number.isFinite(v) || v < 0 || v > ('pct' in t ? MAX_TARGET_PCT : MAX_TARGET_W)) throw new Error('A step has a bad target.')
    }
  }
  if (totalS(intervals) > MAX_WORKOUT_S) throw new Error('The workout is longer than 6 hours.')
}
