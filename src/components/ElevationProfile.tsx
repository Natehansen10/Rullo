import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { profilePoints } from '../lib/course'
import { FEET_PER_METER, METERS_PER_MILE } from '../lib/physics'
import type { CourseLive } from '../lib/ride'
import { Stat } from './Stat'

interface ElevationProfileProps {
  live: CourseLive
  /** Gray the stats out when data is stale or the ride is not live. */
  dim?: boolean
  /** Shown together with a workout: stats on one line and a shorter profile. */
  compact?: boolean
  /** One plain sentence at the right of the stats line: what the course is setting (speed, or speed and the load). */
  note?: string
  className?: string
}

const PAD_Y = 8
const PAD_X = 8 // keeps the dot whole at mile 0 and the finish
const MIN_RANGE_M = 15 // keep near-flat courses from looking mountainous

function niceTickMi(lengthMi: number): number {
  for (const t of [0.5, 1, 2, 5, 10, 20, 25, 50]) if (lengthMi / t <= 8) return t
  return 100
}

/** Course elevation profile. Cobalt marks the part ridden this ride and the current position. */
export function ElevationProfile({ live, dim = false, compact = false, note, className = '' }: ElevationProfileProps) {
  const { course } = live
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(140)
  const clipId = useId()

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(100, entry.contentRect.width))
      setHeight(Math.max(32, entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pts = useMemo(() => profilePoints(course, 800), [course])
  const { minE, rangeE } = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const [, e] of pts) {
      lo = Math.min(lo, e)
      hi = Math.max(hi, e)
    }
    const range = Math.max(MIN_RANGE_M, hi - lo)
    return { minE: lo - (range - (hi - lo)) / 2, rangeE: range }
  }, [pts])

  const x = (sM: number) => PAD_X + (sM / course.lengthM) * (width - 2 * PAD_X)
  const y = (eM: number) => height - PAD_Y - ((eM - minE) / rangeE) * (height - 2 * PAD_Y)

  const line = useMemo(
    () => pts.map(([s, e], i) => `${i === 0 ? 'M' : 'L'}${x(s).toFixed(1)},${y(e).toFixed(1)}`).join(''),
    [pts, width, height, minE, rangeE],
  )
  const area = `${line}L${width - PAD_X},${height}L${PAD_X},${height}Z`

  const posM = live.positionMi * METERS_PER_MILE
  const startX = x(live.startMi * METERS_PER_MILE)
  const posX = x(posM)
  const posE = pts.length ? interpolate(pts, posM) : 0

  const lengthMi = course.lengthM / METERS_PER_MILE
  const tick = niceTickMi(lengthMi)
  const ticks: number[] = []
  for (let t = 0; t <= lengthMi + 1e-6; t += tick) ticks.push(t)

  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'} ${className}`}>
      <div className={`flex flex-wrap gap-y-2 ${compact ? 'items-baseline gap-x-6' : 'items-end gap-x-8'}`}>
        <div className={`flex min-w-0 ${compact ? 'items-baseline gap-2' : 'flex-col gap-2'}`}>
          <span className="ww-label">Course</span>
          <span className="truncate text-title font-semibold text-fg">{course.name}</span>
        </div>
        <Stat label="Grade" value={live.gradePct.toFixed(1)} unit="%" dim={dim} inline={compact} />
        <Stat label="Elevation" value={Math.round(live.elevationFt).toLocaleString()} unit="ft" dim={dim} inline={compact} />
        <Stat label="Climbed" value={Math.round(live.climbedFt).toLocaleString()} unit="ft" dim={dim} inline={compact} />
        <Stat label="To go" value={live.toGoMi.toFixed(1)} unit="mi" dim={dim} inline={compact} />
        {live.finished && <span className="ww-label text-state-on">Course complete</span>}
        {note && <span className="ml-auto whitespace-nowrap text-fg-muted">{note}</span>}
      </div>
      <div ref={boxRef} className={`relative ${compact ? 'ww-profile-compact' : 'ww-profile'}`}>
        <svg width={width} height={height} className="absolute inset-0 block" aria-hidden>
          <defs>
            <clipPath id={clipId}>
              <rect x={Math.min(startX, posX)} y={0} width={Math.abs(posX - startX)} height={height} />
            </clipPath>
          </defs>
          <path d={area} fill="var(--ww-raised)" />
          <path d={line} fill="none" stroke="var(--ww-fg-subtle)" strokeWidth={1.5} />
          <path d={line} fill="none" stroke="var(--ww-accent)" strokeWidth={2.5} clipPath={`url(#${clipId})`} />
          <line x1={posX} x2={posX} y1={y(posE)} y2={height} stroke="var(--ww-line-strong)" strokeWidth={1} />
          <circle cx={posX} cy={y(posE)} r={6} fill="var(--ww-accent)" stroke="var(--ww-surface)" strokeWidth={2} />
        </svg>
      </div>
      <div className="relative h-4 font-mono text-mono text-fg-subtle">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-0"
            style={{
              left: `calc(${PAD_X}px + ${t / lengthMi} * (100% - ${2 * PAD_X}px))`,
              transform: t === 0 ? 'none' : t >= lengthMi - tick / 2 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {t % 1 === 0 ? t : t.toFixed(1)}
            {t === 0 ? ' mi' : ''}
          </span>
        ))}
      </div>
      <span className="sr-only">
        Mile {live.positionMi.toFixed(1)} of {lengthMi.toFixed(1)}, elevation {Math.round(posE * FEET_PER_METER)} feet
      </span>
    </div>
  )
}

function interpolate(pts: [number, number][], s: number): number {
  if (s <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= s) {
      const [s0, e0] = pts[i - 1]
      const [s1, e1] = pts[i]
      return e0 + ((s - s0) / (s1 - s0 || 1)) * (e1 - e0)
    }
  }
  return pts[pts.length - 1][1]
}
