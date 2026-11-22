import { useRef } from 'react'

interface StatProps {
  label: string
  value: string
  unit?: string
  dim: boolean
  /** Label beside the number, not above it: one line, for the compact course and workout rows. */
  inline?: boolean
  /**
   * A discrete event counter (the workout's interval changes). When it changes
   * after the first render, the value and its unit enter once: a fade and a
   * 6px rise. Leave unset for a value that only ticks (time left), which never animates.
   */
  changeKey?: number
}

/** A small live number with its label: course and workout rows. */
export function Stat({ label, value, unit, dim, inline = false, changeKey }: StatProps) {
  const first = useRef(changeKey)
  const entered = changeKey !== undefined && changeKey !== first.current
  return (
    <div className={inline ? 'flex shrink-0 items-baseline gap-2' : 'flex flex-col gap-2'}>
      <span className="ww-label whitespace-nowrap">{label}</span>
      <span
        key={changeKey}
        className={`ww-num ww-num-sm whitespace-nowrap ${dim ? 'text-fg-subtle' : 'text-fg'} ${entered ? 'ww-enter ww-enter-interval' : ''}`}
      >
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </span>
    </div>
  )
}
