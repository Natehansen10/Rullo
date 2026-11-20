/**
 * Cycling Power Service fallback (0x1818 / Measurement 0x2A63), Bluetooth SIG spec.
 * Written from the spec. Cadence comes from crank revolution data.
 */
import type { TrainerReading } from './types'

export const CYCLING_POWER_SERVICE = 0x1818
export const CYCLING_POWER_MEASUREMENT = 0x2a63

/** No new crank revolution for this long means the rider stopped pedaling. */
const CADENCE_ZERO_AFTER_MS = 2500

export class CyclingPowerParser {
  private lastRevs: number | null = null
  private lastEventTime: number | null = null
  private lastRevAt = 0
  private cadence = 0

  parse(view: DataView, t: number): TrainerReading {
    if (view.byteLength < 4) return { t }
    const flags = view.getUint16(0, true)
    const out: TrainerReading = { t, powerW: view.getInt16(2, true) }
    let o = 4
    if (flags & 0x0001) o += 1 // pedal power balance
    if (flags & 0x0004) o += 2 // accumulated torque
    if (flags & 0x0010) o += 6 // wheel revolution data
    if (flags & 0x0020 && o + 4 <= view.byteLength) {
      const revs = view.getUint16(o, true)
      const eventTime = view.getUint16(o + 2, true) // 1/1024 s
      out.cadenceRpm = this.updateCadence(revs, eventTime, t)
    }
    return out
  }

  private updateCadence(revs: number, eventTime: number, t: number): number {
    if (this.lastRevs !== null && this.lastEventTime !== null) {
      const dRevs = (revs - this.lastRevs + 0x10000) & 0xffff
      const dTicks = (eventTime - this.lastEventTime + 0x10000) & 0xffff
      if (dRevs > 0 && dTicks > 0) {
        this.cadence = (dRevs * 60 * 1024) / dTicks
        this.lastRevAt = t
      } else if (t - this.lastRevAt > CADENCE_ZERO_AFTER_MS) {
        this.cadence = 0
      }
    } else {
      this.lastRevAt = t
    }
    this.lastRevs = revs
    this.lastEventTime = eventTime
    return this.cadence
  }

  reset(): void {
    this.lastRevs = null
    this.lastEventTime = null
    this.cadence = 0
  }
}
