import { useEffect, useState } from 'react'
import { downloadRide, lastDays, loadHistory, peekHistory, totalsOf, type RideSummary, type Totals } from '../lib/history'
import { FEET_PER_METER, METERS_PER_MILE } from '../lib/physics'
import type { RideSnapshot } from '../lib/ride'
import { Button } from './Button'
import { Stat } from './Stat'
import { ZoneTable } from './ZoneTable'

interface HomePageProps {
  s: RideSnapshot
  /** To the Workout tab, to pick a course and a workout. */
  onSetup: () => void
  /** To the Ride tab. */
  onRide: () => void
}

/** Rows of history shown at first, and added by each Show more. */
const PAGE = 10
const EMPTY = '--'

function hms(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const ss = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const miles = (m: number, digits: number) =>
  (m / METERS_PER_MILE).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
const feet = (m: number) => Math.round(m * FEET_PER_METER).toLocaleString()

/** The day of a ride ("Fri, Nov 20"; with the year when it is not this one) and its start time. */
function dateOf(t: number, now: number): { day: string; time: string } {
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return {
    day: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }),
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}

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

/** One line of totals. `t` is null while rides are still being read: the numbers wait as "--", nothing moves when they land. */
function TotalsRow({ title, t }: { title: string; t: Totals | null }) {
  const best = t?.best20W ?? null
  return (
    <div className="flex flex-col gap-3 border-t border-line px-6 py-4 first:border-t-0">
      <h3 className="font-semibold text-fg">{title}</h3>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <Stat label="Rides" value={t ? String(t.rides) : EMPTY} dim={!t} />
        <Stat label="Time" value={t ? hms(t.movingMs) : EMPTY} dim={!t} />
        <Stat label="Distance" value={t ? miles(t.distanceM, 1) : EMPTY} unit={t ? 'mi' : undefined} dim={!t} />
        <Stat label="Climbed" value={t ? feet(t.ascentM) : EMPTY} unit={t ? 'ft' : undefined} dim={!t} />
        <Stat label="Best 20 min" value={best === null ? EMPTY : String(Math.round(best))} unit={best === null ? undefined : 'W'} dim={best === null} />
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
export function HomePage({ s, onSetup, onRide }: HomePageProps) {
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

  const next = nextStep(s)
  const courseName = (id: string) => s.courses.find((c) => c.id === id)?.name ?? (s.coursesLoaded ? 'Removed course' : '')
  const workoutName = (r: RideSummary) =>
    s.workouts.find((w) => w.id === r.workoutId)?.name ?? r.workoutName ?? (s.workoutsLoaded ? 'Removed workout' : '')
  const setupOf = (r: RideSummary) =>
    `${r.courseId ? courseName(r.courseId) : 'Flat road'} · ${r.workoutId ? workoutName(r) : 'Free ride'}`

  const onDownload = (r: RideSummary) => {
    setMessage(null)
    downloadRide(r.id).catch((err) => {
      console.error('FIT export failed:', err)
      setMessage('Could not build that FIT file. The ride is still saved in this browser.')
    })
  }

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <h1 className="text-title font-semibold text-fg">Home</h1>
      <div className="ww-home">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Rider" className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-4">
            <h2 className="font-semibold text-fg">Rider</h2>
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

          {rides && rides.length > 0 && (
            <section aria-label="Totals" className="rounded-lg border border-line bg-surface">
              <TotalsRow title="All rides" t={complete ? totalsOf(rides) : null} />
              <TotalsRow title="Last 7 days" t={complete ? totalsOf(lastDays(rides, now)) : null} />
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
                <p className="text-fg-muted">Saved in this browser. Time is moving time. Download FIT rebuilds the file from the saved ride.</p>
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
                        <span className="sr-only">File</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rides.slice(0, shown).map((r) => {
                      const { day, time } = dateOf(r.startedAt, now)
                      return (
                        <tr key={r.id} data-ride={r.id}>
                          <td className="ww-history-ride">
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="truncate font-semibold text-fg">{day}</span>
                              <span className="truncate font-mono text-mono text-fg-subtle" title={setupOf(r)}>
                                {time} · {setupOf(r)}
                              </span>
                            </div>
                          </td>
                          <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">{hms(r.movingMs)}</td>
                          <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">
                            {miles(r.distanceM, 2)} <span className="font-normal text-fg-muted">mi</span>
                          </td>
                          <td className="text-right font-semibold whitespace-nowrap text-fg tabular-nums">
                            {Math.round(r.avgPowerW)} <span className="font-normal text-fg-muted">W</span>
                          </td>
                          <td className="text-right">
                            <Button onClick={() => onDownload(r)} aria-label={`Download FIT, ride on ${day} at ${time}`}>
                              Download FIT
                            </Button>
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
