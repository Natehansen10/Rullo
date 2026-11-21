import type { ReactNode } from 'react'

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
  className?: string
}

/** One live number. Updates in place; no digit rolling. */
export function MetricTile({ label, value, unit, size = 'lg', dim = false, action, dense = false, className = '' }: MetricTileProps) {
  const color = dim ? 'text-fg-subtle' : size === 'hero' ? 'text-accent' : 'text-fg'
  return (
    <div className={`flex min-w-0 flex-col justify-between ${dense ? 'gap-2' : 'gap-4'} ${className}`}>
      <div className={`flex items-center justify-between gap-3 ${size === 'hero' || !dense ? 'min-h-8' : ''}`}>
        <span className="ww-label whitespace-nowrap">{label}</span>
        {action}
      </div>
      <div className={`ww-num whitespace-nowrap ${size === 'hero' ? 'ww-num-hero' : 'ww-num-lg'} ${color}`}>
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </div>
    </div>
  )
}
