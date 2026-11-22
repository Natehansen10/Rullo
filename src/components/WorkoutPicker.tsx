import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { WorkoutOption } from '../lib/ride'
import { MOVE_CARD, MOVE_OPEN, moveLayout, moveName, moveStyle } from '../lib/viewTransition'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { SegmentedControl } from './SegmentedControl'
import { Stat } from './Stat'
import { WorkoutStrip } from './WorkoutStrip'

const DIFFICULTIES = ['all', 'easy', 'medium', 'hard'] as const
type Difficulty = (typeof DIFFICULTIES)[number]
const DIFFICULTY_LABEL: Record<Difficulty, string> = { all: 'All', easy: 'Easy', medium: 'Medium', hard: 'Hard' }

/** Length buckets, named for the ride they hold. Each takes workouts up to its limit in minutes. */
const LENGTH_BUCKETS = [
  { id: '15', label: '15 min', maxMin: 20 },
  { id: '30', label: '30 min', maxMin: 37 },
  { id: '45', label: '45 min', maxMin: 50 },
  { id: '60', label: '1 h', maxMin: 80 },
  { id: '90', label: '1.5 h', maxMin: 105 },
  { id: '120', label: '2 h+', maxMin: Infinity },
] as const
type Length = 'any' | (typeof LENGTH_BUCKETS)[number]['id']
const LENGTHS: readonly Length[] = ['any', ...LENGTH_BUCKETS.map((b) => b.id)]
const lengthLabel = (l: Length) => LENGTH_BUCKETS.find((b) => b.id === l)?.label ?? 'Any'

function lengthOf(w: WorkoutOption): Length | null {
  if (w.rampTest) return null // as long as the rider lasts
  const min = w.durationS / 60
  return LENGTH_BUCKETS.find((b) => min <= b.maxMin)!.id
}

/** The Length filter a workout of this duration shows under, e.g. "1 h". The builder tells the rider. */
export function lengthBucketLabel(durationS: number): string {
  return LENGTH_BUCKETS.find((b) => durationS / 60 <= b.maxMin)!.label
}

interface WorkoutPickerProps {
  workouts: WorkoutOption[]
  loaded: boolean
  /** The workout picked on this tab (its card is highlighted), or null for a free ride. */
  pickedId: string | null
  /** The workout on the Ride tab right now, if any. */
  onRideId: string | null
  /** A course is picked: with no workout the trainer follows its hills. */
  onCourse: boolean
  ftpW: number
  /** The Free ride card: pick "no workout". It reaches the Ride tab with Done. */
  onFreeRide: () => void
  /**
   * The workout whose overview is open (in place of the grid), or null. Looking
   * at a workout does not pick it: only "Ride this workout" does.
   */
  detail: string | null
  onDetail: (id: string | null) => void
  /** Ride this workout: pick it, put the setup on the Ride tab and go there. */
  onRide: (id: string) => void
  /** Open the builder: a new workout, the selected custom workout, or a copy of any workout. */
  onNew: () => void
  onEdit: (id: string) => void
  onCopy: (id: string) => void
  onRemove: (id: string) => void
}

const VIEWS = ['all', 'custom'] as const
type View = (typeof VIEWS)[number]
const VIEW_LABEL: Record<View, string> = { all: 'All workouts', custom: 'Custom' }
const CONFIRM_MS = 3000
const isMine = (w: WorkoutOption) => w.source !== 'builtin'
const metaOf = (w: WorkoutOption) =>
  `${w.rampTest ? 'until you stop' : formatDuration(w.durationS)}${w.tag ? ` · ${w.tag}` : ''}${
    w.source === 'imported' ? ' · imported' : w.source === 'custom' ? ' · custom' : ''
  }`

const CARD = 'ww-press flex min-h-[9rem] cursor-pointer flex-col justify-between gap-3 rounded-lg border p-4 text-left'

/**
 * Step 2 on the Workout tab, laid out like a workout library: a side menu
 * (All workouts, Custom), filters and a count, then a grid of cards led by the
 * Custom Workout tile. Each card is a small graph of the workout, its name,
 * its length and difficulty. Picking a card opens the workout's overview.
 */
export function WorkoutPicker({
  workouts,
  loaded,
  pickedId,
  onRideId,
  onCourse,
  ftpW,
  onFreeRide,
  detail,
  onDetail,
  onRide,
  onNew,
  onEdit,
  onCopy,
  onRemove,
}: WorkoutPickerProps) {
  const [view, setView] = useState<View>('all')
  const [difficulty, setDifficulty] = useState<Difficulty>('all')
  const [length, setLength] = useState<Length>('any')
  const [confirmDelete, setConfirmDelete] = useState(false)
  /**
   * The workout whose overview is open, or was a moment ago: its card carries
   * the panel's and the chart's move names in place of its own, so the card
   * opens into the overview and the overview closes back into the card.
   */
  const [opened, setOpened] = useState(detail)
  if (detail && opened !== detail) setOpened(detail)
  /** Filter reflow: the cards that stay move to their new places; the rest fade. */
  const reflow = (update: () => void) => void moveLayout(update, 'reflow')
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const filtering = difficulty !== 'all' || length !== 'any'
  const inView = workouts.filter((w) => view === 'all' || isMine(w))
  const shown = inView.filter(
    (w) =>
      // The picked workout stays in view whatever the filters say.
      w.id === pickedId ||
      ((difficulty === 'all' || w.tag === difficulty) && (length === 'any' || lengthOf(w) === length)),
  )
  const picked = detail ? (workouts.find((w) => w.id === detail) ?? null) : null

  const menu = (
    <nav aria-label="Workout lists" className="flex w-[11rem] shrink-0 flex-col gap-1">
      {VIEWS.map((v) => {
        const active = view === v && !picked
        return (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() =>
              reflow(() => {
                setView(v)
                // The grid comes back with every card in its own place: nothing closes into a card.
                setOpened(null)
                if (detail) onDetail(null)
              })
            }
            className={`ww-press flex cursor-pointer items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-left font-semibold ${
              active ? 'border-line-strong bg-surface text-fg' : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {VIEW_LABEL[v]}
            <span className="font-mono text-mono font-normal text-fg-subtle">{workouts.filter((w) => v === 'all' || isMine(w)).length}</span>
          </button>
        )
      })}
      <p className="border-t border-line px-3 pt-3 text-fg-muted">Custom holds the workouts you build and the ZWO files you import.</p>
    </nav>
  )

  if (picked) {
    const onRideNow = onRideId === picked.id
    return (
      <div className="flex items-start gap-6">
        {menu}
        <section
          aria-label="Workout overview"
          className={`flex min-w-0 flex-1 flex-col rounded-lg border border-line bg-surface ${MOVE_OPEN}`}
          style={moveStyle('', 'ww-open-panel')}
        >
          <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-3">
            <Button onClick={() => onDetail(null)}>← All workouts</Button>
            <h2 className="min-w-0 flex-1 truncate text-title font-semibold text-fg">{picked.name}</h2>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6 px-6 py-4">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <Stat label="Duration" value={picked.rampTest ? '--' : formatDuration(picked.durationS)} dim={false} inline />
              <Stat label="Intervals" value={String(picked.intervals.length)} dim={false} inline />
              <span className="font-mono text-mono text-fg-subtle">
                {[picked.tag, picked.source === 'builtin' ? null : picked.source, picked.rampTest ? 'runs until you stop' : null, onRideNow ? 'on the Ride tab now' : null].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              {picked.source === 'custom' && <Button onClick={() => onEdit(picked.id)}>Edit</Button>}
              <Button onClick={() => onCopy(picked.id)}>Edit a copy</Button>
              {picked.source !== 'builtin' && (
                <Button
                  variant={confirmDelete ? 'danger' : 'secondary'}
                  onClick={() => {
                    if (!confirmDelete) return setConfirmDelete(true)
                    setConfirmDelete(false)
                    onDetail(null)
                    onRemove(picked.id)
                  }}
                >
                  {confirmDelete ? 'Confirm delete' : 'Delete'}
                </Button>
              )}
              <Button
                variant="primary"
                // The one place a workout is put on the ride.
                onClick={() => onRide(picked.id)}
              >
                Ride this workout
              </Button>
            </div>
          </div>
          {picked.description && <p className="px-6 pb-4 text-fg-muted">{picked.description}</p>}
          <div className="border-t border-line px-6 py-4">
            <WorkoutStrip intervals={picked.intervals} ftpW={ftpW} totalS={Math.max(1, picked.durationS)} heightClass="ww-builder-graph" detailsSide="above" className={MOVE_OPEN} style={moveStyle('', 'ww-open-chart')} />
            <p className="pt-3 font-mono text-mono text-fg-subtle">watts at your FTP of {ftpW} W</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-6">
      {menu}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <span className="ww-label">Length</span>
            <SegmentedControl label="Length" options={LENGTHS} value={length} onChange={(v) => reflow(() => setLength(v))} format={lengthLabel} />
          </div>
          <div className="flex items-center gap-3">
            <span className="ww-label">Difficulty</span>
            <SegmentedControl label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={(v) => reflow(() => setDifficulty(v))} format={(d) => DIFFICULTY_LABEL[d]} />
          </div>
          <span className="ml-auto font-mono text-mono text-fg-subtle" aria-live="polite">
            {shown.length} {shown.length === 1 ? 'workout' : 'workouts'}
            {filtering ? ` of ${inView.length}` : ''}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {/* Always the first tile, like the create tile that leads a workout library. */}
          <button
            type="button"
            onClick={onNew}
            aria-label="Custom Workout"
            style={moveStyle('ww-card-new')}
            className={`${CARD} ${MOVE_CARD} border-line-strong bg-raised hover:bg-line`}
          >
            <span aria-hidden className="ww-num ww-num-sm text-fg">
              +
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-title font-semibold text-fg">Custom Workout</span>
              <span className="font-mono text-mono text-fg-muted">build your own from blocks</span>
            </span>
          </button>
          <div role="radiogroup" aria-label="Workout" className="contents">
            {view === 'all' && (
              <button
                type="button"
                role="radio"
                aria-checked={!pickedId}
                aria-label={`Free ride, no targets, ${onCourse ? "the trainer follows the course's hills" : 'your own resistance or ERG target'}`}
                onClick={onFreeRide}
                style={moveStyle('ww-card-free')}
                className={`${CARD} ${MOVE_CARD} ${!pickedId ? 'border-fg bg-raised' : 'border-line bg-surface hover:bg-bg'}`}
              >
                <span className="ww-profile-compact flex items-center font-mono text-mono text-fg-subtle">no targets</span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-fg">Free ride</span>
                  <span className="font-mono text-mono text-fg-subtle">
                    {onCourse ? "the trainer follows the course's hills" : 'your own resistance or ERG target'}
                  </span>
                </span>
              </button>
            )}
            {shown.map((w) => {
              const checked = pickedId === w.id
              const opening = opened === w.id
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    // The names go on this card first, so the move starts from it.
                    flushSync(() => setOpened(w.id))
                    onDetail(w.id)
                  }}
                  style={moveStyle(moveName('ww-card', w.id), opening ? 'ww-open-panel' : undefined)}
                  className={`${CARD} ${MOVE_CARD} ${opening ? MOVE_OPEN : ''} ${checked ? 'border-fg bg-raised' : 'border-line bg-surface hover:bg-bg'}`}
                >
                  <WorkoutStrip intervals={w.intervals} ftpW={ftpW} totalS={Math.max(1, w.durationS)} heightClass="ww-profile-compact" labels={false} className={`w-full ${opening ? MOVE_OPEN : ''}`} style={opening ? moveStyle('', 'ww-open-chart') : undefined} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-semibold text-fg">{w.name}</span>
                    <span className="truncate font-mono text-mono text-fg-subtle">{metaOf(w)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {!loaded && <p className="text-fg-subtle">Loading workouts</p>}
        {loaded && shown.length === 0 && (
          <p className="text-fg-muted">
            {view === 'custom' && !filtering ? 'No custom workouts yet. Build one with Custom Workout, or import a ZWO file on the Profile tab.' : 'No workouts match these filters.'}
          </p>
        )}
      </div>
    </div>
  )
}
