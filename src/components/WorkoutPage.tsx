import type { ReactNode } from 'react'
import type { RideSnapshot } from '../lib/ride'
import { formatDuration } from '../lib/workout'
import { CoursePicker } from './CoursePicker'
import { WorkoutPicker } from './WorkoutPicker'

interface WorkoutPageProps {
  s: RideSnapshot
  onSelectCourse: (id: string | null) => void
  onStartMi: (mi: number) => void
  onImportCourse: (f: File) => void
  onRemoveCourse: (id: string) => void
  onSelectWorkout: (id: string | null) => void
  onImportWorkout: (f: File) => void
  onRemoveWorkout: (id: string) => void
  notice?: ReactNode
}

/** The setup in one line: "Test Hills · Sweet Spot 3x12", "Test Hills", "Sweet Spot 3x12" or "Free ride". */
export function setupName(s: RideSnapshot): string {
  const names = [s.course?.course.name, s.workout?.workout.name].filter(Boolean)
  return names.length ? names.join(' · ') : 'Free ride'
}

function setupDetail(s: RideSnapshot): string {
  const c = s.course
  const w = s.workout
  const where = c
    ? `${(c.toGoMi + c.positionMi - c.startMi).toFixed(1)} mi${c.startMi > 0 ? ` from mile ${c.startMi.toFixed(1)}` : ''}`
    : 'flat road'
  const what = w
    ? w.workout.rampTest
      ? 'ramp test in ERG'
      : `${formatDuration(w.totalS)} in ERG`
    : 'your own resistance or ERG target'
  return `${where} · ${what}`
}

/**
 * Plan the next ride as one setup: where (a course or a flat road) and what
 * (a workout or none). Any combination works. Locked from the first pedal
 * stroke until New ride.
 */
export function WorkoutPage({ s, notice, ...on }: WorkoutPageProps) {
  const locked = !s.canChooseCourse
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-fg">Workout</h1>
        <p className="text-fg-muted">
          Pick where you ride and what the trainer does. Any mix works: a course, a workout, both or neither.
        </p>
      </div>
      {notice}
      <div className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4" aria-live="polite">
          <span className="ww-label">{locked ? (s.phase === 'ended' ? 'Last ride' : 'Riding') : 'Next ride'}</span>
          <span className="text-title font-semibold text-fg">{setupName(s)}</span>
          <span className="font-mono text-mono text-fg-subtle">{setupDetail(s)}</span>
          {locked && (
            <span className="ml-auto text-fg-muted">
              {s.phase === 'ended' ? 'Press New ride to pick the next one.' : 'End the ride to change it.'}
            </span>
          )}
        </div>
        {!locked && (
          <div className="grid grid-cols-1 items-start border-t border-line xl:grid-cols-2">
            <CoursePicker
              courses={s.courses}
              loaded={s.coursesLoaded}
              selected={s.course}
              onSelect={on.onSelectCourse}
              onStartMi={on.onStartMi}
              onImport={on.onImportCourse}
              onRemove={on.onRemoveCourse}
            />
            <div className="h-full border-t border-line xl:border-t-0 xl:border-l">
              <WorkoutPicker
                workouts={s.workouts}
                loaded={s.workoutsLoaded}
                selected={s.workout}
                ftpW={s.profile.ftpW}
                onSelect={on.onSelectWorkout}
                onImport={on.onImportWorkout}
                onRemove={on.onRemoveWorkout}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
