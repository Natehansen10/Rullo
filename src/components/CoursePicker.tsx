import { useEffect, useState } from 'react'
import { METERS_PER_MILE } from '../lib/physics'
import { MOVE_ANY, moveStyle } from '../lib/viewTransition'
import type { CourseOption, StagedCourse } from '../lib/ride'
import { Button } from './Button'
import { CourseOverview } from './CourseOverview'

const CARD = 'ww-press flex min-h-[9rem] cursor-pointer flex-col justify-between gap-3 rounded-lg border p-4 text-left'
/** Keep a near-flat course from looking like a mountain on its card. */
const MIN_RANGE_M = 15

/** The course's elevation as a small filled line, the course twin of the workout card's strip. */
function CardProfile({ points, onRaised }: { points: [number, number][]; onRaised: boolean }) {
  const last = points[points.length - 1]?.[0] || 1
  let lo = Infinity
  let hi = -Infinity
  for (const [, e] of points) {
    lo = Math.min(lo, e)
    hi = Math.max(hi, e)
  }
  const range = Math.max(MIN_RANGE_M, hi - lo)
  const base = lo - (range - (hi - lo)) / 2
  const line = points.map(([s, e], i) => `${i === 0 ? 'M' : 'L'}${((s / last) * 100).toFixed(2)},${(44 - ((e - base) / range) * 40).toFixed(2)}`).join('')
  return (
    <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="ww-profile-compact block w-full" aria-hidden>
      <path d={`${line}L100,48L0,48Z`} fill={onRaised ? 'var(--ww-line)' : 'var(--ww-raised)'} />
      <path d={line} fill="none" stroke="var(--ww-fg-subtle)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

interface CoursePickerProps {
  courses: CourseOption[]
  loaded: boolean
  /** The course picked on this tab. It is not on the Ride tab until the rider confirms in step 2. */
  selected: StagedCourse | null
  onSelect: (id: string | null) => void
  onStartMi: (mi: number) => void
}

/**
 * Step 1 on the Workout tab: a flat road or a course, as cards with a small
 * elevation profile. The selected course's overview and start mile show under the grid.
 */
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

  // Draw-in: the profile is drawn when a course is picked here, not when the step is shown with one already picked.
  const courseId = selected?.course.id ?? null
  const [seen, setSeen] = useState({ id: courseId, picks: 0 })
  if (seen.id !== courseId) setSeen({ id: courseId, picks: seen.picks + 1 })

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Course" className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        <button
          type="button"
          role="radio"
          aria-checked={!selected}
          aria-label="Flat road, no course, no hills"
          onClick={() => onSelect(null)}
          className={`${CARD} ${!selected ? 'border-fg bg-raised' : 'border-line bg-surface hover:bg-bg'}`}
        >
          <span className="ww-profile-compact flex items-end">
            <span className="w-full border-b border-line-strong" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-semibold text-fg">Flat road</span>
            <span className="font-mono text-mono text-fg-subtle">no course, no hills</span>
          </span>
        </button>
        {courses.map((c) => {
          const checked = selected?.course.id === c.id
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onSelect(c.id)}
              className={`${CARD} ${checked ? 'border-fg bg-raised' : 'border-line bg-surface hover:bg-bg'}`}
            >
              <CardProfile points={c.profile} onRaised={checked} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-semibold text-fg">{c.name}</span>
                <span className="truncate font-mono text-mono text-fg-subtle">
                  {c.lengthMi.toFixed(1)} mi · {Math.round(c.ascentFt).toLocaleString()} ft climbing
                  {c.source === 'imported' ? ' · imported' : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {!loaded && <p className="text-fg-subtle">Loading courses</p>}
      {selected && (
        <section
          aria-label="Course overview"
          className={`flex flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-4 ${MOVE_ANY}`}
          style={moveStyle('ww-course-overview')}
        >
          <h2 className="text-title font-semibold text-fg">{selected.course.name}</h2>
          <CourseOverview course={selected.course} startMi={startMi} drawKey={seen.picks} />
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
              <span className="font-mono text-mono text-fg-subtle">last ride ended at mile {selected.lastEndMi.toFixed(1)}</span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
