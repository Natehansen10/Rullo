import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { CUSTOM_TAGS, MAX_DESCRIPTION_CHARS, MAX_LABEL_CHARS, MAX_NAME_CHARS, type CustomTag, type CustomWorkoutInput } from '../lib/customWorkouts'
import type { SaveWorkoutResult } from '../lib/ride'
import { flatten, targetPct, targetWatts, totalS, zoneOf, type Target } from '../lib/workout'
import {
  builder,
  checkDraft,
  cloneItem,
  formatDurationField,
  formatTarget,
  MAX_EDITOR_ROWS,
  newRepeat,
  newStep,
  parseCadence,
  parseDuration,
  parseTarget,
  rowCount,
  type Draft,
  type DraftItem,
  type DraftRepeat,
  type DraftStep,
} from '../lib/workoutDraft'
import { Button } from './Button'
import { SegmentedControl } from './SegmentedControl'
import { Stat } from './Stat'
import { TextField } from './TextField'
import { lengthBucketLabel } from './WorkoutPicker'
import { formatClock } from './WorkoutRow'
import { WorkoutStrip } from './WorkoutStrip'

const TAG_LABEL: Record<CustomTag, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const KINDS = ['steady', 'ramp'] as const
const KIND_LABEL = { steady: 'Steady', ramp: 'Ramp' } as const
const CONFIRM_MS = 3000
type StepField = 'dur' | 'from' | 'to' | 'cadence' | 'label'

// --- pure edits on the item list ---

function mapStep(items: DraftItem[], uid: string, fn: (s: DraftStep) => DraftStep): DraftItem[] {
  return items.map((it) =>
    it.kind === 'repeat' ? { ...it, steps: it.steps.map((s) => (s.uid === uid ? fn(s) : s)) } : it.uid === uid ? fn(it) : it,
  )
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/**
 * Move a row one place. Top-level rows trade places. A step inside a repeat
 * moves within it, and off either end it leaves the repeat (an emptied repeat
 * is removed).
 */
function moveItem(items: DraftItem[], uid: string, dir: -1 | 1): DraftItem[] {
  const top = items.findIndex((it) => it.uid === uid)
  if (top >= 0) {
    const to = top + dir
    return to < 0 || to >= items.length ? items : swap(items, top, to)
  }
  const ri = items.findIndex((it) => it.kind === 'repeat' && it.steps.some((s) => s.uid === uid))
  if (ri < 0) return items
  const rep = items[ri] as DraftRepeat
  const i = rep.steps.findIndex((s) => s.uid === uid)
  const to = i + dir
  if (to >= 0 && to < rep.steps.length) return items.map((it, k) => (k === ri ? { ...rep, steps: swap(rep.steps, i, to) } : it))
  const rest = rep.steps.filter((s) => s.uid !== uid)
  const kept: DraftItem[] = rest.length ? [{ ...rep, steps: rest }] : []
  const moved = dir < 0 ? [rep.steps[i], ...kept] : [...kept, rep.steps[i]]
  return [...items.slice(0, ri), ...moved, ...items.slice(ri + 1)]
}

/** Copy a row right after itself. Returns the copy's id for focus. */
function duplicateItem(items: DraftItem[], uid: string): { items: DraftItem[]; copyUid: string | null } {
  let copyUid: string | null = null
  const dup = <T extends DraftItem>(list: T[]): T[] =>
    list.flatMap((it) => {
      if (it.uid !== uid) return [it]
      const c = cloneItem(it)
      copyUid = c.uid
      return [it, c]
    })
  const next = dup(items).map((it) => (it.kind === 'repeat' ? { ...it, steps: dup(it.steps) } : it))
  return { items: next, copyUid }
}

/** Delete a row. Returns the row that takes its place, for focus. */
function removeItem(items: DraftItem[], uid: string): { items: DraftItem[]; nextUid: string | null } {
  const top = items.findIndex((it) => it.uid === uid)
  if (top >= 0) {
    const next = items.filter((it) => it.uid !== uid)
    return { items: next, nextUid: (next[top] ?? next[top - 1])?.uid ?? null }
  }
  let nextUid: string | null = null
  const next = items.map((it) => {
    if (it.kind !== 'repeat') return it
    const i = it.steps.findIndex((s) => s.uid === uid)
    if (i < 0) return it
    const steps = it.steps.filter((s) => s.uid !== uid)
    nextUid = (steps[i] ?? steps[i - 1])?.uid ?? it.uid
    return { ...it, steps }
  })
  return { items: next, nextUid }
}

// --- small pieces ---

/** What a target comes to at the rider's FTP: the other unit, with the zone. */
function echo(step: DraftStep, ftpW: number): string {
  const a = parseTarget(step.from)
  const b = step.kind === 'ramp' ? parseTarget(step.to) : a
  if (!a || !b) return ''
  const other = (t: Target) => ('w' in t ? `${Math.round(targetPct(t, ftpW))}%` : `${Math.round(targetWatts(t, ftpW))} W`)
  if (step.kind === 'steady') return `Z${zoneOf(targetPct(a, ftpW))} · ${other(a)}`
  // A ramp shows both ends in watts, the unit the trainer is sent.
  return `${Math.round(targetWatts(a, ftpW))}→${Math.round(targetWatts(b, ftpW))} W`
}

function RowActions({
  what,
  canUp,
  canDown,
  onMove,
  onCopy,
  onDelete,
}: {
  what: string
  canUp: boolean
  canDown: boolean
  onMove: (dir: -1 | 1) => void
  onCopy: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button size="sm" data-f="up" aria-label={`Move ${what} up`} disabled={!canUp} onClick={() => onMove(-1)}>
        ↑
      </Button>
      <Button size="sm" data-f="down" aria-label={`Move ${what} down`} disabled={!canDown} onClick={() => onMove(1)}>
        ↓
      </Button>
      <Button size="sm" data-f="copy" aria-label={`Duplicate ${what}`} onClick={onCopy}>
        Copy
      </Button>
      <Button size="sm" data-f="delete" aria-label={`Delete ${what}`} onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}

interface RowOps {
  ftpW: number
  errors: Map<string, string>
  setField: (uid: string, field: StepField, value: string) => void
  commitField: (uid: string, field: StepField) => void
  setKind: (uid: string, kind: 'steady' | 'ramp') => void
  move: (uid: string, dir: -1 | 1, focus: string) => void
  copy: (uid: string, focus: string) => void
  remove: (uid: string) => void
}

/** Alt + Up / Down moves the row, Ctrl + D duplicates it; focus stays on the same field. */
function rowKeys(e: KeyboardEvent<HTMLDivElement>, uid: string, ops: RowOps, canUp: boolean, canDown: boolean) {
  const field = (e.target as HTMLElement).closest('[data-f]')?.getAttribute('data-f') ?? 'dur'
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    e.stopPropagation()
    const dir = e.key === 'ArrowUp' ? -1 : 1
    if (dir < 0 ? canUp : canDown) ops.move(uid, dir, field)
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    e.stopPropagation()
    ops.copy(uid, field)
  }
}

/** One step: type, time, target (two for a ramp) with what it comes to in watts, cadence cue, label, row actions. */
function StepRow({
  step,
  number,
  inner,
  canUp,
  canDown,
  ops,
}: {
  step: DraftStep
  number: string
  inner: boolean
  canUp: boolean
  canDown: boolean
  ops: RowOps
}) {
  const what = `step ${number}`
  const bad = (f: string) => ops.errors.has(`${step.uid}:${f}`)
  const field = (f: StepField, label: string, width: string, extra?: { placeholder?: string; maxLength?: number; select?: boolean }) => (
    <TextField
      data-f={f}
      aria-label={`${label}, ${what}`}
      title={ops.errors.get(`${step.uid}:${f}`)}
      value={step[f]}
      invalid={bad(f)}
      selectOnFocus={extra?.select ?? true}
      placeholder={extra?.placeholder}
      maxLength={extra?.maxLength ?? 24}
      onChange={(v) => ops.setField(step.uid, f, v)}
      onCommit={() => ops.commitField(step.uid, f)}
      inputClassName={`${width} tabular-nums`}
    />
  )
  return (
    <div
      data-uid={step.uid}
      role="group"
      aria-label={`Step ${number}`}
      onKeyDown={(e) => rowKeys(e, step.uid, ops, canUp, canDown)}
      className={`ww-step-row border-t border-line py-2 pr-6 ${inner ? 'ww-step-row-inner pl-3' : 'pl-6'}`}
    >
      <span className="font-mono text-mono text-fg-subtle">{number}</span>
      <div data-f="kind">
        <SegmentedControl
          label={`Type, ${what}`}
          options={KINDS}
          value={step.kind}
          onChange={(k) => ops.setKind(step.uid, k)}
          format={(k) => KIND_LABEL[k]}
        />
      </div>
      {field('dur', 'Time', 'w-full')}
      <div className="flex min-w-0 items-center gap-2">
        {field('from', step.kind === 'ramp' ? 'Start target' : 'Target', 'w-[4.75rem] shrink-0')}
        {step.kind === 'ramp' && (
          <>
            <span aria-hidden className="text-fg-muted">
              →
            </span>
            {field('to', 'End target', 'w-[4.75rem] shrink-0')}
          </>
        )}
        <span className="min-w-0 truncate font-mono text-mono text-fg-muted">{echo(step, ops.ftpW)}</span>
      </div>
      {field('cadence', 'Cadence in rpm', 'w-full', { placeholder: '--' })}
      {field('label', 'Label', 'w-full', { placeholder: 'Label', maxLength: MAX_LABEL_CHARS, select: false })}
      <RowActions
        what={what}
        canUp={canUp}
        canDown={canDown}
        onMove={(dir) => ops.move(step.uid, dir, dir < 0 ? 'up' : 'down')}
        onCopy={() => ops.copy(step.uid, 'copy')}
        onDelete={() => ops.remove(step.uid)}
      />
    </div>
  )
}

/** A repeat: a header row with the count, then its steps set in from a rule, and its own add buttons. */
function RepeatGroup({
  rep,
  number,
  canUp,
  canDown,
  full,
  ops,
  setTimes,
  addInner,
}: {
  rep: DraftRepeat
  number: string
  canUp: boolean
  canDown: boolean
  full: boolean
  ops: RowOps
  setTimes: (v: string) => void
  addInner: (kind: 'steady' | 'ramp') => void
}) {
  const what = `repeat ${number}`
  const times = /^\d+$/.test(rep.times.trim()) ? Number(rep.times.trim()) : 0
  const oneS = rep.steps.reduce((sum, s) => sum + (parseDuration(s.dur) ?? 0), 0)
  return (
    <div role="group" aria-label={`Repeat ${number}`} className="border-t border-line">
      <div
        data-uid={rep.uid}
        onKeyDown={(e) => rowKeys(e, rep.uid, ops, canUp, canDown)}
        className="flex min-w-[54rem] items-center gap-2 py-2 pr-6 pl-6"
      >
        <span className="w-12 shrink-0 font-mono text-mono text-fg-subtle">{number}</span>
        <span className="font-semibold text-fg">Repeat</span>
        <TextField
          data-f="times"
          aria-label={`Times, ${what}`}
          value={rep.times}
          invalid={ops.errors.has(`${rep.uid}:times`)}
          selectOnFocus
          maxLength={4}
          inputMode="numeric"
          onChange={setTimes}
          inputClassName="w-12 text-right tabular-nums"
        />
        <span className="text-fg-muted">times</span>
        <span className="min-w-0 flex-1 truncate font-mono text-mono text-fg-subtle">
          {rep.steps.length} {rep.steps.length === 1 ? 'step' : 'steps'}
          {times > 0 && oneS > 0 ? ` · ${formatClock(oneS)} each · ${formatClock(oneS * times)} in all` : ''}
        </span>
        <RowActions
          what={what}
          canUp={canUp}
          canDown={canDown}
          onMove={(dir) => ops.move(rep.uid, dir, dir < 0 ? 'up' : 'down')}
          onCopy={() => ops.copy(rep.uid, 'copy')}
          onDelete={() => ops.remove(rep.uid)}
        />
      </div>
      <div className="ml-6 border-l border-line-strong">
        {rep.steps.map((s, j) => (
          <StepRow key={s.uid} step={s} number={`${number}.${j + 1}`} inner canUp canDown ops={ops} />
        ))}
        <div className="flex items-center gap-2 border-t border-line py-2 pr-6 pl-3">
          <Button size="sm" disabled={full} onClick={() => addInner('steady')}>
            Add step to repeat
          </Button>
          <Button size="sm" disabled={full} onClick={() => addInner('ramp')}>
            Add ramp to repeat
          </Button>
        </div>
      </div>
    </div>
  )
}

function Panel({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-fg">{title}</span>
        {children && <span className="text-fg-muted">{children}</span>}
      </div>
      {actions && <div className="flex gap-3">{actions}</div>}
    </div>
  )
}

interface WorkoutBuilderProps {
  ftpW: number
  /** A ride is on: nothing can be edited or saved. */
  locked: boolean
  onSave: (input: CustomWorkoutInput, overwrite: boolean) => Promise<SaveWorkoutResult>
  /** Saved: back to step 2 of the Workout tab, where the workout is now selected. */
  onSaved: () => void
  /** Cancelled: back to where the rider came from. */
  onClose: (returnTo: Draft['returnTo']) => void
}

/**
 * The workout builder: a step list, not a drag canvas. Name, difficulty and
 * description, a live strip of the result, then one row per step. Every
 * change is kept as a draft in this browser until Save or Cancel.
 */
export function WorkoutBuilder({ ftpW, locked, onSave, onSaved, onClose }: WorkoutBuilderProps) {
  const { draft, pending, changedElsewhere } = useSyncExternalStore(builder.subscribe, builder.getSnapshot)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<{ message: string; conflict: boolean } | null>(null)
  /** Row and control to focus once the list has re-rendered (after a move, copy, add or delete). */
  const focusNext = useRef<{ uid: string; f: string } | null>(null)

  useEffect(() => {
    if (!draft && !locked) builder.ensure()
  }, [draft, locked])

  useEffect(() => {
    if (!confirmDiscard) return
    const t = setTimeout(() => setConfirmDiscard(false), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirmDiscard])

  useEffect(() => {
    const want = focusNext.current
    if (!want) return
    focusNext.current = null
    const row = document.querySelector(`[data-uid="${want.uid}"]`)
    const pick = (f: string) => row?.querySelector<HTMLElement>(`[data-f="${f}"]:not(:disabled), [data-f="${f}"] [tabindex="0"]`)
    // A disabled button can't take focus (the first row's Up): fall to its twin, then the row's first field.
    const el = pick(want.f) ?? pick(want.f === 'up' ? 'down' : 'up') ?? pick('dur') ?? pick('times')
    ;(el ?? document.querySelector<HTMLElement>('[data-f="add-step"]'))?.focus()
  })

  const check = useMemo(() => (draft ? checkDraft(draft) : null), [draft])
  const intervals = useMemo(
    () => (check ? flatten({ id: 'draft', name: '', description: '', source: 'custom', steps: check.steps }) : []),
    [check],
  )

  if (locked) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-title font-semibold text-fg">Workout builder</h1>
        <Panel title="You're mid-ride">End the ride to build or edit a workout.{draft?.dirty ? ' Your draft is kept.' : ''}</Panel>
      </div>
    )
  }
  if (!draft || !check) return null

  const total = totalS(intervals)
  const rows = rowCount(draft.items)
  const full = rows >= MAX_EDITOR_ROWS
  const editing = draft.id !== null
  const canSave = check.errors.length === 0 && !saving

  const setItems = (fn: (items: DraftItem[]) => DraftItem[]) => {
    setFailure(null)
    builder.update((d) => ({ ...d, items: fn(d.items) }))
  }
  const setMeta = (patch: Partial<Pick<Draft, 'name' | 'description' | 'tag'>>) => {
    setFailure(null)
    builder.update((d) => ({ ...d, ...patch }))
  }
  const findStep = (uid: string): DraftStep | undefined =>
    draft.items.flatMap((it) => (it.kind === 'repeat' ? it.steps : [it])).find((s) => s.uid === uid)

  const ops: RowOps = {
    ftpW,
    errors: check.fields,
    setField: (uid, field, value) => setItems((items) => mapStep(items, uid, (s) => ({ ...s, [field]: value }))),
    // Leaving a field tidies it ("12" becomes "12:00", "90" becomes "90%"). An unchanged field is left alone.
    commitField: (uid, field) => {
      const s = findStep(uid)
      if (!s) return
      const raw = s[field]
      let tidy = raw
      if (field === 'dur') {
        const v = parseDuration(raw)
        if (v !== null) tidy = formatDurationField(v)
      } else if (field === 'from' || field === 'to') {
        const v = parseTarget(raw)
        if (v !== null) tidy = formatTarget(v)
      } else if (field === 'cadence') {
        const v = parseCadence(raw)
        if (v !== null) tidy = v === undefined ? '' : String(v)
      } else tidy = raw.replace(/\s+/g, ' ').trim()
      if (tidy !== raw) setItems((items) => mapStep(items, uid, (x) => ({ ...x, [field]: tidy })))
    },
    setKind: (uid, kind) =>
      setItems((items) => mapStep(items, uid, (s) => ({ ...s, kind, to: kind === 'ramp' && !s.to.trim() ? s.from : s.to }))),
    move: (uid, dir, focus) => {
      focusNext.current = { uid, f: focus }
      setItems((items) => moveItem(items, uid, dir))
    },
    copy: (uid, focus) => {
      if (full) return
      const res = duplicateItem(draft.items, uid)
      if (res.copyUid) focusNext.current = { uid: res.copyUid, f: focus }
      setItems(() => res.items)
    },
    remove: (uid) => {
      const res = removeItem(draft.items, uid)
      focusNext.current = { uid: res.nextUid ?? '', f: 'delete' }
      setItems(() => res.items)
    },
  }

  const add = (item: DraftItem) => {
    if (full) return
    focusNext.current = { uid: item.uid, f: item.kind === 'repeat' ? 'times' : 'dur' }
    setItems((items) => [...items, item])
  }

  const save = async (mode: 'save' | 'overwrite' | 'copy') => {
    if (!canSave) return
    setSaving(true)
    setFailure(null)
    const res = await onSave(
      {
        id: mode === 'copy' ? null : draft.id,
        name: mode === 'copy' ? `${draft.name.trim()} copy`.slice(0, MAX_NAME_CHARS) : draft.name,
        description: draft.description,
        tag: draft.tag,
        steps: check.steps,
        baseUpdatedAt: draft.baseUpdatedAt,
      },
      mode === 'overwrite',
    )
    setSaving(false)
    if (res.ok) {
      builder.clear()
      onSaved()
    } else setFailure({ message: res.message, conflict: res.conflict })
  }

  const cancel = () => {
    if (draft.dirty && !confirmDiscard) {
      setConfirmDiscard(true)
      return
    }
    const back = draft.returnTo
    builder.clear()
    onClose(back)
  }

  const status = failure ? (
    <span className="text-state-over">{failure.message}</span>
  ) : check.errors.length > 0 ? (
    <span className="text-state-over">
      {check.errors[0]}
      {check.errors.length > 1 ? ` (${check.errors.length - 1} more)` : ''}
    </span>
  ) : check.warnings.length > 0 ? (
    <span className="text-state-under">{check.warnings[0]}</span>
  ) : (
    <span className="text-fg-muted">{draft.dirty ? 'Unsaved changes are kept in this browser until you save or cancel.' : 'No changes yet.'}</span>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-mono text-fg-subtle">Workout builder</span>
        <h1 className="text-title font-semibold text-fg">{editing ? 'Edit workout' : 'New workout'}</h1>
        <p className="text-fg-muted">
          One row per step. A target in % follows your FTP; a target in watts stays fixed. Cadence is a cue for you; the trainer
          holds the power either way.
        </p>
      </div>

      {pending && (
        <Panel
          title={`You have an unsaved draft: ${draft.name.trim() || 'untitled workout'}`}
          actions={
            <>
              <Button onClick={() => builder.resolvePending(true)}>Keep the draft</Button>
              <Button variant="danger" onClick={() => builder.resolvePending(false)}>
                Discard it
              </Button>
            </>
          }
        >
          Keep working on it, or discard it and start {pending.what}.
        </Panel>
      )}
      {changedElsewhere && (
        <Panel title="This draft is open in another tab">The last change made in either tab is the one that is kept.</Panel>
      )}

      <section aria-label="Workout builder" className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-6 py-4">
          <TextField
            label="Name"
            value={draft.name}
            onChange={(name) => setMeta({ name })}
            maxLength={MAX_NAME_CHARS}
            invalid={!draft.name.trim() && draft.dirty}
            placeholder="Sweet Spot 3x12"
            autoFocus={!editing && !draft.name}
            className="w-full max-w-[24rem] flex-1"
            inputClassName="w-full"
          />
          <div className="flex flex-col gap-1">
            <span className="ww-label">Difficulty</span>
            <SegmentedControl label="Difficulty" options={CUSTOM_TAGS} value={draft.tag} onChange={(tag) => setMeta({ tag })} format={(t) => TAG_LABEL[t]} />
          </div>
          <TextField
            label="Description (optional)"
            value={draft.description}
            onChange={(description) => setMeta({ description })}
            maxLength={MAX_DESCRIPTION_CHARS}
            placeholder="What the workout is for"
            className="w-full min-w-[16rem] flex-1"
            inputClassName="w-full"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-6 py-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Stat label="Total time" value={formatClock(total)} dim={total === 0} inline />
            <Stat label="Intervals" value={String(intervals.length)} dim={total === 0} inline />
            <span className="font-mono text-mono text-fg-subtle">
              watts at your FTP of {ftpW} W
              {total > 0 ? ` · listed under ${TAG_LABEL[draft.tag]} · ${lengthBucketLabel(total)}` : ''}
            </span>
          </div>
          {total > 0 ? (
            <WorkoutStrip intervals={intervals} ftpW={ftpW} totalS={total} heightClass="ww-profile" />
          ) : (
            <div className="ww-profile flex items-center justify-center rounded-md bg-raised text-fg-muted">
              {draft.items.length === 0 ? 'Add a step and the workout shows here.' : 'Fix the marked fields and the workout shows here.'}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="ww-step-row border-t border-line py-2 pr-6 pl-6" aria-hidden>
            <span className="ww-label">Step</span>
            <span className="ww-label">Type</span>
            <span className="ww-label">Time</span>
            <span className="ww-label">Target</span>
            <span className="ww-label">Cadence</span>
            <span className="ww-label">Label</span>
            <span />
          </div>
          {draft.items.map((it, i) => {
            const number = String(i + 1)
            const canUp = i > 0
            const canDown = i < draft.items.length - 1
            return it.kind === 'repeat' ? (
              <RepeatGroup
                key={it.uid}
                rep={it}
                number={number}
                canUp={canUp}
                canDown={canDown}
                full={full}
                ops={ops}
                setTimes={(times) => setItems((items) => items.map((x) => (x.uid === it.uid ? { ...x, times } : x)))}
                addInner={(kind) => {
                  if (full) return
                  const s = newStep(kind)
                  focusNext.current = { uid: s.uid, f: 'dur' }
                  setItems((items) => items.map((x) => (x.uid === it.uid && x.kind === 'repeat' ? { ...x, steps: [...x.steps, s] } : x)))
                }}
              />
            ) : (
              <StepRow key={it.uid} step={it} number={number} inner={false} canUp={canUp} canDown={canDown} ops={ops} />
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-6 py-4">
          <div className="flex gap-3">
            <Button data-f="add-step" disabled={full} onClick={() => add(newStep('steady'))}>
              Add step
            </Button>
            <Button disabled={full} onClick={() => add(newStep('ramp'))}>
              Add ramp
            </Button>
            <Button disabled={full} onClick={() => add(newRepeat())}>
              Add repeat
            </Button>
          </div>
          <span className="text-fg-muted">
            {full
              ? `That is the most steps the builder holds (${MAX_EDITOR_ROWS}).`
              : 'Time: 12 is minutes, 12:00, 90s or 1h30. Target: 90 is % of FTP, 225w is watts.'}
          </span>
          <span className="ml-auto font-mono text-mono whitespace-nowrap text-fg-subtle">alt ↑↓ move step · ctrl D duplicate</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
          <div className="min-w-0 flex-1" role="status">
            {status}
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant={confirmDiscard ? 'danger' : 'secondary'} onClick={cancel}>
              {confirmDiscard ? 'Discard changes' : 'Cancel'}
            </Button>
            {failure?.conflict ? (
              <>
                <Button onClick={() => void save('copy')} disabled={!canSave}>
                  Save as a copy
                </Button>
                <Button variant="primary" onClick={() => void save('overwrite')} disabled={!canSave}>
                  Overwrite
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => void save('save')} disabled={!canSave}>
                {saving ? 'Saving' : editing ? 'Save changes' : 'Save workout'}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
