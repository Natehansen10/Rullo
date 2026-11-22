import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useGlide } from '../hooks/useGlide'
import { indexAt, targetPct, targetWatts, zoneAt, type Interval } from '../lib/workout'

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
  /** Watt labels above the blocks. Off for the small graph on a workout card. */
  labels?: boolean
  /**
   * Hover details: pointing at a block shows its targets, length, label and
   * cadence cue in a small overlay. Follows `labels` unless set, so the small
   * card graphs stay quiet.
   */
  details?: boolean
  /** Side of the strip the overlay sits on. It never takes space in the layout. */
  detailsSide?: 'below' | 'above'
  /** The ride is stale, paused or over: the position rests where the data is, and the first move after it snaps. */
  frozen?: boolean
  /** Change it to make the next position change snap (Skip interval). */
  snapKey?: unknown
  /** Index of a block to outline as a heads-up (the next interval, in the last seconds of this one), or null. */
  headsUp?: number | null
  className?: string
}

const MIN_SCALE_PCT = 130
/** Band above the tallest block for the watt labels. */
const LABEL_BAND = 16
/** Mono 11px is about 0.6em per character. */
const CHAR_W = 6.6
const LABEL_PAD = 4
/** Space between the strip and its hover overlay (the `mt-1` / `mb-1` on it). */
const TIP_GAP = 4
/** The Olive position line. With its 1px surface hairline on each side it is 4.5px. */
const LINE_W = 2.5

/** m:ss, or h:mm:ss from an hour up. */
function clock(s: number): string {
  const t = Math.max(0, Math.round(s))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const ss = String(t % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * Every interval as a block: width is duration, height is % FTP, color is the
 * power zone. Ramps are sloped. Each block is labeled with its watts (ramps as
 * start→end) when it is wide enough. The part done is washed out and an Olive
 * line marks the current position. Pointing at a block shows its details in an
 * overlay that is positioned over the page, so nothing around the strip moves.
 */
export function WorkoutStrip({
  intervals,
  ftpW,
  totalS,
  elapsedS,
  intensityPct = 100,
  heightClass,
  labels = true,
  details = labels,
  detailsSide = 'below',
  frozen = false,
  snapKey,
  headsUp = null,
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

  /** Index of the block under the mouse, or null. */
  const [hover, setHover] = useState<number | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [tipW, setTipW] = useState(0)
  const [side, setSide] = useState(detailsSide)

  const { w, h } = size
  const blocks = useMemo(() => {
    const pcts = intervals.map((iv) => [targetPct(iv.from, ftpW), targetPct(iv.to, ftpW)] as const)
    const scale = Math.max(MIN_SCALE_PCT, ...pcts.flat())
    const x = (s: number) => (s / totalS) * w
    const body = h - (labels ? LABEL_BAND : 0)
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
      // % FTP from the watts shown, as the row's Target does, so the two always agree.
      const pa = Math.round((wa / ftpW) * 100)
      const pb = Math.round((wb / ftpW) * 100)
      return {
        x0,
        x1,
        tip: {
          label: iv.label,
          zone: zoneAt((a + b) / 2, ftpW),
          watts: wa === wb ? String(wa) : `${wa}→${wb}`,
          pct: pa === pb ? String(pa) : `${pa}→${pb}`,
          length: clock(iv.durS),
          cadenceRpm: iv.cadenceRpm,
        },
        key: iv.index,
        d: `M${x0.toFixed(1)},${h}L${x0.toFixed(1)},${y(a).toFixed(1)}L${x1.toFixed(1)},${y(b).toFixed(1)}L${x1.toFixed(1)},${h}Z`,
        zone: zoneAt((a + b) / 2, ftpW),
        label: fits && labels ? { text, x: (x0 + x1) / 2, y: Math.min(y(a), y(b)) - 4 } : null,
      }
    })
  }, [intervals, ftpW, totalS, intensityPct, w, h, labels])

  const posX = elapsedS === undefined ? null : Math.min(w, (elapsedS / totalS) * w)
  // The position is a transform, so the browser eases between two readings. See useGlide for when it snaps.
  const glide = useGlide(posX, w, [h, intervals, totalS, snapKey], !frozen)

  const hovered = details && hover !== null ? blocks[hover] : undefined
  /** The heads-up outline. The hover outline wins: while a block is pointed at, it is the only one outlined. */
  const ahead = headsUp !== null && !hovered ? blocks[headsUp] : undefined
  const tipText = hovered ? `${hovered.tip.label}|${hovered.tip.watts}|${hovered.tip.pct}|${hovered.tip.length}|${hovered.tip.cadenceRpm}` : ''
  // Measured before paint, so the overlay is clamped to the strip from its first frame.
  useLayoutEffect(() => {
    const tip = tipRef.current
    const box = boxRef.current
    if (!tip || !box) return
    setTipW(tip.offsetWidth)
    // Flip to the other side when the preferred one would leave the window (a short window, a scrolled page).
    const r = box.getBoundingClientRect()
    const need = tip.offsetHeight + TIP_GAP
    const fitsBelow = r.bottom + need <= document.documentElement.clientHeight
    const fitsAbove = r.top - need >= 0
    setSide(detailsSide === 'below' ? (fitsBelow || !fitsAbove ? 'below' : 'above') : fitsAbove || !fitsBelow ? 'above' : 'below')
  }, [tipText, detailsSide])
  /** Centered on the block, kept inside the strip at the first and last block. */
  const tipLeft = hovered ? Math.max(0, Math.min(w - tipW, (hovered.x0 + hovered.x1) / 2 - tipW / 2)) : 0

  // Mouse and pen only: a touch has no hover, and a tap must not leave an overlay behind.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || intervals.length === 0) return
    const box = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - box.left) / Math.max(1, box.width)))
    const i = indexAt(intervals, Math.min(f * totalS, totalS - 0.001))
    setHover((prev) => (prev === i ? prev : i))
  }

  return (
    <div
      ref={boxRef}
      className={`relative ${heightClass} ${className}`}
      onPointerMove={details ? onMove : undefined}
      onPointerLeave={details ? () => setHover(null) : undefined}
    >
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
      </svg>
      {posX !== null && (
        <div aria-hidden data-strip-position className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* The part done, washed with surface at 60%: a full-width layer scaled from the left. */}
          <div
            className={`absolute inset-0 origin-left bg-surface opacity-60 ${glide.className}`}
            style={{ ...glide.style, transform: `scaleX(${posX / w})` }}
          />
          {/* Two-tone, like the outline below: Olive alone is 2.3:1 on z3, so it gets a 1px surface hairline on each side. */}
          <div
            className={`absolute top-0 bottom-0 left-0 bg-surface ${glide.className}`}
            style={{ ...glide.style, width: LINE_W + 2, marginLeft: -(LINE_W + 2) / 2, transform: `translateX(${posX}px)` }}
          >
            <div className="absolute top-0 bottom-0 bg-accent" style={{ left: 1, width: LINE_W }} />
          </div>
        </div>
      )}
      <svg width={w} height={h} className="pointer-events-none absolute inset-0 block" aria-hidden>
        {/* Heads-up: the same two-tone outline on the block that comes next, fading in. */}
        {ahead && (
          <g key={headsUp} data-heads-up className="ww-fade-in ww-fade-base">
            <path d={ahead.d} fill="none" stroke="var(--ww-surface)" strokeWidth={3} />
            <path d={ahead.d} fill="none" stroke="var(--ww-fg)" strokeWidth={1} />
          </g>
        )}
        {/* Two-tone outline: an fg line with a surface hairline on each side, so it reads on every zone fill (fg alone is 2.7:1 on z7). */}
        {hovered && (
          <>
            <path d={hovered.d} fill="none" stroke="var(--ww-surface)" strokeWidth={3} />
            <path d={hovered.d} fill="none" stroke="var(--ww-fg)" strokeWidth={1} />
          </>
        )}
      </svg>
      {hovered && (
        <div
          ref={tipRef}
          data-strip-tip
          aria-hidden
          style={{ left: tipLeft }}
          className={`ww-strip-tip ${side === 'above' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {hovered.tip.label && <span className="text-fg">{hovered.tip.label}</span>}
          <span className="flex items-center gap-1">
            <span className="h-2 w-2" style={{ background: `var(--ww-z${hovered.tip.zone})` }} />Z{hovered.tip.zone}
          </span>
          <span>
            <span className="text-fg">{hovered.tip.watts}</span> W
          </span>
          <span>
            <span className="text-fg">{hovered.tip.pct}</span>% FTP
          </span>
          <span>
            <span className="text-fg">{hovered.tip.length}</span>
          </span>
          {hovered.tip.cadenceRpm !== undefined && (
            <span>
              <span className="text-fg">{hovered.tip.cadenceRpm}</span> rpm
            </span>
          )}
        </div>
      )}
    </div>
  )
}
