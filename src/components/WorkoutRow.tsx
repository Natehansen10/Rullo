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
  onSkip: () => void
  onApplyFtp: () => void
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
export function WorkoutRow({ live, ftpW, dim = false, canSkip, onSkip, onApplyFtp, className = '' }: WorkoutRowProps) {
  const iv = live.intervals[live.index]
  const test = live.rampTest
  const inRamp = !!test && !test.ended && live.index > 0
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-end gap-8">
        <div className="flex flex-col gap-2">
          <span className="ww-label">Workout</span>
          <span className="text-title font-semibold whitespace-nowrap text-fg">{live.workout.name}</span>
        </div>
        <Stat
          label={iv.label || 'Interval'}
          value={`${live.index + 1}`}
          unit={`of ${live.intervals.length}`}
          dim={dim}
        />
        <Stat label="Target" value={String(live.targetW)} unit={`W · ${Math.round(live.targetPct)}%`} dim={dim} />
        <Stat label={inRamp ? 'Step left' : 'Interval left'} value={formatClock(live.intervalLeftS)} dim={dim} />
        {test ? (
          <Stat label="Best minute" value={test.bestW === null ? '--' : String(test.bestW)} unit="W" dim={dim} />
        ) : (
          <Stat label="Next" value={live.nextTargetW === null ? '--' : String(live.nextTargetW)} unit="W" dim={dim} />
        )}
        <Stat label="Workout left" value={formatClock(live.totalS - live.elapsedS)} dim={dim} />
        <div className="ml-auto flex items-center gap-3">
          {live.done && <span className="ww-label text-state-on">Workout complete</span>}
          {test?.ended && test.ftpW !== null && (
            <>
              <span className="text-fg">
                FTP estimate <span className="font-semibold">{test.ftpW} W</span>
              </span>
              {test.applied || test.ftpW === ftpW ? (
                <span className="ww-label text-state-on">Saved to profile</span>
              ) : (
                <Button onClick={onApplyFtp}>Set FTP to {test.ftpW} W</Button>
              )}
            </>
          )}
          {!live.done && (
            <Button onClick={onSkip} disabled={!canSkip}>
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
        heightClass="ww-profile"
      />
      <span className="sr-only">
        Interval {live.index + 1} of {live.intervals.length}, target {live.targetW} watts,{' '}
        {formatClock(live.intervalLeftS)} left
      </span>
    </div>
  )
}
