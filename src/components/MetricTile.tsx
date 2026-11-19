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
  className?: string
}

/** One live number. Updates in place; no digit rolling. */
export function MetricTile({ label, value, unit, size = 'lg', dim = false, action, className = '' }: MetricTileProps) {
  const color = dim ? 'text-fg-subtle' : size === 'hero' ? 'text-accent' : 'text-fg'
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-4 ${className}`}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <span className="ww-label">{label}</span>
        {action}
      </div>
      <div className={`ww-num whitespace-nowrap ${size === 'hero' ? 'ww-num-hero' : 'ww-num-lg'} ${color}`}>
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </div>
    </div>
  )
}
