import { useState } from 'react'
import type { WorkoutLive, WorkoutOption } from '../lib/ride'
import { formatDuration } from '../lib/workout'
import { PickerRow } from './PickerRow'
import { SegmentedControl } from './SegmentedControl'
import { WorkoutStrip } from './WorkoutStrip'

const DIFFICULTIES = ['all', 'easy', 'medium', 'hard'] as const
type Difficulty = (typeof DIFFICULTIES)[number]
const DIFFICULTY_LABEL: Record<Difficulty, string> = { all: 'All', easy: 'Easy', medium: 'Medium', hard: 'Hard' }

const LENGTHS = ['any', 'short', 'mid', 'long'] as const
type Length = (typeof LENGTHS)[number]
const LENGTH_LABEL: Record<Length, string> = { any: 'Any', short: 'Up to 1 h', mid: '1 to 1.5 h', long: 'Over 1.5 h' }
const HOUR_S = 3600

function lengthOf(w: WorkoutOption): Length | null {
  if (w.rampTest) return null // as long as the rider lasts
  return w.durationS <= HOUR_S ? 'short' : w.durationS <= 1.5 * HOUR_S ? 'mid' : 'long'
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
}

/**
 * Step 2 on the Workout tab: a free ride or a workout, filtered by difficulty
 * and length. The selected workout opens its description and interval strip.
 */
export function WorkoutPicker({ workouts, loaded, selected, onCourse, ftpW, onSelect }: WorkoutPickerProps) {
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
          <SegmentedControl label="Length" options={LENGTHS} value={length} onChange={setLength} format={(l) => LENGTH_LABEL[l]} />
        </div>
        <span className="ml-auto font-mono text-mono text-fg-subtle" aria-live="polite">
          {shown.length} of {workouts.length} workouts
        </span>
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
            }${w.source === 'imported' ? ' · imported' : ''}`}
          >
            {selected?.workout.id === w.id && (
              <div className="flex flex-col gap-3">
                {w.description && <p className="text-fg-muted">{w.description}</p>}
                <WorkoutStrip intervals={selected.intervals} ftpW={ftpW} totalS={selected.totalS} heightClass="ww-strip-preview" />
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
