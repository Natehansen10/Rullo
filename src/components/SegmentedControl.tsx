import { useRef, type KeyboardEvent } from 'react'

interface SegmentedControlProps<T extends string | number> {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}

/**
 * Small option set. The selected option is a chip with its own surface and a
 * hairline border; hover only brightens text, so a hovered option can never be
 * mistaken for the selected one. One Tab stop; Left / Right move the selection.
 * Up / Down are left alone so the ride screen's step keys keep working.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = String,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    const i = options.indexOf(value)
    const next = Math.min(options.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))
    if (next === i) return
    onChange(options[next])
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex gap-1 rounded-md border border-line bg-raised p-1"
    >
      {options.map((opt, i) => {
        const active = opt === value
        return (
          <button
            key={String(opt)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt)}
            className={`ww-press cursor-pointer rounded-sm border px-3 py-1 font-mono text-mono leading-none font-medium ${
              active ? 'border-line-strong bg-surface text-fg' : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {format(opt)}
          </button>
        )
      })}
    </div>
  )
}
