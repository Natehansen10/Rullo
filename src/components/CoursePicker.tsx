import { useEffect, useState } from 'react'
import { METERS_PER_MILE } from '../lib/physics'
import type { CourseLive, CourseOption } from '../lib/ride'
import { Button } from './Button'
import { CourseOverview } from './CourseOverview'
import { PickerRow } from './PickerRow'

interface CoursePickerProps {
  courses: CourseOption[]
  loaded: boolean
  selected: CourseLive | null
  onSelect: (id: string | null) => void
  onStartMi: (mi: number) => void
}

/** Step 1 on the Workout tab: a flat road or a course. The selected course opens its overview and start mile. */
export function CoursePicker({ courses, loaded, selected, onSelect, onStartMi }: CoursePickerProps) {
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
    <div role="radiogroup" aria-label="Course">
      <PickerRow checked={!selected} onClick={() => onSelect(null)} title="Flat road" meta="no course, no hills" />
      {!loaded && <div className="border-t border-line px-6 py-3 text-fg-subtle">Loading courses</div>}
      {courses.map((c) => (
        <PickerRow
          key={c.id}
          checked={selected?.course.id === c.id}
          onClick={() => onSelect(c.id)}
          title={c.name}
          meta={`${c.lengthMi.toFixed(1)} mi · ${Math.round(c.ascentFt).toLocaleString()} ft climbing${
            c.source === 'imported' ? ' · imported' : ''
          }`}
        >
          {selected?.course.id === c.id && (
            <div className="flex flex-col gap-4">
              <CourseOverview course={selected.course} startMi={startMi} />
              <div className="flex flex-wrap items-center gap-4">
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
            </div>
          )}
        </PickerRow>
      ))}
    </div>
  )
}
