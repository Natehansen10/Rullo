import type { ReactNode } from 'react'

/** One radio row in a picker panel: dot, title, mono meta, optional action. Selected row is `raised`. */
export function PickerRow({
  checked,
  onClick,
  title,
  meta,
  action,
}: {
  checked: boolean
  onClick: () => void
  title: string
  meta: string
  action?: ReactNode
}) {
  return (
    <div className={`flex items-center gap-4 border-t border-line px-6 py-3 ${checked ? 'bg-raised' : ''}`}>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onClick}
        className="ww-press flex flex-1 cursor-pointer items-center gap-4 text-left"
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
        <span className="font-mono text-mono text-fg-subtle">{meta}</span>
      </button>
      {action}
    </div>
  )
}
