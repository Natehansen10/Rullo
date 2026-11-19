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
}

export function StatusPill({ tone, label }: StatusPillProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-sm border border-line bg-raised px-3 py-1"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full transition-colors duration-(--ww-dur-base) ease-out ${dot[tone]}`}
      />
      <span className="ww-label text-fg">{label}</span>
    </span>
  )
}
