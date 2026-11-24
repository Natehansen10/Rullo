import { useEffect, useMemo, useRef, useState } from 'react'
import { POWER_TRACE_MIN_HEIGHT_PX, POWER_TRACE_WINDOW_S } from '../config'
import { traceTopW, type PowerTraceLive } from '../lib/powerTrace'
import { zoneAt } from '../lib/workout'

interface PowerTraceProps {
  /** The ride snapshot's trace: a slot a second, newest last. */
  trace: PowerTraceLive
  /** Which of a slot's values to draw: the index of the tile's smoothing window in SMOOTHING_OPTIONS. */
  series: number
  /** The rider's FTP in watts, for the scale. */
  ftpW: number
  /** The number is not live (stale, paused, ended): the line goes `fg-subtle` with it. */
  dim?: boolean
  /** Color each second of the line by its power zone (POWER_ZONE_COLOR). Off, the whole line is Olive. */
  zoneColor?: boolean
  className?: string
}

/**
 * Every stretch of the line in one color, as one path: a zone (1 to 7), or 0
 * for the plain Olive line. One path per color, so a path never changes color
 * as the line moves left and nothing but the stale gray-out ever eases.
 */
interface ZoneLine {
  zone: number
  d: string
}

/** Room for half the line's width at the top and the right, so it is never cut. */
const INSET = 1

/**
 * Builds the shapes for one trace at one size. Pure, so it runs only when the
 * trace, the size or the scale changes, not on every ride snapshot.
 */
function shapes(trace: PowerTraceLive, series: number, ftpW: number, w: number, h: number, zoneColor: boolean) {
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

  // The zone of a second's power: the same rule as the tile's chip, with no hold (this is history). 0 is the plain line.
  const zone = (v: number) => (zoneColor && ftpW > 0 ? zoneAt((v / ftpW) * 100, ftpW) : 0)
  // The line: a second belongs to the stretch that ends at its point, and takes its zone's color.
  // A second with no reading is a gap. Stretches of one zone share a path.
  const paths = new Map<number, string>()
  const add = (z: number, d: string) => paths.set(z, (paths.get(z) ?? '') + d)
  let prev: { p: string; z: number } | null = null
  let count = 0
  /** The zone whose path has its pen at `prev`, so the next stretch in that zone goes on without a move. */
  let pen = -1
  const close = () => {
    // A reading with a gap on both sides is drawn as a dot (a zero-length line with round ends).
    if (prev && count === 1) add(prev.z, `M${prev.p}h0`)
    prev = null
    count = 0
    pen = -1
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
      const p = `${f(x(i))},${f(y(v))}`
      const z = zone(v)
      if (prev) {
        add(z, pen === z ? `L${p}` : `M${prev.p}L${p}`)
        pen = z
      }
      prev = { p, z }
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
  const lines: ZoneLine[] = [...paths.entries()].sort((a, b) => a[0] - b[0]).map(([z, d]) => ({ zone: z, d }))
  // The whole line again, for the surface hairline under a zone-colored line.
  const halo = zoneColor ? lines.map((l) => l.d).join('') : ''
  return { lines, halo, bands, edges, base, top }
}

/**
 * The live power trace: the last few minutes of power as a line, drawn in the
 * free space of the Power tile, each second in the color of its power zone
 * when `zoneColor` is on. It is redrawn when a reading arrives, about
 * once a second, and holds still otherwise: no animation, no glide. It takes
 * only the room its box is given and draws nothing when that is too little.
 * Decorative to a screen reader: the number and the zone chip already speak.
 */
export function PowerTrace({ trace, series, ftpW, dim = false, zoneColor = false, className = '' }: PowerTraceProps) {
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
    () => (fits && trace.slots.length > 0 ? shapes(trace, series, ftpW, w, h, zoneColor) : null),
    [fits, trace, series, ftpW, w, h, zoneColor],
  )

  return (
    <div ref={boxRef} aria-hidden className={`ww-power-trace ${dim ? 'ww-power-trace-dim' : ''} ${className}`}>
      {shape && (
        // The data attributes say what the drawing holds (seconds, and the watts at the top of the scale), for a test to read.
        <svg width={w} height={h} focusable="false" data-slots={trace.slots.length} data-top-w={shape.top}>
          {shape.bands.map((d, i) => (
            <path key={`b${i}`} data-trace="band" className="ww-power-trace-band" d={d} />
          ))}
          {/* Under the target's edge and the baseline, so it clears only the band's fill beside the line. */}
          {shape.halo && <path data-trace="halo" className="ww-power-trace-halo" d={shape.halo} />}
          {shape.edges.map((d, i) => (
            <path key={`e${i}`} data-trace="target" className="ww-power-trace-target" d={d} />
          ))}
          <line data-trace="base" className="ww-power-trace-base" x1={0} x2={w} y1={shape.base} y2={shape.base} />
          {shape.lines.map((l) => (
            <path
              key={l.zone}
              data-trace="line"
              data-zone={l.zone || undefined}
              className="ww-power-trace-line"
              d={l.d}
            />
          ))}
        </svg>
      )}
    </div>
  )
}
