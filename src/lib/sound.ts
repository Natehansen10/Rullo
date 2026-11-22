/**
 * Interval sounds: three soft beeps in the last three seconds of a workout
 * interval and a longer tone when the next one starts. Off by default, set on
 * the Profile tab, per rider. Made with Web Audio: no files.
 *
 * `intervalCue` is the whole rule and has no sound in it. `playCue` makes the
 * sound, and does nothing when sounds are off or the browser has no audio.
 * A cue is only ever asked for from the workout clock, which stands still
 * while a ride is paused, so nothing sounds then.
 */
import { indexAt, totalS, type Interval } from './workout'

/** Count: one of the three beeps before a change. Change: the next interval has started. Done: the workout is over. */
export type Cue = 'count' | 'change' | 'done'

const KEY = 'ww.intervalSounds'
/** The beeps come at 3, 2 and 1 seconds left. */
const COUNT_FROM_S = 3
/** An interval shorter than this gets no countdown: the beeps would run into the last change. */
const MIN_COUNTED_S = 5
/** A step of the clock longer than this is a catch-up (a sleeping tab), not a second of riding: stay quiet. */
const MAX_STEP_S = 2.5

/**
 * The sound, if any, for the workout clock going from `prevS` to `nowS`
 * seconds. At most one per step, and a change always beats a count.
 */
export function intervalCue(intervals: Interval[], prevS: number, nowS: number): Cue | null {
  if (intervals.length === 0 || nowS <= prevS || nowS - prevS > MAX_STEP_S) return null
  const total = totalS(intervals)
  if (prevS >= total) return null
  if (nowS >= total) return 'done'
  const i = indexAt(intervals, nowS)
  if (i !== indexAt(intervals, prevS)) return 'change'
  const iv = intervals[i]
  if (iv.durS < MIN_COUNTED_S) return null
  const end = iv.startS + iv.durS
  // A beep each time the time left drops to 3, 2 or 1: the moment the countdown on screen shows that number.
  for (let k = COUNT_FROM_S; k >= 1; k--) if (end - prevS > k && end - nowS <= k) return 'count'
  return null
}

let on: boolean | null = null

export function soundsOn(): boolean {
  if (on === null) {
    try {
      on = localStorage.getItem(KEY) === '1'
    } catch {
      on = false
    }
  }
  return on
}

export function setSoundsOn(v: boolean): void {
  on = v
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    // storage unavailable: it still applies this session
  }
}

type Ctx = AudioContext
let ctx: Ctx | null = null

function audio(): Ctx | null {
  if (ctx) return ctx
  try {
    const Make = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ctx = Make ? new Make() : null
  } catch {
    ctx = null
  }
  return ctx
}

/** Pitch (Hz), length (s) and peak level of each sound. Sine waves at a low level: soft, and clear over a fan. */
const SHAPE: Record<Cue, { hz: number; s: number; level: number }> = {
  count: { hz: 660, s: 0.09, level: 0.12 },
  change: { hz: 880, s: 0.35, level: 0.14 },
  done: { hz: 880, s: 0.6, level: 0.14 },
}

function tone(c: Ctx, cue: Cue): void {
  const { hz, s, level } = SHAPE[cue]
  const t = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = hz
  // A short fade in and out, so the tone does not click.
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(level, t + 0.01)
  gain.gain.setValueAtTime(level, t + Math.max(0.01, s - 0.04))
  gain.gain.linearRampToValueAtTime(0, t + s)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + s + 0.02)
}

/** Play a cue. `force` plays it with sounds off: the sample on the Profile tab. Never throws. */
export function playCue(cue: Cue, force = false): void {
  if (!force && !soundsOn()) return
  try {
    const c = audio()
    if (!c) return
    // A browser holds audio until the page has had a click. Start and the setting itself are both clicks.
    if (c.state === 'suspended') void c.resume().then(() => tone(c, cue), () => undefined)
    else tone(c, cue)
  } catch {
    // no audio: the ride goes on without it
  }
}
