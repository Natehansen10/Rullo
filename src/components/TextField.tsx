import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (v: string) => void
  /** Called when the field is left or Enter is pressed: the place to tidy what was typed. */
  onCommit?: () => void
  /** Visible label above the field. Without it, pass aria-label. */
  label?: string
  invalid?: boolean
  /** Select the whole value on focus, so typing replaces it. For short values in dense rows. */
  selectOnFocus?: boolean
  /** Classes for the input itself (its width). */
  inputClassName?: string
}

/**
 * A typed field: `raised` with a `line-strong` border, like the Profile
 * inputs, at body size. Takes text, so "12:00", "90%" and "225w" can all be
 * typed; the caller parses. Keys typed here never reach the ride shortcuts.
 */
export function TextField({
  value,
  onChange,
  onCommit,
  label,
  invalid = false,
  selectOnFocus = false,
  inputClassName = '',
  className = '',
  id,
  ...rest
}: TextFieldProps) {
  const auto = useId()
  const fieldId = id ?? auto
  const input = (
    <input
      id={fieldId}
      type="text"
      autoComplete="off"
      spellCheck={false}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onFocus={selectOnFocus ? (e) => e.target.select() : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit?.()
      }}
      className={`ww-field ${inputClassName}`}
      {...rest}
    />
  )
  if (!label) return input
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={fieldId} className="ww-label">
        {label}
      </label>
      {input}
    </div>
  )
}
