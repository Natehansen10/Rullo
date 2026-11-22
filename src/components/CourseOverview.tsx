import { useEffect, useMemo, useRef, useState } from 'react'
import { profilePoints, type Course } from '../lib/course'
import { FEET_PER_METER, METERS_PER_MILE } from '../lib/physics'
import { Stat } from './Stat'

const PAD = 8
const MIN_RANGE_M = 15 // keep near-flat courses from looking mountainous

/**
 * The route at a glance, for the course picker: distance, climbing, low and
 * high points over the elevation profile. A hairline marks the start mile.
 * `drawKey` is a count of picks: when it changes after the first render the
 * profile is drawn in, left to right (see "Motion" in DESIGN.md).
 */
export function CourseOverview({ course, startMi, drawKey = 0 }: { course: Course; startMi: number; drawKey?: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 104 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: Math.max(100, entry.contentRect.width), h: Math.max(32, entry.contentRect.height) }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const shape = useMemo(() => {
    const pts = profilePoints(course, 600)
    let lo = Infinity
    let hi = -Infinity
    for (const [, e] of pts) {
      lo = Math.min(lo, e)
      hi = Math.max(hi, e)
    }
    const range = Math.max(MIN_RANGE_M, hi - lo)
    const base = lo - (range - (hi - lo)) / 2
    const x = (s: number) => PAD + (s / course.lengthM) * (w - 2 * PAD)
    const y = (e: number) => h - PAD - ((e - base) / range) * (h - 2 * PAD)
    const line = pts.map(([s, e], i) => `${i === 0 ? 'M' : 'L'}${x(s).toFixed(1)},${y(e).toFixed(1)}`).join('')
    return { line, area: `${line}L${w - PAD},${h}L${PAD},${h}Z`, lo, hi, startX: x(startMi * METERS_PER_MILE) }
  }, [course, w, h, startMi])

  const feet = (m: number) => Math.round(m * FEET_PER_METER).toLocaleString()
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <Stat label="Distance" value={(course.lengthM / METERS_PER_MILE).toFixed(1)} unit="mi" dim={false} inline />
        <Stat label="Climbing" value={feet(course.ascentM)} unit="ft" dim={false} inline />
        <Stat label="Low" value={feet(shape.lo)} unit="ft" dim={false} inline />
        <Stat label="High" value={feet(shape.hi)} unit="ft" dim={false} inline />
      </div>
      <div ref={boxRef} className="ww-profile relative">
        <svg width={w} height={h} className="absolute inset-0 block" aria-hidden>
          <path d={shape.area} fill="var(--ww-raised)" />
          <path d={shape.line} fill="none" stroke="var(--ww-fg-subtle)" strokeWidth={1.5} />
          {startMi > 0 && <line x1={shape.startX} x2={shape.startX} y1={0} y2={h} stroke="var(--ww-accent)" strokeWidth={2} />}
        </svg>
        {/* The cover that draws the profile in. A new one for every pick, so it plays again. */}
        {drawKey > 0 && <span key={drawKey} aria-hidden className="ww-draw-in" />}
      </div>
      {course.description && <p className="text-fg-muted">{course.description}</p>}
    </div>
  )
}
