import { useRef } from 'react'
import type { WorkoutLive, WorkoutOption } from '../lib/ride'
import { formatDuration } from '../lib/workout'

/** First sentence of a description, capped, so long ZWO descriptions stay on one line. */
function summary(text: string, max = 70): string {
  const first = text.trim().split(/(?<=[.!?])\s/)[0]?.replace(/\s+/g, ' ') ?? ''
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first
}
import { Button } from './Button'
import { PickerRow } from './PickerRow'
import { WorkoutStrip } from './WorkoutStrip'

interface WorkoutPickerProps {
  workouts: WorkoutOption[]
  loaded: boolean
  selected: WorkoutLive | null
  ftpW: number
  onSelect: (id: string | null) => void
  onImport: (file: File) => void
  onRemove: (id: string) => void
}

/** What the trainer does: no workout or one workout, plus Import ZWO and a strip preview. The other half of the setup panel. */
export function WorkoutPicker({ workouts, loaded, selected, ftpW, onSelect, onImport, onRemove }: WorkoutPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <section aria-label="What: choose a workout" className="min-w-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-fg">What</h2>
          <span className="text-fg-muted">The workout sets power targets in ERG.</span>
        </div>
        <Button onClick={() => fileRef.current?.click()}>Import ZWO</Button>
        <input
          ref={fileRef}
          type="file"
          accept=".zwo,application/xml,text/xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
      </div>
      <div role="radiogroup" aria-label="Workout">
        <PickerRow checked={!selected} onClick={() => onSelect(null)} title="No workout" meta="your own resistance or ERG target" />
        {!loaded && <div className="border-t border-line px-6 py-3 text-fg-subtle">Loading workouts</div>}
        {workouts.map((w) => (
          <PickerRow
            key={w.id}
            checked={selected?.workout.id === w.id}
            onClick={() => onSelect(w.id)}
            title={w.name}
            meta={`${w.tag ? `${w.tag} · ` : ''}${w.rampTest ? 'until you stop' : formatDuration(w.durationS)}${w.description ? ` · ${summary(w.description)}` : ''}${
              w.source === 'imported' ? ' · imported' : ''
            }`}
            action={
              w.source === 'imported' ? (
                <button
                  type="button"
                  onClick={() => onRemove(w.id)}
                  className="ww-press cursor-pointer text-fg-subtle hover:text-fg"
                >
                  Remove
                </button>
              ) : undefined
            }
          />
        ))}
      </div>
      {selected && (
        <div className="border-t border-line px-6 py-4">
          <WorkoutStrip
            intervals={selected.intervals}
            ftpW={ftpW}
            totalS={selected.totalS}
            heightClass="ww-strip-preview"
          />
        </div>
      )}
    </section>
  )
}
