/**
 * Fake 1 Hz trainer for building without the bike. Enabled with ?fake=1.
 * The first 3 seconds send 0 W and 0 rpm (rider getting on), so the Ready state shows.
 * Press D to drop data for 5 seconds and test the stale / Reconnecting state.
 * Resistance changes power the way a harder gear would at the same cadence.
 */
import type { Trainer, TrainerHandlers } from './types'

const DROP_MS = 5000
const IDLE_MS = 3000

export function isFakeMode(): boolean {
  return new URLSearchParams(window.location.search).get('fake') === '1'
}

export function createFakeTrainer(h: TrainerHandlers): Trainer {
  let timer: ReturnType<typeof setInterval> | null = null
  let dropUntil = 0
  let t0 = 0
  let resistancePct = 20

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'd' || e.key === 'D') dropUntil = Date.now() + DROP_MS
  }

  const tick = () => {
    const now = Date.now()
    if (now < dropUntil) return
    if (now - t0 < IDLE_MS) {
      h.onReading({ t: now, powerW: 0, cadenceRpm: 0 })
      return
    }
    const s = (now - t0) / 1000
    const base = 110 + resistancePct * 4.5
    const power = base + 25 * Math.sin(s / 20) + (Math.random() - 0.5) * 30
    const cadence = 88 + 4 * Math.sin(s / 13) + (Math.random() - 0.5) * 3
    h.onReading({
      t: now,
      powerW: Math.round(power),
      cadenceRpm: Math.round(cadence * 2) / 2,
    })
  }

  return {
    async connect() {
      h.onStatus({ kind: 'connecting' })
      await new Promise((r) => setTimeout(r, 400))
      t0 = Date.now()
      dropUntil = 0
      window.addEventListener('keydown', onKey)
      if (timer) clearInterval(timer)
      timer = setInterval(tick, 1000)
      h.onStatus({ kind: 'connected', protocol: 'Fake' })
      tick()
    },
    async setResistance(pct: number) {
      await new Promise((r) => setTimeout(r, 80))
      resistancePct = pct
      return 'ok' as const
    },
    disconnect() {
      if (timer) clearInterval(timer)
      timer = null
      window.removeEventListener('keydown', onKey)
      h.onStatus({ kind: 'disconnected' })
    },
  }
}
