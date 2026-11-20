interface StatProps {
  label: string
  value: string
  unit?: string
  dim: boolean
  /** Label beside the number, not above it: one line, for the compact course and workout rows. */
  inline?: boolean
}

/** A small live number with its label: course and workout rows. */
export function Stat({ label, value, unit, dim, inline = false }: StatProps) {
  return (
    <div className={inline ? 'flex shrink-0 items-baseline gap-2' : 'flex flex-col gap-2'}>
      <span className="ww-label whitespace-nowrap">{label}</span>
      <span className={`ww-num ww-num-sm whitespace-nowrap ${dim ? 'text-fg-subtle' : 'text-fg'}`}>
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </span>
    </div>
  )
}
