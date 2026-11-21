/**
 * Fake heart rate sensor for building without a strap or watch. Used with ?fake=1.
 * Heart rate follows effort with a lag, the way a real one does: it heads for
 * a value set by the power the rider is making and covers most of the gap in
 * about half a minute.
 *
 * Key:
 *   H  drop the heart rate for 8 seconds (the tile grays out; the ride carries on)
 */
import type { HeartRateHandlers, HeartRateSensor } from './heartRate'

const TICK_MS = 1000
const DROP_MS = 8000
const REST_BPM = 62
const BPM_PER_WATT = 0.42
const MAX_BPM = 188
/** Time constant of the lag, seconds. */
const LAG_S = 25

export function createFakeHeartRate(h: HeartRateHandlers, powerW: () => number): HeartRateSensor {
  let timer: ReturnType<typeof setInterval> | null = null
  let bpm = REST_BPM
  let dropUntil = 0
  let lastTick = 0

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    if (e.metaKey || e.ctrlKey || e.altKey || typing) return
    if (e.key.toLowerCase() === 'h') dropUntil = Date.now() + DROP_MS
  }

  const tick = () => {
    const now = Date.now()
    const dtS = lastTick ? Math.min(5, (now - lastTick) / 1000) : 1
    lastTick = now
    const want = Math.min(MAX_BPM, REST_BPM + Math.max(0, powerW()) * BPM_PER_WATT)
    bpm += (want - bpm) * (1 - Math.exp(-dtS / LAG_S))
    if (now < dropUntil) return
    h.onBpm(now, Math.round(bpm + (Math.random() - 0.5) * 2))
  }

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
    window.removeEventListener('keydown', onKey)
  }

  return {
    async connect() {
      stop()
      h.onStatus('connecting')
      await new Promise((r) => setTimeout(r, 400))
      dropUntil = 0
      lastTick = 0
      window.addEventListener('keydown', onKey)
      h.onStatus('connected')
      tick()
      timer = setInterval(tick, TICK_MS)
    },
    disconnect() {
      stop()
      h.onStatus('off')
    },
  }
}
