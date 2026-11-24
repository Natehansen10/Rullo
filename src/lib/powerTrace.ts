/**
 * The live power trace: the last few minutes of power, one slot a second,
 * for the line in the Power tile. In memory only. It is never saved, never
 * sent anywhere and never read by anything that talks to the trainer.
 *
 * A slot is one second of the trace. A second with no reading is an empty
 * slot (a gap in the line): a value is never held or made up to fill it.
 */
import { POWER_TRACE_FTP_SHARE, POWER_TRACE_HEADROOM, POWER_TRACE_SCALE_STEP_W, POWER_TRACE_WINDOW_S } from '../config'

export interface TraceSlot {
  /**
   * The power the tile showed at the end of this second, in whole watts: one
   * value per smoothing window, in the order of SMOOTHING_OPTIONS. Null when
   * no reading arrived in this second.
   */
  w: readonly number[] | null
  /** What was asked for in this second (the workout or ERG target), in watts. Null when nothing set a target. */
  targetW: number | null
}

/** What the snapshot carries. A new object only when the trace changed, so a chart can memoize on it. */
export interface PowerTraceLive {
  /** Goes up by one on every change. */
  version: number
  /** Oldest first, newest last. Never longer than POWER_TRACE_WINDOW_S. */
  slots: readonly TraceSlot[]
}

interface Slot extends TraceSlot {
  /** When this second began: the time of its first reading, or where the grid put it. */
  startT: number
  /** The time of its latest reading (startT for an empty slot). */
  lastT: number
}

/**
 * A reading this late still belongs to the next second. A trainer's clock
 * drifts against ours, so readings a little under or over a second apart must
 * neither double up nor leave a hole. PowerSmoother uses the same tolerance.
 */
const SLOT_TOLERANCE_MS = 250
const EMPTY: PowerTraceLive = { version: 0, slots: [] }

export class PowerTrace {
  private slots: Slot[] = []
  private version = 0
  private breakNext = false
  private cached: PowerTraceLive = EMPTY

  /**
   * One power reading. `watts` is what the tile shows for each smoothing
   * window after this reading. Readings in the same second share a slot (the
   * latest wins); a reading that comes late leaves an empty slot for every
   * second that had none.
   */
  push(t: number, watts: readonly number[], targetW: number | null): void {
    const last = this.slots[this.slots.length - 1]
    const filled = { w: watts, targetW, lastT: t }
    if (!last) {
      this.slots.push({ ...filled, startT: t })
    } else {
      // A break (the ride was paused) is one empty slot whatever time passed: a pause takes no width.
      const steps = this.breakNext ? 2 : Math.floor((t - last.startT + SLOT_TOLERANCE_MS) / 1000)
      if (steps <= 0) {
        Object.assign(last, filled)
      } else if (steps > POWER_TRACE_WINDOW_S) {
        // Everything on screen is older than the window.
        this.slots = [{ ...filled, startT: t }]
      } else {
        for (let k = 1; k < steps; k++) {
          const at = last.startT + k * 1000
          this.slots.push({ w: null, targetW: null, startT: at, lastT: at })
        }
        // On the one-second grid, or at the reading when it came later than that.
        this.slots.push({ ...filled, startT: this.breakNext ? t : Math.max(last.startT + steps * 1000, t) })
      }
    }
    this.breakNext = false
    if (this.slots.length > POWER_TRACE_WINDOW_S) this.slots.splice(0, this.slots.length - POWER_TRACE_WINDOW_S)
    this.version++
  }

  /**
   * Take back every second from `t` on. An auto-pause is backdated to the
   * rider's first still second, so the seconds drawn while it was pending
   * were not ridden.
   */
  dropFrom(t: number): void {
    let n = this.slots.length
    while (n > 0 && this.slots[n - 1].lastT >= t) n--
    // An empty slot is never the newest one.
    while (n > 0 && this.slots[n - 1].w === null) n--
    if (n === this.slots.length) return
    this.slots.length = n
    this.version++
  }

  /** The next reading starts a new stretch of line after one empty slot (the ride was paused in between). */
  breakLine(): void {
    if (this.slots.length > 0) this.breakNext = true
  }

  clear(): void {
    this.breakNext = false
    if (this.slots.length === 0) return
    this.slots = []
    this.version++
  }

  /** The trace for the snapshot. The same object until the trace changes. */
  view(): PowerTraceLive {
    if (this.cached.version !== this.version) {
      this.cached = { version: this.version, slots: this.slots.map(({ w, targetW }) => ({ w, targetW })) }
    }
    return this.cached
  }
}

/**
 * The top of the trace's scale, in watts. The bottom is always 0. It leaves
 * room above the rider's FTP and above the highest power or target in the
 * window, and moves only in steps of POWER_TRACE_SCALE_STEP_W, so the line
 * does not rescale every second.
 */
export function traceTopW(ftpW: number, peakW: number): number {
  const need = Math.max(ftpW * POWER_TRACE_FTP_SHARE, peakW * POWER_TRACE_HEADROOM, 1)
  return Math.ceil(need / POWER_TRACE_SCALE_STEP_W) * POWER_TRACE_SCALE_STEP_W
}
