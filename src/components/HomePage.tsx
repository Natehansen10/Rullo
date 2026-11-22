import { useEffect, useMemo, useState } from 'react'
import {
  BEST_LABEL,
  BEST_WINDOWS_S,
  bestHolders,
  deleteRide,
  downloadRide,
  lastDays,
  loadHistory,
  peekHistory,
  prsByRide,
  totalsOf,
  type BestWindow,
  type RideSummary,
  type Totals,
} from '../lib/history'
import { dateOf, feet, hms, miles, setupOf } from '../lib/rideFormat'
import { profileHref, summaryHref } from '../hooks/useRoute'
import { BACKUP_NUDGE_RIDES, ridesSinceBackup } from '../lib/backup'
import type { RideSnapshot } from '../lib/ride'
import { Button } from './Button'
import { Stat } from './Stat'
import { ZoneTable } from './ZoneTable'

interface HomePageProps {
  s: RideSnapshot
  /** The rider's name, once there is a rider. */
  riderName: string | null
  /** To the Workout tab, to pick a course and a workout. */
  onSetup: () => void
  /** To the Ride tab. */
  onRide: () => void
}

/** Rows of history shown at first, and added by each Show more. */
const PAGE = 10
const EMPTY = '--'
/** How long Confirm delete stays up before it goes back to Delete. */
const CONFIRM_MS = 3000

/** What the rider should do next, and where its button goes. One primary button on the screen. */
function nextStep(s: RideSnapshot): { text: string; ride: boolean } {
  if (s.phase === 'riding') return { text: 'Your ride is on.', ride: true }
  if (s.phase === 'ended') return { text: 'Your ride has ended. Download it or start a new one on the Ride tab.', ride: true }
  if (s.resuming) return { text: 'Your unfinished ride is ready to resume on the Ride tab.', ride: true }
  if (s.recovery) return { text: 'An unfinished ride is waiting on the Ride tab.', ride: true }
  if (s.course || s.workout) {
    const setup = `${s.course?.course.name ?? 'Flat road'} · ${s.workout?.workout.name ?? 'Free ride'}`
    return { text: `On the Ride tab now: ${setup}.`, ride: true }
  }
  if (s.phase === 'ready') return { text: 'The trainer is connected. Flat road · Free ride is on the Ride tab.', ride: true }
  return { text: 'Pick a course and a workout. Or press Connect to ride free on a flat road.', ride: false }
}

/**
 * A PR tag: this ride beat every earlier ride over these stretches. Neutral
 * chip with the words written out; color carries nothing here.
 */
export function PrChip({ windows, shrink = false }: { windows: BestWindow[]; /** May truncate in a tight row; the full text is its title. */ shrink?: boolean }) {
  const text = `PR ${windows.map((w) => BEST_LABEL[w]).join(' · ')}`
  return (
    <span
      title={shrink ? text : undefined}
      className={`rounded-sm border border-line-strong bg-raised px-2 font-mono text-mono whitespace-nowrap text-fg ${shrink ? 'min-w-0 truncate' : 'shrink-0'}`}
    >
      {text}
    </span>
  )
}

/** One line of totals. `t` is null while rides are still being read: the numbers wait as "--", nothing moves when they land. */
function TotalsRow({ title, t }: { title: string; t: Totals | null }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line px-6 py-4 first:border-t-0">
      <h3 className="font-semibold text-fg">{title}</h3>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <Stat label="Rides" value={t ? String(t.rides) : EMPTY} dim={!t} />
        <Stat label="Time" value={t ? hms(t.movingMs) : EMPTY} dim={!t} />
        <Stat label="Distance" value={t ? miles(t.distanceM, 1) : EMPTY} unit={t ? 'mi' : undefined} dim={!t} />
        <Stat label="Climbed" value={t ? feet(t.ascentM) : EMPTY} unit={t ? 'ft' : undefined} dim={!t} />
      </div>
    </div>
  )
}

/**
 * Home: the rider at a glance. A left rail (rider summary, power zones) and a
 * main column (next step, totals, ride history), laid out after Zwift's home
 * screen and drawn with this system's tokens. Read-only: nothing here changes
 * a ride in progress.
 */
export function HomePage({ s, riderName, onSetup, onRide }: HomePageProps) {
  /** Null until the first rides are read. Newest first; may be the top of the list only while `complete` is false. */
  const [rides, setRides] = useState<RideSummary[] | null>(peekHistory)
  /** Every finished ride has been read, so the totals can be shown. */
  const [complete, setComplete] = useState(() => peekHistory() !== null)
  const [failed, setFailed] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [message, setMessage] = useState<string | null>(null)
  /** Fixed for this visit, so "last 7 days" and the row dates do not shift while the page is open. */
  const [now] = useState(() => Date.now())

  // Read again when a ride starts or ends: End Ride adds a row.
  useEffect(() => {
    let live = true
    loadHistory((partial) => live && setRides(partial))
      .then((all) => {
        if (!live) return
        setRides(all)
        setComplete(true)
        setFailed(false)
      })
      .catch((err) => {
        console.error('Could not read ride history:', err)
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [s.phase])

  /** The ride whose Delete was pressed once. The second press deletes it. */
  const [confirming, setConfirming] = useState<number | null>(null)
  useEffect(() => {
    if (confirming === null) return
    const t = setTimeout(() => setConfirming(null), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirming])

  /** Bests and PR tags wait for the full list: half a list would hand out the wrong PRs. */
  const holders = useMemo(() => (rides && complete ? bestHolders(rides) : null), [rides, complete])
  const prs = useMemo(() => (rides && complete ? prsByRide(rides) : new Map<number, BestWindow[]>()), [rides, complete])

  const next = nextStep(s)
  /** Rides that are in no backup. Waits for the full list, like the totals. */
  const unsaved = useMemo(() => (rides && complete ? ridesSinceBackup(rides) : 0), [rides, complete])

  const onDownload = (r: RideSummary) => {
    setMessage(null)
    downloadRide(r.id).catch((err) => {
      console.error('FIT export failed:', err)
      setMessage('Could not build that FIT file. The ride is still saved in this browser.')
    })
  }

  const onDelete = (r: RideSummary) => {
    if (confirming !== r.id) return setConfirming(r.id)
    setConfirming(null)
    setMessage(null)
    deleteRide(r.id)
      .then(() => setRides((list) => list && list.filter((x) => x.id !== r.id)))
      .catch((err) => {
        console.error('Could not delete the ride:', err)
        setMessage('Could not delete that ride.')
      })
  }

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <h1 className="text-title font-semibold text-fg">Home</h1>
      <div className="ww-home">
        <div className="ww-home-rail">
          <section aria-label="Rider" className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-4">
            <h2 className="truncate font-semibold text-fg">{riderName ?? 'Rider'}</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <Stat label="FTP" value={String(s.profile.ftpW)} unit="W" dim={false} />
              <Stat label="Weight" value={String(s.profile.riderLb)} unit="lb" dim={false} />
            </div>
            <p className="text-fg-muted">Set on the Profile tab.</p>
          </section>
          <section aria-label="Power zones" className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-6 py-4">
            <h2 className="font-semibold text-fg">Power zones</h2>
            <ZoneTable ftpW={s.profile.ftpW} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-label="Next step"
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="font-semibold text-fg">Next</h2>
              <p className="text-fg-muted">{next.text}</p>
            </div>
            <Button variant="primary" onClick={next.ride ? onRide : onSetup}>
              {next.ride ? 'Go to Ride' : 'Set up a ride'}
            </Button>
          </section>

          {unsaved >= BACKUP_NUDGE_RIDES && (
            <section aria-label="Back up" className="rounded-lg border border-line bg-surface px-6 py-4">
              <p className="text-fg">
                {unsaved} rides are not in a backup. They live in this browser only.{' '}
                <a className="ww-link" href={profileHref('data')}>
                  Back up
                </a>
              </p>
            </section>
          )}

          {rides && rides.length > 0 && (
            <section aria-label="Totals" className="rounded-lg border border-line bg-surface">
              <TotalsRow title="All rides" t={complete ? totalsOf(rides) : null} />
              <TotalsRow title="Last 7 days" t={complete ? totalsOf(lastDays(rides, now)) : null} />
            </section>
          )}

          {rides && rides.length > 0 && (
            <section aria-label="Power bests" className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-6 py-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-fg">Power bests</h2>
                <p className="text-fg-muted">Your best average power over each stretch, with no stop in it, and the day you set it.</p>
              </div>
              <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                {BEST_WINDOWS_S.map((win) => {
                  const h = holders?.[win] ?? null
                  return (
                    <div key={win} className="flex flex-col gap-2">
                      <Stat label={BEST_LABEL[win]} value={h ? String(Math.round(h.w)) : EMPTY} unit={h ? 'W' : undefined} dim={!h} />
                      <span className="font-mono text-mono text-fg-subtle">{h ? dateOf(h.startedAt, now).day : complete ? 'no ride this long' : '\u00a0'}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section aria-label="Ride history" className="rounded-lg border border-line bg-surface">
            <div className="flex flex-col gap-1 px-6 py-4">
              <h2 className="font-semibold text-fg">Ride history</h2>
              {failed ? (
                <p className="text-fg-muted">Could not read your saved rides. Check that site data is allowed.</p>
              ) : rides === null ? (
                <p className="text-fg-subtle">Loading rides</p>
              ) : rides.length === 0 ? (
                <p className="text-fg-muted">No rides yet. Each ride you finish will be listed here.</p>
              ) : (
                <p className="text-fg-muted">Saved in this browser. Click a ride for its summary. Time is moving time. Delete removes the ride for good.</p>
              )}
            </div>
            {rides && rides.length > 0 && (
              <>
                <table className="ww-table ww-history">
                  <thead>
                    <tr>
                      <th scope="col" className="ww-label">
                        Ride
                      </th>
                      <th scope="col" className="ww-label text-right whitespace-nowrap">
                        Time
                      </th>
                      <th scope="col" className="ww-label text-right whitespace-nowrap">
                        Distance
                      </th>
                      <th scope="col" className="ww-label text-right whitespace-nowrap">
                        Avg power
                      </th>
                      <th scope="col">
                        <span className="sr-only">File and delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rides.slice(0, shown).map((r) => {
                      const { day, time } = dateOf(r.startedAt, now)
                      return (
                        <tr key={r.id} data-ride={r.id}>
                          <td className="ww-history-ride">
                            <a href={summaryHref(r.id)} aria-label={`Open the ride on ${day} at ${time}`} className="ww-history-link flex min-w-0 flex-col gap-1 no-underline">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="ww-history-day shrink-0 font-semibold whitespace-nowrap text-fg">{day}</span>
                                {prs.has(r.id) && <PrChip windows={prs.get(r.id) as BestWindow[]} shrink />}
                              </span>
                              <span className="truncate font-mono text-mono text-fg-subtle" title={setupOf(s, r)}>
                                {time} · {setupOf(s, r)}
                              </span>
                            </a>
                          </td>
                          <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">{hms(r.movingMs)}</td>
                          <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">
                            {miles(r.distanceM, 2)} <span className="font-normal text-fg-muted">mi</span>
                          </td>
                          <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">
                            {Math.round(r.avgPowerW)} <span className="font-normal text-fg-muted">W</span>
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => onDownload(r)} aria-label={`Download FIT, ride on ${day} at ${time}`}>
                                Download FIT
                              </Button>
                              <Button
                                size="sm"
                                variant={confirming === r.id ? 'danger' : 'secondary'}
                                onClick={() => onDelete(r)}
                                aria-label={`${confirming === r.id ? 'Confirm delete' : 'Delete'}, ride on ${day} at ${time}`}
                                className="ww-history-delete"
                              >
                                {confirming === r.id ? 'Confirm delete' : 'Delete'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {(rides.length > shown || !complete || message) && (
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-3">
                    <span className="text-fg-muted" aria-live="polite">
                      {message ?? (complete ? `Showing ${Math.min(shown, rides.length)} of ${rides.length} rides.` : 'Reading older rides')}
                    </span>
                    {rides.length > shown && <Button onClick={() => setShown((n) => n + PAGE)}>Show more</Button>}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
