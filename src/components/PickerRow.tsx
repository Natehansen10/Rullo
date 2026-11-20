import type { ReactNode } from 'react'

/**
 * One radio row in a picker panel: dot, title, mono meta. Selected row is
 * `raised`. Children show under the selected row as its detail card (the
 * course overview, the workout preview).
 */
export function PickerRow({
  checked,
  onClick,
  title,
  meta,
  children,
}: {
  checked: boolean
  onClick: () => void
  title: string
  meta: string
  children?: ReactNode
}) {
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onClick}
        className={`ww-press flex w-full cursor-pointer items-center gap-4 px-6 py-3 text-left ${checked ? 'bg-raised' : 'hover:bg-bg'}`}
      >
        <span
          aria-hidden
          className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
            checked ? 'border-fg' : 'border-line-strong'
          }`}
        >
          {checked && <span className="size-2 rounded-full bg-fg" />}
        </span>
        <span className={`font-semibold whitespace-nowrap ${checked ? 'text-fg' : 'text-fg-muted'}`}>{title}</span>
        <span className="min-w-0 truncate font-mono text-mono text-fg-subtle">{meta}</span>
      </button>
      {checked && children && <div className="border-t border-line px-6 py-4">{children}</div>}
    </div>
  )
}
