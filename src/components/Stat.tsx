/** A small live number with its label: course and workout rows. */
export function Stat({ label, value, unit, dim }: { label: string; value: string; unit?: string; dim: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="ww-label">{label}</span>
      <span className={`ww-num ww-num-sm whitespace-nowrap ${dim ? 'text-fg-subtle' : 'text-fg'}`}>
        {value}
        {unit && <span className="ww-unit">{unit}</span>}
      </span>
    </div>
  )
}
