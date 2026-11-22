import { useState } from 'react'
import type { WorkoutLive } from '../lib/ride'
import { Button } from './Button'
import { Stat } from './Stat'
import { WorkoutStrip } from './WorkoutStrip'

interface WorkoutRowProps {
  live: WorkoutLive
  ftpW: number
  /** Gray the numbers out when data is stale or the ride is not live. */
  dim?: boolean
  canSkip: boolean
  /** The ride is over: no Skip button. */
  ended?: boolean
  onSkip: () => void
  onStart: () => void
  onApplyFtp: () => void
  /** Shown together with a course: stats on one line and a shorter strip. */
  compact?: boolean
  className?: string
}

export function formatClock(s: number): string {
  const t = Math.max(0, Math.ceil(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const ss = String(t % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Workout progress in the ride panel: interval stats over a strip of every interval. */
export function WorkoutRow({
  live,
  ftpW,
  dim = false,
  canSkip,
  ended = false,
  onSkip,
  onStart,
  onApplyFtp,
  compact = false,
  className = '',
}: WorkoutRowProps) {
  const iv = live.intervals[live.index]
  const test = live.rampTest
  const inRamp = !!test && !test.ended && live.index > 0
  /** Compact row after a ramp test: the FTP estimate takes the place of two stats so the row stays on one line. */
  const estimateShown = compact && !!test?.ended && test.ftpW !== null
  /** A cadence column shows for the whole workout when any interval has a cue, so the row never shifts mid-ride. */
  const hasCadence = live.intervals.some((x) => x.cadenceRpm !== undefined)
  /** Skip interval and End test are jumps: the strip's position snaps to them. */
  const [skips, setSkips] = useState(0)
  const skip = () => {
    setSkips((n) => n + 1)
    onSkip()
  }
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'} ${className}`}>
      {/* One line at desktop width, compact or not. The name gives way (truncates) before anything wraps. */}
      <div className={`flex flex-wrap gap-y-2 xl:flex-nowrap ${compact ? 'items-center gap-x-6' : 'items-end gap-x-8'}`}>
        <div className={`flex min-w-0 ${compact ? 'items-baseline gap-2' : 'flex-col gap-2'}`}>
          <span className="ww-label">Workout</span>
          <span className="truncate text-title font-semibold text-fg">{live.workout.name}</span>
        </div>
        <Stat
          label={iv.label || 'Interval'}
          value={`${live.index + 1}`}
          unit={`of ${live.intervals.length}`}
          dim={dim}
          inline={compact}
        />
        <Stat label="Target" value={String(live.targetW)} unit={`W · ${Math.round(live.targetPct)}%`} dim={dim} inline={compact} />
        {hasCadence && (
          <Stat
            label={compact ? 'RPM' : 'Cadence'}
            value={live.cadenceTargetRpm === null ? '--' : String(live.cadenceTargetRpm)}
            unit={compact ? undefined : 'rpm'}
            dim={dim || live.cadenceTargetRpm === null}
            inline={compact}
          />
        )}
        <Stat
          label={compact ? 'Left' : inRamp ? 'Step left' : 'Interval left'}
          value={formatClock(live.intervalLeftS)}
          dim={dim}
          inline={compact}
        />
        {estimateShown ? null : test ? (
          <Stat label={compact ? 'Best min' : 'Best minute'} value={test.bestW === null ? '--' : String(test.bestW)} unit="W" dim={dim} inline={compact} />
        ) : (
          <Stat label="Next" value={live.nextTargetW === null ? '--' : String(live.nextTargetW)} unit="W" dim={dim} inline={compact} />
        )}
        {!estimateShown && (
          <Stat
            label={compact ? 'Total left' : 'Workout left'}
            value={formatClock(live.totalS - live.elapsedS)}
            dim={dim}
            inline={compact}
          />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {live.done && <span className="ww-label text-state-on">Workout complete</span>}
          {test?.ended && test.ftpW !== null && (
            <>
              <span className="whitespace-nowrap text-fg">
                FTP estimate <span className="font-semibold">{test.ftpW} W</span>
              </span>
              {test.applied || test.ftpW === ftpW ? (
                <span className="ww-label text-state-on">Saved to profile</span>
              ) : (
                <Button onClick={onApplyFtp}>Set FTP to {test.ftpW} W</Button>
              )}
            </>
          )}
          {/* Start workout is in the top bar. Here: where it is, in words. */}
          {!live.started && !ended && !live.canStart && !compact && (
            <span className="whitespace-nowrap text-fg-muted">{live.waiting ? 'Press Start workout' : 'Connect to start'}</span>
          )}
          {/* Only an old unfinished ride can be riding with its workout not started. */}
          {live.canStart && !ended && <Button onClick={onStart}>Start workout</Button>}
          {live.started && !live.done && !ended && (
            <Button onClick={skip} disabled={!canSkip}>
              {inRamp ? 'End test' : 'Skip interval'}
            </Button>
          )}
        </div>
      </div>
      <WorkoutStrip
        intervals={live.intervals}
        ftpW={ftpW}
        totalS={live.totalS}
        elapsedS={live.elapsedS}
        intensityPct={live.intensityPct}
        frozen={dim}
        snapKey={skips}
        heightClass={compact ? 'ww-strip-compact' : 'ww-profile'}
      />
      <span className="sr-only">
        Interval {live.index + 1} of {live.intervals.length}, target {live.targetW} watts,{' '}
        {live.cadenceTargetRpm !== null && `cadence ${live.cadenceTargetRpm} rpm, `}
        {formatClock(live.intervalLeftS)} left
      </span>
    </div>
  )
}
