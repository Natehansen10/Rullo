import { useRef, type CSSProperties, type ReactNode } from 'react'
import { useFirstValue } from '../hooks/useFirstValue'

interface MetricTileProps {
  label: string
  value: string
  unit?: string
  /** hero: live power only. */
  size?: 'hero' | 'lg'
  /** Gray the number out: stale, not live, or empty. */
  dim?: boolean
  /** Optional control in the label row (e.g. smoothing toggle). */
  action?: ReactNode
  /** Tighter label-to-number gap, for when the ride panel also shows a course or workout row. */
  dense?: boolean
  /**
   * Zone chip after the label (the Power tile only): 1 to 7, or null to hide
   * it. The slot keeps its width either way, so nothing beside it moves.
   */
  zone?: number | null
  /**
   * Zone color for the number (the Power tile only): 1 to 7 puts the number
   * in that zone's token. Null or unset leaves it Olive (hero) or `fg`. `dim`
   * wins. Only the color changes; the color eases, the digits never do.
   */
  tint?: number | null
  /** The value is a placeholder ("--"): there is no reading. */
  empty?: boolean
  /**
   * First data: when `empty` turns false the number enters once (fade and a
   * small rise), this many ms late so a row of tiles can stagger. Leave unset
   * for a number that is always there (distance, time).
   */
  enterDelayMs?: number
  /**
   * A chart for the free space between the label row and the number (the
   * Power tile's trace). It gets only the room the tile already has spare,
   * which can be none; it never makes the tile taller or moves the number.
   */
  chart?: ReactNode
  className?: string
}

/** One live number. Updates in place; no digit rolling. The only motion is the one-time enter of a first reading. */
export function MetricTile({
  label,
  value,
  unit,
  size = 'lg',
  dim = false,
  action,
  dense = false,
  zone,
  tint,
  empty = false,
  enterDelayMs,
  chart,
  className = '',
}: MetricTileProps) {
  const arrivals = useFirstValue(!empty)
  const enter = enterDelayMs !== undefined && arrivals > 0 && !empty
  const color = dim ? 'text-fg-subtle' : tint != null && ZONE_TEXT[tint] ? ZONE_TEXT[tint] : size === 'hero' ? 'text-accent' : 'text-fg'
  return (
    <div className={`flex min-w-0 flex-col justify-between ${dense ? 'gap-2' : 'gap-4'} ${className}`}>
      <div className={`flex items-center justify-between gap-3 ${size === 'hero' || !dense ? 'min-h-8' : ''}`}>
        {zone === undefined ? (
          <span className="ww-label whitespace-nowrap">{label}</span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="ww-label whitespace-nowrap">{label}</span>
            <ZoneChip zone={zone} />
          </span>
        )}
        {action}
      </div>
      {/* The negative margin takes back the gap this third child would add, so the tile needs no more height than without it. */}
      {chart !== undefined && <div className={`ww-tile-chart ${dense ? '-mt-2' : '-mt-4'}`}>{chart}</div>}
      <div
        // A new key only when a reading arrives, so the enter plays once and updates stay in place.
        key={arrivals}
        data-tint={!dim && tint != null && ZONE_TEXT[tint] ? tint : undefined}
        className={`ww-num whitespace-nowrap ${size === 'hero' ? 'ww-num-hero' : 'ww-num-lg'} ${color} ${enter ? 'ww-enter' : ''}`}
        style={enter ? ({ '--ww-enter-delay': `${enterDelayMs}ms` } as CSSProperties) : undefined}
      >
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </div>
    </div>
  )
}

/** The text color of each zone, by zone number. Written out in full so Tailwind makes the classes. */
const ZONE_TEXT: Record<number, string> = {
  1: 'text-z1',
  2: 'text-z2',
  3: 'text-z3',
  4: 'text-z4',
  5: 'text-z5',
  6: 'text-z6',
  7: 'text-z7',
}

/**
 * The power zone right now: an 8px swatch in the zone token with its code in
 * mono, as in the workout strip's hover details. Fixed width, so Z1 to Z7 and
 * hidden all take the same room. The swatch color eases. The code is always
 * there, so the number's zone color (`tint`) is never the only signal.
 */
function ZoneChip({ zone }: { zone: number | null }) {
  // While hidden it keeps its last zone, so it fades out in the color it had.
  const last = useRef(zone ?? 1)
  if (zone !== null) last.current = zone
  const z = last.current
  return (
    <span
      data-zone-chip
      aria-hidden={zone === null}
      className={`ww-zone-chip font-mono text-mono text-fg ${zone === null ? 'opacity-0' : ''}`}
    >
      <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: `var(--ww-z${z})` }} />
      <span className="sr-only">Zone </span>Z{z}
    </span>
  )
}
