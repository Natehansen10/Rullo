import { useEffect, useMemo, useState } from 'react'
import { downloadFit } from '../lib/fit'
import { BEST_LABEL, BEST_WINDOWS_S, deleteRide, loadHistory, peekHistory, prsByRide, type BestWindow, type RideSummary } from '../lib/history'
import { FEET_PER_METER } from '../lib/physics'
import type { RideSnapshot } from '../lib/ride'
import { loadRideDetail, type RideDetail } from '../lib/rideDetail'
import { dateOf, feet, hms, miles, setupOf } from '../lib/rideFormat'
import { ZONES } from '../lib/workout'
import { Button } from './Button'
import { PrChip } from './HomePage'
import { RideChart } from './RideChart'
import { Stat } from './Stat'

interface RideSummaryPageProps {
  rideId: number
  s: RideSnapshot
  /** Back to Home. */
  onBack: () => void
}

const CONFIRM_MS = 3000
/** Elevation charts span at least this much, so a near-flat course does not look like mountains (15 m, as on the course cards). */
const MIN_ELEVATION_RANGE_FT = 50

function ChartRow({ label, detail, children }: { label: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="ww-ride-chart-row">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="ww-label">{label}</span>
        <span className="truncate font-mono text-mono text-fg-muted">{detail}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * One finished ride: its numbers, a line each for power, cadence, heart rate
 * and elevation over moving time, time in each power zone, and its power
 * bests. A side trip from Home. Everything is read from the saved samples;
 * the totals are the FIT file's own.
 */
export function RideSummaryPage({ rideId, s, onBack }: RideSummaryPageProps) {
  /** undefined: reading. null: no such finished ride. */
  const [detail, setDetail] = useState<RideDetail | null | undefined>(undefined)
  const [history, setHistory] = useState<RideSummary[] | null>(peekHistory)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [now] = useState(() => Date.now())
  const ftpW = s.profile.ftpW

  useEffect(() => {
    let live = true
    setDetail(undefined)
    loadRideDetail(rideId, ftpW)
      .then((d) => live && setDetail(d))
      .catch((err) => {
        console.error('Could not read the ride:', err)
        if (live) setDetail(null)
      })
    // The PR tags need every ride's bests; this is a memory read after Home has been open.
    loadHistory()
      .then((all) => live && setHistory(all))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [rideId, ftpW])

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const prs = useMemo(() => (history ? (prsByRide(history).get(rideId) ?? []) : []), [history, rideId])
  const altitudeFt = useMemo(() => detail?.altitudeM.map((m) => (m === null ? null : m * FEET_PER_METER)) ?? [], [detail])

  if (detail === undefined) return <p className="text-fg-subtle">Loading ride</p>
  if (detail === null) {
    return (
      <div className="flex max-w-7xl flex-col items-start gap-4">
        <h1 className="text-title font-semibold text-fg">Ride not found</h1>
        <p className="text-fg-muted">This ride is not saved in this browser. It may have been deleted, or it was never ended.</p>
        <Button variant="primary" onClick={onBack}>
          ← Home
        </Button>
      </div>
    )
  }

  const t = detail.totals
  const { day, time } = dateOf(t.startT, now)
  const snap = detail.ride.workoutSnapshot as { name?: unknown } | null | undefined
  const setup = setupOf(s, {
    courseId: detail.ride.courseId,
    workoutId: detail.ride.workoutId,
    workoutName: snap && typeof snap.name === 'string' ? snap.name.trim().slice(0, 80) : undefined,
  })
  const totalS = detail.powerW.length
  const paused = t.elapsedMs - t.timerMs
  const max = (v: (number | null)[]) => Math.round(Math.max(...v.filter((x): x is number => x !== null)))
  const min = (v: (number | null)[]) => Math.round(Math.min(...v.filter((x): x is number => x !== null)))
  const zoneMax = Math.max(1, ...detail.zoneS)

  const onDelete = () => {
    if (!confirmDelete) return setConfirmDelete(true)
    setConfirmDelete(false)
    deleteRide(rideId)
      .then(onBack)
      .catch((err) => {
        console.error('Could not delete the ride:', err)
        setMessage('Could not delete this ride.')
      })
  }

  const onDownload = () => {
    setMessage(null)
    try {
      downloadFit(detail.samples, detail.samples[0].t)
    } catch (err) {
      console.error('FIT export failed:', err)
      setMessage('Could not build the FIT file. The ride is still saved in this browser.')
    }
  }

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <section aria-label="Ride summary" className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-3">
          <Button onClick={onBack}>← Home</Button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-title font-semibold text-fg">
                {day}, {time}
              </h1>
              {prs.length > 0 && <PrChip windows={prs} />}
            </div>
            <span className="truncate font-mono text-mono text-fg-subtle">{setup}</span>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant={confirmDelete ? 'danger' : 'secondary'} onClick={onDelete}>
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </Button>
            <Button variant="primary" onClick={onDownload}>
              Download FIT
            </Button>
          </div>
        </div>
        {message && (
          <p className="border-b border-line px-6 py-3 text-fg-muted" aria-live="polite">
            {message}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-6 py-4">
          <Stat label="Moving time" value={hms(t.timerMs)} dim={false} />
          <Stat label="Distance" value={miles(t.distanceM, 2)} unit="mi" dim={false} />
          {detail.hasAltitude && <Stat label="Climbed" value={feet(t.ascentM)} unit="ft" dim={false} />}
          <Stat label="Avg power" value={String(Math.round(t.avgPowerW))} unit="W" dim={false} />
          <Stat label="Max power" value={String(Math.round(t.maxPowerW))} unit="W" dim={false} />
          <Stat label="Work" value={Math.round(t.workJ / 1000).toLocaleString()} unit="kJ" dim={false} />
          <Stat label="Avg cadence" value={String(Math.round(t.avgCadenceRpm))} unit="rpm" dim={false} />
          {t.avgHeartRateBpm !== null && <Stat label="Avg heart rate" value={String(Math.round(t.avgHeartRateBpm))} unit="bpm" dim={false} />}
          {t.maxHeartRateBpm !== null && <Stat label="Max heart rate" value={String(Math.round(t.maxHeartRateBpm))} unit="bpm" dim={false} />}
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-fg">The ride</h2>
            <p className="text-fg-muted">
              Over moving time{paused >= 1000 ? `; ${hms(paused)} of pauses left out` : ''}.
              {detail.lapStarts.length > 0 ? ' The faint lines are the workout intervals.' : ''}
            </p>
          </div>
          <ChartRow label="Power" detail={`avg ${Math.round(t.avgPowerW)} · max ${Math.round(t.maxPowerW)} W`}>
            <RideChart values={detail.powerW} color="var(--ww-fg)" marks={detail.lapStarts} minRange={100} />
          </ChartRow>
          <ChartRow label="Cadence" detail={`avg ${Math.round(t.avgCadenceRpm)} · max ${max(detail.cadenceRpm)} rpm`}>
            <RideChart values={detail.cadenceRpm} color="var(--ww-cadence)" marks={detail.lapStarts} minRange={60} />
          </ChartRow>
          {detail.hasHeartRate && t.avgHeartRateBpm !== null && (
            <ChartRow label="Heart rate" detail={`avg ${Math.round(t.avgHeartRateBpm)} · max ${t.maxHeartRateBpm} bpm`}>
              <RideChart values={detail.heartRateBpm} color="var(--ww-fg-muted)" fromZero={false} marks={detail.lapStarts} minRange={30} />
            </ChartRow>
          )}
          {detail.hasAltitude && (
            <ChartRow label="Elevation" detail={`${min(altitudeFt).toLocaleString()} to ${max(altitudeFt).toLocaleString()} ft`}>
              <RideChart values={altitudeFt} color="var(--ww-fg-subtle)" fill fromZero={false} minRange={MIN_ELEVATION_RANGE_FT} />
            </ChartRow>
          )}
          <div className="ww-ride-chart-row" aria-hidden>
            <span />
            <div className="flex justify-between font-mono text-mono text-fg-muted">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i}>{hms(((totalS * i) / 4) * 1000)}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-fg">Time in zone</h2>
            <p className="text-fg-muted">
              {detail.ownFtp
                ? `Each second by its power, in the zones for the FTP you rode it at, ${detail.zoneFtpW} W.`
                : `Each second by its power, in the zones for your FTP of ${detail.zoneFtpW} W today.`}
            </p>
          </div>
          <div className="ww-zone-bars" role="table" aria-label="Time in each power zone">
            {ZONES.map((z, i) => {
              const sec = detail.zoneS[i]
              return (
                <div key={z.zone} role="row" className="contents">
                  <span role="rowheader" className="flex items-center gap-2 font-mono text-mono text-fg">
                    <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: `var(--ww-z${z.zone})` }} />Z{z.zone}
                  </span>
                  <span role="cell" className="text-fg">
                    {z.name}
                  </span>
                  <span role="presentation" className="h-3">
                    <span className="block h-3 rounded-sm" style={{ width: `${(sec / zoneMax) * 100}%`, background: `var(--ww-z${z.zone})` }} />
                  </span>
                  <span role="cell" className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">
                    {hms(sec * 1000)}
                  </span>
                  <span role="cell" className="text-right font-mono text-mono whitespace-nowrap text-fg-muted">
                    {Math.round((sec / totalS) * 100)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-fg">Power bests</h2>
            <p className="text-fg-muted">This ride's best average power over each stretch, with no stop in it. PR: it beat every earlier ride.</p>
          </div>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            {BEST_WINDOWS_S.map((win: BestWindow) => {
              const w = detail.bests[win]
              return (
                <div key={win} className="flex flex-col items-start gap-2">
                  <Stat label={BEST_LABEL[win]} value={w === null ? '--' : String(Math.round(w))} unit={w === null ? undefined : 'W'} dim={w === null} />
                  {prs.includes(win) ? <PrChip windows={[win]} /> : <span className="font-mono text-mono text-fg-subtle">{w === null ? 'ride too short' : ' '}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
