import { useEffect, useMemo, useRef, useState } from 'react'
import { POWER_TRACE_MIN_HEIGHT_PX, POWER_TRACE_WINDOW_S } from '../config'
import { traceTopW, type PowerTraceLive } from '../lib/powerTrace'

interface PowerTraceProps {
  /** The ride snapshot's trace: a slot a second, newest last. */
  trace: PowerTraceLive
  /** Which of a slot's values to draw: the index of the tile's smoothing window in SMOOTHING_OPTIONS. */
  series: number
  /** The rider's FTP in watts, for the scale. */
  ftpW: number
  /** The number is not live (stale, paused, ended): the line goes `fg-subtle` with it. */
  dim?: boolean
  className?: string
}

/** One unbroken stretch of the line. A stretch could carry its own color (a zone) later. */
interface Run {
  d: string
}

/** Room for half the line's width at the top and the right, so it is never cut. */
const INSET = 1

/**
 * Builds the shapes for one trace at one size. Pure, so it runs only when the
 * trace, the size or the scale changes, not on every ride snapshot.
 */
function shapes(trace: PowerTraceLive, series: number, ftpW: number, w: number, h: number) {
  const slots = trace.slots
  const n = slots.length
  let peak = 0
  for (const s of slots) {
    if (s.w) peak = Math.max(peak, s.w[series] ?? 0)
    if (s.targetW !== null) peak = Math.max(peak, s.targetW)
  }
  const top = traceTopW(ftpW, peak)
  const base = h - 0.5
  const step = (w - INSET) / (POWER_TRACE_WINDOW_S - 1)
  // The newest slot is at the right edge; a slot is the second that ends at its x.
  const x = (i: number) => w - INSET - (n - 1 - i) * step
  const y = (v: number) => base - (Math.min(v, top) / top) * (base - INSET)
  const f = (v: number) => v.toFixed(1)

  // The line: one path per unbroken run, so a second with no reading is a gap.
  const runs: Run[] = []
  let cur = ''
  let count = 0
  const close = () => {
    // A reading with a gap on both sides is drawn as a dot (a zero-length line with round ends).
    if (cur) runs.push({ d: count === 1 ? `${cur}h0` : cur })
    cur = ''
    count = 0
  }
  // The target band: a flat area from 0 up to what was asked in each second. A change of target is a step.
  const bands: string[] = []
  const edges: string[] = []
  let band = ''
  let bandFrom = 0
  const closeBand = (endX: number) => {
    if (!band) return
    edges.push(band)
    bands.push(`${band}L${f(endX)},${f(base)}L${f(bandFrom)},${f(base)}Z`)
    band = ''
  }
  slots.forEach((s, i) => {
    const v = s.w ? s.w[series] : undefined
    if (v === undefined) close()
    else {
      cur += `${cur ? 'L' : 'M'}${f(x(i))},${f(y(v))}`
      count++
    }
    if (s.targetW === null) closeBand(x(i - 1))
    else {
      const from = Math.max(0, x(i) - step)
      if (!band) bandFrom = from
      band += `${band ? 'L' : 'M'}${f(from)},${f(y(s.targetW))}L${f(x(i))},${f(y(s.targetW))}`
    }
  })
  close()
  closeBand(x(n - 1))
  return { runs, bands, edges, base, top }
}

/**
 * The live power trace: the last few minutes of power as a line, drawn in the
 * free space of the Power tile. It is redrawn when a reading arrives, about
 * once a second, and holds still otherwise: no animation, no glide. It takes
 * only the room its box is given and draws nothing when that is too little.
 * Decorative to a screen reader: the number and the zone chip already speak.
 */
export function PowerTrace({ trace, series, ftpW, dim = false, className = '' }: PowerTraceProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      setSize((old) => (old && old.w === w && old.h === h ? old : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fits = size !== null && size.h >= POWER_TRACE_MIN_HEIGHT_PX && size.w > 0
  const w = size?.w ?? 0
  const h = size?.h ?? 0
  // `trace` is a new object only when a reading changed it, so this does not run on every snapshot.
  const shape = useMemo(
    () => (fits && trace.slots.length > 0 ? shapes(trace, series, ftpW, w, h) : null),
    [fits, trace, series, ftpW, w, h],
  )

  return (
    <div ref={boxRef} aria-hidden className={`ww-power-trace ${dim ? 'ww-power-trace-dim' : ''} ${className}`}>
      {shape && (
        // The data attributes say what the drawing holds (seconds, and the watts at the top of the scale), for a test to read.
        <svg width={w} height={h} focusable="false" data-slots={trace.slots.length} data-top-w={shape.top}>
          {shape.bands.map((d, i) => (
            <path key={`b${i}`} data-trace="band" className="ww-power-trace-band" d={d} />
          ))}
          {shape.edges.map((d, i) => (
            <path key={`e${i}`} data-trace="target" className="ww-power-trace-target" d={d} />
          ))}
          <line data-trace="base" className="ww-power-trace-base" x1={0} x2={w} y1={shape.base} y2={shape.base} />
          {shape.runs.map((run, i) => (
            <path key={`r${i}`} data-trace="line" className="ww-power-trace-line" d={run.d} />
          ))}
        </svg>
      )}
    </div>
  )
}
