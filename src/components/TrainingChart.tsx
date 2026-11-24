import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { RideSummary } from '../lib/history'
import { hms, miles } from '../lib/rideFormat'
import { RECENT_DAYS, scaleMs, sumDays, TRAINING_DAYS, trainingDays, type DayTotals, type TrainingDay } from '../lib/training'
import { formatDuration } from '../lib/workout'

interface TrainingChartProps {
  /** Every finished ride. Null while they are still being read: the chart keeps its room and shows empty days. */
  rides: RideSummary[] | null
  /** Local midnight at the start of today (see useToday). */
  today: number
  /** The rides could not be read. */
  failed?: boolean
}

/** A Monday's date is left out this close to the last day, where "Today" is written. */
const TODAY_CLEAR_DAYS = 4
/** The bars are drawn in once per page load, not on every visit to Home. */
let drawn = false

const dayName = (t: number) => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
const weekName = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
const rideCount = (n: number) => `${n} ${n === 1 ? 'ride' : 'rides'}`
const kj = (j: number) => Math.round(j / 1000).toLocaleString()

/** What a day or a span comes to, as plain words for a screen reader. */
function spoken(t: DayTotals): string {
  if (t.rides === 0) return 'no ride'
  return `${rideCount(t.rides)}, ${hms(t.movingMs)} moving, ${miles(t.distanceM, 1)} miles${t.workJ === null ? '' : `, ${kj(t.workJ)} kilojoules`}`
}

/**
 * The same numbers on the readout line. Each is one piece of text in a cell of
 * a fixed width in mono characters, wider than anything it holds, so nothing
 * on the line moves when the day pointed at changes.
 */
function Numbers({ t }: { t: DayTotals }) {
  if (t.rides === 0) return <span className="text-fg-muted">no ride</span>
  return (
    <>
      <span className="w-[9ch] shrink-0">{rideCount(t.rides)}</span>
      <span className="w-[9ch] shrink-0">{hms(t.movingMs)}</span>
      <span className="w-[11ch] shrink-0">{`${miles(t.distanceM, 1)} mi`}</span>
      {t.workJ !== null && <span>{`${kj(t.workJ)} kJ`}</span>}
    </>
  )
}

/** One sentence for the last 7 days, today included. It stands in for the old "Last 7 days" totals row. */
function recentLine(all: RideSummary[], days: TrainingDay[]): string {
  if (all.length === 0) return 'No rides yet. Each day you ride gets a bar here.'
  const t = sumDays(days.slice(-RECENT_DAYS))
  const help = "Each bar is a day's moving time."
  if (t.rides === 0) return `No rides in the last ${RECENT_DAYS} days. ${help}`
  const time = t.movingMs < 60000 ? 'under a minute' : formatDuration(t.movingMs / 1000)
  return `${rideCount(t.rides)}, ${time} and ${miles(t.distanceM, 1)} mi in the last ${RECENT_DAYS} days. ${help}`
}

/**
 * Training over time: one bar per calendar day for the last 6 weeks, today
 * last. Height is the day's moving time. A day with no ride keeps its slot and
 * a baseline tick, so the weeks keep their rhythm. Pointing at a day, or
 * moving to it with the arrow keys, writes its numbers on a line that is
 * always there, so nothing moves.
 */
export function TrainingChart({ rides, today, failed = false }: TrainingChartProps) {
  const days = useMemo(() => trainingDays(rides ?? [], today), [rides, today])
  const top = useMemo(() => scaleMs(days), [days])
  const span = useMemo(() => sumDays(days), [days])
  const last = days.length - 1

  /** The day under the pointer, or null. */
  const [hover, setHover] = useState<number | null>(null)
  /** The day the arrow keys are on. Shown while the chart has focus. */
  const [picked, setPicked] = useState(last)
  const [focused, setFocused] = useState(false)
  const shown = hover ?? (focused ? Math.min(picked, last) : null)
  const day = shown === null ? null : days[shown]

  /** Draw-in: once, when the first bars are there to draw. */
  const [draw] = useState(() => !drawn)
  const hasBars = span.rides > 0
  useEffect(() => {
    if (hasBars) drawn = true
  }, [hasBars])

  const indexOf = (e: PointerEvent<HTMLDivElement>): number | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    return el ? Number(el.dataset.i) : null
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexOf(e)
    // Between two weeks the last day pointed at stays.
    if (i !== null) setHover((prev) => (prev === i ? prev : i))
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexOf(e)
    if (i !== null) setPicked(i)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = Math.min(picked, last)
    const to =
      e.key === 'ArrowLeft' ? Math.max(0, from - 1) : e.key === 'ArrowRight' ? Math.min(last, from + 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (to === null) return
    e.preventDefault()
    setHover(null)
    setPicked(to)
  }

  const at = days[focused ? Math.min(picked, last) : last]
  return (
    <section aria-label="Training" className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-fg">Training</h2>
        {failed ? (
          <p className="text-fg-muted">Could not read your saved rides.</p>
        ) : rides === null ? (
          <p className="text-fg-subtle">Reading rides</p>
        ) : (
          <p className="text-fg-muted" data-training-summary>
            {recentLine(rides, days)}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span aria-hidden className="font-mono text-mono leading-4 text-fg-subtle">
          {formatDuration(top / 1000)}
        </span>
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Training by day, last ${TRAINING_DAYS / 7} weeks. Left and right arrows move the day.`}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={focused ? Math.min(picked, last) : last}
          aria-valuetext={`${at.today ? 'Today, ' : ''}${dayName(at.start)}: ${spoken(at)}`}
          className="ww-training rounded-sm"
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerLeave={() => setHover(null)}
        >
          <div className="ww-training-plot" data-training-plot data-scale-ms={top}>
            {days.map((d, i) => (
              <div
                key={d.key}
                className="ww-training-day"
                data-i={i}
                data-day={d.key}
                data-rides={d.rides || undefined}
                data-ms={Math.round(d.movingMs)}
                data-today={d.today || undefined}
                data-week={d.weekStart || undefined}
                data-on={shown === i || undefined}
              >
                {d.rides > 0 && <span className="ww-training-bar" style={{ height: `${(d.movingMs / top) * 100}%` }} />}
                <span className="ww-training-tick" />
                {d.today ? (
                  <span aria-hidden className="ww-training-label right-0 text-fg">
                    Today
                  </span>
                ) : (
                  d.weekStart &&
                  last - i >= TODAY_CLEAR_DAYS && (
                    <span aria-hidden className="ww-training-label left-0 text-fg-subtle">
                      {weekName(d.start)}
                    </span>
                  )
                )}
              </div>
            ))}
            {/* The cover that draws the bars in, left to right. The baseline ticks stay above it. */}
            {draw && hasBars && <span aria-hidden className="ww-draw-in" />}
          </div>
        </div>
      </div>
      {/* Always one line tall, so pointing at a day moves nothing. The slider's value text says the same to a screen reader. */}
      <p aria-hidden data-training-readout className="flex h-4 gap-3 overflow-hidden font-mono text-mono leading-4 whitespace-nowrap text-fg">
        {day ? (
          <>
            <span className="w-[19ch] shrink-0 overflow-hidden">{`${day.today ? 'Today, ' : ''}${dayName(day.start)}`}</span>
            <Numbers t={day} />
          </>
        ) : rides !== null && hasBars ? (
          <>
            <span className="w-[19ch] shrink-0 overflow-hidden">{`Last ${TRAINING_DAYS / 7} weeks`}</span>
            <Numbers t={span} />
          </>
        ) : (
          ' '
        )}
      </p>
    </section>
  )
}
