import { useEffect, useRef, type CSSProperties } from 'react'
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

/**
 * Apps that make an Apple Watch show up as a standard Bluetooth heart rate
 * sensor, free ones first. Links and needs read from each App Store listing
 * on Nov 22 and 24, 2026; Nate found HeartBLE costs money to use. None has
 * been ride-tested with Rullo yet.
 */
const RELAY_APPS = [
  {
    name: 'HR Broadcast',
    href: 'https://apps.apple.com/us/app/hr-broadcast/id6766073249',
    price: 'Free',
    note: 'Watch and iPhone. Keep the iPhone app open.',
  },
  {
    name: 'HeartCast',
    href: 'https://apps.apple.com/us/app/heartcast-heart-rate-monitor/id1499771124',
    price: 'Free',
    note: 'Watch and iPhone. Its paid extras are optional.',
  },
  {
    name: 'HeartBLE',
    href: 'https://apps.apple.com/us/app/heartble-heart-rate-bluetooth/id6758879454',
    price: 'Paid',
    note: 'Watch only, no iPhone. Needs watchOS 26.',
  },
]

/** Each part enters once, a beat after the one before it (see Motion in DESIGN.md). */
function enterAfter(ms: number): CSSProperties {
  return { '--ww-enter-delay': `${ms}ms` } as CSSProperties
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
  if (kind === 'heartRate') return <WatchCard primary={primary} onContinue={onContinue} onCancel={onCancel} />
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

function StepMark({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="ww-step-mark font-mono text-mono text-fg">
      {n}
    </span>
  )
}

/**
 * The heart rate sensor's step, as a pop-up card over the page: how to get an
 * Apple Watch broadcasting, which app to use (free ones first), and Connect
 * when the rider is ready. A native modal dialog, so the page behind is inert,
 * focus stays inside and Escape cancels. It covers the ride panel and moves
 * nothing on it.
 */
function WatchCard({ primary, onContinue, onCancel }: Omit<PairingStepProps, 'kind'>) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    // showModal() puts focus on the first link; the rider's next press is Connect.
    d.querySelector<HTMLElement>('[data-first-focus]')?.focus()
    return () => {
      if (d.open) d.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="ww-watch-card-title"
      className="ww-dialog"
      onCancel={(e) => {
        // Escape: close through the ride's state, so the step and the dialog agree.
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        // A click on the scrim (the dialog element itself, outside its content) cancels.
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="flex flex-col">
        <header className="flex flex-col gap-2 px-6 pt-6 pb-4">
          <span className="ww-label">Heart rate</span>
          <h2 id="ww-watch-card-title" className="text-title font-semibold text-fg">
            Connect your watch
          </h2>
          <p className="text-fg-muted">
            An Apple Watch does not send heart rate on its own. A relay app makes it show up as a sensor.
          </p>
        </header>
        <ol className="flex flex-col gap-6 border-t border-line px-6 py-6">
          <li className="ww-enter ww-step" style={enterAfter(120)}>
            <StepMark n={1} />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="font-semibold text-fg">Get a relay app</span>
              <ul className="flex flex-col">
                {RELAY_APPS.map((app) => (
                  <li key={app.name}>
                    <a
                      className="ww-app-row"
                      href={app.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${app.name}, ${app.price}. ${app.note} Opens the App Store in a new tab.`}
                    >
                      <span className="ww-app-row-name">{app.name}</span>
                      <span className="ww-app-row-price font-mono text-mono text-fg">{app.price}</span>
                      <span className="min-w-0 flex-1 text-fg-muted">{app.note}</span>
                      <span className="ww-app-row-arrow font-mono text-mono text-fg-muted" aria-hidden="true">
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </li>
          <li className="ww-enter ww-step" style={enterAfter(200)}>
            <StepMark n={2} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold text-fg">Start the broadcast</span>
              <span className="text-fg-muted">Open the app on your watch and tap Start.</span>
            </div>
          </li>
          <li className="ww-enter ww-step" style={enterAfter(280)}>
            <StepMark n={3} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold text-fg">Pick it in the list</span>
              <span className="text-fg-muted">
                Press Connect. Your browser shows its own device list. Pick the watch (it may show as your iPhone)
                and press Pair.
              </span>
            </div>
          </li>
        </ol>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
          <span className="text-fg-muted">Chest strap? Put it on and press Connect.</span>
          <div className="flex gap-3">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant={primary ? 'primary' : 'secondary'} onClick={onContinue} data-first-focus>
              Connect
            </Button>
          </div>
        </footer>
      </div>
    </dialog>
  )
}
