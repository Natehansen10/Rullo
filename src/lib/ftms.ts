/**
 * Fitness Machine Service (FTMS), Bluetooth SIG spec v1.0.
 * Written from the spec. Reference implementations consulted for the
 * Request Control, Reset, one-write-at-a-time pattern: GPX Rider trainer.mjs (MIT),
 * Croissant Ride ftms.ts (Apache-2.0), serpentine ftms.ts (MIT). No code copied.
 */
import { CONTROL_POINT_TIMEOUT_MS } from '../config'
import type { TrainerReading } from './types'

export const FTMS_SERVICE = 0x1826
export const INDOOR_BIKE_DATA = 0x2ad2
export const CONTROL_POINT = 0x2ad9
export const SUPPORTED_RESISTANCE_RANGE = 0x2ad6

export const OP_REQUEST_CONTROL = 0x00
export const OP_RESET = 0x01
export const OP_SET_TARGET_RESISTANCE = 0x04
export const OP_SET_TARGET_POWER = 0x05
const OP_RESPONSE = 0x80
const RESULT_SUCCESS = 0x01

/** Control point result codes (FTMS 4.16.2.22). */
export const RESULT_NOT_SUPPORTED = 0x02
export const RESULT_INVALID_PARAMETER = 0x03
export const RESULT_CONTROL_NOT_PERMITTED = 0x05

export interface ResistanceRange {
  min: number
  max: number
  increment: number
}

/** Used when the trainer has no readable range. */
export const DEFAULT_RESISTANCE_RANGE: ResistanceRange = { min: 0, max: 100, increment: 1 }

/** Supported Resistance Level Range (0x2AD6): min, max (sint16), increment (uint16), all 0.1 resolution. */
export function parseResistanceRange(view: DataView): ResistanceRange | null {
  if (view.byteLength < 6) return null
  const min = view.getInt16(0, true) / 10
  const max = view.getInt16(2, true) / 10
  const increment = view.getUint16(4, true) / 10
  if (!(max > min)) return null
  return { min, max, increment: increment > 0 ? increment : 0.1 }
}

/** Map 0 to 100% onto the trainer's range, snapped to its increment. */
export function percentToLevel(pct: number, r: ResistanceRange): number {
  const raw = r.min + (Math.min(100, Math.max(0, pct)) / 100) * (r.max - r.min)
  const snapped = r.min + Math.round((raw - r.min) / r.increment) * r.increment
  return Math.min(r.max, Math.max(r.min, snapped))
}

/** Parameter bytes for Set Target Power: sint16 watts, resolution 1 W. */
export function encodePower(watts: number): number[] {
  const v = Math.max(-32768, Math.min(32767, Math.round(watts))) & 0xffff
  return [v & 0xff, v >> 8]
}

/**
 * Parameter bytes for Set Target Resistance Level, in 0.1 units.
 * FTMS 1.0 text lists a uint8; many trainers take a sint16. ble.ts tries
 * sint16 first and falls back to uint8 if the trainer rejects the parameter.
 */
export function encodeResistance(level: number, format: 'sint16' | 'uint8'): number[] {
  const tenths = Math.round(level * 10)
  if (format === 'uint8') return [Math.min(255, Math.max(0, tenths))]
  const v = Math.max(-32768, Math.min(32767, tenths)) & 0xffff
  return [v & 0xff, v >> 8]
}

/**
 * Parse an Indoor Bike Data (0x2AD2) notification.
 * Fields follow the flags in spec order (FTMS 1.0, 4.9.1). Flag bit 0
 * ("More Data") is inverted: when it is 0, Instantaneous Speed IS present.
 * Trainers may split one reading across packets, so every field is optional.
 * Power is the trainer's own instantaneous power, sint16 watts, used as is.
 * A packet shorter than its flags claim yields the fields that fit.
 */
export function parseIndoorBikeData(view: DataView, t: number): TrainerReading {
  const out: TrainerReading = { t }
  if (view.byteLength < 2) return out
  const flags = view.getUint16(0, true)
  let o = 2
  const fits = (size: number) => o + size <= view.byteLength

  if ((flags & 0x0001) === 0) {
    if (!fits(2)) return out
    out.trainerSpeedKph = view.getUint16(o, true) / 100 // 0.01 km/h
    o += 2
  }
  if (flags & 0x0002) o += 2 // average speed
  if (flags & 0x0004) {
    if (!fits(2)) return out
    out.cadenceRpm = view.getUint16(o, true) / 2 // 0.5 rpm
    o += 2
  }
  if (flags & 0x0008) o += 2 // average cadence
  if (flags & 0x0010) o += 3 // total distance, uint24
  if (flags & 0x0020) o += 2 // resistance level
  if (flags & 0x0040) {
    if (!fits(2)) return out
    out.powerW = view.getInt16(o, true) // signed
    o += 2
  }
  // Remaining fields (average power, energy, heart rate, MET, elapsed, remaining) are unused.
  return out
}

export class ControlPointError extends Error {
  /** FTMS result code, or undefined for a timeout or write error. */
  readonly code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.code = code
  }
}

/**
 * Serializes writes to the FTMS Control Point. Each write waits for its
 * response indication (0x80, op code, result) before the next one goes out.
 */
export class FtmsControlPoint {
  private queue: Promise<unknown> = Promise.resolve()
  private pending: { op: number; resolve: (result: number) => void } | null = null
  private readonly char: BluetoothRemoteGATTCharacteristic
  private readonly onIndication = (e: Event) => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (!v || v.byteLength < 3 || v.getUint8(0) !== OP_RESPONSE) return
    const op = v.getUint8(1)
    if (this.pending && this.pending.op === op) {
      const p = this.pending
      this.pending = null
      p.resolve(v.getUint8(2))
    }
  }

  constructor(char: BluetoothRemoteGATTCharacteristic) {
    this.char = char
  }

  async start(): Promise<void> {
    this.char.addEventListener('characteristicvaluechanged', this.onIndication)
    await this.char.startNotifications()
  }

  stop(): void {
    this.char.removeEventListener('characteristicvaluechanged', this.onIndication)
    this.pending = null
  }

  /** Queue one op. Resolves when the trainer replies with success. */
  send(op: number, params: number[] = []): Promise<void> {
    const run = () =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = null
          reject(new ControlPointError(`No reply to op 0x${op.toString(16)}`))
        }, CONTROL_POINT_TIMEOUT_MS)
        this.pending = {
          op,
          resolve: (result) => {
            clearTimeout(timer)
            if (result === RESULT_SUCCESS) resolve()
            else reject(new ControlPointError(`Op 0x${op.toString(16)} failed, result ${result}`, result))
          },
        }
        this.char.writeValueWithResponse(new Uint8Array([op, ...params])).catch((err) => {
          clearTimeout(timer)
          this.pending = null
          reject(err)
        })
      })
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => undefined)
    return next
  }
}
