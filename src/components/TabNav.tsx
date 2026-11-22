import { useSlidingChip } from '../hooks/useSlidingChip'

interface TabNavProps<T extends string> {
  tabs: readonly { id: T; label: string; href: string }[]
  current: T
}

/**
 * Page tabs in the top bar. Same chip look as SegmentedControl at body size:
 * the current page is a `surface` chip with a `line-strong` border, one
 * element that slides to the current tab (useSlidingChip).
 */
export function TabNav<T extends string>({ tabs, current }: TabNavProps<T>) {
  const { trackRef, chipRef } = useSlidingChip<HTMLElement>(current)
  return (
    <nav ref={trackRef} aria-label="Pages" className="relative inline-flex gap-1 rounded-md border border-line bg-raised p-1">
      <span ref={chipRef} aria-hidden className="ww-chip-indicator" />
      {tabs.map((t) => {
        const active = t.id === current
        return (
          <a
            key={t.id}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            data-chip={active ? 'on' : undefined}
            className={`ww-press relative rounded-sm border border-transparent px-4 py-1 text-body font-semibold no-underline ${
              active ? 'text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </nav>
  )
}
