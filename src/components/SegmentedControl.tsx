interface SegmentedControlProps<T extends string | number> {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = String,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-md border border-line bg-raised p-1">
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={`ww-press cursor-pointer rounded-sm px-3 py-1 font-mono text-mono leading-none font-medium ${
              active ? 'bg-line-strong text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {format(opt)}
          </button>
        )
      })}
    </div>
  )
}
