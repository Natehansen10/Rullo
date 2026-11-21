import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './components/Button'
import { ElevationProfile } from './components/ElevationProfile'
import { ProfilePage } from './components/ProfilePage'
import { MetricTile } from './components/MetricTile'
import { SegmentedControl } from './components/SegmentedControl'
import { StatusPill, type StatusTone } from './components/StatusPill'
import { Stepper } from './components/Stepper'
import { TabNav } from './components/TabNav'
import { WorkoutBuilder } from './components/WorkoutBuilder'
import { WorkoutPage } from './components/WorkoutPage'
import { WorkoutRow } from './components/WorkoutRow'
import {
  ERG_MAX_W,
  ERG_MIN_W,
  ERG_STEPS_W,
  GRADE_FEEL_STEPS_PCT,
  INTENSITY_MAX_PCT,
  INTENSITY_MIN_PCT,
  INTENSITY_STEPS_PCT,
  RESISTANCE_STEPS_PCT,
  SMOOTHING_OPTIONS,
} from './config'
import { ride, useRide } from './hooks/useRide'
import { go, href, isRoute, useRoute } from './hooks/useRoute'
import type { RideSnapshot } from './lib/ride'
import { builder, type ReturnTo } from './lib/workoutDraft'

const EMPTY = '--'
const CONFIRM_MS = 3000
/**
 * The top bar's right slot changes under the pointer. A click on End Ride is
 * ignored this long after Start, and one on New ride this long after Confirm
 * end, so a double click cannot run into the next button.
 */
const START_GUARD_MS = 1000

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
  // Connected and waiting for Start: nothing is being saved, and the pill says so.
  if (c.kind === 'connected') return s.phase === 'ready' ? { tone: 'warn', label: 'Not recording' } : { tone: 'on', label: 'Connected' }
  return { tone: 'idle', label: 'Not connected' }
}

/** A key pressed in a field is typing, not a shortcut. */
function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** One hint for every mode, so it never changes width: the unit is on the value beside it. */
const KEY_HINT = '↑↓ 1  ·  +/− 5  ·  shift ↑↓ 10  ·  E mode'
const MODE_LABEL = { resistance: 'Resistance', erg: 'ERG', grade: 'Grade' } as const
const TABS = [
  { id: 'ride', label: 'Ride', href: href('ride') },
  { id: 'workout', label: 'Workout', href: href('workout') },
  { id: 'profile', label: 'Profile', href: href('profile') },
] as const

/** The Start button's words: the workout starts with the ride. */
function startLabel(s: RideSnapshot): string {
  return s.workout ? 'Start workout' : 'Start ride'
}

/**
 * Who sets the load right now, in plain words: the workout (ERG follows its
 * targets), the hills (Grade follows the course) or the rider (a resistance
 * level or their own ERG target). Short: the control row has about 140px for
 * it at 1280 on a course.
 */
function loadOwner(s: RideSnapshot): string {
  if (s.phase === 'ended') return 'Ride ended.'
  const erg = s.mode === 'erg' && !s.ergUnsupported
  const grade = s.mode === 'grade' && !s.gradeUnsupported && !!s.course
  if (grade) return 'Hills set the load.'
  const w = s.workout
  if (erg && w?.started) return w.done ? 'Workout is done.' : 'Workout sets the load.'
  // A workout is loaded and waiting: the rider's own target or level until Start workout.
  if (w && !w.started) return 'You set the load for now.'
  return 'You set the load.'
}

/** The course's part, for the course row: it always sets speed and distance, and the load only in Grade. */
function courseNote(s: RideSnapshot): string {
  return s.mode === 'grade' && !s.gradeUnsupported ? 'The course sets speed and the load.' : 'The course sets speed, not the load.'
}

/** The second line of the control row: what the trainer is doing, or what the rider should do next. */
function controlDetail(s: RideSnapshot): string | null {
  const erg = s.mode === 'erg'
  const grade = s.mode === 'grade'
  const started = !!s.workout?.started
  const moving = s.phase === 'riding' ? !s.paused : s.phase === 'ready' && ((s.cadenceRpm ?? 0) > 0 || (s.powerW ?? 0) > 0)
  if (s.phase === 'ended') return 'Press New ride.'
  if (started && !s.workout?.done && !erg && s.controlState !== 'unsupported') return 'Workout targets are off.'
  if (grade && s.gradeUnsupported) return 'No grade control here.'
  if (erg && s.ergUnsupported) return 'No ERG on this trainer.'
  if (!erg && s.controlState === 'unsupported') return 'No resistance control.'
  if (s.controlState === 'failed' && moving && !(erg && s.ergReleased)) return 'Refused. Retrying.'
  if (s.connection.kind !== 'connected') {
    return erg && !started ? `${Math.round((s.ergTargetW / s.profile.ftpW) * 100)}% FTP · on connect` : 'Applies on connect'
  }
  if (s.paused) return 'Paused. Pedal to resume.'
  if (erg && s.ergReleased && !s.ergUnsupported && s.phase === 'riding') return 'Released until 60 rpm.'
  // Waiting for Start: say so here too, where the rider's hands are.
  if (s.phase === 'ready') return `Press ${startLabel(s)}.`
  if (grade) return `Hill feel · trainer ${s.trainerGradePct.toFixed(1)}%`
  if (erg && s.ergEasing) return 'Easing in to target'
  if (erg && started) return s.workout?.done ? 'Holding the last target' : 'Intensity, every target'
  if (erg) return `${Math.round((s.ergTargetW / s.profile.ftpW) * 100)}% FTP`
  if (s.controlState === 'sending') return 'Setting'
  return null
}

/**
 * Control row status: always two lines, each on one line, so nothing moves
 * when the words change. Who sets the load, then the detail.
 */
function controlStatus(s: RideSnapshot): ReactNode {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-fg">{loadOwner(s)}</span>
      <span className="truncate">{controlDetail(s) ?? '\u00a0'}</span>
    </span>
  )
}

/** Within this many rpm of a cadence cue counts as on target (Zwift prompts at about the same). */
const CADENCE_ON_TARGET_RPM = 5

/**
 * The workout's cadence cue for the Cadence tile: "target 90" (the tile's unit is rpm), toned on, under
 * or over once the workout runs. A cue for the rider only; the trainer holds
 * power in ERG whatever the cadence.
 */
function cadenceCue(s: RideSnapshot, live: boolean): ReactNode {
  const target = s.workout?.cadenceTargetRpm ?? null
  if (target === null || s.phase === 'ended') return null
  const judged = live && s.workout?.started && !s.stale && !s.paused && s.cadenceRpm !== null
  const diff = judged ? (s.cadenceRpm as number) - target : 0
  const tone = !judged
    ? 'text-fg-muted'
    : diff < -CADENCE_ON_TARGET_RPM
      ? 'text-state-under'
      : diff > CADENCE_ON_TARGET_RPM
        ? 'text-state-over'
        : 'text-state-on'
  const word = !judged ? '' : diff < -CADENCE_ON_TARGET_RPM ? ' · under' : diff > CADENCE_ON_TARGET_RPM ? ' · over' : ' · on'
  return (
    <span className={`font-mono text-mono whitespace-nowrap ${tone}`}>
      target {target}{word}
    </span>
  )
}

/**
 * The Heart rate tile's label-row control: one button whose word follows the
 * sensor (Connect, Connecting, Disconnect, Reconnecting, Retry). It stays the
 * same element through every state, so keyboard focus stays on it. Pressing it
 * while it reconnects stops the retries.
 */
function heartRateAction(s: RideSnapshot): ReactNode {
  const st = s.heartRate.status
  if (!s.supported) return null
  const idle = st === 'off' || st === 'failed'
  const word = { off: 'Connect', failed: 'Retry', connecting: 'Connecting', connected: 'Disconnect', reconnecting: 'Reconnecting' }[st]
  const label = {
    off: 'Connect a heart rate sensor',
    failed: 'Heart rate sensor lost. Connect it again',
    connecting: 'Connecting the heart rate sensor',
    connected: 'Disconnect heart rate sensor',
    reconnecting: 'Heart rate sensor lost, reconnecting. Press to stop',
  }[st]
  return (
    <button
      type="button"
      className={`ww-tile-link ${st === 'reconnecting' ? 'text-state-under' : ''}`}
      aria-label={label}
      aria-disabled={st === 'connecting'}
      onClick={idle ? ride.connectHeartRate : st === 'connecting' ? undefined : ride.disconnectHeartRate}
    >
      {word}
    </button>
  )
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
  /** When Start was last pressed. See onEnd. */
  const startedAtRef = useRef(0)
  /** When Confirm end was last pressed. See onNewRide. */
  const endedAtRef = useRef(0)
  const route = useRoute()
  /** Step of the Workout tab. Kept here so the builder can send the rider back to step 2. */
  const [workoutStep, setWorkoutStep] = useState<0 | 1>(0)
  /** The selected workout's overview is open on step 2. */
  const [workoutDetail, setWorkoutDetail] = useState<string | null>(null)

  /** Open the workout builder on a new workout, a custom workout (edit) or a copy of any workout. */
  const openBuilder = (kind: 'new' | 'edit' | 'copy', id: string | null, returnTo: ReturnTo) => {
    const workout = id ? ride.getWorkout(id) : null
    if (kind !== 'new' && !workout) return
    try {
      builder.open(kind === 'new' || !workout ? { kind: 'new' } : { kind, workout }, returnTo)
      ride.notify(null)
      go('builder')
    } catch (err) {
      ride.notify(err instanceof Error ? err.message : 'That workout cannot be edited.')
    }
  }

  // From the saddle. Resistance: arrows 1%, + / - 5%, Shift+arrows 10%.
  // ERG: arrows 1 W, + / - 5 W, Shift+arrows 10 W. Workout in ERG: intensity 1 / 5 / 10%. E switches mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !isRoute('ride') || isTyping(e)) return
      const snap = ride.getSnapshot()
      const erg = snap.mode === 'erg'
      const grade = snap.mode === 'grade' && !snap.gradeUnsupported
      const workout = erg && !!snap.workout?.started
      const step = workout ? ride.stepIntensity : erg ? ride.stepErg : grade ? ride.stepGradeFeel : ride.stepResistance
      const [small, mid, large] = workout ? INTENSITY_STEPS_PCT : erg ? ERG_STEPS_W : grade ? GRADE_FEEL_STEPS_PCT : RESISTANCE_STEPS_PCT
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

  const onStart = () => {
    startedAtRef.current = Date.now()
    go('ride')
    ride.startRide()
  }

  const onEnd = () => {
    // End Ride lands where Start was: a double click on Start must not arm it.
    if (Date.now() - startedAtRef.current < START_GUARD_MS) return
    if (!confirmEnd) {
      setConfirmEnd(true)
      return
    }
    setConfirmEnd(false)
    endedAtRef.current = Date.now()
    void ride.endRide()
  }

  const onNewRide = () => {
    // New ride lands where Confirm end was: a double click there must not clear the ride just ended.
    if (Date.now() - endedAtRef.current < START_GUARD_MS) return
    ride.newRide()
  }

  const modeSwitch = (
    <SegmentedControl
      label="Trainer mode"
      options={s.modes}
      value={s.mode}
      onChange={ride.setMode}
      format={(m) => MODE_LABEL[m]}
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
          <TabNav tabs={TABS} current={route === 'builder' ? 'workout' : route} />
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone={pill.tone} label={pill.label} />
          {s.phase === 'idle' && (
            <Button
              variant={route === 'workout' || route === 'builder' ? 'secondary' : 'primary'}
              onClick={() => {
                go('ride')
                ride.connect()
              }}
              disabled={!s.supported || connecting}
            >
              {connecting ? 'Connecting' : s.resuming ? 'Connect to resume' : 'Connect'}
            </Button>
          )}
          {s.phase === 'ready' && <Button onClick={ride.disconnect}>Disconnect</Button>}
          {live && lost && (
            <Button variant="primary" onClick={ride.connect}>
              Reconnect
            </Button>
          )}
          {/* Start takes the slot Connect had. Nothing is recorded until it is pressed. */}
          {s.phase === 'ready' && !lost && (
            <Button
              variant={route === 'workout' || route === 'builder' ? 'secondary' : 'primary'}
              onClick={onStart}
              disabled={s.connection.kind !== 'connected'}
            >
              {startLabel(s)}
            </Button>
          )}
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
              <Button onClick={onNewRide}>New ride</Button>
            </>
          )}
        </div>
      </header>

      {route === 'profile' ? (
        <main className="flex flex-1 flex-col px-8 py-6">
          <ProfilePage
            profile={s.profile}
            onChange={ride.setProfile}
            editable={s.canEditProfile}
            courses={s.courses}
            workouts={s.workouts}
            onImportCourse={(f) => void ride.importCourse(f)}
            onRemoveCourse={(id) => void ride.removeCourse(id)}
            onImportWorkout={(f) => void ride.importWorkout(f)}
            onRemoveWorkout={(id) => void ride.removeWorkout(id)}
            onNewWorkout={() => openBuilder('new', null, 'profile')}
            onEditWorkout={(id) => openBuilder('edit', id, 'profile')}
            onCopyWorkout={(id) => openBuilder('copy', id, 'profile')}
            notice={s.notice && <Notice title={s.notice} />}
          />
        </main>
      ) : route === 'builder' ? (
        <main className="flex flex-1 flex-col px-8 py-6">
          <WorkoutBuilder
            ftpW={s.profile.ftpW}
            locked={!s.canChooseCourse}
            onSave={ride.saveCustomWorkout}
            onSaved={(id) => {
              // Like Zwift: Save lands on the new workout's overview, ready to ride.
              setWorkoutDetail(id)
              setWorkoutStep(1)
              go('workout')
            }}
            onClose={(returnTo) => {
              if (returnTo === 'workout') setWorkoutStep(1)
              go(returnTo)
            }}
          />
        </main>
      ) : route === 'workout' ? (
        <main className="flex flex-1 flex-col px-8 py-6">
          <WorkoutPage
            s={s}
            notice={s.notice && <Notice title={s.notice} />}
            onStageCourse={(id) => void ride.stageCourse(id)}
            onStartMi={ride.setStartMi}
            onStageWorkout={ride.stageWorkout}
            onConfirm={(workoutId) => {
              // The only way a setup reaches the Ride tab.
              ride.confirmSetup(workoutId)
              go('ride')
            }}
            step={workoutStep}
            onStep={setWorkoutStep}
            onNewWorkout={() => openBuilder('new', null, 'workout')}
            onEditWorkout={(id) => openBuilder('edit', id, 'workout')}
            onCopyWorkout={(id) => openBuilder('copy', id, 'workout')}
            onRemoveWorkout={(id) => void ride.removeWorkout(id)}
            detail={workoutDetail}
            onDetail={setWorkoutDetail}
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
            className="grid flex-1 auto-rows-auto grid-cols-1 grid-rows-[1fr] rounded-lg border border-line bg-surface xl:grid-cols-[2fr_3fr]"
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
            {/* Top row: three tiles, Cadence a little wider for its cue. Bottom row: two, which need the width (112.34 mi, 1:23:45). */}
            <div className="grid grid-rows-2">
              <div className="grid grid-cols-[9fr_8fr_8fr]">
              <MetricTile
                label="Cadence"
                value={cadence}
                unit="rpm"
                dim={dimLive || s.cadenceRpm === null}
                dense={dense}
                action={cadenceCue(s, live)}
                className={`border-r border-b border-line ${pad}`}
              />
              <MetricTile
                label="Heart rate"
                value={s.heartRate.bpm === null ? EMPTY : String(s.heartRate.bpm)}
                unit="bpm"
                dim={s.heartRate.stale || s.heartRate.bpm === null}
                dense={dense}
                action={heartRateAction(s)}
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
              </div>
              <div className="grid grid-cols-2">
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
                action={s.phase === 'ready' && <span className="ww-label whitespace-nowrap text-state-under">Not recording</span>}
                className={pad}
              />
              </div>
            </div>
            {s.course && (
              <ElevationProfile
                live={s.course}
                dim={dimRide}
                compact={both}
                note={s.phase === 'ended' ? undefined : courseNote(s)}
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
                hint={KEY_HINT}
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
                hint={KEY_HINT}
                className={`border-t border-line xl:col-span-2 ${pad}`}
              />
            ) : s.mode === 'grade' && !s.gradeUnsupported ? (
              <Stepper
                label={modeSwitch}
                value={String(s.gradeFeelPct)}
                unit="%"
                steps={GRADE_FEEL_STEPS_PCT}
                onStep={ride.stepGradeFeel}
                stepLabel={(d) => `Hill feel ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)}%`}
                atMin={s.gradeFeelPct <= 0}
                atMax={s.gradeFeelPct >= 100}
                status={controlStatus(s)}
                hint={KEY_HINT}
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
                hint={KEY_HINT}
                className={`border-t border-line xl:col-span-2 ${pad}`}
              />
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 font-mono text-mono text-fg-subtle">
            <span>
              {s.connection.kind === 'connected' ? `${s.connection.protocol}` : 'Kickr Core 2 over FTMS'}
              {' · '}power smoothed over {s.smoothing}s
            </span>
            {s.fake && <span>FAKE TRAINER · D drop data · C low cadence · S stop pedaling · J jitter · H drop heart rate</span>}
          </footer>
        </main>
      )}
    </div>
  )
}
