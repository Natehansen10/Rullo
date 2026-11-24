import type { ReactNode } from 'react'
import type { RideSnapshot } from '../lib/ride'
import { METERS_PER_MILE } from '../lib/physics'
import { MOVE_ANY, MOVE_STEP, moveLayout, moveStyle } from '../lib/viewTransition'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { CoursePicker } from './CoursePicker'
import { WorkoutPicker } from './WorkoutPicker'

interface WorkoutPageProps {
  s: RideSnapshot
  /** Pick a course on this tab (null is a flat road). Nothing reaches the Ride tab. */
  onStageCourse: (id: string | null) => void
  onStartMi: (mi: number) => void
  /** Pick a workout on this tab (null is a free ride). Nothing reaches the Ride tab. */
  onStageWorkout: (id: string | null) => void
  /**
   * Put the setup on the Ride tab and go there. With a workout id, that
   * workout is picked first ("Ride this workout"); with none, the picks as they stand (Done).
   */
  onConfirm: (workoutId?: string) => void
  /** Which step shows. Kept by the app, so a trip to the builder comes back to step 2. */
  step: 0 | 1
  onStep: (step: 0 | 1) => void
  onNewWorkout: () => void
  onEditWorkout: (id: string) => void
  onCopyWorkout: (id: string) => void
  onRemoveWorkout: (id: string) => void
  /** The selected workout's overview is open. Kept by the app, so saving in the builder lands on it. */
  detail: string | null
  onDetail: (id: string | null) => void
  notice?: ReactNode
}

/** A setup, staged or on the ride, reduced to what the setup line says. */
interface Setup {
  course: { name: string; lengthMi: number; startMi: number } | null
  workout: { name: string; durationS: number; rampTest: boolean } | null
}

/** What the rider picked on this tab. */
function stagedSetup(s: RideSnapshot): Setup {
  const c = s.staged.course
  const w = s.staged.workout
  return {
    course: c ? { name: c.course.name, lengthMi: c.course.lengthM / METERS_PER_MILE, startMi: c.startMi } : null,
    workout: w ? { name: w.name, durationS: w.durationS, rampTest: w.rampTest } : null,
  }
}

/** What the Ride tab has: the confirmed setup. */
export function rideSetup(s: RideSnapshot): Setup {
  const c = s.course
  const w = s.workout
  return {
    course: c ? { name: c.course.name, lengthMi: c.course.lengthM / METERS_PER_MILE, startMi: c.startMi } : null,
    workout: w ? { name: w.workout.name, durationS: w.totalS, rampTest: !!w.workout.rampTest } : null,
  }
}

/** The setup in one line: "Test Hills · Sweet Spot 3x12", "Test Hills · Free ride", "Flat road · Free ride". */
export function setupName(x: Setup): string {
  return `${x.course?.name ?? 'Flat road'} · ${x.workout?.name ?? 'Free ride'}`
}

/** What the trainer will do with this setup, in a few words. */
export function setupDetail(x: Setup): string {
  const c = x.course
  const w = x.workout
  const where = c ? `${(c.lengthMi - c.startMi).toFixed(1)} mi${c.startMi > 0 ? ` from mile ${c.startMi.toFixed(1)}` : ''}` : null
  const what = w
    ? `${w.rampTest ? 'ramp test' : formatDuration(w.durationS)}, the workout sets the load`
    : c
      ? 'the hills set the load'
      : 'you set the load'
  return where ? `${where} · ${what}` : what
}

/** Layout moves (see moveLayout): the step's content slides, and the setup line under it moves to its new place. */
const STEP_BODY = moveStyle('ww-step')
const SETUP_LINE = moveStyle('ww-setup-line')

const STEPS = [
  { title: '1. Choose your course', help: 'Where you ride. The course sets elevation, speed and distance.' },
  { title: '2. Choose your workout', help: 'What the trainer does. A workout sets power targets; a free ride leaves it to the course or to you.' },
] as const

/**
 * Plan the next ride in two steps: the course, then the workout. The picks
 * are staged here and reach the Ride tab only when the rider confirms them
 * (Ride this workout, or Done). With a workout the trainer follows its
 * targets (ERG); on a course with no workout it follows the hills (Grade);
 * the rider can always switch on the Ride tab.
 * Open until Start is pressed (connected or not). Locked from Start until New ride.
 */
export function WorkoutPage({
  s,
  notice,
  onStageCourse,
  onStartMi,
  onStageWorkout,
  onConfirm,
  step,
  onStep: setStep,
  onNewWorkout,
  onEditWorkout,
  onCopyWorkout,
  onRemoveWorkout,
  detail,
  onDetail,
}: WorkoutPageProps) {
  const locked = !s.canChooseCourse
  /** Step slide: forward comes in from the right, back from the left. */
  const goStep = (to: 0 | 1) => void moveLayout(() => setStep(to), to > step ? 'step-next' : 'step-back')
  /** Looking at a workout, or back to the grid: the card opens into the overview and closes back into the card. */
  const setDetail = (id: string | null) => void moveLayout(() => onDetail(id), 'open')
  // Locked: the ride's own setup. Otherwise: the picks on this tab, and what the Ride tab has if that differs.
  const shown = locked ? rideSetup(s) : stagedSetup(s)
  const summary = (
    <div className="flex min-w-0 flex-col gap-1" aria-live="polite">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="ww-label">{locked ? (s.phase === 'ended' ? 'Last ride' : 'Riding') : 'Picked'}</span>
        <span className="font-semibold text-fg">{setupName(shown)}</span>
        <span className="font-mono text-mono text-fg-subtle">{setupDetail(shown)}</span>
      </div>
      {!locked && (
        <span className="text-fg-muted">
          {s.staged.onRide
            ? 'This is on the Ride tab now.'
            : `Not on the Ride tab yet. The Ride tab has ${setupName(rideSetup(s))}.`}
        </span>
      )}
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
      <div className={`flex flex-col gap-1 ${MOVE_STEP}`} style={moveStyle('ww-step-head')}>
        <span className="font-mono text-mono text-fg-subtle">Step {step + 1} of 2</span>
        <h1 className="text-title font-semibold text-fg">{STEPS[step].title}</h1>
        <p className="text-fg-muted">{STEPS[step].help}</p>
      </div>
      {notice}
      {step === 0 ? (
        <>
          <div className={MOVE_STEP} style={STEP_BODY}>
            <CoursePicker
              courses={s.courses}
              loaded={s.coursesLoaded}
              selected={s.staged.course}
              // The overview opens under the grid and the setup line moves down to make room.
              onSelect={(id) => void moveLayout(() => onStageCourse(id), 'course')}
              onStartMi={onStartMi}
            />
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4 ${MOVE_ANY}`} style={SETUP_LINE}>
            {summary}
            <Button variant="primary" onClick={() => goStep(1)}>
              Next: choose your workout
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={MOVE_STEP} style={STEP_BODY}>
          <WorkoutPicker
            workouts={s.workouts}
            loaded={s.workoutsLoaded}
            pickedId={s.staged.workout?.id ?? null}
            onRideId={s.workout?.workout.id ?? null}
            onCourse={!!s.staged.course}
            ftpW={s.profile.ftpW}
            onFreeRide={() => onStageWorkout(null)}
            detail={detail}
            onDetail={setDetail}
            onRide={onConfirm}
            onNew={onNewWorkout}
            onEdit={onEditWorkout}
            onCopy={onCopyWorkout}
            onRemove={onRemoveWorkout}
          />
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4 ${MOVE_ANY}`} style={SETUP_LINE}>
            {summary}
            <div className="flex shrink-0 gap-3">
              <Button onClick={() => goStep(0)}>Back</Button>
              {/* In a workout's overview, "Ride this workout" is the one primary button. */}
              {!detail && (
                // Confirms exactly the line beside it: the picked course with the picked workout or free ride.
                <Button variant="primary" onClick={() => onConfirm()}>
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
