import type { ReactNode } from 'react'
import { Button } from './Button'

interface StepperProps {
  label: string
  value: string
  unit?: string
  onDecrement: () => void
  onIncrement: () => void
  decrementLabel: string
  incrementLabel: string
  disabled?: boolean
  atMin?: boolean
  atMax?: boolean
  /** Short state text after the value, e.g. "Applies when connected". */
  status?: ReactNode
  /** Keyboard hint on the right, in mono. */
  hint?: string
  className?: string
}

/** Large minus / value / plus control, sized to hit from the saddle. */
export function Stepper({
  label,
  value,
  unit,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  disabled = false,
  atMin = false,
  atMax = false,
  status,
  hint,
  className = '',
}: StepperProps) {
  return (
    <div className={`flex flex-wrap items-center gap-6 ${className}`}>
      <span className="ww-label">{label}</span>
      <div className="flex items-center gap-4">
        <Button aria-label={decrementLabel} onClick={onDecrement} disabled={disabled || atMin} className="size-12 px-0 text-title">
          −
        </Button>
        <span aria-live="polite" className={`ww-num ww-num-control text-center ${disabled ? 'text-fg-subtle' : 'text-fg'}`}>
          {value}
          {unit && <span className="ww-unit">{unit}</span>}
        </span>
        <Button aria-label={incrementLabel} onClick={onIncrement} disabled={disabled || atMax} className="size-12 px-0 text-title">
          +
        </Button>
      </div>
      {status && <span className="text-body text-fg-muted">{status}</span>}
      {hint && <span className="ml-auto font-mono text-mono text-fg-subtle">{hint}</span>}
    </div>
  )
}
