import { useEffect, useState, type ReactNode } from 'react'
import { Button } from './components/Button'
import { ElevationProfile } from './components/ElevationProfile'
import { ProfilePage } from './components/ProfilePage'
import { MetricTile } from './components/MetricTile'
import { SegmentedControl } from './components/SegmentedControl'
import { StatusPill, type StatusTone } from './components/StatusPill'
import { Stepper } from './components/Stepper'
import { TabNav } from './components/TabNav'
import { WorkoutPage } from './components/WorkoutPage'
import { WorkoutRow } from './components/WorkoutRow'
import {
  ERG_MAX_W,
  ERG_MIN_W,
  ERG_STEPS_W,
  INTENSITY_MAX_PCT,
  INTENSITY_MIN_PCT,
  INTENSITY_STEPS_PCT,
  RESISTANCE_STEPS_PCT,
  SMOOTHING_OPTIONS,
} from './config'
import { ride, useRide } from './hooks/useRide'
import { go, href, isRoute, useRoute } from './hooks/useRoute'
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
  if (s.paused) return { tone: 'idle', label: 'Paused' }
  if (c.kind === 'connected') return { tone: 'on', label: s.phase === 'ready' ? 'Ready' : 'Connected' }
  return { tone: 'idle', label: 'Not connected' }
}

/** A key pressed in a field is typing, not a shortcut. */
function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

const MODE_OPTIONS = ['resistance', 'erg'] as const
const TABS = [
  { id: 'ride', label: 'Ride', href: href('ride') },
  { id: 'workout', label: 'Workout', href: href('workout') },
  { id: 'profile', label: 'Profile', href: href('profile') },
] as const

function controlStatus(s: RideSnapshot): string | null {
  const erg = s.mode === 'erg'
  const started = !!s.workout?.started
  if (started && !erg && s.controlState !== 'unsupported') return 'Targets off in Resistance. Press E.'
  if (erg && s.ergUnsupported) return 'No ERG on this trainer. Using resistance.'
  if (!erg && s.controlState === 'unsupported') return 'No resistance control on this trainer'
  if (s.controlState === 'failed' && s.phase === 'riding' && !s.paused && !(erg && s.ergReleased)) return 'Trainer refused it. Retrying.'
  if (s.connection.kind !== 'connected' || s.phase === 'ended') {
    return erg && !started ? `${Math.round((s.ergTargetW / s.profile.ftpW) * 100)}% FTP · on connect` : 'Applies on connect'
  }
  if (s.paused) return 'Paused. Pedal to resume.'
  if (erg && s.ergReleased) return 'Released. Spin up to 60 rpm.'
  if (erg && s.ergEasing) return 'Easing in to target'
  if (erg && started) return 'Intensity, every target'
  if (erg) return `${Math.round((s.ergTargetW / s.profile.ftpW) * 100)}% FTP`
  if (s.controlState === 'sending') return 'Setting'
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
  const route = useRoute()

  // From the saddle. Resistance: arrows 1%, + / - 5%, Shift+arrows 10%.
  // ERG: arrows 1 W, + / - 5 W, Shift+arrows 10 W. Workout in ERG: intensity 1 / 5 / 10%. E switches mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !isRoute('ride') || isTyping(e)) return
      const snap = ride.getSnapshot()
      const erg = snap.mode === 'erg'
      const workout = erg && !!snap.workout?.started
      const step = workout ? ride.stepIntensity : erg ? ride.stepErg : ride.stepResistance
      const [small, mid, large] = workout ? INTENSITY_STEPS_PCT : erg ? ERG_STEPS_W : RESISTANCE_STEPS_PCT
      const arrow = e.shiftKey ? large : small
      if (e.key === 'ArrowUp') step(arrow)
      else if (e.key === 'ArrowDown') step(-arrow)
      else if (e.key === '+' || e.key === '=') step(mid)
      else if (e.key === '-' || e.key === '_') step(-mid)
      else if (e.key === 'e' || e.key === 'E') ride.toggleMode()
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

  /** A course or workout row is showing: the tiles and control row tighten so everything fits 1280x720. */
  const dense = !!(s.course || s.workout)
  const both = !!(s.course && s.workout)
  const pad = dense ? 'px-6 py-4' : 'p-6'
  const pill = status(s)
  const live = s.phase === 'ready' || s.phase === 'riding'
  const dimLive = !live || s.stale || s.paused
  /** Distance, time, course and workout numbers: live only while the ride is moving. */
  const dimRide = s.phase === 'riding' ? s.stale || s.paused : true
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

  const modeSwitch = (
    <SegmentedControl
      label="Trainer mode"
      options={MODE_OPTIONS}
      value={s.mode}
      onChange={ride.setMode}
      format={(m) => (m === 'erg' ? 'ERG' : 'Resistance')}
    />
  )

  const power = live && s.powerW !== null ? String(s.powerW) : EMPTY
  const cadence = live && s.cadenceRpm !== null ? String(s.cadenceRpm) : EMPTY
  const speed = live && s.speedMph !== null ? s.speedMph.toFixed(1) : EMPTY

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-line px-8 py-4">
        <div className="flex items-center gap-8">
          <a href={href('ride')} className="ww-wordmark no-underline">
            Weem Watts
          </a>
          <TabNav tabs={TABS} current={route} />
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone={pill.tone} label={pill.label} />
          {s.phase === 'idle' && (
            <Button
              variant="primary"
              onClick={() => {
                go('ride')
                ride.connect()
              }}
              disabled={!s.supported || connecting}
            >
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

      {route === 'profile' ? (
        <main className="flex flex-1 flex-col px-8 py-6">
          <ProfilePage profile={s.profile} onChange={ride.setProfile} editable={s.canEditProfile} />
        </main>
      ) : route === 'workout' ? (
        <main className="flex flex-1 flex-col px-8 py-6">
          <WorkoutPage
            s={s}
            notice={s.notice && <Notice title={s.notice} />}
            onSelectCourse={(id) => void ride.selectCourse(id)}
            onStartMi={ride.setStartMi}
            onImportCourse={(f) => void ride.importCourse(f)}
            onRemoveCourse={(id) => void ride.removeCourse(id)}
            onSelectWorkout={ride.selectWorkout}
            onImportWorkout={(f) => void ride.importWorkout(f)}
            onRemoveWorkout={(id) => void ride.removeWorkout(id)}
          />
        </main>
      ) : (
        <main className="flex flex-1 flex-col gap-4 px-8 py-4">
          <h1 className="sr-only">Ride</h1>
          {!s.supported && (
            <Notice title="This browser can't connect to your trainer">
              Web Bluetooth is not available here. Open Weem Watts in Chrome or Edge on a desktop computer.
            </Notice>
          )}
          {s.connection.kind === 'failed' && (
            <Notice title={live ? 'Trainer lost' : 'Pairing failed'}>{s.connection.message}</Notice>
          )}
          {s.recovery && s.coursesLoaded && s.workoutsLoaded && s.phase === 'idle' && !s.resuming && (
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
            className="grid flex-1 auto-rows-auto grid-cols-1 grid-rows-[1fr] rounded-lg border border-line bg-surface xl:grid-cols-2"
          >
            <MetricTile
              size="hero"
              label="Power"
              value={power}
              unit="W"
              dim={dimLive || s.powerW === null}
              dense={dense}
              className={`border-b border-line xl:border-r xl:border-b-0 ${pad}`}
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
                dense={dense}
                className={`border-r border-b border-line ${pad}`}
              />
              <MetricTile
                label="Speed"
                value={speed}
                unit="mph"
                dim={dimLive || s.speedMph === null}
                dense={dense}
                className={`border-b border-line ${pad}`}
              />
              <MetricTile
                label="Distance"
                value={s.distanceMi.toFixed(2)}
                unit="mi"
                dim={dimRide && s.phase !== 'ended'}
                dense={dense}
                className={`border-r border-line ${pad}`}
              />
              <MetricTile
                label="Time"
                value={formatTime(s.elapsedMs)}
                dim={dimRide && s.phase !== 'ended'}
                dense={dense}
                className={pad}
              />
            </div>
            {s.course && (
              <ElevationProfile
                live={s.course}
                dim={dimRide}
                compact={both}
                className={`border-t border-line xl:col-span-2 ${both ? 'px-6 py-3' : pad}`}
              />
            )}
            {s.workout && (
              <WorkoutRow
                live={s.workout}
                ftpW={s.profile.ftpW}
                dim={dimRide}
                canSkip={s.phase === 'riding'}
                ended={s.phase === 'ended'}
                onSkip={ride.skipInterval}
                onStart={ride.startWorkout}
                onApplyFtp={ride.applyTestFtp}
                compact={both}
                className={`border-t border-line xl:col-span-2 ${both ? 'px-6 py-3' : pad}`}
              />
            )}
            {s.mode === 'erg' && s.workout?.started && !s.ergUnsupported ? (
              <Stepper
                label={modeSwitch}
                value={String(s.workout.intensityPct)}
                unit="%"
                steps={INTENSITY_STEPS_PCT}
                onStep={ride.stepIntensity}
                stepLabel={(d) => `Workout intensity ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)}%`}
                atMin={s.workout.intensityPct <= INTENSITY_MIN_PCT}
                atMax={s.workout.intensityPct >= INTENSITY_MAX_PCT}
                status={controlStatus(s)}
                hint="↑↓ 1%  ·  +/− 5%  ·  shift ↑↓ 10%  ·  E mode"
                className={`border-t border-line xl:col-span-2 ${pad}`}
              />
            ) : s.mode === 'erg' ? (
              <Stepper
                label={modeSwitch}
                value={String(s.ergTargetW)}
                unit="W"
                steps={ERG_STEPS_W}
                onStep={ride.stepErg}
                stepLabel={(d) => `ERG target ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)} watts`}
                disabled={s.ergUnsupported}
                atMin={s.ergTargetW <= ERG_MIN_W}
                atMax={s.ergTargetW >= ERG_MAX_W}
                status={controlStatus(s)}
                hint="↑↓ 1 W  ·  +/− 5 W  ·  shift ↑↓ 10 W  ·  E mode"
                className={`border-t border-line xl:col-span-2 ${pad}`}
              />
            ) : (
              <Stepper
                label={modeSwitch}
                value={String(s.resistancePct)}
                unit="%"
                steps={RESISTANCE_STEPS_PCT}
                onStep={ride.stepResistance}
                stepLabel={(d) => `Resistance ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)}%`}
                disabled={s.controlState === 'unsupported'}
                atMin={s.resistancePct <= 0}
                atMax={s.resistancePct >= 100}
                status={controlStatus(s)}
                hint="↑↓ 1%  ·  +/− 5%  ·  shift ↑↓ 10%  ·  E mode"
                className={`border-t border-line xl:col-span-2 ${pad}`}
              />
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 font-mono text-mono text-fg-subtle">
            <span>
              {s.connection.kind === 'connected' ? `${s.connection.protocol}` : 'Kickr Core 2 over FTMS'}
              {' · '}power smoothed over {s.smoothing}s
            </span>
            {s.fake && <span>FAKE TRAINER · D drop data · C low cadence · S stop pedaling · J jitter</span>}
          </footer>
        </main>
      )}
    </div>
  )
}
