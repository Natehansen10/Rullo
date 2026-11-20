import { useState } from 'react'
import type { WorkoutLive, WorkoutOption } from '../lib/ride'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { PickerRow } from './PickerRow'
import { SegmentedControl } from './SegmentedControl'
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

/** First sentence of a description, capped, so long ZWO descriptions stay on one line. */
function summary(text: string, max = 70): string {
  const first = text.trim().split(/(?<=[.!?])\s/)[0]?.replace(/\s+/g, ' ') ?? ''
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first
}

interface WorkoutPickerProps {
  workouts: WorkoutOption[]
  loaded: boolean
  selected: WorkoutLive | null
  /** A course is picked: with no workout the trainer follows its hills. */
  onCourse: boolean
  ftpW: number
  onSelect: (id: string | null) => void
  /** Open the builder: a new workout, the selected custom workout, or a copy of any workout. */
  onNew: () => void
  onEdit: (id: string) => void
  onCopy: (id: string) => void
}

/**
 * Step 2 on the Workout tab: a free ride or a workout, filtered by difficulty
 * and length. The selected workout opens its description and interval strip.
 */
export function WorkoutPicker({ workouts, loaded, selected, onCourse, ftpW, onSelect, onNew, onEdit, onCopy }: WorkoutPickerProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('all')
  const [length, setLength] = useState<Length>('any')
  const filtering = difficulty !== 'all' || length !== 'any'
  const shown = workouts.filter(
    (w) =>
      // The picked workout stays in view whatever the filters say.
      w.id === selected?.workout.id ||
      ((difficulty === 'all' || w.tag === difficulty) && (length === 'any' || lengthOf(w) === length)),
  )
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="ww-label">Difficulty</span>
          <SegmentedControl
            label="Difficulty"
            options={DIFFICULTIES}
            value={difficulty}
            onChange={setDifficulty}
            format={(d) => DIFFICULTY_LABEL[d]}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="ww-label">Length</span>
          <SegmentedControl label="Length" options={LENGTHS} value={length} onChange={setLength} format={lengthLabel} />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono text-mono text-fg-subtle" aria-live="polite">
            {shown.length} of {workouts.length} workouts
          </span>
          <Button onClick={onNew}>New workout</Button>
        </div>
      </div>
      <div role="radiogroup" aria-label="Workout">
        <PickerRow
          checked={!selected}
          onClick={() => onSelect(null)}
          title="Free ride"
          meta={onCourse ? "no targets · the trainer follows the course's hills" : 'no targets · your own resistance or ERG target'}
        />
        {!loaded && <div className="border-t border-line px-6 py-3 text-fg-subtle">Loading workouts</div>}
        {shown.map((w) => (
          <PickerRow
            key={w.id}
            checked={selected?.workout.id === w.id}
            onClick={() => onSelect(w.id)}
            title={w.name}
            meta={`${w.tag ? `${w.tag} · ` : ''}${w.rampTest ? 'until you stop' : formatDuration(w.durationS)}${
              w.description ? ` · ${summary(w.description)}` : ''
            }${w.source === 'imported' ? ' · imported' : w.source === 'custom' ? ' · custom' : ''}`}
          >
            {selected?.workout.id === w.id && (
              <div className="flex flex-col gap-3">
                {w.description && <p className="text-fg-muted">{w.description}</p>}
                <WorkoutStrip intervals={selected.intervals} ftpW={ftpW} totalS={selected.totalS} heightClass="ww-strip-preview" />
                <div className="flex flex-wrap items-center gap-3">
                  {w.source === 'custom' && <Button onClick={() => onEdit(w.id)}>Edit</Button>}
                  <Button onClick={() => onCopy(w.id)}>Edit a copy</Button>
                  <span className="text-fg-muted">
                    {w.source === 'custom'
                      ? 'Change this workout, or start a new one from it.'
                      : 'Start a new workout from this one. The original stays as it is.'}
                  </span>
                </div>
              </div>
            )}
          </PickerRow>
        ))}
        {loaded && filtering && shown.length === 0 && (
          <div className="border-t border-line px-6 py-3 text-fg-muted">No workouts match these filters.</div>
        )}
      </div>
    </>
  )
}
