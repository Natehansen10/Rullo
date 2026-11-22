import { useEffect, useRef, useState } from 'react'

export type StatusTone = 'on' | 'warn' | 'error' | 'idle'

const dot: Record<StatusTone, string> = {
  on: 'bg-state-on',
  warn: 'bg-state-under',
  error: 'bg-state-over',
  idle: 'bg-fg-subtle',
}

interface StatusPillProps {
  tone: StatusTone
  label: string
  /** Work is under way (connecting, reconnecting): the dot breathes. Never for a steady state like "Not recording". */
  busy?: boolean
}

/** The words of a label without its counters, so "Reconnecting 2/30" to "3/30" is the same label: numbers update in place. */
function words(label: string): string {
  return label.replace(/\d+/g, '#')
}

/**
 * Connection and ride state. When the words change, the pill's width eases to
 * the new label and the label crossfades, so the top bar does not snap.
 */
export function StatusPill({ tone, label, busy = false }: StatusPillProps) {
  const pillRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)

  // The label on screen and the one it replaced (derived from props, as React's docs describe for "previous render" state).
  const [shown, setShown] = useState({ label, old: null as string | null, n: 0 })
  if (shown.label !== label) {
    const swapped = words(shown.label) !== words(label)
    setShown({ label, old: swapped ? shown.label : shown.old, n: shown.n + (swapped ? 1 : 0) })
  }

  // The pill is as wide as its content. The width is written straight to the
  // element (no render): it snaps the first time, then eases (`.ww-pill`).
  useEffect(() => {
    const pill = pillRef.current
    const inner = innerRef.current
    if (!pill || !inner) return
    let first = true
    const ro = new ResizeObserver(() => {
      const w = `${inner.offsetWidth + pill.offsetWidth - pill.clientWidth}px`
      if (first) {
        pill.style.transition = 'none'
        pill.style.width = w
        void pill.offsetWidth
        pill.style.transition = ''
        first = false
      } else {
        pill.style.width = w
      }
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  return (
    <span
      ref={pillRef}
      role="status"
      aria-live="polite"
      className="ww-pill inline-flex shrink-0 overflow-hidden rounded-sm border border-line bg-raised"
    >
      <span ref={innerRef} className="inline-flex shrink-0 items-center gap-2 px-3 py-1 whitespace-nowrap">
        <span
          aria-hidden
          className={`size-2 rounded-full transition-colors duration-(--ww-dur-base) ease-out ${dot[tone]} ${busy ? 'ww-breathe' : ''}`}
        />
        <span className="relative">
          <span key={shown.n} className={`ww-label block text-fg ${shown.n > 0 ? 'ww-fade-in' : ''}`}>
            {label}
          </span>
          {shown.old !== null && (
            <span key={`old${shown.n}`} aria-hidden className="ww-label ww-fade-out absolute top-0 left-0 text-fg">
              {shown.old}
            </span>
          )}
        </span>
      </span>
    </span>
  )
}
