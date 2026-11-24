import type { CSSProperties } from 'react'
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
 * sensor. Links and needs read from each App Store listing on Nov 22, 2026.
 * None has been ride-tested with Rullo yet.
 */
const RELAY_APPS = [
  {
    name: 'HeartBLE',
    href: 'https://apps.apple.com/us/app/heartble-heart-rate-bluetooth/id6758879454',
    note: 'Watch only. Needs watchOS 26.',
  },
  {
    name: 'HeartCast',
    href: 'https://apps.apple.com/us/app/heartcast-heart-rate-monitor/id1499771124',
    note: 'Watch and iPhone.',
  },
  {
    name: 'HR Broadcast',
    href: 'https://apps.apple.com/us/app/hr-broadcast/id6766073249',
    note: 'Watch and iPhone.',
  },
]

/** Each step enters once, a beat after the one before it (see Motion in DESIGN.md). */
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

/**
 * The heart rate sensor's step: how to get an Apple Watch broadcasting, which
 * app to use, and Connect when the rider is ready. One panel, three steps.
 */
function WatchCard({ primary, onContinue, onCancel }: Omit<PairingStepProps, 'kind'>) {
  return (
    <section
      aria-label="Connect your watch"
      className="ww-enter flex flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-fg">Connect your watch</span>
        <span className="text-fg-muted">
          An Apple Watch does not send heart rate on its own. A relay app makes it show up as a sensor.
        </span>
      </div>
      <ol className="grid gap-6 border-t border-line pt-4 xl:grid-cols-3">
        <li className="ww-enter flex flex-col gap-1" style={enterAfter(80)}>
          <span className="ww-label">Step 1</span>
          <span className="font-semibold text-fg">Get a relay app</span>
          <ul className="flex flex-col gap-1">
            {RELAY_APPS.map((app) => (
              <li key={app.name} className="flex flex-wrap items-baseline gap-2">
                <a
                  className="ww-link"
                  href={app.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${app.name} on the App Store (opens in a new tab)`}
                >
                  {app.name}
                </a>
                <span className="text-fg-muted">{app.note}</span>
              </li>
            ))}
          </ul>
        </li>
        <li className="ww-enter flex flex-col gap-1" style={enterAfter(160)}>
          <span className="ww-label">Step 2</span>
          <span className="font-semibold text-fg">Start the broadcast</span>
          <span className="text-fg-muted">
            Open the app on your watch and tap Start. With HeartCast or HR Broadcast, keep the iPhone app open
            nearby.
          </span>
        </li>
        <li className="ww-enter flex flex-col gap-1" style={enterAfter(240)}>
          <span className="ww-label">Step 3</span>
          <span className="font-semibold text-fg">Pick it in the list</span>
          <span className="text-fg-muted">
            Press Connect. Your browser shows its own device list. Pick the watch (it may show as HeartBLE or as
            your iPhone) and press Pair.
          </span>
        </li>
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-fg-muted">Chest strap or armband? Put it on and press Connect. No app needed.</span>
        <div className="flex gap-3">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={primary ? 'primary' : 'secondary'} onClick={onContinue} autoFocus>
            Connect
          </Button>
        </div>
      </div>
    </section>
  )
}
