import { Button } from './Button'
import type { PairKind } from '../lib/pairing'

const COPY: Record<PairKind, { title: string; before: string; pick: string }> = {
  trainer: {
    title: 'Pair your trainer',
    before: 'Spin the pedals to wake the trainer, and close the Wahoo app and Zwift.',
    pick: 'Pick the trainer there and press Pair.',
  },
  heartRate: {
    title: 'Pair your heart rate sensor',
    before: "Put the strap on, or start the broadcast in your watch's relay app.",
    pick: 'Pick the sensor there and press Pair.',
  },
}

interface PairingStepProps {
  kind: PairKind
  /** Olive only when this is the screen's one primary (the trainer, before anything is connected). */
  primary: boolean
  /** Must open the browser's device list in the same click. */
  onContinue: () => void
  onCancel: () => void
}

/**
 * Rullo's own step before the browser's device list. The list is drawn by the
 * browser and cannot be styled, so this says what to do first and what is
 * about to appear. Shown only when the list is really about to open.
 */
export function PairingStep({ kind, primary, onContinue, onCancel }: PairingStepProps) {
  const c = COPY[kind]
  return (
    <section
      aria-label={c.title}
      className="ww-enter flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-fg">{c.title}</span>
        <span className="text-fg-muted">{c.before}</span>
        <span className="text-fg-muted">Your browser shows its own device list next. {c.pick}</span>
      </div>
      <div className="flex gap-3">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant={primary ? 'primary' : 'secondary'} onClick={onContinue} autoFocus>
          Show device list
        </Button>
      </div>
    </section>
  )
}
