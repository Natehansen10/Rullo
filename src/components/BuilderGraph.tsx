import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { targetPct, targetWatts, zoneAt, ZONES } from '../lib/workout'
import {
  builder,
  duplicateItem,
  formatDurationField,
  formatTarget,
  moveItem,
  newStep,
  parseCadence,
  parseDuration,
  parseTarget,
  removeItem,
  reorderItem,
  type Draft,
  type DraftItem,
  type DraftRepeat,
  type DraftStep,
} from '../lib/workoutDraft'
import { Button } from './Button'
import { formatClock } from './WorkoutRow'

/** What the power fields show and what a bare number typed into them means. */
export type DisplayUnit = 'pct' | 'w'

interface BuilderGraphProps {
  draft: Draft
  ftpW: number
  unit: DisplayUnit
  selected: string | null
  onSelect: (uid: string | null) => void
  /** The builder holds no more rows. */
  full: boolean
}

// --- geometry ---

const GUTTER = 32
const AXIS = 20
const TOP = 8
const EDGE = 8
const DRAG_START_PX = 4
const MIN_SCALE_PCT = 150
const EMPTY_AXIS_S = 3600
const NICE_S = [60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600]
/** Top of each zone, Z1 to Z5; Z6 runs on up. */
const ZONE_TOPS = ZONES.slice(0, 5).map((z) => z.maxPct as number)
const MAX_PCT = 500
const ORDINALS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const ordinal = (i: number) => ORDINALS[i] ?? String(i + 1)

/** A time axis a little longer than the workout, on a round number, so there is room to drop the next block. */
function axisFor(totalS: number): number {
  if (totalS <= 0) return EMPTY_AXIS_S
  const want = totalS * 1.12
  return NICE_S.find((n) => n >= want) ?? Math.ceil(want / 900) * 900
}

interface StepView {
  durS: number
  /** % FTP at the start and the end. Equal for a steady step. */
  a: number
  b: number
}

function viewStep(s: DraftStep, ftpW: number): StepView {
  const from = parseTarget(s.from)
  const to = s.kind === 'ramp' ? parseTarget(s.to) : from
  const a = from ? targetPct(from, ftpW) : 50
  return { durS: parseDuration(s.dur) ?? 300, a, b: to ? targetPct(to, ftpW) : a }
}

interface Part {
  /** Index of the step inside a repeat, or null for a plain step. */
  inner: number | null
  step: DraftStep
  startS: number
  v: StepView
}

interface Block {
  item: DraftItem
  startS: number
  durS: number
  parts: Part[]
}

function layout(items: DraftItem[], ftpW: number): { blocks: Block[]; totalS: number; maxPct: number } {
  let t = 0
  let maxPct = 0
  const blocks = items.map((item): Block => {
    const startS = t
    const parts: Part[] = []
    const add = (step: DraftStep, inner: number | null) => {
      const v = viewStep(step, ftpW)
      parts.push({ inner, step, startS: t, v })
      t += v.durS
      maxPct = Math.max(maxPct, v.a, v.b)
    }
    if (item.kind === 'repeat') {
      // A bad or huge count still has to draw: clamp what is shown, not what is stored.
      const times = Math.min(200, Math.max(1, Number.parseInt(item.times, 10) || 1))
      for (let r = 0; r < times; r++) item.steps.forEach((s, j) => add(s, j))
    } else add(item, null)
    return { item, startS, durS: t - startS, parts }
  })
  return { blocks, totalS: t, maxPct }
}

/** Keep a target in the unit it was typed in while the graph changes its size. */
function withPct(text: string, pct: number, ftpW: number): string {
  const t = parseTarget(text)
  const p = Math.min(MAX_PCT, Math.max(0, pct))
  return t && 'w' in t ? formatTarget({ w: Math.round((p * ftpW) / 100) }) : formatTarget({ pct: Math.round(p) })
}

function describe(item: DraftItem): string {
  if (item.kind === 'repeat') return `Intervals, ${item.times} times, ${item.steps.length} steps`
  return item.kind === 'ramp' ? `Ramp, ${item.dur}, ${item.from} to ${item.to}` : `Steady, ${item.dur} at ${item.from}`
}

// --- the palette ---

type TileId = 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | 'warm' | 'cool' | 'intervals' | 'cadence'
const ZONE_DEFAULT_PCT = [50, 65, 81, 95, 110, 125]
const DEFAULT_CADENCE = '90'

interface Tile {
  id: TileId
  label: string
  hint: string
}

const TILES: Tile[] = [
  ...ZONE_DEFAULT_PCT.map((p, i): Tile => ({ id: `z${i + 1}` as TileId, label: `Z${i + 1}`, hint: `Steady block, 5 min at ${p}% FTP` })),
  { id: 'warm', label: 'Warm up', hint: 'Ramp up, 10 min' },
  { id: 'cool', label: 'Cool down', hint: 'Ramp down, 10 min' },
  { id: 'intervals', label: 'Intervals', hint: 'A repeating on / off pair, 4 times' },
  { id: 'cadence', label: 'Cadence', hint: 'A cadence target for the selected block' },
]

function makeItem(id: TileId): DraftItem | null {
  if (id === 'cadence') return null
  if (id === 'warm') return { ...newStep('ramp'), dur: '10:00', from: '50%', to: '75%', label: 'Warm-up' }
  if (id === 'cool') return { ...newStep('ramp'), dur: '10:00', from: '75%', to: '50%', label: 'Cool-down' }
  if (id === 'intervals') {
    return {
      uid: newStep().uid + 'r',
      kind: 'repeat',
      times: '4',
      steps: [
        { ...newStep(), dur: '1:00', from: '110%', to: '110%', label: 'On' },
        { ...newStep(), dur: '1:00', from: '55%', to: '55%', label: 'Off' },
      ],
    }
  }
  const pct = ZONE_DEFAULT_PCT[Number(id[1]) - 1]
  return { ...newStep(), dur: '5:00', from: `${pct}%`, to: `${pct}%` }
}

function TileIcon({ id }: { id: TileId }) {
  if (id === 'cadence') return <span className="font-mono text-mono text-fg-muted">rpm</span>
  const zone = id.startsWith('z') ? id : null
  return (
    <svg width={28} height={16} aria-hidden className="shrink-0">
      {zone && <rect x={0} y={0} width={28} height={16} rx={2} fill={`var(--ww-${zone})`} />}
      {id === 'warm' && <path d="M0,16L0,11L28,2L28,16Z" fill="var(--ww-z2)" />}
      {id === 'cool' && <path d="M0,16L0,2L28,11L28,16Z" fill="var(--ww-z1)" />}
      {id === 'intervals' &&
        [0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={i * 10} y={1} width={5} height={15} fill="var(--ww-z5)" />
            <rect x={i * 10 + 5} y={10} width={4} height={6} fill="var(--ww-z1)" />
          </g>
        ))}
    </svg>
  )
}

// --- the fields over the selected block ---

/** A small labelled field. What is typed is applied when the field is left or Enter is pressed; a value that can't be read is put back. */
function Field({
  label,
  name,
  value,
  onCommit,
  width = 'w-[4.5rem]',
}: {
  label: string
  /** Stable handle for focus and tests. */
  name: string
  value: string
  /** Return false to refuse the text. */
  onCommit: (text: string) => boolean
  width?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => {
    if (text.trim() === value) return
    if (!onCommit(text)) setText(value)
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="ww-label whitespace-nowrap">{label}</span>
      <input
        type="text"
        data-gf={name}
        autoComplete="off"
        spellCheck={false}
        maxLength={24}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          // Keys typed here are text, not block shortcuts.
          e.stopPropagation()
        }}
        className={`ww-field tabular-nums ${width}`}
      />
    </label>
  )
}

interface DragState {
  mode: 'move' | 'dur' | 'from' | 'to' | 'both' | 'tile'
  uid: string
  inner: number | null
  tile?: TileId
  startX: number
  startY: number
  moved: boolean
  /** Frozen for the length of a resize, so the edge stays under the pointer. */
  axisS: number
  scalePct: number
  orig: StepView
}

/**
 * The builder's main view, after Zwift's editor: a graph of blocks (width is
 * time, height is power, color is the zone) with a palette beside it. Click a
 * tile to add a block, or drag it to a spot on the graph. Click a block to
 * select it: its time and power fields show right above it. Drag a block's
 * top edge for power, its right edge for time, its body to move it. Delete
 * takes it away, and unlike Zwift there is an Undo.
 */
export function BuilderGraph({ draft, ftpW, unit, selected, onSelect, full }: BuilderGraphProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 264 })
  const [popLeft, setPopLeft] = useState(0)
  const drag = useRef<DragState | null>(null)
  /** Where a dragged block or tile would land (index among the other blocks), and a floating label for a tile. */
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const focusBlock = useRef<string | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: Math.max(200, entry.contentRect.width), h: Math.max(120, entry.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { blocks, totalS, maxPct } = layout(draft.items, ftpW)
  const frozen = drag.current && drag.current.mode !== 'move' && drag.current.mode !== 'tile' ? drag.current : null
  const axisS = frozen?.axisS ?? axisFor(totalS)
  const scalePct = frozen?.scalePct ?? Math.max(MIN_SCALE_PCT, Math.ceil((maxPct + 15) / 10) * 10)
  const { w, h } = size
  const plotW = w - GUTTER
  const floor = h - AXIS
  const x = (s: number) => GUTTER + (s / axisS) * plotW
  const y = (pct: number) => floor - (Math.min(scalePct, Math.max(0, pct)) / scalePct) * (floor - TOP)
  const sel = blocks.find((b) => b.item.uid === selected) ?? null

  // The fields sit right above the selected block, kept inside the graph's width.
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop || !sel) return
    const center = x(sel.startS + sel.durS / 2)
    setPopLeft(Math.max(0, Math.min(w - pop.offsetWidth, center - pop.offsetWidth / 2)))
  })

  useEffect(() => {
    const uid = focusBlock.current
    if (!uid) return
    focusBlock.current = null
    svgRef.current?.querySelector<SVGGElement>(`[data-block="${uid}"]`)?.focus()
  })

  // --- edits ---

  const setItems = (fn: (items: DraftItem[]) => DraftItem[], key: string | null = null) => builder.update((d) => ({ ...d, items: fn(d.items) }), key)
  const patchStep = (uid: string, inner: number | null, fn: (s: DraftStep) => DraftStep, key: string | null = null) =>
    setItems(
      (items) =>
        items.map((it) => {
          if (it.uid !== uid) return it
          if (it.kind === 'repeat') return { ...it, steps: it.steps.map((s, j) => (j === inner ? fn(s) : s)) }
          return fn(it)
        }),
      key,
    )

  const insertAt = (item: DraftItem, index: number) => {
    if (full) return
    setItems((items) => [...items.slice(0, index), item, ...items.slice(index)])
    onSelect(item.uid)
    focusBlock.current = item.uid
  }

  const addTile = (id: TileId, index?: number, overUid?: string) => {
    if (id === 'cadence') {
      const uid = overUid ?? selected
      const target = draft.items.find((it) => it.uid === uid)
      if (!target) return
      // A repeat takes the cue on its first step without one.
      const inner = target.kind === 'repeat' ? Math.max(0, target.steps.findIndex((s) => !s.cadence.trim())) : null
      patchStep(target.uid, inner, (s) => (s.cadence.trim() ? s : { ...s, cadence: DEFAULT_CADENCE }))
      onSelect(target.uid)
      return
    }
    const item = makeItem(id)
    if (!item) return
    const after = draft.items.findIndex((it) => it.uid === selected)
    insertAt(item, index ?? (after >= 0 ? after + 1 : draft.items.length))
  }

  const remove = (uid: string) => {
    const res = removeItem(draft.items, uid)
    setItems(() => res.items)
    onSelect(res.nextUid)
    focusBlock.current = res.nextUid
  }

  const copy = (uid: string) => {
    if (full) return
    const res = duplicateItem(draft.items, uid)
    setItems(() => res.items)
    if (res.copyUid) {
      onSelect(res.copyUid)
      focusBlock.current = res.copyUid
    }
  }

  const move = (uid: string, dir: -1 | 1) => {
    setItems((items) => moveItem(items, uid, dir))
    focusBlock.current = uid
  }

  // --- pointer: move, resize, drop ---

  const localX = (clientX: number) => clientX - (svgRef.current?.getBoundingClientRect().left ?? 0)
  const overGraph = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    return !!r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  }
  /** Index among the blocks other than `skip` where something dropped at this x would go. */
  const indexAtX = (px: number, skip: string | null) =>
    blocks.filter((b) => b.item.uid !== skip).filter((b) => x(b.startS + b.durS / 2) < px).length

  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < DRAG_START_PX) return
    d.moved = true
    if (d.mode === 'tile' || d.mode === 'move') {
      setDragging(d.mode === 'move' ? d.uid : null)
      if (d.mode === 'tile') setGhost({ x: e.clientX, y: e.clientY, label: TILES.find((t) => t.id === d.tile)?.label ?? '' })
      const inside = overGraph(e.clientX, e.clientY)
      setDropAt(inside && d.tile !== 'cadence' ? indexAtX(localX(e.clientX), d.mode === 'move' ? d.uid : null) : null)
      return
    }
    if (d.mode === 'dur') {
      const snap = d.axisS >= 1200 ? 15 : 5
      const durS = Math.max(snap, Math.round((d.orig.durS + (dx / plotW) * d.axisS) / snap) * snap)
      patchStep(d.uid, d.inner, (s) => ({ ...s, dur: formatDurationField(durS) }), 'drag')
      return
    }
    const dPct = (-dy / (floor - TOP)) * d.scalePct
    patchStep(
      d.uid,
      d.inner,
      (s) => ({
        ...s,
        from: d.mode === 'to' ? s.from : withPct(s.from, d.orig.a + dPct, ftpW),
        to: d.mode === 'from' ? s.to : withPct(s.to, (s.kind === 'ramp' ? d.orig.b : d.orig.a) + dPct, ftpW),
      }),
      'drag',
    )
  }

  const onUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    const d = drag.current
    drag.current = null
    setDropAt(null)
    setGhost(null)
    setDragging(null)
    if (!d) return
    const under = document.elementFromPoint(e.clientX, e.clientY)
    if (d.mode === 'tile' && d.tile) {
      if (!d.moved) return // a click: the button's own onClick adds it
      if (!overGraph(e.clientX, e.clientY)) return
      if (d.tile === 'cadence') addTile('cadence', undefined, under?.closest('[data-block]')?.getAttribute('data-block') ?? undefined)
      else addTile(d.tile, indexAtX(localX(e.clientX), null))
      return
    }
    if (d.mode === 'move' && d.moved) {
      if (under?.closest('[data-trash]')) remove(d.uid)
      else if (overGraph(e.clientX, e.clientY)) {
        const to = indexAtX(localX(e.clientX), d.uid)
        setItems((items) => reorderItem(items, d.uid, to))
      }
    }
  }

  const begin = (e: ReactPointerEvent, mode: DragState['mode'], block: Block | null, part: Part | null, tile?: TileId) => {
    if (e.button !== 0) return
    drag.current = {
      mode,
      uid: block?.item.uid ?? '',
      inner: part?.inner ?? null,
      tile,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      axisS,
      scalePct,
      orig: part?.v ?? { durS: 0, a: 0, b: 0 },
    }
    if (block) {
      onSelect(block.item.uid)
      e.preventDefault()
      svgRef.current?.querySelector<SVGGElement>(`[data-block="${block.item.uid}"]`)?.focus()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // --- keyboard on a block ---

  const onBlockKey = (e: ReactKeyboardEvent, b: Block, i: number) => {
    const uid = b.item.uid
    const go = (to: number) => {
      const next = blocks[to]
      if (!next) return
      onSelect(next.item.uid)
      focusBlock.current = next.item.uid
    }
    const nudge = (dPct: number, dS: number) => {
      if (b.item.kind === 'repeat') return
      patchStep(
        uid,
        null,
        (s) => {
          const v = viewStep(s, ftpW)
          return {
            ...s,
            dur: dS ? formatDurationField(Math.max(5, v.durS + dS)) : s.dur,
            from: dPct ? withPct(s.from, v.a + dPct, ftpW) : s.from,
            to: dPct ? withPct(s.to, (s.kind === 'ramp' ? v.b : v.a) + dPct, ftpW) : s.to,
          }
        },
        `key:${uid}:${dPct ? "power" : "time"}`,
      )
    }
    const big = e.shiftKey
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const dir = e.key === 'ArrowLeft' ? -1 : 1
      if (i + dir >= 0 && i + dir < blocks.length) move(uid, dir)
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) copy(uid)
    else if (e.ctrlKey || e.metaKey || e.altKey) return
    else if (e.key === 'ArrowLeft' && big) nudge(0, -30)
    else if (e.key === 'ArrowRight' && big) nudge(0, 30)
    else if (e.key === 'ArrowLeft') go(i - 1)
    else if (e.key === 'ArrowRight') go(i + 1)
    else if (e.key === 'ArrowUp') nudge(big ? 5 : 1, 0)
    else if (e.key === 'ArrowDown') nudge(big ? -5 : -1, 0)
    else if (e.key === 'Delete' || e.key === 'Backspace') remove(uid)
    else if (e.key === 'Enter') popRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    else if (e.key === 'Escape') onSelect(null)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  // --- the fields for the selected block ---

  const shown = (text: string): string => {
    const t = parseTarget(text)
    if (!t) return text
    return unit === 'w' ? `${Math.round(targetWatts(t, ftpW))} W` : `${Math.round(targetPct(t, ftpW) * 10) / 10}%`
  }
  const setTarget = (uid: string, inner: number | null, field: 'from' | 'to', both: boolean) => (text: string) => {
    const t = parseTarget(text, unit)
    if (!t || ('w' in t ? t.w > 2500 : t.pct > MAX_PCT)) return false
    const value = formatTarget(t)
    patchStep(uid, inner, (s) => (both ? { ...s, from: value, to: value } : { ...s, [field]: value }))
    return true
  }
  const stepFields = (uid: string, inner: number | null, s: DraftStep, suffix: string) => {
    const tag = suffix ? ` ${suffix}` : ''
    const id = inner === null ? '' : `-${inner + 1}`
    return (
      <div key={s.uid} className="flex items-end gap-2">
        <Field
          label={`Duration${tag}`}
          name={`dur${id}`}
          value={s.dur}
          onCommit={(text) => {
            const v = parseDuration(text)
            if (v === null || v > 6 * 3600) return false
            patchStep(uid, inner, (st) => ({ ...st, dur: formatDurationField(v) }))
            return true
          }}
        />
        {s.kind === 'ramp' ? (
          <>
            <Field label={`Power${tag} start`} name={`from${id}`} value={shown(s.from)} onCommit={setTarget(uid, inner, 'from', false)} />
            <Field label="End" name={`to${id}`} value={shown(s.to)} onCommit={setTarget(uid, inner, 'to', false)} />
          </>
        ) : (
          <Field label={`Power${tag}`} name={`from${id}`} value={shown(s.from)} onCommit={setTarget(uid, inner, 'from', true)} />
        )}
        {s.cadence.trim() !== '' && (
          <div className="flex items-end gap-1">
            <Field
              label={`Cadence${tag}`}
              name={`cadence${id}`}
              value={s.cadence}
              width="w-12"
              onCommit={(text) => {
                const v = parseCadence(text)
                if (v === null) return false
                patchStep(uid, inner, (st) => ({ ...st, cadence: v === undefined ? '' : String(v) }))
                return true
              }}
            />
            <Button size="sm" aria-label={`Remove cadence${tag}`} onClick={() => patchStep(uid, inner, (st) => ({ ...st, cadence: '' }))}>
              ×
            </Button>
          </div>
        )}
      </div>
    )
  }

  const repeatFields = (rep: DraftRepeat) => {
    const times = Math.max(1, Number.parseInt(rep.times, 10) || 1)
    const setTimes = (n: number) => setItems((items) => items.map((it) => (it.uid === rep.uid ? { ...it, times: String(Math.min(999, Math.max(1, n))) } : it)))
    return (
      <>
        <div className="flex flex-col gap-1">
          <span className="ww-label">Repeat</span>
          <div className="flex items-center gap-1">
            <Button size="sm" aria-label="One repeat fewer" disabled={times <= 1} onClick={() => setTimes(times - 1)}>
              −
            </Button>
            <span className="w-8 text-center font-semibold tabular-nums text-fg" aria-live="polite">
              {times}
            </span>
            <Button size="sm" aria-label="One repeat more" disabled={times >= 999} onClick={() => setTimes(times + 1)}>
              +
            </Button>
          </div>
        </div>
        {rep.steps.map((s, j) => stepFields(rep.uid, j, s, ordinal(j)))}
        <Button
          size="sm"
          aria-label="Add a step to the repeat"
          disabled={full}
          onClick={() =>
            setItems((items) => items.map((it) => (it.uid === rep.uid && it.kind === 'repeat' ? { ...it, steps: [...it.steps, newStep()] } : it)))
          }
        >
          Add step
        </Button>
        {rep.steps.length > 1 && (
          <Button
            size="sm"
            aria-label="Remove the last step of the repeat"
            onClick={() => setItems((items) => items.map((it) => (it.uid === rep.uid && it.kind === 'repeat' ? { ...it, steps: it.steps.slice(0, -1) } : it)))}
          >
            Remove step
          </Button>
        )}
      </>
    )
  }

  const selIndex = sel ? blocks.indexOf(sel) : -1
  const others = blocks.filter((b) => b.item.uid !== dragging)
  const markerX = dropAt === null ? null : dropAt < others.length ? x(others[dropAt].startS) : x(others.length ? others[others.length - 1].startS + others[others.length - 1].durS : 0)
  // While a block is being moved, the marker is drawn in the layout as it is now; close enough to aim by.

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* The selected block's fields, right above it. The band keeps its height so the graph never jumps. */}
          <div className="flex min-h-16 items-end">
            {sel ? (
              <div
                ref={popRef}
                role="group"
                aria-label={`Block ${selIndex + 1}`}
                style={{ marginLeft: popLeft }}
                className="flex max-w-full flex-wrap items-end gap-x-4 gap-y-2 rounded-md border border-line-strong bg-surface px-3 py-2"
              >
                {sel.item.kind === 'repeat' ? repeatFields(sel.item) : stepFields(sel.item.uid, null, sel.item, '')}
                <div className="flex items-center gap-1">
                  <Button size="sm" aria-label="Move block earlier" disabled={selIndex <= 0} onClick={() => move(sel.item.uid, -1)}>
                    ←
                  </Button>
                  <Button size="sm" aria-label="Move block later" disabled={selIndex >= blocks.length - 1} onClick={() => move(sel.item.uid, 1)}>
                    →
                  </Button>
                  <Button size="sm" aria-label="Duplicate block" disabled={full} onClick={() => copy(sel.item.uid)}>
                    Copy
                  </Button>
                </div>
              </div>
            ) : (
              <span className="text-fg-muted">
                {blocks.length === 0 ? 'Click the name above to rename the workout.' : 'Click a block to set its time and power.'}
              </span>
            )}
          </div>

          <div ref={boxRef} className="ww-builder-graph relative select-none">
            <svg
              ref={svgRef}
              width={w}
              height={h}
              role="group"
              aria-label="Workout blocks"
              className="absolute inset-0 block touch-none"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) onSelect(null)
              }}
            >
              <rect x={GUTTER} y={TOP} width={plotW} height={floor - TOP} fill="var(--ww-raised)" pointerEvents="none" />
              {ZONE_TOPS.filter((p) => p < scalePct).map((p) => (
                <line key={p} x1={GUTTER} x2={w} y1={y(p)} y2={y(p)} stroke="var(--ww-line-strong)" strokeWidth={1} pointerEvents="none" />
              ))}
              {[0, ...ZONE_TOPS].map((lo, i) => {
                const hi = Math.min(scalePct, ZONE_TOPS[i] ?? scalePct)
                return lo < scalePct ? (
                  <text key={i} x={0} y={(y(lo) + y(hi)) / 2 + 4} fill="var(--ww-fg-muted)" className="font-mono text-mono" pointerEvents="none">
                    Z{i + 1}
                  </text>
                ) : null
              })}
              {[0, 1, 2, 3, 4].map((i) => (
                <text
                  key={i}
                  x={GUTTER + (plotW * i) / 4}
                  y={h - 4}
                  textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
                  fill="var(--ww-fg-muted)"
                  className="font-mono text-mono"
                  pointerEvents="none"
                >
                  {formatClock((axisS * i) / 4)}
                </text>
              ))}

              {blocks.map((b, i) => {
                const isSel = b.item.uid === selected
                const x0 = x(b.startS)
                const x1 = x(b.startS + b.durS)
                const top = Math.min(...b.parts.map((p) => Math.min(y(p.v.a), y(p.v.b))))
                return (
                  <g
                    key={b.item.uid}
                    data-block={b.item.uid}
                    role="button"
                    aria-pressed={isSel}
                    aria-label={`Block ${i + 1} of ${blocks.length}: ${describe(b.item)}`}
                    tabIndex={isSel || (!sel && i === 0) ? 0 : -1}
                    onFocus={() => onSelect(b.item.uid)}
                    onKeyDown={(e) => onBlockKey(e, b, i)}
                    opacity={dragging === b.item.uid ? 0.4 : 1}
                    className="outline-none"
                  >
                    {b.parts.map((p, k) => {
                      const px0 = x(p.startS)
                      const px1 = x(p.startS + p.v.durS)
                      const ya = y(p.v.a)
                      const yb = y(p.v.b)
                      const mid = (px0 + px1) / 2
                      return (
                        <g key={k}>
                          <path
                            d={`M${px0},${floor}L${px0},${ya}L${px1},${yb}L${px1},${floor}Z`}
                            fill={`var(--ww-z${zoneAt((p.v.a + p.v.b) / 2, ftpW)})`}
                            stroke="var(--ww-surface)"
                            strokeWidth={1}
                            className="cursor-grab"
                            onPointerDown={(e) => begin(e, 'move', b, p)}
                          />
                          {p.step.cadence.trim() !== '' && px1 - px0 > 56 && (
                            <g pointerEvents="none">
                              {/* On a surface chip: mono text straight on a zone color would miss 4.5:1. */}
                              <rect x={mid - 26} y={floor - 20} width={52} height={16} rx={2} fill="var(--ww-surface)" />
                              <text x={mid} y={floor - 8} textAnchor="middle" fill="var(--ww-fg-muted)" className="font-mono text-mono">
                                {p.step.cadence} rpm
                              </text>
                            </g>
                          )}
                        </g>
                      )
                    })}
                    {/* Two-tone outline: an fg line with a surface hairline on each side, so it reads on every zone fill (fg alone is 2.7:1 on z7). */}
                    {isSel &&
                      (['surface', 'fg'] as const).map((tone) => (
                        <rect
                          key={tone}
                          x={x0 + 1}
                          y={top - 3}
                          width={Math.max(2, x1 - x0 - 2)}
                          height={floor - top + 3}
                          fill="none"
                          stroke={`var(--ww-${tone})`}
                          strokeWidth={tone === 'fg' ? 2 : 4}
                          rx={2}
                          pointerEvents="none"
                        />
                      ))}
                  </g>
                )
              })}
              {/* Edge handles sit above every block, so the edge between two blocks always resizes the one on its left. */}
              {blocks.map((b) =>
                b.parts.map((p, k) => {
                  const px0 = x(p.startS)
                  const px1 = x(p.startS + p.v.durS)
                  const ya = y(p.v.a)
                  const yb = y(p.v.b)
                  const ramp = p.step.kind === 'ramp'
                  const mid = (px0 + px1) / 2
                  return (
                    <g key={`${b.item.uid}:${k}`}>
                          {/* Top edge: power. A ramp's two halves set its start and its end. */}
                      {ramp ? (
                        <>
                          <line x1={px0} y1={ya} x2={mid} y2={(ya + yb) / 2} stroke="transparent" strokeWidth={EDGE * 2} className="cursor-ns-resize" onPointerDown={(e) => begin(e, 'from', b, p)} />
                          <line x1={mid} y1={(ya + yb) / 2} x2={px1} y2={yb} stroke="transparent" strokeWidth={EDGE * 2} className="cursor-ns-resize" onPointerDown={(e) => begin(e, 'to', b, p)} />
                        </>
                      ) : (
                        <rect x={px0} y={ya - EDGE} width={Math.max(1, px1 - px0)} height={EDGE * 2} fill="transparent" className="cursor-ns-resize" onPointerDown={(e) => begin(e, 'both', b, p)} />
                      )}
                      {/* Right edge: time. */}
                      <rect x={px1 - EDGE / 2} y={Math.min(ya, yb)} width={EDGE} height={floor - Math.min(ya, yb)} fill="transparent" className="cursor-ew-resize" onPointerDown={(e) => begin(e, 'dur', b, p)} />
                    </g>
                  )
                }),
              )}
              {markerX !== null && <line x1={markerX} x2={markerX} y1={TOP} y2={floor} stroke="var(--ww-fg)" strokeWidth={2} pointerEvents="none" />}
              <line x1={GUTTER} x2={w} y1={floor} y2={floor} stroke="var(--ww-line-strong)" strokeWidth={1} pointerEvents="none" />
            </svg>
            {blocks.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pl-8 text-fg-muted">
                Click a block on the right, or drag it here, to build your workout.
              </div>
            )}
          </div>
        </div>

        <div role="group" aria-label="Blocks to add" className="grid w-[11rem] shrink-0 grid-cols-2 content-start gap-2 pt-16">
          {TILES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              aria-label={`Add ${t.label}: ${t.hint}`}
              disabled={t.id === 'cadence' ? !selected : full}
              onPointerDown={(e) => begin(e, 'tile', null, null, t.id)}
              onClick={() => addTile(t.id)}
              className={`ww-press flex cursor-grab touch-none items-center gap-2 rounded-md ${t.id.startsWith('z') ? '' : 'col-span-2'} border border-line-strong bg-raised px-2 py-1 text-left text-body font-semibold whitespace-nowrap text-fg hover:bg-line disabled:cursor-not-allowed disabled:border-line disabled:text-fg-subtle`}
            >
              <TileIcon id={t.id} />
              {t.label}
            </button>
          ))}
          <p className="col-span-2 text-fg-muted">Click to add after the selected block, or drag onto the graph.</p>
        </div>
      </div>

      {ghost && (
        <div
          aria-hidden
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
          className="pointer-events-none fixed z-10 rounded-md border border-line-strong bg-surface px-2 py-1 font-semibold text-fg"
        >
          {ghost.label}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => builder.undo()} disabled={!builder.getSnapshot().canUndo}>
          Undo
        </Button>
        <Button data-trash onClick={() => sel && remove(sel.item.uid)} disabled={!sel && !dragging} aria-label="Delete block">
          Delete block
        </Button>
        <span className="text-fg-muted">
          {blocks.length === 0 ? 'Drag a block onto Delete block to remove it.' : 'Drag a top edge for power, a right edge for time, the middle to move.'}
        </span>
        <span className="ml-auto font-mono text-mono whitespace-nowrap text-fg-subtle">←→ select · ↑↓ power · shift ←→ time · alt ←→ move · del · ctrl Z undo</span>
      </div>
    </div>
  )
}
