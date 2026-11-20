/**
 * Fake 1 Hz trainer for building without the bike. Enabled with ?fake=1.
 * The first 3 seconds send 0 W and 0 rpm (rider getting on), so the Ready state shows.
 * Press D to drop data for 5 seconds and test the stale / Reconnecting state.
 * Resistance changes power the way a harder gear would at the same cadence.
 * ERG holds the target. Press C to drop cadence to 40 rpm for 6 seconds
 * (tests the ERG low-cadence release).
 * Press J (or open with ?fake=1&jitter=1) for jittery delivery: readings come
 * 0.3 to 2.6 s apart, like a hidden tab or a trainer whose clock drifts
 * (tests that recording still saves one sample every second).
 */
import type { Trainer, TrainerHandlers } from './types'

const DROP_MS = 5000
const IDLE_MS = 3000
const LOW_CADENCE_MS = 6000
const TICK_MS = 1000
const JITTER_MIN_MS = 300
const JITTER_MAX_MS = 2600

export function isFakeMode(): boolean {
  return new URLSearchParams(window.location.search).get('fake') === '1'
}

export function createFakeTrainer(h: TrainerHandlers): Trainer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let jitter = new URLSearchParams(window.location.search).get('jitter') === '1'
  let dropUntil = 0
  let t0 = 0
  let resistancePct = 20
  let ergW: number | null = null
  let lowCadenceUntil = 0

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'd' || e.key === 'D') dropUntil = Date.now() + DROP_MS
    if (e.key === 'c' || e.key === 'C') lowCadenceUntil = Date.now() + LOW_CADENCE_MS
    if (e.key === 'j' || e.key === 'J') jitter = !jitter
  }

  const tick = () => {
    const now = Date.now()
    if (now < dropUntil) return
    if (now - t0 < IDLE_MS) {
      h.onReading({ t: now, powerW: 0, cadenceRpm: 0 })
      return
    }
    const s = (now - t0) / 1000
    const lowCadence = now < lowCadenceUntil
    const cadence = lowCadence ? 40 + (Math.random() - 0.5) * 2 : 88 + 4 * Math.sin(s / 13) + (Math.random() - 0.5) * 3
    const power =
      ergW !== null
        ? ergW + (Math.random() - 0.5) * 10
        : (110 + resistancePct * 4.5) * (cadence / 88) + 25 * Math.sin(s / 20) + (Math.random() - 0.5) * 30
    h.onReading({
      t: now,
      powerW: Math.round(power),
      cadenceRpm: Math.round(cadence * 2) / 2,
    })
  }

  /** Tick, then schedule the next one: every second, or unevenly when jittery. */
  const run = () => {
    tick()
    const delay = jitter ? JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS) : TICK_MS
    timer = setTimeout(run, delay)
  }

  return {
    async connect() {
      h.onStatus({ kind: 'connecting' })
      await new Promise((r) => setTimeout(r, 400))
      t0 = Date.now()
      dropUntil = 0
      ergW = null // a fresh connection starts without an ERG target, like a reset trainer
      window.addEventListener('keydown', onKey)
      if (timer) clearTimeout(timer)
      h.onStatus({ kind: 'connected', protocol: 'Fake' })
      run()
    },
    async setResistance(pct: number) {
      await new Promise((r) => setTimeout(r, 80))
      resistancePct = pct
      ergW = null
      return 'ok' as const
    },
    async setTargetPower(watts: number) {
      await new Promise((r) => setTimeout(r, 80))
      ergW = watts
      return 'ok' as const
    },
    disconnect() {
      if (timer) clearTimeout(timer)
      timer = null
      window.removeEventListener('keydown', onKey)
      h.onStatus({ kind: 'disconnected' })
    },
  }
}
