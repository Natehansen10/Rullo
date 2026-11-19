interface TabNavProps<T extends string> {
  tabs: readonly { id: T; label: string; href: string }[]
  current: T
}

/**
 * Page tabs in the top bar. Same chip look as SegmentedControl at body size:
 * the current page is a `surface` chip with a `line-strong` border.
 */
export function TabNav<T extends string>({ tabs, current }: TabNavProps<T>) {
  return (
    <nav aria-label="Pages" className="inline-flex gap-1 rounded-md border border-line bg-raised p-1">
      {tabs.map((t) => {
        const active = t.id === current
        return (
          <a
            key={t.id}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`ww-press rounded-sm border px-4 py-1 text-body font-semibold no-underline ${
              active ? 'border-line-strong bg-surface text-fg' : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </nav>
  )
}
