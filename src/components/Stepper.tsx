import type { ReactNode } from 'react'
import { Button } from './Button'

interface StepperProps {
  /** Text label, or a control (e.g. a mode switch) in the label slot. */
  label: ReactNode
  value: string
  unit?: string
  /** Step sizes, smallest first. Renders minus steps (largest outside) and plus steps (largest outside). */
  steps: readonly number[]
  onStep: (delta: number) => void
  /** Accessible name for one step button, e.g. (d) => `Resistance ${d}%`. */
  stepLabel: (delta: number) => string
  disabled?: boolean
  atMin?: boolean
  atMax?: boolean
  /** Short state text after the controls, e.g. "Applies when connected". */
  status?: ReactNode
  /** Keyboard hint on the right, in mono. */
  hint?: string
  className?: string
}

const MINUS = '−'

/** Value flanked by direct step buttons, sized to hit from the saddle. */
export function Stepper({
  label,
  value,
  unit,
  steps,
  onStep,
  stepLabel,
  disabled = false,
  atMin = false,
  atMax = false,
  status,
  hint,
  className = '',
}: StepperProps) {
  const down = [...steps].reverse().map((s) => -s)
  const up = [...steps]
  const stepButton = (delta: number) => (
    <Button
      key={delta}
      aria-label={stepLabel(delta)}
      onClick={() => onStep(delta)}
      disabled={disabled || (delta < 0 ? atMin : atMax)}
      className="h-12 px-3 tabular-nums"
    >
      {delta < 0 ? `${MINUS}${-delta}` : `+${delta}`}
    </Button>
  )
  // At desktop width the row never wraps: the status text takes the space left
  // and may run to two lines inside the row's height.
  return (
    <div className={`flex flex-wrap items-center gap-4 xl:flex-nowrap ${className}`}>
      {typeof label === 'string' ? <span className="ww-label">{label}</span> : label}
      <div className="flex shrink-0 items-center gap-2">
        {down.map(stepButton)}
        <span
          aria-live="polite"
          className={`ww-num ww-num-control px-3 text-center ${disabled ? 'text-fg-subtle' : 'text-fg'}`}
        >
          {value}
          {unit && <span className="ww-unit">{unit}</span>}
        </span>
        {up.map(stepButton)}
      </div>
      {status && <span className="min-w-0 text-body leading-tight text-fg-muted">{status}</span>}
      {hint && <span className="ml-auto shrink-0 font-mono text-mono whitespace-nowrap text-fg-subtle">{hint}</span>}
    </div>
  )
}
