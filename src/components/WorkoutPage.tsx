import type { ReactNode } from 'react'
import type { RideSnapshot } from '../lib/ride'
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

/**
 * Plan the next ride: a course or a structured workout (never both), plus
 * GPX and ZWO import. Locked from the first pedal stroke until New ride.
 */
export function WorkoutPage({ s, notice, ...on }: WorkoutPageProps) {
  const picked = s.workout ? s.workout.workout.name : s.course ? s.course.course.name : 'Free ride'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-fg">Workout</h1>
        <p className="text-fg-muted">
          Pick a course or a workout for your next ride. Picking one clears the other. Workouts run in ERG on a flat road.
        </p>
      </div>
      {notice}
      {!s.canChooseCourse ? (
        <div className="rounded-lg border border-line bg-surface px-6 py-4 text-fg">
          Riding: <span className="font-semibold">{picked}</span>.{' '}
          {s.phase === 'ended' ? 'Press New ride to pick the next one.' : 'End the ride to change it.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <CoursePicker
            courses={s.courses}
            loaded={s.coursesLoaded}
            selected={s.course}
            onSelect={on.onSelectCourse}
            onStartMi={on.onStartMi}
            onImport={on.onImportCourse}
            onRemove={on.onRemoveCourse}
          />
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
      )}
    </div>
  )
}
