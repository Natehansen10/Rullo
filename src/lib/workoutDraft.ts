/**
 * The workout builder's draft: the workout being built, as the text the rider
 * typed. Kept in localStorage on every change, so a reload or a tab switch
 * loses nothing. Turned into real steps (and checked) by checkDraft.
 */
import { cleanTag, MAX_DESCRIPTION_CHARS, MAX_LABEL_CHARS, MAX_NAME_CHARS, type CustomTag } from './customWorkouts'
import {
  countIntervals,
  MAX_CADENCE_RPM,
  MAX_INTERVALS,
  MAX_TARGET_PCT,
  MAX_TARGET_W,
  MAX_WORKOUT_S,
  MIN_CADENCE_RPM,
  validateWorkout,
  type RampStep,
  type SteadyStep,
  type Step,
  type Target,
  type Workout,
} from './workout'
import { ERG_RESUME_RPM } from '../config'

/** Step rows the editor will hold. Above this a workout is too long to edit by hand (and to render). */
export const MAX_EDITOR_ROWS = 500
const MAX_REPEAT_TIMES = 999
const MAX_FIELD_CHARS = 24
const DRAFT_KEY = 'ww.workoutDraft'

export interface DraftStep {
  uid: string
  kind: 'steady' | 'ramp'
  /** Duration as typed: "12", "12:00", "90s", "1h30". */
  dur: string
  /** Target as typed: "90" or "90%" is % FTP, "225w" is watts. A steady step uses `from` only. */
  from: string
  to: string
  /** Cadence cue in rpm, or empty for none. */
  cadence: string
  label: string
}

export interface DraftRepeat {
  uid: string
  kind: 'repeat'
  times: string
  steps: DraftStep[]
}

export type DraftItem = DraftStep | DraftRepeat
export type ReturnTo = 'workout' | 'profile'

export interface Draft {
  v: 1
  /** The custom workout being edited, or null for a new one (or a copy). */
  id: string | null
  /** updatedAt of the saved copy this edit started from. */
  baseUpdatedAt: number | null
  /** Id of the workout this draft was copied from, if any. */
  copyOf: string | null
  /** Where Cancel goes back to. */
  returnTo: ReturnTo
  name: string
  description: string
  tag: CustomTag
  items: DraftItem[]
  /** The rider changed something since the draft was opened. */
  dirty: boolean
}

// --- parsing and formatting the typed fields ---

/** "12" and "12m" are minutes, "12:00" is m:ss, "1:30:00" is h:mm:ss, "90s" is seconds, "1h30" is hours and minutes. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase()
  if (!t || t.length > MAX_FIELD_CHARS) return null
  let s: number | null = null
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(t)
  const plain = /^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins|h|hr|hrs)?$/.exec(t)
  const parts = /^(?:(\d+)\s*h(?:r|rs)?)?\s*(?:(\d+)\s*m(?:in|ins)?)?\s*(?:(\d+)\s*s(?:ec|ecs)?)?$/.exec(t)
  if (clock) {
    const [a, b, c] = [Number(clock[1]), Number(clock[2]), clock[3] === undefined ? null : Number(clock[3])]
    s = c === null ? a * 60 + b : a * 3600 + b * 60 + c
  } else if (plain) {
    const unit = plain[2]?.[0] ?? 'm'
    s = Number(plain[1]) * (unit === 's' ? 1 : unit === 'h' ? 3600 : 60)
  } else if (parts && (parts[1] || parts[2] || parts[3])) {
    s = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
  } else {
    // "1h30": a bare number after hours is minutes.
    const hm = /^(\d+)\s*h\s*(\d{1,2})$/.exec(t)
    if (hm) s = Number(hm[1]) * 3600 + Number(hm[2]) * 60
  }
  if (s === null || !Number.isFinite(s)) return null
  s = Math.round(s)
  return s >= 1 ? s : null
}

export function formatDurationField(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** "90" and "90%" are % FTP; "225w" is watts. */
export function parseTarget(text: string): Target | null {
  const m = /^(\d+(?:\.\d+)?)\s*(%|w|watt|watts)?$/i.exec(text.trim())
  if (!m || text.length > MAX_FIELD_CHARS) return null
  const v = Number(m[1])
  if (!Number.isFinite(v)) return null
  return m[2] && m[2] !== '%' ? { w: Math.round(v) } : { pct: Math.round(v * 10) / 10 }
}

export function formatTarget(t: Target): string {
  return 'w' in t ? `${t.w} W` : `${t.pct}%`
}

function targetInRange(t: Target): boolean {
  return 'w' in t ? t.w <= MAX_TARGET_W : t.pct <= MAX_TARGET_PCT
}

/** Empty is "no cue". Otherwise a whole rpm in range, or null for a bad value. */
export function parseCadence(text: string): number | undefined | null {
  const t = text.trim().toLowerCase().replace(/\s*rpm$/, '')
  if (!t) return undefined
  if (!/^\d{1,3}$/.test(t)) return null
  const v = Number(t)
  return v >= MIN_CADENCE_RPM && v <= MAX_CADENCE_RPM ? v : null
}

// --- building drafts ---

let uidCount = 0
const uid = () => `s${Date.now().toString(36)}${(uidCount++).toString(36)}`

export function newStep(kind: 'steady' | 'ramp' = 'steady'): DraftStep {
  return kind === 'ramp'
    ? { uid: uid(), kind, dur: '10:00', from: '50%', to: '75%', cadence: '', label: '' }
    : { uid: uid(), kind, dur: '5:00', from: '75%', to: '75%', cadence: '', label: '' }
}

export function newRepeat(): DraftRepeat {
  return {
    uid: uid(),
    kind: 'repeat',
    times: '3',
    steps: [
      { ...newStep(), dur: '5:00', from: '100%', to: '100%' },
      { ...newStep(), dur: '3:00', from: '50%', to: '50%' },
    ],
  }
}

/** A copy with fresh ids, so the copy and the original are separate rows. */
export function cloneItem<T extends DraftItem>(item: T): T {
  return item.kind === 'repeat'
    ? { ...item, uid: uid(), steps: item.steps.map((s) => ({ ...s, uid: uid() })) }
    : { ...item, uid: uid() }
}

export function newDraft(returnTo: ReturnTo): Draft {
  return { v: 1, id: null, baseUpdatedAt: null, copyOf: null, returnTo, name: '', description: '', tag: 'medium', items: [], dirty: false }
}

function stepToDraft(s: SteadyStep | RampStep): DraftStep {
  const from = s.type === 'steady' ? s.target : s.from
  const to = s.type === 'steady' ? s.target : s.to
  return {
    uid: uid(),
    kind: s.type,
    dur: formatDurationField(Math.round(s.durS)),
    from: formatTarget(from),
    to: formatTarget(to),
    cadence: s.cadenceRpm === undefined ? '' : String(s.cadenceRpm),
    label: s.label ?? '',
  }
}

export function rowCount(items: DraftItem[]): number {
  return items.reduce((n, it) => n + (it.kind === 'repeat' ? 1 + it.steps.length : 1), 0)
}

/**
 * A draft from a saved workout: `edit` changes that workout (custom ones
 * only), `copy` starts a new one from it. Throws if it is too long to edit.
 */
export function draftFromWorkout(w: Workout, mode: 'edit' | 'copy', returnTo: ReturnTo): Draft {
  const items: DraftItem[] = w.steps.map((s) =>
    s.type === 'repeat' ? { uid: uid(), kind: 'repeat', times: String(s.times), steps: s.steps.map(stepToDraft) } : stepToDraft(s),
  )
  if (rowCount(items) > MAX_EDITOR_ROWS) throw new Error(`${w.name} has more than ${MAX_EDITOR_ROWS} steps, too many to edit here.`)
  const edit = mode === 'edit' && w.source === 'custom'
  return {
    v: 1,
    id: edit ? w.id : null,
    baseUpdatedAt: edit ? (w.updatedAt ?? null) : null,
    copyOf: edit ? null : w.id,
    returnTo,
    name: (edit ? w.name : `${w.name} copy`).slice(0, MAX_NAME_CHARS),
    description: w.description,
    tag: cleanTag(w.tag),
    items,
    // A copy is new work the moment it exists; an untouched edit is not.
    dirty: !edit,
  }
}

// --- checking a draft ---

export interface DraftCheck {
  /** Every row that parsed, for the live preview. */
  steps: Step[]
  /** Field errors by `${uid}:${field}` (dur, from, to, cadence, times). */
  fields: Map<string, string>
  /** What stops a save, most important first. Empty when the draft can be saved. */
  errors: string[]
  /** Worth knowing, but not blocking. */
  warnings: string[]
}

const DUR_HELP = 'needs a value like 12, 12:00 or 90s'
const TARGET_HELP = `needs a value like 90 (% FTP, up to ${MAX_TARGET_PCT}) or 225w (up to ${MAX_TARGET_W} W)`

/** Parse every row. Rows with a bad field are left out of `steps` and reported. */
export function checkDraft(d: Draft): DraftCheck {
  const fields = new Map<string, string>()
  const errors: string[] = []
  const warnings: string[] = []

  const simple = (s: DraftStep, n: string): SteadyStep | RampStep | null => {
    let ok = true
    const fail = (field: string, message: string) => {
      fields.set(`${s.uid}:${field}`, message)
      errors.push(`Step ${n}: ${message}.`)
      ok = false
    }
    const durS = parseDuration(s.dur)
    if (durS === null) fail('dur', `time ${DUR_HELP}`)
    else if (durS > MAX_WORKOUT_S) fail('dur', 'time is longer than 6 hours')
    const target = (field: 'from' | 'to'): Target | null => {
      const t = parseTarget(s[field])
      if (t === null || !targetInRange(t)) {
        fail(field, `${s.kind === 'ramp' ? (field === 'from' ? 'start ' : 'end ') : ''}target ${TARGET_HELP}`)
        return null
      }
      return t
    }
    const from = target('from')
    const to = s.kind === 'ramp' ? target('to') : from
    const cadence = parseCadence(s.cadence)
    if (cadence === null) fail('cadence', `cadence needs a whole number from ${MIN_CADENCE_RPM} to ${MAX_CADENCE_RPM} rpm, or leave it empty`)
    else if (cadence !== undefined && cadence < ERG_RESUME_RPM) {
      warnings.push(`Step ${n}: under ${ERG_RESUME_RPM} rpm ERG may let go. It releases below 50 rpm and needs ${ERG_RESUME_RPM} rpm to come back.`)
    }
    if (!ok || durS === null || from === null || to === null) return null
    const label = s.label.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_CHARS)
    const extra = { ...(label ? { label } : {}), ...(typeof cadence === 'number' ? { cadenceRpm: cadence } : {}) }
    return s.kind === 'ramp' ? { type: 'ramp', durS, from, to, ...extra } : { type: 'steady', durS, target: from, ...extra }
  }

  const steps: Step[] = []
  d.items.forEach((it, i) => {
    const n = String(i + 1)
    if (it.kind !== 'repeat') {
      const s = simple(it, n)
      if (s) steps.push(s)
      return
    }
    const times = /^\d{1,4}$/.test(it.times.trim()) ? Number(it.times.trim()) : NaN
    const timesOk = Number.isInteger(times) && times >= 1 && times <= MAX_REPEAT_TIMES
    if (!timesOk) {
      fields.set(`${it.uid}:times`, 'bad count')
      errors.push(`Step ${n}: repeat needs a whole number of times, 1 to ${MAX_REPEAT_TIMES}.`)
    }
    const inner = it.steps.map((s, j) => simple(s, `${n}.${j + 1}`)).filter((s): s is SteadyStep | RampStep => s !== null)
    if (it.steps.length === 0) errors.push(`Step ${n}: the repeat has no steps. Add one or delete the repeat.`)
    if (timesOk && inner.length > 0) steps.push({ type: 'repeat', times, steps: inner })
  })

  // Whole-workout limits: the same ones an imported file meets.
  const top: string[] = []
  if (!d.name.trim()) top.push('Give the workout a name.')
  if (d.items.length === 0) top.push('Add at least one step.')
  if (errors.length === 0 && steps.length > 0) {
    if (countIntervals(steps) > MAX_INTERVALS) top.push(`The workout has more than ${MAX_INTERVALS} intervals.`)
    else {
      try {
        validateWorkout({ id: 'draft', name: d.name, description: '', source: 'custom', steps })
      } catch (err) {
        top.push(err instanceof Error ? err.message : 'The workout is not valid.')
      }
    }
  }
  // The preview must never expand a runaway repeat.
  const previewable = countIntervals(steps) <= MAX_INTERVALS
  return { steps: previewable ? steps : [], fields, errors: [...top, ...errors], warnings }
}

// --- persistence ---

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

function cleanDraftStep(v: unknown): DraftStep | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  if (r.kind !== 'steady' && r.kind !== 'ramp') return null
  return {
    uid: uid(),
    kind: r.kind,
    dur: text(r.dur, MAX_FIELD_CHARS),
    from: text(r.from, MAX_FIELD_CHARS),
    to: text(r.to, MAX_FIELD_CHARS),
    cadence: text(r.cadence, MAX_FIELD_CHARS),
    label: text(r.label, MAX_LABEL_CHARS),
  }
}

/** A stored draft is untrusted: rebuilt field by field, capped, or dropped. */
function cleanDraft(raw: unknown): Draft | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.v !== 1 || !Array.isArray(r.items)) return null
  const items: DraftItem[] = []
  let rows = 0
  for (const v of r.items) {
    if (rows >= MAX_EDITOR_ROWS) break
    const rep = v as Record<string, unknown> | null
    if (rep && typeof rep === 'object' && rep.kind === 'repeat' && Array.isArray(rep.steps)) {
      const steps = rep.steps
        .slice(0, MAX_EDITOR_ROWS - rows - 1)
        .map(cleanDraftStep)
        .filter((s): s is DraftStep => s !== null)
      items.push({ uid: uid(), kind: 'repeat', times: text(rep.times, MAX_FIELD_CHARS), steps })
      rows += 1 + steps.length
    } else {
      const s = cleanDraftStep(v)
      if (s) {
        items.push(s)
        rows++
      }
    }
  }
  return {
    v: 1,
    id: typeof r.id === 'string' ? r.id.slice(0, 80) : null,
    baseUpdatedAt: typeof r.baseUpdatedAt === 'number' ? r.baseUpdatedAt : null,
    copyOf: typeof r.copyOf === 'string' ? r.copyOf.slice(0, 80) : null,
    returnTo: r.returnTo === 'profile' ? 'profile' : 'workout',
    name: text(r.name, MAX_NAME_CHARS),
    description: text(r.description, MAX_DESCRIPTION_CHARS),
    tag: cleanTag(r.tag),
    items,
    dirty: r.dirty === true,
  }
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? cleanDraft(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeDraft(d: Draft | null): void {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Storage unavailable: the draft lives in this tab until it closes.
  }
}

// --- the store ---

/** What the rider asked to open. */
export type BuilderTarget = { kind: 'new' } | { kind: 'edit' | 'copy'; workout: Workout }

export interface BuilderState {
  draft: Draft | null
  /** Asked to open something else while an unsaved draft exists. The rider decides. */
  pending: { target: BuilderTarget; returnTo: ReturnTo; what: string } | null
  /** The stored draft was changed by another tab since this one opened it. */
  changedElsewhere: boolean
}

function sameTarget(d: Draft, t: BuilderTarget): boolean {
  if (t.kind === 'new') return d.id === null && d.copyOf === null
  if (t.kind === 'edit' && t.workout.source === 'custom') return d.id === t.workout.id
  return d.id === null && d.copyOf === t.workout.id
}

function draftFor(t: BuilderTarget, returnTo: ReturnTo): Draft {
  return t.kind === 'new' ? newDraft(returnTo) : draftFromWorkout(t.workout, t.kind, returnTo)
}

class BuilderStore {
  private listeners = new Set<() => void>()
  private state: BuilderState = { draft: readDraft(), pending: null, changedElsewhere: false }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== DRAFT_KEY || !this.state.draft) return
        this.set({ changedElsewhere: true })
      })
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.state

  private set(patch: Partial<BuilderState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  /**
   * Open the builder on something. An unsaved draft of the same thing is
   * picked up where it was left; an unsaved draft of something else is kept,
   * and the rider is asked which one to go on with. Throws if the workout is
   * too long to edit.
   */
  open(target: BuilderTarget, returnTo: ReturnTo) {
    const cur = this.state.draft
    if (cur && sameTarget(cur, target) && (cur.dirty || target.kind === 'new')) {
      this.replace({ ...cur, returnTo }, null)
      return
    }
    const next = draftFor(target, returnTo)
    if (cur?.dirty) {
      const what =
        target.kind === 'new' ? 'a new workout' : target.kind === 'edit' ? `editing ${target.workout.name}` : `a copy of ${target.workout.name}`
      this.set({ pending: { target, returnTo, what } })
      return
    }
    this.replace(next, null)
  }

  /** Answer the "unsaved draft" question: keep it, or drop it for what was asked. */
  resolvePending(keep: boolean) {
    const p = this.state.pending
    if (!p) return
    if (keep) this.set({ pending: null })
    else this.replace(draftFor(p.target, p.returnTo), null)
  }

  /** The builder was opened with nothing to edit (a direct link, a reload after saving): start a new workout. */
  ensure() {
    if (!this.state.draft) this.replace(newDraft('workout'), null)
  }

  private replace(draft: Draft | null, pending: BuilderState['pending']) {
    writeDraft(draft)
    this.set({ draft, pending, changedElsewhere: false })
  }

  /** Change the draft. Every change is saved at once. */
  update(fn: (d: Draft) => Draft) {
    const cur = this.state.draft
    if (!cur) return
    const next = { ...fn(cur), dirty: true }
    writeDraft(next)
    this.set({ draft: next })
  }

  /** Saved or thrown away: nothing is left to restore. */
  clear() {
    this.replace(null, null)
  }
}

export const builder = new BuilderStore()
