import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { elevationAt, gradeAt, profilePoints, type Course } from '../lib/course'
import { FEET_PER_METER, METERS_PER_MILE } from '../lib/physics'
import { Stat } from './Stat'

const PAD = 8
const MIN_RANGE_M = 15 // keep near-flat courses from looking mountainous
/** Space between the cursor line and its chip. */
const TIP_GAP = 8

/**
 * The route at a glance, for the course picker: distance, climbing, low and
 * high points over the elevation profile. A hairline marks the start mile.
 * `drawKey` is a count of picks: when it changes after the first render the
 * profile is drawn in, left to right (see "Motion" in DESIGN.md).
 * Pointing at the profile shows a cursor and the mile, elevation and grade
 * there, in an overlay that takes no space.
 */
export function CourseOverview({ course, startMi, drawKey = 0 }: { course: Course; startMi: number; drawKey?: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 104 })
  /** Meters along the course under the pointer, or null. */
  const [at, setAt] = useState<number | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipW, setTipW] = useState(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setSize({ w: Math.max(100, entry.contentRect.width), h: Math.max(32, entry.contentRect.height) }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Another course: the pointer has not been over this one yet.
  useEffect(() => setAt(null), [course])

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
    return { line, area: `${line}L${w - PAD},${h}L${PAD},${h}Z`, lo, hi, x, y, startX: x(startMi * METERS_PER_MILE) }
  }, [course, w, h, startMi])

  const feet = (m: number) => Math.round(m * FEET_PER_METER).toLocaleString()

  /** The point under the pointer: where it is drawn and what it reads, in miles, feet and % at display. */
  const point = useMemo(() => {
    if (at === null) return null
    const eleM = elevationAt(course, at)
    const grade = (gradeAt(course, at) * 100).toFixed(1)
    return {
      x: shape.x(at),
      y: shape.y(eleM),
      mile: (at / METERS_PER_MILE).toFixed(2),
      ft: Math.round(eleM * FEET_PER_METER).toLocaleString(),
      grade: grade === '-0.0' ? '0.0' : grade,
    }
  }, [at, course, shape])

  const tipText = point ? `${point.mile}|${point.ft}|${point.grade}` : ''
  // Measured before paint, so the chip is on the right side of the line from its first frame.
  useLayoutEffect(() => {
    if (tipRef.current) setTipW(tipRef.current.offsetWidth)
  }, [tipText.length])
  /** Right of the line, or left of it when there is no room. */
  const tipLeft = point ? (point.x + TIP_GAP + tipW <= w ? point.x + TIP_GAP : Math.max(0, point.x - TIP_GAP - tipW)) : 0

  // Mouse and pen only: a touch has no hover, and a tap must not leave a cursor behind.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const box = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - box.left - PAD) / Math.max(1, box.width - 2 * PAD)))
    setAt(f * course.lengthM)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <Stat label="Distance" value={(course.lengthM / METERS_PER_MILE).toFixed(1)} unit="mi" dim={false} inline />
        <Stat label="Climbing" value={feet(course.ascentM)} unit="ft" dim={false} inline />
        <Stat label="Low" value={feet(shape.lo)} unit="ft" dim={false} inline />
        <Stat label="High" value={feet(shape.hi)} unit="ft" dim={false} inline />
      </div>
      <div ref={boxRef} data-course-profile className="ww-profile relative" onPointerMove={onMove} onPointerLeave={() => setAt(null)}>
        <svg width={w} height={h} className="absolute inset-0 block" aria-hidden>
          <path d={shape.area} fill="var(--ww-raised)" />
          <path d={shape.line} fill="none" stroke="var(--ww-fg-subtle)" strokeWidth={1.5} />
          {startMi > 0 && <line x1={shape.startX} x2={shape.startX} y1={0} y2={h} stroke="var(--ww-accent)" strokeWidth={2} />}
        </svg>
        {/* The cover that draws the profile in. A new one for every pick, so it plays again. */}
        {drawKey > 0 && <span key={drawKey} aria-hidden className="ww-draw-in" />}
        {point && (
          <>
            {/* fg, never Olive: Olive here is the start mile. Two-tone, so it reads over the fill. */}
            <span aria-hidden data-scrub-line className="ww-scrub-line" style={{ transform: `translateX(${point.x}px)` }} />
            <span
              aria-hidden
              data-scrub-dot
              className="ww-scrub-dot"
              style={{ background: 'var(--ww-fg)', transform: `translate(${point.x}px, ${point.y}px)` }}
            />
            <div ref={tipRef} data-course-tip aria-hidden className="ww-strip-tip top-0" style={{ left: tipLeft }}>
              <span>
                mile <span className="text-fg">{point.mile}</span>
              </span>
              <span>
                <span className="text-fg">{point.ft}</span> ft
              </span>
              <span>
                <span className="text-fg">{point.grade}</span>% grade
              </span>
            </div>
          </>
        )}
      </div>
      {course.description && <p className="text-fg-muted">{course.description}</p>}
    </div>
  )
}
