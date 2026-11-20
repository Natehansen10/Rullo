/**
 * ZWO workout import (the XML format Zwift and many workout sites use).
 * Powers in a ZWO file are fractions of FTP; durations are seconds.
 * Supported: Warmup, Cooldown, Ramp, SteadyState, IntervalsT, FreeRide, MaxEffort.
 * Written from the format as seen in public ZWO files. No code copied.
 */
import type { RampStep, SteadyStep, Step, Workout } from './workout'

const FREE_RIDE_PCT = 50
const MAX_EFFORT_PCT = 150
/** Limits on a file from outside. A crafted file must not be able to hang or fill the page. */
export const MAX_ZWO_BYTES = 1024 * 1024
const MAX_INTERVALS = 2000
const MAX_NAME_CHARS = 80
const MAX_DESCRIPTION_CHARS = 400

function num(el: Element, ...names: string[]): number | null {
  for (const n of names) {
    const v = el.getAttribute(n)
    if (v !== null && v !== '') {
      const f = Number.parseFloat(v)
      if (Number.isFinite(f)) return f
    }
  }
  return null
}

const pct = (fraction: number) => Math.round(fraction * 1000) / 10

export interface ParsedZwo {
  name: string
  description: string
  steps: Step[]
}

export function parseZwo(text: string): ParsedZwo {
  if (text.length > MAX_ZWO_BYTES) throw new Error('The file is too large for a workout (limit 1 MB).')
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not valid XML.')
  const root = doc.getElementsByTagName('workout_file')[0]
  const body = root?.getElementsByTagName('workout')[0]
  if (!body) throw new Error('No <workout> found. Is this a ZWO file?')

  const steps: Step[] = []
  let skipped = 0
  let intervals = 0
  for (const el of Array.from(body.children)) {
    if (intervals > MAX_INTERVALS) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
    const tag = el.tagName.toLowerCase()
    const dur = num(el, 'Duration')
    if (tag === 'steadystate' && dur) {
      const p = num(el, 'Power', 'PowerLow')
      if (p === null) skipped++
      else {
        steps.push({ type: 'steady', durS: dur, target: { pct: pct(p) } })
        intervals++
      }
    } else if ((tag === 'warmup' || tag === 'cooldown' || tag === 'ramp') && dur) {
      let lo = num(el, 'PowerLow', 'Power')
      let hi = num(el, 'PowerHigh', 'Power')
      if (lo === null || hi === null) {
        skipped++
        continue
      }
      // Cool-downs go down; some files list the pair low-to-high anyway.
      if (tag === 'cooldown' && lo < hi) [lo, hi] = [hi, lo]
      const label = tag === 'warmup' ? 'Warm-up' : tag === 'cooldown' ? 'Cool-down' : undefined
      steps.push({ type: 'ramp', durS: dur, from: { pct: pct(lo) }, to: { pct: pct(hi) }, label })
      intervals++
    } else if (tag === 'intervalst') {
      const times = num(el, 'Repeat') ?? 1
      const onS = num(el, 'OnDuration')
      const offS = num(el, 'OffDuration')
      const on = num(el, 'OnPower', 'PowerOnHigh', 'PowerOnLow')
      const off = num(el, 'OffPower', 'PowerOffLow', 'PowerOffHigh')
      if (!onS || !offS || on === null || off === null) {
        skipped++
        continue
      }
      const inner: (SteadyStep | RampStep)[] = [
        { type: 'steady', durS: onS, target: { pct: pct(on) }, label: 'On' },
        { type: 'steady', durS: offS, target: { pct: pct(off) }, label: 'Off' },
      ]
      const reps = Math.max(1, Math.round(times))
      // Checked before anything is expanded: Repeat is the one attribute that multiplies.
      if (!(reps * 2 + intervals <= MAX_INTERVALS)) throw new Error(`The workout has more than ${MAX_INTERVALS} intervals.`)
      steps.push({ type: 'repeat', times: reps, steps: inner })
      intervals += reps * 2
    } else if (tag === 'freeride' && dur) {
      steps.push({ type: 'steady', durS: dur, target: { pct: FREE_RIDE_PCT }, label: 'Free ride' })
      intervals++
    } else if (tag === 'maxeffort' && dur) {
      steps.push({ type: 'steady', durS: dur, target: { pct: MAX_EFFORT_PCT }, label: 'Max effort' })
      intervals++
    } else if (tag !== 'textevent') {
      skipped++
    }
  }
  if (steps.length === 0) throw new Error('No steps this app can ride were found in the file.')
  if (skipped > 0) console.warn(`ZWO import: skipped ${skipped} unsupported step(s).`)

  const text1 = (tag: string, max: number) =>
    (root.getElementsByTagName(tag)[0]?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  return { name: text1('name', MAX_NAME_CHARS), description: text1('description', MAX_DESCRIPTION_CHARS), steps }
}

export function workoutFromZwo(
  text: string,
  id: string,
  fallbackName: string,
  source: Workout['source'] = 'imported',
): Workout {
  const z = parseZwo(text)
  return { id, name: z.name || fallbackName.slice(0, MAX_NAME_CHARS), description: z.description, source, steps: z.steps }
}
