import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { FEET_PER_METER } from '../lib/physics'
import type { RideDetail } from '../lib/rideDetail'
import { hms, miles } from '../lib/rideFormat'
import { RideChart, secondX } from './RideChart'

/** Elevation charts span at least this much, so a near-flat course does not look like mountains (15 m, as on the course cards). */
const MIN_ELEVATION_RANGE_FT = 50
/** Seconds a key moves the cursor: an arrow, Shift + arrow, Page Up / Down. */
const STEP_S = 1
const STEP_SHIFT_S = 10
const STEP_PAGE_S = 60

/** A value at the cursor: the number in `fg`, its unit in `fg-muted`. "--" in `fg-subtle` for a second with no reading. */
function At({ value, unit }: { value: string | null; unit: string }) {
  if (value === null) return <span className="text-fg-subtle">--</span>
  return (
    <span>
      <span className="text-fg">{value}</span> {unit}
    </span>
  )
}

/** One chart row. Its mono line is the row's numbers for the whole ride, or `at`, the values at the cursor. Same line, same width: nothing moves. */
function ChartRow({ label, detail, at, children }: { label: string; detail: string; at: ReactNode | null; children: ReactNode }) {
  return (
    <div className="ww-ride-chart-row">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="ww-label">{label}</span>
        <span data-scrub-readout={at ? label : undefined} className="truncate font-mono text-mono text-fg-muted">
          {at ?? detail}
        </span>
      </div>
      {children}
    </div>
  )
}

/**
 * The ride summary's stacked charts (power, cadence, heart rate when the ride
 * has any, elevation on a course ride) over one time axis, with one cursor
 * for all of them. Pointing at the charts, or the arrow keys once the chart
 * area has focus, puts a line through every row at one recorded second; each
 * row's mono line then shows that second's value in place of the ride's
 * numbers, and the time sits on the axis. Nothing takes or gives up space.
 */
export function RideCharts({ detail, drawIn = false }: { detail: RideDetail; /** Uncover the charts left to right, once, when they are first drawn (the finish screen). */ drawIn?: boolean }) {
  const t = detail.totals
  const n = detail.powerW.length
  const altitudeFt = useMemo(() => detail.altitudeM.map((m) => (m === null ? null : m * FEET_PER_METER)), [detail])
  const showHr = detail.hasHeartRate && t.avgHeartRateBpm !== null

  /** Index of the recorded second the cursor is on, or null. */
  const [cursor, setCursor] = useState<number | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  const chipRef = useRef<HTMLSpanElement>(null)
  const [chipW, setChipW] = useState(0)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(100, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Another ride: start with no cursor.
  useEffect(() => setCursor(null), [detail])

  const i = cursor === null ? null : Math.min(n - 1, cursor)
  const x = i === null ? 0 : secondX(i, n, w)
  const time = i === null ? '' : hms(i * 1000)
  // Measured before paint, so the time chip is kept inside the axis from its first frame.
  useLayoutEffect(() => {
    if (chipRef.current) setChipW(chipRef.current.offsetWidth)
  }, [time.length])

  const max = (v: (number | null)[]) => Math.round(Math.max(...v.filter((x): x is number => x !== null)))
  const min = (v: (number | null)[]) => Math.round(Math.min(...v.filter((x): x is number => x !== null)))

  const power = i === null ? null : String(Math.round(detail.powerW[i]))
  const cadence = i === null ? null : String(Math.round(detail.cadenceRpm[i]))
  const hr = i === null || detail.heartRateBpm[i] === null ? null : String(Math.round(detail.heartRateBpm[i] as number))
  const ele = i === null || altitudeFt[i] === null ? null : Math.round(altitudeFt[i] as number).toLocaleString()
  const dist = i === null ? null : miles(detail.samples[i].distanceM, 2)

  /** What a screen reader hears for the cursor. */
  const spoken =
    i === null
      ? 'No moment picked. Left and Right arrows move through the ride.'
      : [
          `${time} into the ride`,
          `power ${power} W`,
          `cadence ${cadence} rpm`,
          ...(showHr ? [`heart rate ${hr === null ? 'no reading' : `${hr} bpm`}`] : []),
          ...(detail.hasAltitude ? [`elevation ${ele === null ? 'no reading' : `${ele} ft`}`, `distance ${dist} mi`] : []),
        ].join(', ')

  // Mouse and pen only: a touch has no hover, and a tap must not leave a cursor behind.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const box = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - box.left) / Math.max(1, box.width)))
    const next = Math.round(f * (n - 1))
    setCursor((prev) => (prev === next ? prev : next))
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const step = e.shiftKey ? STEP_SHIFT_S : STEP_S
    let next: number | null
    switch (e.key) {
      case 'ArrowRight':
        next = i === null ? 0 : i + step
        break
      case 'ArrowLeft':
        next = i === null ? n - 1 : i - step
        break
      case 'PageUp':
        next = i === null ? 0 : i + STEP_PAGE_S
        break
      case 'PageDown':
        next = i === null ? n - 1 : i - STEP_PAGE_S
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = n - 1
        break
      case 'Escape':
        if (i === null) return
        next = null
        break
      default:
        return
    }
    e.preventDefault()
    setCursor(next === null ? null : Math.min(n - 1, Math.max(0, next)))
  }

  return (
    <>
      <div className="relative flex flex-col gap-4">
        <ChartRow label="Power" detail={`avg ${Math.round(t.avgPowerW)} · max ${Math.round(t.maxPowerW)} W`} at={i === null ? null : <At value={power} unit="W" />}>
          <RideChart values={detail.powerW} color="var(--ww-fg)" marks={detail.lapStarts} minRange={100} cursor={i} />
        </ChartRow>
        <ChartRow
          label="Cadence"
          detail={`avg ${Math.round(t.avgCadenceRpm)} · max ${max(detail.cadenceRpm)} rpm`}
          at={i === null ? null : <At value={cadence} unit="rpm" />}
        >
          <RideChart values={detail.cadenceRpm} color="var(--ww-cadence)" marks={detail.lapStarts} minRange={60} cursor={i} />
        </ChartRow>
        {showHr && (
          <ChartRow
            label="Heart rate"
            detail={`avg ${Math.round(t.avgHeartRateBpm as number)} · max ${t.maxHeartRateBpm} bpm`}
            at={i === null ? null : <At value={hr} unit="bpm" />}
          >
            <RideChart values={detail.heartRateBpm} color="var(--ww-fg-muted)" fromZero={false} marks={detail.lapStarts} minRange={30} cursor={i} />
          </ChartRow>
        )}
        {detail.hasAltitude && (
          <ChartRow
            label="Elevation"
            detail={`${min(altitudeFt).toLocaleString()} to ${max(altitudeFt).toLocaleString()} ft`}
            at={
              i === null ? null : (
                <>
                  <At value={ele} unit="ft" /> · <At value={dist} unit="mi" />
                </>
              )
            }
          >
            <RideChart values={altitudeFt} color="var(--ww-fg-subtle)" fill fromZero={false} minRange={MIN_ELEVATION_RANGE_FT} cursor={i} />
          </ChartRow>
        )}
        {/* The cursor line: one line through every row. Over the charts and their fills, under the dots. */}
        <div aria-hidden className="ww-scrub-area pointer-events-none">
          {/* The cover that draws the charts in: over every row at once, gone after --ww-dur-draw. */}
          {drawIn && <span className="ww-draw-in" />}
          {i !== null && <span data-scrub-line className="ww-scrub-line" style={{ transform: `translateX(${x}px)` }} />}
        </div>
        {/* The chart area is one tab stop, and the only thing here that takes the pointer. */}
        <div
          ref={areaRef}
          role="slider"
          tabIndex={0}
          aria-label="The ride, second by second"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, n - 1)}
          aria-valuenow={i ?? 0}
          aria-valuetext={spoken}
          data-scrub
          className="ww-scrub-area ww-scrub"
          onPointerMove={onMove}
          onPointerLeave={() => setCursor(null)}
          onKeyDown={onKey}
          onBlur={() => setCursor(null)}
        />
      </div>
      <div className="ww-ride-chart-row" aria-hidden>
        <span />
        <div className="relative flex justify-between font-mono text-mono text-fg-muted">
          {[0, 1, 2, 3, 4].map((k) => (
            <span key={k}>{hms(((n * k) / 4) * 1000)}</span>
          ))}
          {i !== null && (
            <span
              ref={chipRef}
              data-scrub-time
              className="ww-strip-tip ww-scrub-time"
              style={{ left: Math.max(0, Math.min(w - chipW, x - chipW / 2)), color: 'var(--ww-fg)' }}
            >
              {time}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
