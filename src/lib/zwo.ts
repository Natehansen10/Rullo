/**
 * ZWO workout import (the XML format Zwift and many workout sites use).
 * Powers in a ZWO file are fractions of FTP; durations are seconds.
 * Supported: Warmup, Cooldown, Ramp, SteadyState, IntervalsT, FreeRide, MaxEffort.
 * Written from the format as seen in public ZWO files. No code copied.
 */
import type { RampStep, SteadyStep, Step, Workout } from './workout'

const FREE_RIDE_PCT = 50
const MAX_EFFORT_PCT = 150

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
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not valid XML.')
  const root = doc.getElementsByTagName('workout_file')[0]
  const body = root?.getElementsByTagName('workout')[0]
  if (!body) throw new Error('No <workout> found. Is this a ZWO file?')

  const steps: Step[] = []
  let skipped = 0
  for (const el of Array.from(body.children)) {
    const tag = el.tagName.toLowerCase()
    const dur = num(el, 'Duration')
    if (tag === 'steadystate' && dur) {
      const p = num(el, 'Power', 'PowerLow')
      if (p === null) skipped++
      else steps.push({ type: 'steady', durS: dur, target: { pct: pct(p) } })
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
      steps.push({ type: 'repeat', times: Math.max(1, Math.round(times)), steps: inner })
    } else if (tag === 'freeride' && dur) {
      steps.push({ type: 'steady', durS: dur, target: { pct: FREE_RIDE_PCT }, label: 'Free ride' })
    } else if (tag === 'maxeffort' && dur) {
      steps.push({ type: 'steady', durS: dur, target: { pct: MAX_EFFORT_PCT }, label: 'Max effort' })
    } else if (tag !== 'textevent') {
      skipped++
    }
  }
  if (steps.length === 0) throw new Error('No steps this app can ride were found in the file.')
  if (skipped > 0) console.warn(`ZWO import: skipped ${skipped} unsupported step(s).`)

  const text1 = (tag: string) => root.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
  return { name: text1('name'), description: text1('description'), steps }
}

export function workoutFromZwo(
  text: string,
  id: string,
  fallbackName: string,
  source: Workout['source'] = 'imported',
): Workout {
  const z = parseZwo(text)
  return { id, name: z.name || fallbackName, description: z.description, source, steps: z.steps }
}
