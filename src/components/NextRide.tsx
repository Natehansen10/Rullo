import { useMemo } from 'react'
import { profilePoints } from '../lib/course'
import { FEET_PER_METER, METERS_PER_MILE } from '../lib/physics'
import type { RideSnapshot } from '../lib/ride'
import { dateOf } from '../lib/rideFormat'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { CardProfile } from './CoursePicker'
import { Stat } from './Stat'
import { rideSetup, setupDetail, setupName } from './WorkoutPage'
import { WorkoutStrip } from './WorkoutStrip'

interface NextRideProps {
  s: RideSnapshot
  /** To the Workout tab, to pick a course and a workout. */
  onSetup: () => void
  /** To the Ride tab. */
  onRide: () => void
}

/** Points along the course for the profile: enough for a smooth line at the panel's full width. */
const PROFILE_POINTS = 240

/** What the panel is about, its one sentence, and where its button goes. One primary button on the screen. */
function nextStep(s: RideSnapshot): { label: string; text: string; ride: boolean } {
  if (s.phase === 'riding') return { label: 'Riding now', text: 'Your ride is on.', ride: true }
  if (s.phase === 'ended') return { label: 'Last ride', text: 'Your ride has ended. Download it or start a new one on the Ride tab.', ride: true }
  if (s.resuming) return { label: 'Unfinished ride', text: 'Your unfinished ride is ready to resume on the Ride tab.', ride: true }
  if (s.recovery) return { label: 'Next ride', text: 'An unfinished ride is waiting on the Ride tab.', ride: true }
  if (s.phase === 'ready') return { label: 'Next ride', text: 'On the Ride tab now. The trainer is connected.', ride: true }
  if (s.course || s.workout) return { label: 'Next ride', text: 'On the Ride tab now.', ride: true }
  return { label: 'Next ride', text: 'Pick a course and a workout. Or press Connect to ride free on a flat road.', ride: false }
}

/**
 * Home's first panel and the largest thing on the page: what the Ride tab is
 * set up to ride, drawn (the course's elevation, the workout's blocks), with
 * the page's one primary button. Left-aligned. It shows the setup, never the
 * ride's progress: Olive is the button and nothing else here.
 */
export function NextRide({ s, onSetup, onRide }: NextRideProps) {
  const next = nextStep(s)
  /** An unfinished ride that has not been resumed: the Ride tab does not have its course and workout yet, so none is named. */
  const waiting = !!s.recovery && !s.resuming && s.phase !== 'riding' && s.phase !== 'ended'
  const setup = rideSetup(s)
  const course = waiting ? null : (s.course?.course ?? null)
  const workout = waiting ? null : s.workout
  const points = useMemo(() => (course ? profilePoints(course, PROFILE_POINTS) : null), [course])
  const started = s.recovery ? dateOf(s.recovery.startedAt, Date.now()) : null

  return (
    <section aria-label="Next ride" className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ww-label">{next.label}</span>
          <h2 className="text-title font-semibold text-fg" data-next-title>
            {waiting ? 'Unfinished ride' : setupName(setup)}
          </h2>
          <p className="text-fg-muted">{next.text}</p>
        </div>
        <Button variant="primary" onClick={next.ride ? onRide : onSetup}>
          {next.ride ? 'Go to Ride' : 'Set up a ride'}
        </Button>
      </div>

      {waiting ? (
        <p className="font-mono text-mono text-fg-subtle">
          started {started?.day} at {started?.time} · {s.recovery?.distanceMi.toFixed(1)} mi so far
        </p>
      ) : !course && !workout ? (
        // Nothing picked is a ride too: a flat road, drawn as its baseline, the way the Flat road card draws it.
        <div className="flex flex-col gap-2">
          <span aria-hidden className="ww-profile-compact flex items-end">
            <span className="w-full border-b border-line-strong" />
          </span>
          <span className="font-mono text-mono text-fg-subtle">no hills, no targets · {setupDetail(setup)}</span>
        </div>
      ) : (
        <div className={`grid gap-x-8 gap-y-6 ${course && workout ? 'md:grid-cols-2' : ''}`}>
          {course && points && (
            <div className="flex min-w-0 flex-col gap-3" data-next-course>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <Stat label="Distance" value={(course.lengthM / METERS_PER_MILE).toFixed(1)} unit="mi" dim={false} />
                <Stat label="Climbing" value={Math.round(course.ascentM * FEET_PER_METER).toLocaleString()} unit="ft" dim={false} />
              </div>
              <CardProfile points={points} heightClass="ww-profile" />
              <span className="truncate font-mono text-mono text-fg-subtle">
                {setup.course && setup.course.startMi > 0 ? `starts at mile ${setup.course.startMi.toFixed(1)} · ` : ''}
                {workout ? 'the course sets speed' : 'the hills set the load'}
              </span>
            </div>
          )}
          {workout && (
            <div className="flex min-w-0 flex-col gap-3" data-next-workout>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <Stat label="Duration" value={workout.workout.rampTest ? '--' : formatDuration(workout.totalS)} dim={false} />
                <Stat label="Intervals" value={String(workout.intervals.length)} dim={false} />
              </div>
              <WorkoutStrip
                intervals={workout.intervals}
                ftpW={s.profile.ftpW}
                totalS={workout.totalS}
                intensityPct={workout.intensityPct}
                heightClass="ww-profile"
                details={false}
              />
              <span className="truncate font-mono text-mono text-fg-subtle">
                {workout.workout.rampTest ? 'ramp test · ' : ''}the workout sets the load
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
