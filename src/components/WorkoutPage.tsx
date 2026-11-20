import type { ReactNode } from 'react'
import type { RideSnapshot } from '../lib/ride'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { CoursePicker } from './CoursePicker'
import { WorkoutPicker } from './WorkoutPicker'

interface WorkoutPageProps {
  s: RideSnapshot
  onSelectCourse: (id: string | null) => void
  onStartMi: (mi: number) => void
  onSelectWorkout: (id: string | null) => void
  /** Which step shows. Kept by the app, so a trip to the builder comes back to step 2. */
  step: 0 | 1
  onStep: (step: 0 | 1) => void
  onNewWorkout: () => void
  onEditWorkout: (id: string) => void
  onCopyWorkout: (id: string) => void
  onRemoveWorkout: (id: string) => void
  /** The selected workout's overview is open. Kept by the app, so saving in the builder lands on it. */
  detail: boolean
  onDetail: (open: boolean) => void
  /** Setup done: go to the Ride tab. */
  onDone: () => void
  notice?: ReactNode
}

/** The setup in one line: "Test Hills · Sweet Spot 3x12", "Test Hills · Free ride", "Flat road · Free ride". */
export function setupName(s: RideSnapshot): string {
  return `${s.course?.course.name ?? 'Flat road'} · ${s.workout?.workout.name ?? 'Free ride'}`
}

/** What the trainer will do with this setup, in a few words. */
function setupDetail(s: RideSnapshot): string {
  const c = s.course
  const w = s.workout
  const where = c
    ? `${(c.toGoMi + c.positionMi - c.startMi).toFixed(1)} mi${c.startMi > 0 ? ` from mile ${c.startMi.toFixed(1)}` : ''}`
    : null
  const what = w
    ? `${w.workout.rampTest ? 'ramp test' : formatDuration(w.totalS)}, the workout sets the load`
    : c
      ? 'the hills set the load'
      : 'you set the load'
  return where ? `${where} · ${what}` : what
}

const STEPS = [
  { title: '1. Choose your course', help: 'Where you ride. The course sets elevation, speed and distance.' },
  { title: '2. Choose your workout', help: 'What the trainer does. A workout sets power targets; a free ride leaves it to the course or to you.' },
] as const

/**
 * Plan the next ride in two steps: the course, then the workout. With a
 * workout the trainer follows its targets (ERG); on a course with no workout
 * it follows the hills (Grade); the rider can always switch on the Ride tab.
 * Locked from the first pedal stroke until New ride.
 */
export function WorkoutPage({
  s,
  notice,
  onSelectCourse,
  onStartMi,
  onSelectWorkout,
  step,
  onStep: setStep,
  onNewWorkout,
  onEditWorkout,
  onCopyWorkout,
  onRemoveWorkout,
  detail,
  onDetail,
  onDone,
}: WorkoutPageProps) {
  const locked = !s.canChooseCourse
  const summary = (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
      <span className="ww-label">{locked ? (s.phase === 'ended' ? 'Last ride' : 'Riding') : 'Next ride'}</span>
      <span className="font-semibold text-fg">{setupName(s)}</span>
      <span className="font-mono text-mono text-fg-subtle">{setupDetail(s)}</span>
    </div>
  )

  if (locked) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-title font-semibold text-fg">Workout</h1>
        {notice}
        <div className="flex flex-wrap items-baseline justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4">
          {summary}
          <span className="text-fg-muted">
            {s.phase === 'ended' ? 'Press New ride to pick the next one.' : 'End the ride to change it.'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-mono text-fg-subtle">Step {step + 1} of 2</span>
        <h1 className="text-title font-semibold text-fg">{STEPS[step].title}</h1>
        <p className="text-fg-muted">{STEPS[step].help}</p>
      </div>
      {notice}
      {step === 0 ? (
        <section aria-label={STEPS[0].title} className="overflow-hidden rounded-lg border border-line bg-surface">
          <CoursePicker courses={s.courses} loaded={s.coursesLoaded} selected={s.course} onSelect={onSelectCourse} onStartMi={onStartMi} />
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
            {summary}
            <Button variant="primary" onClick={() => setStep(1)}>
              Next: choose your workout
            </Button>
          </div>
        </section>
      ) : (
        <>
          <WorkoutPicker
            workouts={s.workouts}
            loaded={s.workoutsLoaded}
            selected={s.workout}
            onCourse={!!s.course}
            ftpW={s.profile.ftpW}
            onSelect={onSelectWorkout}
            detail={detail}
            onDetail={onDetail}
            onRide={onDone}
            onNew={onNewWorkout}
            onEdit={onEditWorkout}
            onCopy={onCopyWorkout}
            onRemove={onRemoveWorkout}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4">
            {summary}
            <div className="flex shrink-0 gap-3">
              <Button onClick={() => setStep(0)}>Back</Button>
              {/* In a workout's overview, "Ride this workout" is the one primary button. */}
              {!(detail && s.workout) && (
                <Button variant="primary" onClick={onDone}>
                  Done: go to Ride
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
