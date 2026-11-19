import { useEffect, useState, type ReactNode } from 'react'
import { Button } from './components/Button'
import { MetricTile } from './components/MetricTile'
import { SegmentedControl } from './components/SegmentedControl'
import { StatusPill, type StatusTone } from './components/StatusPill'
import { Stepper } from './components/Stepper'
import { RESISTANCE_STEPS_PCT, SMOOTHING_OPTIONS } from './config'
import { ride, useRide } from './hooks/useRide'
import type { RideSnapshot } from './lib/ride'

const EMPTY = '--'
const CONFIRM_MS = 3000

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function status(s: RideSnapshot): { tone: StatusTone; label: string } {
  if (!s.supported) return { tone: 'error', label: 'Not supported' }
  if (s.phase === 'ended') return { tone: 'idle', label: 'Ride ended' }
  const c = s.connection
  if (c.kind === 'reconnecting') return { tone: 'warn', label: `Reconnecting ${c.attempt}/${c.max}` }
  if (s.stale) {
    if (c.kind === 'failed' || c.kind === 'disconnected') return { tone: 'error', label: 'Disconnected' }
    return { tone: 'warn', label: 'Reconnecting' }
  }
  if (c.kind === 'connecting') return { tone: 'warn', label: 'Connecting' }
  if (c.kind === 'connected') return { tone: 'on', label: s.phase === 'ready' ? 'Ready' : 'Connected' }
  return { tone: 'idle', label: 'Not connected' }
}

function resistanceStatus(s: RideSnapshot): string | null {
  if (s.resistanceState === 'unsupported') return "This trainer doesn't accept resistance control"
  if (s.resistanceState === 'failed') return "Trainer didn't take the change. Tap again."
  if (s.connection.kind !== 'connected' || s.phase === 'ended') return 'Applies when connected'
  if (s.resistanceState === 'sending') return 'Setting'
  return null
}

function Notice({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-6 py-4">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-fg">{title}</span>
        {children && <span className="text-fg-muted">{children}</span>}
      </div>
      {actions && <div className="flex gap-3">{actions}</div>}
    </div>
  )
}

export default function App() {
  const s = useRide()
  const [confirmEnd, setConfirmEnd] = useState(false)

  // Resistance from the saddle: arrows 1%, Shift+arrows 10%, + / - 5%.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const big = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowUp') ride.stepResistance(big)
      else if (e.key === 'ArrowDown') ride.stepResistance(-big)
      else if (e.key === '+' || e.key === '=') ride.stepResistance(5)
      else if (e.key === '-' || e.key === '_') ride.stepResistance(-5)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!confirmEnd) return
    const t = setTimeout(() => setConfirmEnd(false), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirmEnd])

  const pill = status(s)
  const live = s.phase === 'ready' || s.phase === 'riding'
  const dimLive = !live || s.stale
  const connecting = s.connection.kind === 'connecting'
  const lost = live && (s.connection.kind === 'failed' || s.connection.kind === 'disconnected')

  const onEnd = () => {
    if (!confirmEnd) {
      setConfirmEnd(true)
      return
    }
    setConfirmEnd(false)
    void ride.endRide()
  }

  const power = live && s.powerW !== null ? String(s.powerW) : EMPTY
  const cadence = live && s.cadenceRpm !== null ? String(s.cadenceRpm) : EMPTY
  const speed = live && s.speedMph !== null ? s.speedMph.toFixed(1) : EMPTY

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-line px-8 py-4">
        <span className="ww-wordmark">Weem Watts</span>
        <div className="flex items-center gap-3">
          <StatusPill tone={pill.tone} label={pill.label} />
          {s.phase === 'idle' && (
            <Button variant="primary" onClick={ride.connect} disabled={!s.supported || connecting}>
              {connecting ? 'Connecting' : s.resuming ? 'Connect to resume' : 'Connect'}
            </Button>
          )}
          {live && lost && (
            <Button variant="primary" onClick={ride.connect}>
              Reconnect
            </Button>
          )}
          {s.phase === 'ready' && <Button onClick={ride.disconnect}>Disconnect</Button>}
          {s.phase === 'riding' && (
            <Button variant={confirmEnd ? 'danger' : 'secondary'} onClick={onEnd}>
              {confirmEnd ? 'Confirm end' : 'End Ride'}
            </Button>
          )}
          {s.phase === 'ended' && (
            <>
              {s.canDownload && (
                <Button variant="primary" onClick={() => void ride.download()}>
                  Download FIT
                </Button>
              )}
              <Button onClick={ride.newRide}>New ride</Button>
            </>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-8">
        {!s.supported && (
          <Notice title="This browser can't connect to your trainer">
            Web Bluetooth is not available here. Open Weem Watts in Chrome or Edge on a desktop computer.
          </Notice>
        )}
        {s.connection.kind === 'failed' && (
          <Notice title={live ? 'Trainer lost' : 'Pairing failed'}>{s.connection.message}</Notice>
        )}
        {s.recovery && s.phase === 'idle' && !s.resuming && (
          <Notice
            title="Unfinished ride found"
            actions={
              <>
                <Button onClick={ride.resumeRecovered}>Resume</Button>
                <Button onClick={() => void ride.endRecovered()}>End and download</Button>
              </>
            }
          >
            Started {formatClock(s.recovery.startedAt)}, {s.recovery.distanceMi.toFixed(2)} mi recorded.
          </Notice>
        )}
        {s.resuming && (
          <Notice title="Resuming your ride">Press Connect and pick your Kickr. Distance picks up where it left off.</Notice>
        )}
        {s.notice && <Notice title={s.notice} />}

        <section
          aria-label="Live ride data"
          className="grid flex-1 grid-cols-1 grid-rows-[1fr_auto_auto] rounded-lg border border-line bg-surface xl:grid-cols-2 xl:grid-rows-[1fr_auto]"
        >
          <MetricTile
            size="hero"
            label="Power"
            value={power}
            unit="W"
            dim={dimLive || s.powerW === null}
            className="border-b border-line p-6 xl:border-r xl:border-b-0"
            action={
              <SegmentedControl
                label="Power smoothing"
                options={SMOOTHING_OPTIONS}
                value={s.smoothing}
                onChange={ride.setSmoothing}
                format={(v) => `${v}s`}
              />
            }
          />
          <div className="grid grid-cols-2 grid-rows-2">
            <MetricTile
              label="Cadence"
              value={cadence}
              unit="rpm"
              dim={dimLive || s.cadenceRpm === null}
              className="border-r border-b border-line p-6"
            />
            <MetricTile
              label="Speed"
              value={speed}
              unit="mph"
              dim={dimLive || s.speedMph === null}
              className="border-b border-line p-6"
            />
            <MetricTile
              label="Distance"
              value={s.distanceMi.toFixed(2)}
              unit="mi"
              dim={s.phase === 'riding' ? s.stale : s.phase !== 'ended'}
              className="border-r border-line p-6"
            />
            <MetricTile
              label="Time"
              value={formatTime(s.elapsedMs)}
              dim={s.phase === 'riding' ? s.stale : s.phase !== 'ended'}
              className="p-6"
            />
          </div>
          <Stepper
            label="Resistance"
            value={String(s.resistancePct)}
            unit="%"
            steps={RESISTANCE_STEPS_PCT}
            onStep={ride.stepResistance}
            stepLabel={(d) => `Resistance ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)}%`}
            disabled={s.resistanceState === 'unsupported'}
            atMin={s.resistancePct <= 0}
            atMax={s.resistancePct >= 100}
            status={resistanceStatus(s)}
            hint="↑↓ 1%  ·  +/− 5%  ·  shift ↑↓ 10%"
            className="border-t border-line p-6 xl:col-span-2"
          />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 font-mono text-mono text-fg-subtle">
          <span>
            {s.connection.kind === 'connected' ? `${s.connection.protocol}` : 'Kickr Core 2 over FTMS'}
            {' · '}power smoothed over {s.smoothing}s
          </span>
          {s.fake && <span>FAKE TRAINER · press D to drop data for 5s</span>}
        </footer>
      </main>
    </div>
  )
}
