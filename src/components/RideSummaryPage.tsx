import { useEffect, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { downloadFit } from '../lib/fit'
import { BEST_LABEL, BEST_WINDOWS_S, deleteRide, loadHistory, peekHistory, prGainsOf, type BestWindow, type RideSummary } from '../lib/history'
import type { RideSnapshot } from '../lib/ride'
import { loadRideDetail, type RideDetail } from '../lib/rideDetail'
import { dateOf, feet, hms, miles, setupOf } from '../lib/rideFormat'
import { ZONES } from '../lib/workout'
import { Button } from './Button'
import { PrChip } from './HomePage'
import { RideCharts } from './RideCharts'
import { Stat } from './Stat'

interface RideSummaryPageProps {
  rideId: number
  s: RideSnapshot
  /** Back to Home. */
  onBack: () => void
  /** The ride was deleted for good. Called before onBack. */
  onDeleted?: (rideId: number) => void
  /**
   * This is the ride that just ended: the finish screen. The header says the
   * ride is saved, a PR is written out under it, and Download FIT is in the
   * top bar with the ride's other buttons, not on the page.
   */
  finished?: boolean
  /** The rider has come straight from End Ride: the stats enter and the charts draw in, once. */
  arrive?: boolean
  /** The arrival has been taken: opening this page again plays nothing. */
  onArrived?: () => void
  /** Notices about the ended ride, shown above the panel on the finish screen. */
  notice?: ReactNode
}

const CONFIRM_MS = 3000
/** On arrival each stat enters this long after the one before it. */
const ARRIVE_STAGGER_MS = 40

/** The one-time enter of the `i`th stat on arrival, or nothing. */
function enterAt(on: boolean, i: number): { className?: string; style?: CSSProperties } {
  return on ? { className: 'ww-enter', style: { '--ww-enter-delay': `${i * ARRIVE_STAGGER_MS}ms` } as CSSProperties } : {}
}

/**
 * One finished ride: its numbers, a line each for power, cadence, heart rate
 * and elevation over moving time, time in each power zone, and its power
 * bests. A side trip from Home. Everything is read from the saved samples;
 * the totals are the FIT file's own.
 */
export function RideSummaryPage({ rideId, s, onBack, onDeleted, finished = false, arrive = false, onArrived, notice }: RideSummaryPageProps) {
  /** undefined: reading. null: no such finished ride. */
  const [detail, setDetail] = useState<RideDetail | null | undefined>(undefined)
  const [history, setHistory] = useState<RideSummary[] | null>(peekHistory)
  /** Every ride has been read this visit, the one on screen included: its PRs are known. */
  const [historyRead, setHistoryRead] = useState(false)
  /** Taken once when the page opens, so nothing plays again on a later draw or a later visit. */
  const [arriving] = useState(arrive)
  useEffect(() => {
    if (arriving) onArrived?.()
    // Once, when the page opens.
  }, [])
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
      .then((all) => {
        if (!live) return
        setHistory(all)
        setHistoryRead(true)
      })
      .catch(() => live && setHistoryRead(true))
    return () => {
      live = false
    }
  }, [rideId, ftpW])

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const gains = useMemo(() => (history ? prGainsOf(history, rideId) : []), [history, rideId])
  const prs = useMemo(() => gains.map((g) => g.win), [gains])

  // The finish screen waits for the PRs too, so the "New best" lines never push the page down after it has drawn.
  if (detail === undefined || (finished && detail !== null && !historyRead)) return <p className="text-fg-subtle">Loading ride</p>
  if (detail === null) {
    return (
      <div className="flex max-w-7xl flex-col items-start gap-4">
        <h1 className="text-title font-semibold text-fg">Ride not found</h1>
        <p className="text-fg-muted">This ride is not saved in this browser. It may have been deleted, or it was never ended.</p>
        {/* On the finish screen the top bar still has the ended ride's primary. */}
        <Button variant={finished ? 'secondary' : 'primary'} onClick={onBack}>
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
  const zoneMax = Math.max(1, ...detail.zoneS)

  const onDelete = () => {
    if (!confirmDelete) return setConfirmDelete(true)
    setConfirmDelete(false)
    deleteRide(rideId)
      .then(() => {
        onDeleted?.(rideId)
        onBack()
      })
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
    <div className="flex max-w-7xl flex-col gap-4">
      {notice}
      <section aria-label="Ride summary" className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-3">
          <Button onClick={onBack}>← Home</Button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {finished && <span className="ww-label">Ride saved</span>}
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-title font-semibold text-fg">
                {day}, {time}
              </h1>
              {/* The finish screen writes each PR out in the band below. */}
              {!finished && prs.length > 0 && <PrChip windows={prs} />}
            </div>
            <span className="truncate font-mono text-mono text-fg-subtle">{setup}</span>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button variant={confirmDelete ? 'danger' : 'secondary'} onClick={onDelete}>
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </Button>
            {/* The ride that just ended has its Download FIT in the top bar, with Upload to Strava and New ride. */}
            {!finished && (
              <Button variant="primary" onClick={onDownload}>
                Download FIT
              </Button>
            )}
          </div>
        </div>
        {message && (
          <p className="border-b border-line px-6 py-3 text-fg-muted" aria-live="polite">
            {message}
          </p>
        )}
        {finished && gains.length > 0 && (
          <ul aria-label="New power bests" className="flex flex-col gap-2 border-b border-line px-6 py-4">
            {gains.map((g, i) => (
              <li key={g.win} {...enterAt(arriving, i)}>
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <PrChip windows={[g.win]} />
                  <span className="font-semibold text-fg">
                    New best: {BEST_LABEL[g.win]}, {g.w} W
                  </span>
                  <span className="font-mono text-mono text-fg-muted">
                    up {g.w - g.prevW} W from {g.prevW} W
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-6 py-4">
          {[
            <Stat key="time" label="Moving time" value={hms(t.timerMs)} dim={false} />,
            <Stat key="dist" label="Distance" value={miles(t.distanceM, 2)} unit="mi" dim={false} />,
            detail.hasAltitude && <Stat key="climb" label="Climbed" value={feet(t.ascentM)} unit="ft" dim={false} />,
            <Stat key="avgw" label="Avg power" value={String(Math.round(t.avgPowerW))} unit="W" dim={false} />,
            <Stat key="maxw" label="Max power" value={String(Math.round(t.maxPowerW))} unit="W" dim={false} />,
            <Stat key="work" label="Work" value={Math.round(t.workJ / 1000).toLocaleString()} unit="kJ" dim={false} />,
            <Stat key="cad" label="Avg cadence" value={String(Math.round(t.avgCadenceRpm))} unit="rpm" dim={false} />,
            t.avgHeartRateBpm !== null && <Stat key="avghr" label="Avg heart rate" value={String(Math.round(t.avgHeartRateBpm))} unit="bpm" dim={false} />,
            t.maxHeartRateBpm !== null && <Stat key="maxhr" label="Max heart rate" value={String(Math.round(t.maxHeartRateBpm))} unit="bpm" dim={false} />,
          ]
            .filter((x): x is ReactElement => !!x)
            // On arrival each stat enters once, a step after the one before. Opened from Home they are just there.
            .map((stat, i) => (
              <div key={stat.key} {...enterAt(arriving, gains.length + i)}>
                {stat}
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-fg">The ride</h2>
            <p className="text-fg-muted">
              Over moving time{paused >= 1000 ? `; ${hms(paused)} of pauses left out` : ''}.
              {detail.lapStarts.length > 0 ? ' The faint lines are the workout intervals.' : ''}
            </p>
          </div>
          <RideCharts detail={detail} drawIn={arriving} />
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
