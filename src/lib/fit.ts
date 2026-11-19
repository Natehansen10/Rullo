/**
 * Minimal FIT activity file writer (Garmin FIT protocol 2.0).
 * Messages: file_id, event (timer start), record x N, event (timer stop),
 * lap, session, activity. Sport cycling, sub-sport indoor cycling.
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

  write(local: number, values: number[]): void {
    const fields = this.defs.get(local)
    if (!fields || fields.length !== values.length) throw new Error(`Bad FIT message ${local}`)
    this.out.push(local)
    fields.forEach(([, type], i) => {
      const size = SIZE[type]
      const v = Math.max(0, Math.round(values[i]))
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

export function buildFit(samples: SampleRow[]): Uint8Array {
  if (samples.length === 0) throw new Error('No samples to export')
  const first = samples[0]
  const last = samples[samples.length - 1]

  // Timer time counts only seconds with live data; reconnect gaps are excluded.
  let timerMs = 1000
  let maxPower = 0
  let maxCadence = 0
  let maxSpeed = 0
  let powerSum = 0
  let cadenceSum = 0
  let cadenceCount = 0
  samples.forEach((s, i) => {
    if (i > 0) {
      const dt = s.t - samples[i - 1].t
      if (dt <= MAX_SAMPLE_GAP_MS) timerMs += dt
    }
    powerSum += s.powerW
    maxPower = Math.max(maxPower, s.powerW)
    maxCadence = Math.max(maxCadence, s.cadenceRpm)
    maxSpeed = Math.max(maxSpeed, s.speedMps)
    if (s.cadenceRpm > 0) {
      cadenceSum += s.cadenceRpm
      cadenceCount++
    }
  })
  const elapsedMs = last.t - first.t + 1000
  const distanceM = last.distanceM
  const avgPower = powerSum / samples.length
  const avgCadence = cadenceCount ? cadenceSum / cadenceCount : 0
  const avgSpeed = distanceM / (timerMs / 1000)

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

  w.define(2, MESG_RECORD, [
    [253, UINT32],
    [7, UINT16], // power, W
    [4, UINT8], // cadence, rpm
    [6, UINT16], // speed, m/s * 1000
    [5, UINT32], // distance, m * 100
  ])
  let lastWritten = -1
  for (const s of samples) {
    const ts = fitTime(s.t)
    if (ts === lastWritten) continue // one record per second
    lastWritten = ts
    w.write(2, [ts, s.powerW, Math.min(254, s.cadenceRpm), s.speedMps * 1000, s.distanceM * 100])
  }

  w.write(1, [fitTime(last.t), EVENT_TIMER, EVENT_TYPE_STOP_ALL])

  w.define(3, MESG_LAP, [
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
    [25, ENUM], // sport
    [39, ENUM], // sub_sport
  ])
  w.write(3, [
    0,
    fitTime(last.t),
    EVENT_LAP,
    EVENT_TYPE_STOP,
    fitTime(first.t),
    elapsedMs,
    timerMs,
    distanceM * 100,
    avgSpeed * 1000,
    maxSpeed * 1000,
    Math.min(254, avgCadence),
    Math.min(254, maxCadence),
    avgPower,
    maxPower,
    SPORT_CYCLING,
    SUB_SPORT_INDOOR_CYCLING,
  ])

  w.define(4, MESG_SESSION, [
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
    [25, UINT16], // first_lap_index
    [26, UINT16], // num_laps
  ])
  w.write(4, [
    0,
    fitTime(last.t),
    EVENT_SESSION,
    EVENT_TYPE_STOP,
    fitTime(first.t),
    SPORT_CYCLING,
    SUB_SPORT_INDOOR_CYCLING,
    elapsedMs,
    timerMs,
    distanceM * 100,
    avgSpeed * 1000,
    maxSpeed * 1000,
    Math.min(254, avgCadence),
    Math.min(254, maxCadence),
    avgPower,
    maxPower,
    0,
    1,
  ])

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
