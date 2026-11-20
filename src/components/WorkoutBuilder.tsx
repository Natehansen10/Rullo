import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { CUSTOM_TAGS, MAX_DESCRIPTION_CHARS, MAX_LABEL_CHARS, MAX_NAME_CHARS, type CustomTag, type CustomWorkoutInput } from '../lib/customWorkouts'
import type { SaveWorkoutResult } from '../lib/ride'
import { flatten, targetPct, targetWatts, totalS, zoneAt, type Target } from '../lib/workout'
import {
  builder,
  checkDraft,
  formatDurationField,
  duplicateItem,
  formatTarget,
  mapStep,
  MAX_EDITOR_ROWS,
  moveItem,
  removeItem,
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
import { BuilderGraph, type DisplayUnit } from './BuilderGraph'
import { Button } from './Button'
import { SegmentedControl } from './SegmentedControl'
import { Stat } from './Stat'
import { TextField } from './TextField'
import { lengthBucketLabel } from './WorkoutPicker'
import { formatClock } from './WorkoutRow'

const TAG_LABEL: Record<CustomTag, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const KINDS = ['steady', 'ramp'] as const
const KIND_LABEL = { steady: 'Steady', ramp: 'Ramp' } as const
const CONFIRM_MS = 3000
const UNITS = ['pct', 'w'] as const
const UNIT_LABEL: Record<DisplayUnit, string> = { pct: '% FTP', w: 'Watts' }
const UNIT_KEY = 'ww.builderUnit'
const LIST_KEY = 'ww.builderList'

function pref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setPref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // not saved: the choice lasts until the page closes
  }
}
type StepField = 'dur' | 'from' | 'to' | 'cadence' | 'label'

// --- small pieces ---

/** What a target comes to at the rider's FTP: the other unit, with the zone. */
function echo(step: DraftStep, ftpW: number): string {
  const a = parseTarget(step.from)
  const b = step.kind === 'ramp' ? parseTarget(step.to) : a
  if (!a || !b) return ''
  const other = (t: Target) => ('w' in t ? `${Math.round(targetPct(t, ftpW))}%` : `${Math.round(targetWatts(t, ftpW))} W`)
  if (step.kind === 'steady') return `Z${zoneAt(targetPct(a, ftpW), ftpW)} · ${other(a)}`
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
  /** Saved: back to step 2 of the Workout tab, on the saved workout's overview. It is not loaded for the ride until picked. */
  onSaved: (id: string) => void
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
  /** The block picked on the graph (a top-level step or repeat). Its fields show above it. */
  const [selected, setSelected] = useState<string | null>(null)
  const [unit, setUnit] = useState<DisplayUnit>(() => (pref(UNIT_KEY) === 'w' ? 'w' : 'pct'))
  const [listWanted, setListWanted] = useState(() => pref(LIST_KEY) === '1')
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

  // Ctrl + Z takes back the last change, except inside a field, where it undoes typing as usual.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key !== 'z' && e.key !== 'Z')) return
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      e.preventDefault()
      builder.undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  // A field the graph can't show as wrong (a bad time typed in the list) opens the list, so the marked field is on screen.
  const listOpen = listWanted || check.fields.size > 0
  const toggleList = (open: boolean) => {
    setListWanted(open)
    setPref(LIST_KEY, open ? '1' : '0')
  }
  const changeUnit = (u: DisplayUnit) => {
    setUnit(u)
    setPref(UNIT_KEY, u)
  }

  const setItems = (fn: (items: DraftItem[]) => DraftItem[], key: string | null = null) => {
    setFailure(null)
    builder.update((d) => ({ ...d, items: fn(d.items) }), key)
  }
  const setMeta = (patch: Partial<Pick<Draft, 'name' | 'description' | 'tag'>>) => {
    setFailure(null)
    builder.update((d) => ({ ...d, ...patch }), `meta:${Object.keys(patch).join()}`)
  }
  const findStep = (uid: string): DraftStep | undefined =>
    draft.items.flatMap((it) => (it.kind === 'repeat' ? it.steps : [it])).find((s) => s.uid === uid)

  const ops: RowOps = {
    ftpW,
    errors: check.fields,
    setField: (uid, field, value) => setItems((items) => mapStep(items, uid, (s) => ({ ...s, [field]: value })), `type:${uid}:${field}`),
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
      onSaved(res.id)
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
        {/* Header: back on the left, the workout's name as the title. Click the name to rename it. */}
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-3">
          <Button variant={confirmDiscard ? 'danger' : 'secondary'} onClick={cancel} aria-label={confirmDiscard ? 'Discard changes' : 'Back'}>
            {confirmDiscard ? 'Discard changes' : '← Back'}
          </Button>
          <h1 className="min-w-0 flex-1">
            <input
              type="text"
              aria-label="Name"
              autoComplete="off"
              spellCheck={false}
              value={draft.name}
              maxLength={MAX_NAME_CHARS}
              placeholder="Name this workout"
              aria-invalid={!draft.name.trim() || undefined}
              onChange={(e) => setMeta({ name: e.target.value })}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="ww-title-field w-full max-w-[32rem]"
            />
          </h1>
          <span className="font-mono text-mono text-fg-subtle">{editing ? 'Editing a saved workout' : 'New workout'} · click the name to rename</span>
        </div>

        {/* Details: description on the left, difficulty tag on the right. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-6 py-4">
          <TextField
            label="Description"
            value={draft.description}
            onChange={(description) => setMeta({ description })}
            maxLength={MAX_DESCRIPTION_CHARS}
            placeholder="Description (optional)"
            className="w-full min-w-[16rem] flex-1"
            inputClassName="w-full"
          />
          <div className="flex flex-col gap-1">
            <span className="ww-label">Tag your workout</span>
            <SegmentedControl label="Difficulty" options={CUSTOM_TAGS} value={draft.tag} onChange={(tag) => setMeta({ tag })} format={(t) => TAG_LABEL[t]} />
          </div>
        </div>

        <div className="border-t border-line px-6 py-4">
          <BuilderGraph draft={draft} ftpW={ftpW} unit={unit} selected={selected} onSelect={setSelected} full={full} />
        </div>

        {/* Bottom bar: display unit, duration, and the list view. */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-6 py-3" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="ww-label">Display</span>
            <SegmentedControl label="Display" options={UNITS} value={unit} onChange={changeUnit} format={(u) => UNIT_LABEL[u]} />
          </div>
          <Stat label="Workout duration" value={formatClock(total)} dim={total === 0} inline />
          <Stat label="Intervals" value={String(intervals.length)} dim={total === 0} inline />
          <span className="font-mono text-mono text-fg-subtle">
            your FTP {ftpW} W{total > 0 ? ` · listed under ${TAG_LABEL[draft.tag]} · ${lengthBucketLabel(total)}` : ''}
          </span>
          <Button className="ml-auto" aria-expanded={listOpen} onClick={() => toggleList(!listOpen)}>
            {listOpen ? 'Hide step list' : 'Step list'}
          </Button>
        </div>

        {listOpen && (
          <>
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
                return (
                  <div key={it.uid} onFocusCapture={() => setSelected(it.uid)}>
                    {it.kind === 'repeat' ? (
                      <RepeatGroup
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
                      <StepRow step={it} number={number} inner={false} canUp={canUp} canDown={canDown} ops={ops} />
                    )}
                  </div>
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
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
          <div className="min-w-0 flex-1" role="status">
            {status}
          </div>
          <div className="flex shrink-0 gap-3">
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
                {saving ? 'Saving' : editing ? 'Save changes' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
