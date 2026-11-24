import { useEffect, useMemo, useRef, useState } from 'react'

interface RideChartProps {
  /** One value per recorded second. Null is a second with no reading: the line breaks there. */
  values: (number | null)[]
  /** CSS color for the line, a token: `var(--ww-fg)`. */
  color: string
  /** Fill under the line with `raised` (elevation). */
  fill?: boolean
  /** Start the scale at 0 (power, cadence) or fit it to the values (heart rate, elevation). */
  fromZero?: boolean
  /** The least the scale may span, so a near-flat line does not look like mountains. */
  minRange?: number
  /** Indexes to mark with a hairline: where each workout interval starts. */
  marks?: number[]
  /** Index of the second the summary's cursor is on, or null. Draws a dot on the line there; the cursor line itself is shared by the stack (see RideCharts). */
  cursor?: number | null
  className?: string
}

const PAD_Y = 4

/** Where second `i` of `n` sits across a chart `w` wide. The cursor line, the dots and the interval marks all use it. */
export function secondX(i: number, n: number, w: number): number {
  return n <= 1 ? 0 : (i / (n - 1)) * w
}

/**
 * One line over a ride's moving time, for the ride summary: a small chart
 * with no axis of its own (the numbers are written beside it, and the time
 * axis is shared under the stack). Each pixel column is the average of the
 * seconds that fall in it.
 */
export function RideChart({ values, color, fill = false, fromZero = true, minRange = 1, marks = [], cursor = null, className = '' }: RideChartProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 72 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: Math.max(100, entry.contentRect.width), h: Math.max(24, entry.contentRect.height) }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const shape = useMemo(() => {
    const n = values.length
    const cols = Math.max(1, Math.min(n, Math.floor(w)))
    const pts: (number | null)[] = []
    for (let c = 0; c < cols; c++) {
      const from = Math.floor((c * n) / cols)
      const to = Math.max(from + 1, Math.floor(((c + 1) * n) / cols))
      let sum = 0
      let count = 0
      for (let i = from; i < to; i++) {
        const v = values[i]
        if (v !== null) {
          sum += v
          count++
        }
      }
      pts.push(count ? sum / count : null)
    }
    const real = pts.filter((v): v is number => v !== null)
    let lo = fromZero ? 0 : Math.min(...real)
    let hi = Math.max(...real, lo)
    if (hi - lo < minRange) {
      const mid = (hi + lo) / 2
      lo = fromZero ? 0 : mid - minRange / 2
      hi = lo + minRange
    }
    const x = (c: number) => (cols === 1 ? w / 2 : (c / (cols - 1)) * w)
    const y = (v: number) => h - PAD_Y - ((v - lo) / (hi - lo)) * (h - 2 * PAD_Y)
    // One path per unbroken run, so a gap in the readings is a gap in the line.
    const runs: string[] = []
    const areas: string[] = []
    let cur = ''
    let start = 0
    pts.forEach((v, c) => {
      if (v === null) {
        if (cur) {
          runs.push(cur)
          areas.push(`${cur}L${x(c - 1).toFixed(1)},${h}L${x(start).toFixed(1)},${h}Z`)
        }
        cur = ''
        return
      }
      if (!cur) start = c
      cur += `${cur ? 'L' : 'M'}${x(c).toFixed(1)},${y(v).toFixed(1)}`
    })
    if (cur) {
      runs.push(cur)
      areas.push(`${cur}L${x(cols - 1).toFixed(1)},${h}L${x(start).toFixed(1)},${h}Z`)
    }
    return { runs, areas, y, markX: marks.map((i) => secondX(i, n, w)) }
  }, [values, w, h, fromZero, minRange, marks])

  // The dot sits at that second's own reading, the number the row shows. On a ride longer than the chart is wide the drawn line is an average, so the dot can sit a little off it.
  const at = cursor === null ? null : (values[cursor] ?? null)
  const dotY = at === null ? null : Math.min(h, Math.max(0, shape.y(at)))

  return (
    <div ref={boxRef} className={`ww-ride-chart relative ${className}`}>
      <svg width={w} height={h} className="absolute inset-0 block" aria-hidden>
        {fill && shape.areas.map((d, i) => <path key={`a${i}`} d={d} fill="var(--ww-raised)" />)}
        {shape.markX.map((mx, i) => (
          <line key={`m${i}`} x1={mx} x2={mx} y1={0} y2={h} stroke="var(--ww-line)" strokeWidth={1} />
        ))}
        <line x1={0} x2={w} y1={h - 0.5} y2={h - 0.5} stroke="var(--ww-line)" strokeWidth={1} />
        {shape.runs.map((d, i) => (
          <path key={`r${i}`} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        ))}
      </svg>
      {cursor !== null && dotY !== null && (
        <span
          aria-hidden
          data-scrub-dot
          className="ww-scrub-dot"
          style={{ background: color, transform: `translate(${secondX(cursor, values.length, w)}px, ${dotY}px)` }}
        />
      )}
    </div>
  )
}
