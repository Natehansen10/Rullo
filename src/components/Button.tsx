import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** sm: a compact button for dense rows (the workout builder's step rows). */
  size?: 'md' | 'sm'
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink border-accent hover:bg-accent-hover hover:border-accent-hover active:bg-accent-press active:border-accent-press',
  secondary: 'bg-raised text-fg border-line-strong hover:bg-line',
  // Hover goes lighter, not darker: state-over on `line` would drop under 4.5:1.
  danger: 'bg-raised text-state-over border-state-over hover:bg-surface',
}

/** Cobalt (primary) is for the one main action on screen. */
export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`ww-press inline-flex items-center justify-center rounded-md border ${size === 'sm' ? 'px-2 py-1' : 'px-4 py-2'} text-body font-semibold whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:bg-raised disabled:border-line disabled:text-fg-subtle ${variants[variant]} ${className}`}
      {...rest}
    />
  )
}
