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

export const OP_REQUEST_CONTROL = 0x00
export const OP_RESET = 0x01
const OP_RESPONSE = 0x80
const RESULT_SUCCESS = 0x01

/**
 * Parse an Indoor Bike Data (0x2AD2) notification.
 * Flag bit 0 ("More Data") is inverted: when it is 0, Instantaneous Speed IS present.
 * Trainers may split one reading across packets, so every field is optional.
 */
export function parseIndoorBikeData(view: DataView, t: number): TrainerReading {
  const flags = view.getUint16(0, true)
  let o = 2
  const out: TrainerReading = { t }

  if ((flags & 0x0001) === 0) {
    out.trainerSpeedKph = view.getUint16(o, true) / 100 // 0.01 km/h
    o += 2
  }
  if (flags & 0x0002) o += 2 // average speed
  if (flags & 0x0004) {
    out.cadenceRpm = view.getUint16(o, true) / 2 // 0.5 rpm
    o += 2
  }
  if (flags & 0x0008) o += 2 // average cadence
  if (flags & 0x0010) o += 3 // total distance, uint24
  if (flags & 0x0020) o += 2 // resistance level
  if (flags & 0x0040) {
    out.powerW = view.getInt16(o, true) // signed
    o += 2
  }
  // Remaining fields (average power, energy, heart rate, MET, elapsed, remaining) are unused.
  return out
}

export class ControlPointError extends Error {}

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
            else reject(new ControlPointError(`Op 0x${op.toString(16)} failed, result ${result}`))
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
