import { useRef, type ReactNode } from 'react'
import type { WorkoutLive, WorkoutOption } from '../lib/ride'
import { formatDuration } from '../lib/workout'
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
  /** Course / Workout switch, shown in the header. */
  switcher: ReactNode
}

/** No workout or one workout, plus Import ZWO and a strip preview of the selection. */
export function WorkoutPicker({ workouts, loaded, selected, ftpW, onSelect, onImport, onRemove, switcher }: WorkoutPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <section aria-label="Choose a workout" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {switcher}
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
        <PickerRow checked={!selected} onClick={() => onSelect(null)} title="No workout" meta="ERG or resistance by hand" />
        {!loaded && <div className="border-t border-line px-6 py-3 text-fg-subtle">Loading workouts</div>}
        {workouts.map((w) => (
          <PickerRow
            key={w.id}
            checked={selected?.workout.id === w.id}
            onClick={() => onSelect(w.id)}
            title={w.name}
            meta={`${w.rampTest ? 'until you stop' : formatDuration(w.durationS)} · ${w.description}${
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
