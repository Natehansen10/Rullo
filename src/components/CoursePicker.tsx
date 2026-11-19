import { useEffect, useRef, useState, type ReactNode } from 'react'
import { METERS_PER_MILE } from '../lib/physics'
import type { CourseLive, CourseOption } from '../lib/ride'
import { Button } from './Button'
import { PickerRow as Row } from './PickerRow'

interface CoursePickerProps {
  courses: CourseOption[]
  loaded: boolean
  selected: CourseLive | null
  onSelect: (id: string | null) => void
  onStartMi: (mi: number) => void
  onImport: (file: File) => void
  onRemove: (id: string) => void
  /** Course / Workout switch, shown in the header. */
  switcher: ReactNode
}

/** Free ride or a course, plus the start mile. Shown only before a ride starts. */
export function CoursePicker({ courses, loaded, selected, onSelect, onStartMi, onImport, onRemove, switcher }: CoursePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [startText, setStartText] = useState('')
  const startMi = selected?.startMi ?? 0

  useEffect(() => {
    setStartText(startMi.toFixed(1))
  }, [startMi, selected?.course.id])

  const commitStart = () => {
    const v = Number.parseFloat(startText)
    if (Number.isFinite(v)) onStartMi(v)
    else setStartText(startMi.toFixed(1))
  }

  const lengthMi = selected ? selected.course.lengthM / METERS_PER_MILE : 0

  return (
    <section aria-label="Choose a course" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {switcher}
        <Button onClick={() => fileRef.current?.click()}>Import GPX</Button>
        <input
          ref={fileRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
      </div>
      <div role="radiogroup" aria-label="Course">
        <Row checked={!selected} onClick={() => onSelect(null)} title="Free ride" meta="flat road, no course" />
        {!loaded && <div className="border-t border-line px-6 py-3 text-fg-subtle">Loading courses</div>}
        {courses.map((c) => (
          <Row
            key={c.id}
            checked={selected?.course.id === c.id}
            onClick={() => onSelect(c.id)}
            title={c.name}
            meta={`${c.lengthMi.toFixed(1)} mi · ${Math.round(c.ascentFt).toLocaleString()} ft climbing${
              c.source === 'imported' ? ' · imported' : ''
            }`}
            action={
              c.source === 'imported' ? (
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
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
        <div className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-4">
          <label htmlFor="start-mi" className="ww-label">
            Start at mile
          </label>
          <input
            id="start-mi"
            type="number"
            inputMode="decimal"
            min={0}
            max={Math.max(0, lengthMi - 0.1)}
            step={0.1}
            value={startText}
            onChange={(e) => setStartText(e.target.value)}
            onBlur={commitStart}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              e.stopPropagation()
            }}
            className="ww-num w-[7ch] rounded-md border border-line-strong bg-raised px-3 py-2 text-title text-fg"
          />
          <span className="text-fg-muted">of {lengthMi.toFixed(1)} mi</span>
          {startMi > 0 && <Button onClick={() => onStartMi(0)}>From the start</Button>}
          {selected.lastEndMi !== null && (
            <span className="font-mono text-mono text-fg-subtle">
              last ride ended at mile {selected.lastEndMi.toFixed(1)}
            </span>
          )}
        </div>
      )}
    </section>
  )
}
