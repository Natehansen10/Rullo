/**
 * Minimal FIT activity file writer (Garmin FIT protocol 2.0).
 * Messages: file_id, event (timer start), record x N with a lap after each
 * workout interval and a timer stop / start pair around each pause or dropout,
 * event (timer stop), last lap, session, activity. total_timer_time leaves the
 * pauses out; total_elapsed_time covers the whole ride. Sport cycling; sub-sport indoor cycling for a free
 * ride, virtual activity (Strava: Virtual Ride) for a course ride, which also
 * gets altitude on every record and total ascent.
 * A ride with a heart rate sensor also gets heart_rate on each record that
 * had a fresh reading (the invalid value on the others) and average and max
 * heart rate on every lap and the session. Without a sensor none of those
 * fields are defined, so the file is what it was before heart rate existed.
 * Every lap and the session carry total_work (J) and total_calories (kcal),
 * worked out from recorded power: each record is one second at its power, and
 * 1 kJ of work counts as 1 kcal, the usual cycling convention (a rider is
 * about 24% efficient, and 1 kcal is 4.184 kJ, so the two nearly cancel).
 * Paused time and dropouts have no records, so they add nothing.
 * Field numbers are from the FIT profile (Garmin FIT SDK, Profile.xlsx).
 * Written from the FIT protocol docs. Structure informed by GPX Rider fit.mjs (MIT).
 * No code copied.
 */
import { MAX_SAMPLE_GAP_MS } from '../config'
import type { SampleRow } from './recorder'

const FIT_EPOCH_OFFSET_S = 631065600 // 1989-12-31T00:00:00Z

const ENUM = 0x00
const UINT8 = 0x02
const UINT16 = 0x84
const UINT32 = 0x86
const UINT32Z = 0x8c

const SIZE: Record<number, number> = { [ENUM]: 1, [UINT8]: 1, [UINT16]: 2, [UINT32]: 4, [UINT32Z]: 4 }

const MESG_FILE_ID = 0
const MESG_SESSION = 18
const MESG_LAP = 19
const MESG_RECORD = 20
const MESG_EVENT = 21
const MESG_ACTIVITY = 34

const SPORT_CYCLING = 2
const SUB_SPORT_INDOOR_CYCLING = 6
const SUB_SPORT_VIRTUAL_ACTIVITY = 58
const EVENT_TIMER = 0
const EVENT_SESSION = 8
const EVENT_LAP = 9
const EVENT_ACTIVITY = 26
const EVENT_TYPE_START = 0
const EVENT_TYPE_STOP = 1
const EVENT_TYPE_STOP_ALL = 4
const FILE_TYPE_ACTIVITY = 4
const MANUFACTURER_DEVELOPMENT = 255

type Field = [num: number, baseType: number]

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401,
  0x5000, 0x9c01, 0x8801, 0x4400,
]

function crc16(bytes: ArrayLike<number>, start = 0, end = bytes.length): number {
  let crc = 0
  for (let i = start; i < end; i++) {
    const b = bytes[i]
    let tmp = CRC_TABLE[crc & 0xf]
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[b & 0xf]
    tmp = CRC_TABLE[crc & 0xf]
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf]
  }
  return crc
}

class FitWriter {
  private out: number[] = []
  private defs = new Map<number, Field[]>()

  define(local: number, global: number, fields: Field[]): void {
    this.defs.set(local, fields)
    this.out.push(0x40 | local, 0, 0) // header, reserved, little-endian
    this.out.push(global & 0xff, (global >> 8) & 0xff, fields.length)
    for (const [num, type] of fields) this.out.push(num, SIZE[type], type)
  }

  /** A null value is written as the type's invalid value (all bits set): the field is absent for this message. */
  write(local: number, values: (number | null)[]): void {
    const fields = this.defs.get(local)
    if (!fields || fields.length !== values.length) throw new Error(`Bad FIT message ${local}`)
    this.out.push(local)
    fields.forEach(([, type], i) => {
      const size = SIZE[type]
      const value = values[i]
      const v = value === null ? 2 ** (8 * size) - 1 : Math.max(0, Math.round(value))
      for (let b = 0; b < size; b++) this.out.push(Math.floor(v / 2 ** (8 * b)) & 0xff)
    })
  }

  finish(): Uint8Array {
    const dataSize = this.out.length
    const header = [14, 0x20, 0x54, 0x08, ...le32(dataSize), 0x2e, 0x46, 0x49, 0x54] // ".FIT", profile 21.32
    const hcrc = crc16(header)
    const file = new Uint8Array(14 + dataSize + 2)
    file.set(header, 0)
    file[12] = hcrc & 0xff
    file[13] = hcrc >> 8
    file.set(this.out, 14)
    const crc = crc16(file, 0, 14 + dataSize)
    file[14 + dataSize] = crc & 0xff
    file[15 + dataSize] = crc >> 8
    return file
  }
}

function le32(v: number): number[] {
  return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
}

const fitTime = (ms: number) => Math.round(ms / 1000) - FIT_EPOCH_OFFSET_S

interface Totals {
  startT: number
  endT: number
  /** Time of the last sample in the run. */
  lastT: number
  elapsedMs: number
  timerMs: number
  distanceM: number
  maxSpeed: number
  avgCadence: number
  maxCadence: number
  avgPower: number
  maxPower: number
  ascentM: number
  /** Work in joules: every sample is one second at its power. */
  workJ: number
  /** Over the samples that have a heart rate. Null when none do. */
  avgHeartRate: number | null
  maxHeartRate: number | null
}

/** The timer was stopped between these two samples: an auto-pause, or a dropout longer than MAX_SAMPLE_GAP_MS. */
export function stoppedBetween(a: SampleRow, b: SampleRow): boolean {
  return (b.pausedMs ?? 0) > (a.pausedMs ?? 0) || b.t - a.t > MAX_SAMPLE_GAP_MS
}

/**
 * Totals for a run of samples. Each sample counts for the time until the next
 * sample (the next run's first sample for a lap), or 1 s for the last one and
 * for the one before a pause. Paused time adds elapsed time but no timer time.
 * So laps add up exactly to the session.
 */
function totals(run: SampleRow[], next: SampleRow | undefined, startDistanceM: number, prevAltM: number | undefined): Totals {
  let timerMs = 0
  let maxPower = 0
  let maxCadence = 0
  let maxSpeed = 0
  let powerSum = 0
  let cadenceSum = 0
  let cadenceCount = 0
  let ascentM = 0
  let workJ = 0
  let hrSum = 0
  let hrCount = 0
  let maxHr = 0
  let alt = prevAltM
  run.forEach((s, i) => {
    const after = run[i + 1] ?? next
    timerMs += after && !stoppedBetween(s, after) ? after.t - s.t : 1000
    powerSum += s.powerW
    workJ += Math.max(0, Math.round(s.powerW))
    maxPower = Math.max(maxPower, s.powerW)
    maxCadence = Math.max(maxCadence, s.cadenceRpm)
    maxSpeed = Math.max(maxSpeed, s.speedMps)
    if (s.cadenceRpm > 0) {
      cadenceSum += s.cadenceRpm
      cadenceCount++
    }
    if (s.heartRateBpm !== undefined) {
      hrSum += s.heartRateBpm
      hrCount++
      maxHr = Math.max(maxHr, s.heartRateBpm)
    }
    if (s.altitudeM !== undefined) {
      if (alt !== undefined && s.altitudeM > alt) ascentM += s.altitudeM - alt
      alt = s.altitudeM
    }
  })
  const first = run[0]
  const last = run[run.length - 1]
  const endT = next ? next.t : last.t + 1000
  return {
    startT: first.t,
    endT,
    lastT: last.t,
    elapsedMs: endT - first.t,
    timerMs: Math.max(1000, timerMs),
    // In whole centimeters, as the file stores it, so lap distances add up exactly to the session's.
    distanceM: Math.max(0, Math.round(last.distanceM * 100) - Math.round(startDistanceM * 100)) / 100,
    maxSpeed,
    avgCadence: cadenceCount ? cadenceSum / cadenceCount : 0,
    maxCadence,
    avgPower: powerSum / run.length,
    maxPower,
    ascentM,
    workJ,
    avgHeartRate: hrCount ? hrSum / hrCount : null,
    maxHeartRate: hrCount ? maxHr : null,
  }
}

/** A whole ride's numbers, as the FIT session message carries them. */
export interface RideTotals {
  /** Time of the first sample: the FIT file's start. */
  startT: number
  /** Moving time: the timer, pauses and dropouts left out. */
  timerMs: number
  distanceM: number
  avgPowerW: number
  ascentM: number
}

/**
 * The totals buildFit writes into the session message, from the same code,
 * so a ride listed in the app and its FIT file can't disagree.
 */
export function rideTotals(samples: SampleRow[]): RideTotals {
  if (samples.length === 0) throw new Error('No samples')
  const t = totals(samples, undefined, 0, undefined)
  return { startT: t.startT, timerMs: t.timerMs, distanceM: t.distanceM, avgPowerW: t.avgPower, ascentM: t.ascentM }
}

/** Contiguous runs of samples with the same lap (interval) number. No lap numbers: one run. */
function splitLaps(samples: SampleRow[]): SampleRow[][] {
  const runs: SampleRow[][] = []
  for (const s of samples) {
    const cur = runs[runs.length - 1]
    if (cur && cur[cur.length - 1].lap === s.lap) cur.push(s)
    else runs.push([s])
  }
  return runs
}

export function buildFit(samples: SampleRow[]): Uint8Array {
  if (samples.length === 0) throw new Error('No samples to export')
  const first = samples[0]
  const last = samples[samples.length - 1]

  const onCourse = samples.some((s) => s.altitudeM !== undefined)
  /** Heart rate fields are defined only when the ride has any, so a ride without a sensor is unchanged. */
  const hasHr = samples.some((s) => s.heartRateBpm !== undefined)
  const hr = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.min(254, v))
  const subSport = onCourse ? SUB_SPORT_VIRTUAL_ACTIVITY : SUB_SPORT_INDOOR_CYCLING
  const all = totals(samples, undefined, 0, undefined)
  const avgSpeed = (t: Totals) => t.distanceM / (t.timerMs / 1000)

  const w = new FitWriter()

  w.define(0, MESG_FILE_ID, [
    [0, ENUM],
    [1, UINT16],
    [2, UINT16],
    [3, UINT32Z],
    [4, UINT32],
  ])
  w.write(0, [FILE_TYPE_ACTIVITY, MANUFACTURER_DEVELOPMENT, 0, fitTime(first.t) || 1, fitTime(first.t)])

  w.define(1, MESG_EVENT, [
    [253, UINT32],
    [0, ENUM],
    [1, ENUM],
  ])
  w.write(1, [fitTime(first.t), EVENT_TIMER, EVENT_TYPE_START])

  const recordFields: Field[] = [
    [253, UINT32],
    [7, UINT16], // power, W
    [4, UINT8], // cadence, rpm
    [6, UINT16], // speed, m/s * 1000
    [5, UINT32], // distance, m * 100
  ]
  if (onCourse) recordFields.push([2, UINT16]) // altitude, (m + 500) * 5
  if (hasHr) recordFields.push([3, UINT8]) // heart_rate, bpm
  w.define(2, MESG_RECORD, recordFields)

  const lapFields: Field[] = [
    [254, UINT16], // message_index
    [253, UINT32], // timestamp
    [0, ENUM], // event
    [1, ENUM], // event_type
    [2, UINT32], // start_time
    [7, UINT32], // total_elapsed_time, s * 1000
    [8, UINT32], // total_timer_time, s * 1000
    [9, UINT32], // total_distance, m * 100
    [13, UINT16], // avg_speed
    [14, UINT16], // max_speed
    [17, UINT8], // avg_cadence
    [18, UINT8], // max_cadence
    [19, UINT16], // avg_power
    [20, UINT16], // max_power
    [21, UINT16], // total_ascent, m
    [25, ENUM], // sport
    [39, ENUM], // sub_sport
    [41, UINT32], // total_work, J
    [11, UINT16], // total_calories, kcal
  ]
  if (hasHr) lapFields.push([15, UINT8], [16, UINT8]) // avg_heart_rate, max_heart_rate
  w.define(3, MESG_LAP, lapFields)
  // Calories are rounded on the running total, so the laps add up exactly to the session's whole number.
  const kcal = (joules: number) => Math.round(joules / 1000)
  let workSoFarJ = 0
  const writeLap = (index: number, t: Totals) => {
    const calories = kcal(workSoFarJ + t.workJ) - kcal(workSoFarJ)
    workSoFarJ += t.workJ
    w.write(3, [
      index,
      fitTime(t.lastT),
      EVENT_LAP,
      EVENT_TYPE_STOP,
      fitTime(t.startT),
      t.elapsedMs,
      t.timerMs,
      t.distanceM * 100,
      avgSpeed(t) * 1000,
      t.maxSpeed * 1000,
      Math.min(254, t.avgCadence),
      Math.min(254, t.maxCadence),
      t.avgPower,
      t.maxPower,
      t.ascentM,
      SPORT_CYCLING,
      subSport,
      t.workJ,
      calories,
      ...(hasHr ? [hr(t.avgHeartRate), hr(t.maxHeartRate)] : []),
    ])
  }

  // Records, with each finished lap written right after its records.
  // Laps on a workout ride are its intervals; otherwise the whole ride is one lap.
  const runs = splitLaps(samples)
  let lastWritten = -1
  let prev: SampleRow | undefined
  let lastAlt = samples.find((s) => s.altitudeM !== undefined)?.altitudeM ?? 0
  let lapStartDistance = 0
  let lapPrevAlt: number | undefined
  const finalLaps: Totals[] = []
  runs.forEach((run, i) => {
    for (const s of run) {
      const ts = fitTime(s.t)
      if (ts <= lastWritten) continue // one record per second
      lastWritten = ts
      if (prev && stoppedBetween(prev, s)) {
        w.write(1, [fitTime(prev.t), EVENT_TIMER, EVENT_TYPE_STOP_ALL])
        w.write(1, [ts, EVENT_TIMER, EVENT_TYPE_START])
      }
      prev = s
      const values: (number | null)[] = [ts, s.powerW, Math.min(254, s.cadenceRpm), s.speedMps * 1000, s.distanceM * 100]
      if (onCourse) {
        if (s.altitudeM !== undefined) lastAlt = s.altitudeM
        values.push((lastAlt + 500) * 5)
      }
      // No fresh reading this second: the invalid value, never the last one and never 0.
      if (hasHr) values.push(hr(s.heartRateBpm))
      w.write(2, values)
    }
    const lap = totals(run, runs[i + 1]?.[0], lapStartDistance, lapPrevAlt)
    lapStartDistance = run[run.length - 1].distanceM
    lapPrevAlt = [...run].reverse().find((s) => s.altitudeM !== undefined)?.altitudeM ?? lapPrevAlt
    if (i < runs.length - 1) writeLap(i, lap)
    else finalLaps.push(lap)
  })

  w.write(1, [fitTime(last.t), EVENT_TIMER, EVENT_TYPE_STOP_ALL])
  writeLap(runs.length - 1, finalLaps[0])

  const sessionFields: Field[] = [
    [254, UINT16], // message_index
    [253, UINT32], // timestamp
    [0, ENUM], // event
    [1, ENUM], // event_type
    [2, UINT32], // start_time
    [5, ENUM], // sport
    [6, ENUM], // sub_sport
    [7, UINT32], // total_elapsed_time
    [8, UINT32], // total_timer_time
    [9, UINT32], // total_distance
    [14, UINT16], // avg_speed
    [15, UINT16], // max_speed
    [18, UINT8], // avg_cadence
    [19, UINT8], // max_cadence
    [20, UINT16], // avg_power
    [21, UINT16], // max_power
    [22, UINT16], // total_ascent, m
    [25, UINT16], // first_lap_index
    [26, UINT16], // num_laps
    [48, UINT32], // total_work, J
    [11, UINT16], // total_calories, kcal
  ]
  if (hasHr) sessionFields.push([16, UINT8], [17, UINT8]) // avg_heart_rate, max_heart_rate
  w.define(4, MESG_SESSION, sessionFields)
  w.write(4, [
    0,
    fitTime(last.t),
    EVENT_SESSION,
    EVENT_TYPE_STOP,
    fitTime(first.t),
    SPORT_CYCLING,
    subSport,
    all.elapsedMs,
    all.timerMs,
    all.distanceM * 100,
    avgSpeed(all) * 1000,
    all.maxSpeed * 1000,
    Math.min(254, all.avgCadence),
    Math.min(254, all.maxCadence),
    all.avgPower,
    all.maxPower,
    all.ascentM,
    0,
    runs.length,
    all.workJ,
    kcal(all.workJ),
    ...(hasHr ? [hr(all.avgHeartRate), hr(all.maxHeartRate)] : []),
  ])

  const timerMs = all.timerMs
  const tzOffsetS = -new Date(last.t).getTimezoneOffset() * 60
  w.define(5, MESG_ACTIVITY, [
    [253, UINT32], // timestamp
    [0, UINT32], // total_timer_time
    [1, UINT16], // num_sessions
    [2, ENUM], // type: manual
    [3, ENUM], // event
    [4, ENUM], // event_type
    [5, UINT32], // local_timestamp
  ])
  w.write(5, [fitTime(last.t), timerMs, 1, 0, EVENT_ACTIVITY, EVENT_TYPE_STOP, fitTime(last.t) + tzOffsetS])

  return w.finish()
}

export function fitFileName(startedAt: number): string {
  const d = new Date(startedAt)
  const p = (n: number) => String(n).padStart(2, '0')
  return `weem-watts-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.fit`
}

export function downloadFit(samples: SampleRow[], startedAt: number): void {
  const bytes = buildFit(samples)
  const blob = new Blob([bytes], { type: 'application/vnd.ant.fit' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fitFileName(startedAt)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
