/**
 * Fake trainer for building without the bike. Enabled with ?fake=1.
 * The first 3 seconds send 0 W and 0 rpm (rider getting on), so the Ready state shows.
 * Resistance changes power the way a harder gear would at the same cadence.
 * ERG holds the target at any cadence above 0, like the real thing (so a
 * restart in ERG is heavy unless the app released it). Like a Kickr Core 2 is
 * reported to, it refuses a resistance level while the flywheel is stopped,
 * so the app's retry is exercised on every stop.
 *
 * Keys:
 *   D  drop data for 5 seconds (stale / Reconnecting state)
 *   C  drop cadence to 40 rpm for 6 seconds (ERG low-cadence release)
 *   S  stop pedaling until pressed again (auto-pause, ERG release, then a
 *      spin-up from 0 rpm so the soft re-engage shows in the power)
 *   J  jittery delivery, also ?fake=1&jitter=1: readings come 0.3 to 2.6 s
 *      apart, like a hidden tab or a trainer whose clock drifts (recording
 *      must still save one sample every second)
 */
import { ERG_RELEASE_W } from '../config'
import type { ControlResult, Trainer, TrainerHandlers } from './types'

const DROP_MS = 5000
const IDLE_MS = 3000
const LOW_CADENCE_MS = 6000
const TICK_MS = 1000
const JITTER_MIN_MS = 300
const JITTER_MAX_MS = 2600
/** How fast the fake rider spins up after a stop, rpm per second. */
const SPIN_UP_RPM_PER_S = 22

export function isFakeMode(): boolean {
  return new URLSearchParams(window.location.search).get('fake') === '1'
}

export function createFakeTrainer(h: TrainerHandlers): Trainer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let jitter = new URLSearchParams(window.location.search).get('jitter') === '1'
  let dropUntil = 0
  let t0 = 0
  let lastTick = 0
  let resistancePct = 20
  let ergW: number | null = null
  /** Simulation grade in %, or null when not in simulation. Climbs make the same cadence cost more. */
  let simGradePct: number | null = null
  let lowCadenceUntil = 0
  let stopped = false
  let cadence = 0

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (e.metaKey || e.ctrlKey || e.altKey || el?.tagName === 'INPUT') return
    const k = e.key.toLowerCase()
    if (k === 'd') dropUntil = Date.now() + DROP_MS
    if (k === 'c') lowCadenceUntil = Date.now() + LOW_CADENCE_MS
    if (k === 's') stopped = !stopped
    if (k === 'j') jitter = !jitter
  }

  const tick = () => {
    const now = Date.now()
    const dtS = lastTick ? (now - lastTick) / 1000 : 1
    lastTick = now
    const s = (now - t0) / 1000
    const idle = now - t0 < IDLE_MS
    // Cadence chases what the rider is doing. Stopping is quick; spinning up takes a few seconds.
    const want = stopped || idle ? 0 : now < lowCadenceUntil ? 40 : 88 + 4 * Math.sin(s / 13)
    cadence = want < cadence ? want : Math.min(want, cadence + SPIN_UP_RPM_PER_S * dtS)
    if (now < dropUntil) return
    if (cadence === 0) {
      h.onReading({ t: now, powerW: 0, cadenceRpm: 0 })
      return
    }
    const rpm = cadence + (Math.random() - 0.5) * (cadence > 60 ? 3 : 2)
    const power =
      ergW !== null
        ? ergW + (Math.random() - 0.5) * 10
        : (simGradePct !== null ? 130 + simGradePct * 40 : 110 + resistancePct * 4.5) * (rpm / 88) + (rpm / 88) * 25 * Math.sin(s / 20) + (Math.random() - 0.5) * 30 * (rpm / 88)
    h.onReading({
      t: now,
      powerW: Math.max(1, Math.round(power)),
      cadenceRpm: Math.round(rpm * 2) / 2,
    })
  }

  const setResistance = async (pct: number): Promise<ControlResult> => {
    await new Promise((r) => setTimeout(r, 80))
    if (cadence === 0) return 'failed'
    resistancePct = pct
    ergW = null
    simGradePct = null
    return 'ok'
  }

  const setTargetPower = async (watts: number): Promise<ControlResult> => {
    await new Promise((r) => setTimeout(r, 80))
    ergW = watts
    simGradePct = null
    return 'ok'
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
      lastTick = 0
      dropUntil = 0
      stopped = false
      cadence = 0
      simGradePct = null
      ergW = null // a fresh connection starts without an ERG target, like a reset trainer
      window.removeEventListener('keydown', onKey)
      window.addEventListener('keydown', onKey)
      if (timer) clearTimeout(timer)
      h.onStatus({ kind: 'connected', protocol: 'Fake' })
      run()
    },
    setResistance,
    setTargetPower,
    async setGrade(gradePct: number) {
      await new Promise((r) => setTimeout(r, 80))
      simGradePct = gradePct
      ergW = null
      return 'ok' as const
    },
    async release() {
      await setTargetPower(ERG_RELEASE_W)
      return setResistance(0)
    },
    disconnect() {
      if (timer) clearTimeout(timer)
      timer = null
      window.removeEventListener('keydown', onKey)
      h.onStatus({ kind: 'disconnected' })
    },
  }
}
