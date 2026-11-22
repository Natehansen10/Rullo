import type { CSSProperties, ReactNode } from 'react'
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
  /** The value is a placeholder ("--"): there is no reading. */
  empty?: boolean
  /**
   * First data: when `empty` turns false the number enters once (fade and a
   * small rise), this many ms late so a row of tiles can stagger. Leave unset
   * for a number that is always there (distance, time).
   */
  enterDelayMs?: number
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
  empty = false,
  enterDelayMs,
  className = '',
}: MetricTileProps) {
  const arrivals = useFirstValue(!empty)
  const enter = enterDelayMs !== undefined && arrivals > 0 && !empty
  const color = dim ? 'text-fg-subtle' : size === 'hero' ? 'text-accent' : 'text-fg'
  return (
    <div className={`flex min-w-0 flex-col justify-between ${dense ? 'gap-2' : 'gap-4'} ${className}`}>
      <div className={`flex items-center justify-between gap-3 ${size === 'hero' || !dense ? 'min-h-8' : ''}`}>
        <span className="ww-label whitespace-nowrap">{label}</span>
        {action}
      </div>
      <div
        // A new key only when a reading arrives, so the enter plays once and updates stay in place.
        key={arrivals}
        className={`ww-num whitespace-nowrap ${size === 'hero' ? 'ww-num-hero' : 'ww-num-lg'} ${color} ${enter ? 'ww-enter' : ''}`}
        style={enter ? ({ '--ww-enter-delay': `${enterDelayMs}ms` } as CSSProperties) : undefined}
      >
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </div>
    </div>
  )
}
