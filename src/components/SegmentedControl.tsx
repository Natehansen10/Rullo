import { useRef, type KeyboardEvent } from 'react'
import { useSlidingChip } from '../hooks/useSlidingChip'

interface SegmentedControlProps<T extends string | number> {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  format?: (v: T) => string
}

/**
 * Small option set. The selected option is a chip with its own surface and a
 * hairline border: one element behind the options that slides to the selected
 * one (useSlidingChip). Hover only brightens text, so a hovered option can never be
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
  const { trackRef, chipRef } = useSlidingChip<HTMLDivElement>(value)

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
      ref={trackRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative inline-flex gap-1 rounded-md border border-line bg-raised p-1"
    >
      <span ref={chipRef} aria-hidden className="ww-chip-indicator" />
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
            data-chip={active ? 'on' : undefined}
            onClick={() => onChange(opt)}
            className={`ww-press relative cursor-pointer rounded-sm border border-transparent px-3 py-1 font-mono text-mono leading-none font-medium ${
              active ? 'text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {format(opt)}
          </button>
        )
      })}
    </div>
  )
}
