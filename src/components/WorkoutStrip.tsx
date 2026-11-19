import { useEffect, useMemo, useRef, useState } from 'react'
import { targetPct, targetWatts, zoneOf, type Interval } from '../lib/workout'

interface WorkoutStripProps {
  intervals: Interval[]
  ftpW: number
  totalS: number
  /** Seconds done. Omit for a preview with no progress. */
  elapsedS?: number
  /** Workout intensity in %; labels show watts after it. */
  intensityPct?: number
  /** Height class: `ww-profile` on the ride screen, `ww-strip-preview` in the picker. */
  heightClass: string
  className?: string
}

const MIN_SCALE_PCT = 130
/** Band above the tallest block for the watt labels. */
const LABEL_BAND = 16
/** Mono 11px is about 0.6em per character. */
const CHAR_W = 6.6
const LABEL_PAD = 4

/**
 * Every interval as a block: width is duration, height is % FTP, color is the
 * power zone. Ramps are sloped. Each block is labeled with its watts (ramps as
 * start→end) when it is wide enough. The part done is washed out and a Cobalt
 * line marks the current position.
 */
export function WorkoutStrip({
  intervals,
  ftpW,
  totalS,
  elapsedS,
  intensityPct = 100,
  heightClass,
  className = '',
}: WorkoutStripProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 104 })

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
  const blocks = useMemo(() => {
    const pcts = intervals.map((iv) => [targetPct(iv.from, ftpW), targetPct(iv.to, ftpW)] as const)
    const scale = Math.max(MIN_SCALE_PCT, ...pcts.flat())
    const x = (s: number) => (s / totalS) * w
    const body = h - LABEL_BAND
    const y = (p: number) => h - (Math.max(0, p) / scale) * body
    const watts = (t: Interval['from']) => Math.round((targetWatts(t, ftpW) * intensityPct) / 100)
    return intervals.map((iv, i) => {
      const [a, b] = pcts[i]
      const x0 = x(iv.startS)
      const x1 = x(iv.startS + iv.durS)
      const wa = watts(iv.from)
      const wb = watts(iv.to)
      const text = wa === wb ? String(wa) : `${wa}→${wb}`
      const fits = x1 - x0 >= text.length * CHAR_W + LABEL_PAD
      return {
        key: iv.index,
        d: `M${x0.toFixed(1)},${h}L${x0.toFixed(1)},${y(a).toFixed(1)}L${x1.toFixed(1)},${y(b).toFixed(1)}L${x1.toFixed(1)},${h}Z`,
        zone: zoneOf((a + b) / 2),
        label: fits ? { text, x: (x0 + x1) / 2, y: Math.min(y(a), y(b)) - 4 } : null,
      }
    })
  }, [intervals, ftpW, totalS, intensityPct, w, h])

  const posX = elapsedS === undefined ? null : Math.min(w, (elapsedS / totalS) * w)

  return (
    <div ref={boxRef} className={`relative ${heightClass} ${className}`}>
      <svg width={w} height={h} className="absolute inset-0 block" aria-hidden>
        {blocks.map((b) => (
          <path key={b.key} d={b.d} fill={`var(--ww-z${b.zone})`} stroke="var(--ww-surface)" strokeWidth={1} />
        ))}
        {blocks.map(
          (b) =>
            b.label && (
              <text
                key={`t${b.key}`}
                x={b.label.x}
                y={b.label.y}
                textAnchor="middle"
                fill="var(--ww-fg-muted)"
                className="font-mono text-mono"
              >
                {b.label.text}
              </text>
            ),
        )}
        {posX !== null && (
          <>
            <rect x={0} y={0} width={posX} height={h} fill="var(--ww-surface)" opacity={0.6} />
            <line x1={posX} x2={posX} y1={0} y2={h} stroke="var(--ww-accent)" strokeWidth={2.5} />
          </>
        )}
      </svg>
    </div>
  )
}
