/**
 * Training over time for the Home tab: the rider's saved rides, one bucket per
 * local calendar day. Nothing is stored; it is worked out from the ride
 * summaries Home already has.
 *
 * A day is the rider's own calendar day. Days are made with the Date
 * constructor (year, month, day), never by adding 24 hours, so the day the
 * clocks change (23 or 25 hours long) is still one day.
 */
import type { RideSummary } from './history'

/** How far back the chart goes: 6 weeks, today included. */
export const TRAINING_DAYS = 42
/** The days the summary line counts: today and the 6 before it. */
export const RECENT_DAYS = 7
/** The top of the chart is never under an hour, so one short ride is not drawn as a big day. */
const MIN_SCALE_MS = 60 * 60 * 1000
/** The top moves in half hours. */
const SCALE_STEP_MS = 30 * 60 * 1000

export interface DayTotals {
  rides: number
  /** Moving time of the rides that started in it. */
  movingMs: number
  distanceM: number
  /** Null when one of the rides has no work saved yet (see RideSummary.workJ). */
  workJ: number | null
}

export interface TrainingDay extends DayTotals {
  /** Local midnight at the start of the day, ms since epoch. */
  start: number
  /** "2026-11-24", from the local date. */
  key: string
  today: boolean
  /** A Monday: a week starts here. */
  weekStart: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar day a moment falls on, as "2026-11-24". */
export function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight at the start of the day `t` falls on. */
export function dayStart(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Local midnight `n` calendar days after the day `t` falls on (before, when negative). */
export function addDays(t: number, n: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime()
}

/**
 * The last `days` calendar days, oldest first, ending on the day `now` falls
 * on. A ride counts on the day it started, also when it ran past midnight.
 */
export function trainingDays(rides: RideSummary[], now: number, days = TRAINING_DAYS): TrainingDay[] {
  const out: TrainingDay[] = []
  const at = new Map<string, TrainingDay>()
  for (let i = days - 1; i >= 0; i--) {
    const start = addDays(now, -i)
    const day: TrainingDay = {
      start,
      key: dayKey(start),
      rides: 0,
      movingMs: 0,
      distanceM: 0,
      workJ: 0,
      today: i === 0,
      weekStart: new Date(start).getDay() === 1,
    }
    out.push(day)
    at.set(day.key, day)
  }
  for (const r of rides) {
    const day = at.get(dayKey(r.startedAt))
    if (!day) continue
    day.rides++
    day.movingMs += r.movingMs
    day.distanceM += r.distanceM
    day.workJ = day.workJ === null || r.workJ === undefined ? null : day.workJ + r.workJ
  }
  return out
}

/** Rides, time, distance and work over a run of days. */
export function sumDays(days: DayTotals[]): DayTotals {
  const t: DayTotals = { rides: 0, movingMs: 0, distanceM: 0, workJ: 0 }
  for (const d of days) {
    t.rides += d.rides
    t.movingMs += d.movingMs
    t.distanceM += d.distanceM
    t.workJ = t.workJ === null || d.workJ === null ? null : t.workJ + d.workJ
  }
  return t
}

/** The moving time at the top of the chart: the longest day, rounded up to a half hour, and at least an hour. */
export function scaleMs(days: DayTotals[]): number {
  let max = 0
  for (const d of days) max = Math.max(max, d.movingMs)
  return Math.max(MIN_SCALE_MS, Math.ceil(max / SCALE_STEP_MS) * SCALE_STEP_MS)
}
