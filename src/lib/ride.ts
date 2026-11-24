/**
 * Ride state, outside React. One instance per tab.
 * Time and distance come from timestamps, never from counting timer ticks,
 * so a throttled background tab does not drift.
 */
import {
  DEFAULT_ERG_FTP_SHARE,
  DEFAULT_GRADE_FEEL_PCT,
  DEFAULT_RESISTANCE_PCT,
  AIR_DENSITY,
  GRADE_MAX_PCT,
  GRADE_MIN_PCT,
  GRADE_SEND_EVERY_MS,
  GRADE_SMOOTH_S,
  HR_FRESH_MS,
  HR_STALE_AFTER_MS,
  ERG_MAX_W,
  ERG_MIN_W,
  ERG_RELEASE_AFTER_MS,
  ERG_RELEASE_RPM,
  ERG_RESUME_AFTER_MS,
  ERG_RESUME_RPM,
  ERG_SOFT_START_MS,
  ERG_STOPPED_AFTER_MS,
  ERG_STOPPED_RPM,
  CONTROL_RETRY_MS,
  AUTO_PAUSE_AFTER_MS,
  DEFAULT_SMOOTHING,
  INTENSITY_MAX_PCT,
  INTENSITY_MIN_PCT,
  MAX_SAMPLE_GAP_MS,
  SMOOTHING_OPTIONS,
  STALE_AFTER_MS,
  type SmoothingSeconds,
} from '../config'
import { bluetoothSupported, createBleTrainer, trainerNeedsList } from './ble'
import { elevationAt, gradeAt, type Course , profilePoints } from './course'
import { importGpxFile, loadCourses, removeImportedCourse } from './courses'
import { createFakeHeartRate } from './fakeHeartRate'
import { createFakeTrainer, isFakeMode } from './fakeTrainer'
import { createBleHeartRate, heartRateNeedsList, type HeartRateSensor, type HeartRateStatus } from './heartRate'
import type { PairKind } from './pairing'
import { buildFit, downloadFit, type RideOrigin } from './fit'
import { FEET_PER_METER, METERS_PER_MILE, MPS_TO_MPH, SpeedModel } from './physics'
import { logFtpChange, type FtpSource } from './ftpHistory'
import { intervalCue, playCue } from './sound'
import { loadProfile, normalizeProfile, riderParams, saveProfile, type Profile } from './profile'
import * as recorder from './recorder'
import { PowerSmoother } from './smoothing'
import { PowerTrace, type PowerTraceLive } from './powerTrace'
import type { ConnectionStatus, ControlResult, Trainer, TrainerReading } from './types'
import { keepAwake } from './wakeLock'
import {
  flatten,
  indexAt,
  RAMP_TEST_FTP_SHARE,
  targetWatts,
  totalS,
  wattsAt,
  type Interval,
  type Workout,
} from './workout'
import { importZwoFile, loadWorkouts, removeImportedWorkout } from './workouts'
import {
  loadCustomWorkouts,
  removeCustomWorkout,
  saveCustomWorkout,
  snapshotOf,
  WorkoutConflictError,
  workoutFromSnapshot,
  type CustomWorkoutInput,
} from './customWorkouts'

/**
 * idle: no ride. ready: connected and waiting for Start: numbers are live,
 * nothing is recorded. riding: from Start (or a resumed ride) to End Ride.
 */
export type Phase = 'idle' | 'ready' | 'riding' | 'ended'

/** idle: nothing sent yet. sending: a write is in flight. */
export type ControlState = 'idle' | 'sending' | ControlResult

/** resistance: a fixed brake level. erg: the trainer holds a target power. */
/** grade: on a course, the trainer follows the hills (simulation). */
export type ControlMode = 'resistance' | 'erg' | 'grade'

const RESISTANCE_KEY = 'ww.resistancePct'
const MODE_KEY = 'ww.mode'
const GRADE_FEEL_KEY = 'ww.gradeFeelPct'
const ERG_KEY = 'ww.ergW'
/** The picks on the Workout tab (staged). They reach the ride only through confirmSetup. */
const STAGED_COURSE_KEY = 'ww.stagedCourseId'
const STAGED_WORKOUT_KEY = 'ww.stagedWorkoutId'
/** Before Nov 20, 2026 the ride's own course and workout were saved here and restored on load. No longer read. */
const OLD_SETUP_KEYS = ['ww.courseId', 'ww.workoutId']
/** Ride id when the browser could not create the ride row (IndexedDB unavailable). Nothing is recorded. */
const NO_RIDE = -1
/** A saved position this close to the finish starts the next ride from mile 0. */
const NEAR_FINISH_M = 160

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // storage unavailable
  }
}

/** A saved 0 to 100 value, or the fallback when it is missing or out of range. */
function loadPct(key: string, fallback: number): number {
  const raw = storageGet(key)
  const v = Number(raw)
  return raw !== null && raw !== '' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : fallback
}

export interface Recovery {
  startedAt: number
  distanceMi: number
  lastAt: number
}

export interface CourseOption {
  id: string
  name: string
  source: Course['source']
  description?: string
  lengthMi: number
  ascentFt: number
  /** A light elevation profile, [meters along, meters up] pairs, for the small graph on the course's card. */
  profile: [number, number][]
}

/** Card profiles are sampled once per course, not on every snapshot. */
const cardProfiles = new WeakMap<Course, [number, number][]>()
function cardProfile(c: Course): [number, number][] {
  let pts = cardProfiles.get(c)
  if (!pts) {
    pts = profilePoints(c, 80)
    cardProfiles.set(c, pts)
  }
  return pts
}

export interface CourseLive {
  course: Course
  /** Where this ride starts (or started) on the course. */
  startMi: number
  /** Where the last ride on this course ended, if any. */
  lastEndMi: number | null
  positionMi: number
  toGoMi: number
  gradePct: number
  elevationFt: number
  climbedFt: number
  finished: boolean
}

/** The course picked on the Workout tab, with its start mile. Not on the ride until confirmed. */
export interface StagedCourse {
  course: Course
  startMi: number
  /** Where the last ride on this course ended, if any. */
  lastEndMi: number | null
}

/** What the Workout tab holds. The Ride tab shows it only after confirmSetup. */
export interface StagedSetup {
  /** Null is a flat road. */
  course: StagedCourse | null
  /** Null is a free ride. */
  workout: WorkoutOption | null
  /** The Ride tab already has exactly this course, start mile and workout. */
  onRide: boolean
}

export interface WorkoutOption {
  id: string
  name: string
  description: string
  source: Workout['source']
  tag?: string
  durationS: number
  rampTest: boolean
  /** Every interval, for the small graph on the workout's card. */
  intervals: Interval[]
}

/** Outcome of saving a built workout. `conflict`: the saved copy changed in another tab. */
export type SaveWorkoutResult = { ok: true; id: string } | { ok: false; conflict: boolean; message: string }

/** Tabs tell each other when the custom workout list changes. */
const WORKOUTS_CHANNEL = 'ww.workouts'

export interface RampTestLive {
  /** The test is over (failed, ended, or ran out of steps); the cool-down is on. */
  ended: boolean
  /** Best average power over the test window so far. */
  bestW: number | null
  /** FTP estimate from bestW, once the test has ended. */
  ftpW: number | null
  /** The estimate has been saved to the profile. */
  applied: boolean
}

export interface WorkoutLive {
  workout: Workout
  intervals: Interval[]
  totalS: number
  elapsedS: number
  index: number
  intervalLeftS: number
  /** Current target after intensity. */
  targetW: number
  targetPct: number
  nextTargetW: number | null
  nextLabel: string | null
  /** Cadence cue for the current interval, in rpm. For the rider only: the trainer never sees it. */
  cadenceTargetRpm: number | null
  done: boolean
  /** The workout is running (or has run). It starts with the ride, on Start workout. */
  started: boolean
  /** Connected and waiting for Start workout (the button is in the top bar). */
  waiting: boolean
  /**
   * A ride is on but its workout never started. Only an unfinished ride
   * recorded before Start existed can be in this state; the workout row offers Start workout.
   */
  canStart: boolean
  intensityPct: number
  rampTest: RampTestLive | null
}

/** The ride that just ended and has a file: what Download FIT and Upload to Strava work on. */
export interface EndedRide {
  id: number
  /** From the setup: "Sweet Spot 3x12 on Test Hills", "Test Hills", or "Free ride". */
  name: string
  /** A real trainer, the fake one, or null for a ride saved before origins were recorded. Only 'trainer' can be uploaded. */
  origin: RideOrigin | null
  /** This ride's Strava upload, if the rider made one. */
  strava: recorder.StravaMark | null
}

/** A ride as it will be sent to Strava: the same bytes Download FIT gives. */
export interface RideFile {
  rideId: number
  bytes: Uint8Array
  name: string
  /** Stable for the ride, so Strava can tell a second upload of it. */
  externalId: string
}

const digits = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{1,20}$/.test(v) ? v : undefined)

/** A stored Strava mark is untrusted like everything read back from the browser: ids must be digits. */
function cleanStravaMark(v: unknown): recorder.StravaMark | null {
  if (!v || typeof v !== 'object') return null
  const m = v as Record<string, unknown>
  const uploadId = digits(m.uploadId)
  const activityId = digits(m.activityId)
  if (!uploadId && !activityId && m.duplicate !== true) return null
  return {
    ...(uploadId ? { uploadId } : {}),
    ...(activityId ? { activityId } : {}),
    ...(m.duplicate === true ? { duplicate: true } : {}),
    at: typeof m.at === 'number' && Number.isFinite(m.at) ? m.at : 0,
  }
}

const cleanOrigin = (v: unknown): RideOrigin | null => (v === 'trainer' || v === 'fake' ? v : null)
const cleanName = (v: unknown): string => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : 'Free ride')

/** The heart rate sensor, a second device beside the trainer. It never affects the ride or the trainer. */
export interface HeartRateLive {
  status: HeartRateStatus
  /** The last reading, or null when there is none to show. */
  bpm: number | null
  /** No fresh reading: the number must not read as live. */
  stale: boolean
}

export interface RideSnapshot {
  phase: Phase
  connection: ConnectionStatus
  /** No data for STALE_AFTER_MS while a ride needs it. Numbers must not read as live. */
  stale: boolean
  /** Auto-paused: the rider stopped pedaling. Time, distance, the workout clock and recording are stopped. */
  paused: boolean
  fake: boolean
  supported: boolean
  /** Rullo's pairing step is open: the browser's device list comes next, for this device. Null when it is not. */
  pairing: PairKind | null
  smoothing: SmoothingSeconds
  powerW: number | null
  /**
   * The last few minutes of power, a slot a second, for the line in the Power
   * tile. For drawing only. The same object until a reading changes it.
   */
  powerTrace: PowerTraceLive
  cadenceRpm: number | null
  speedMph: number | null
  distanceMi: number
  elapsedMs: number
  recovery: Recovery | null
  /** True while a resumed ride is waiting for the trainer. */
  resuming: boolean
  canDownload: boolean
  /** The ended ride, when it has a file. Null otherwise. */
  ended: EndedRide | null
  notice: string | null
  resistancePct: number
  mode: ControlMode
  /** Modes on offer: Grade only with a course selected. */
  modes: ControlMode[]
  /** Grade mode: how much of the course grade the trainer gets, 0 to 100%. */
  gradeFeelPct: number
  /** Grade mode: the grade the trainer is riding right now, in %. */
  trainerGradePct: number
  /** The trainer has no simulation (grade) control. */
  gradeUnsupported: boolean
  ergTargetW: number
  /** ERG is released (low cadence or not yet spun up); the trainer is at minimum resistance. */
  ergReleased: boolean
  /** ERG just engaged and is ramping up to the target (soft start). */
  ergEasing: boolean
  /** State of the latest control command. */
  controlState: ControlState
  /** ERG target power command unsupported by this trainer. */
  ergUnsupported: boolean
  profile: Profile
  /** Profile can be edited any time except during a ride (Start to End Ride). */
  canEditProfile: boolean
  courses: CourseOption[]
  coursesLoaded: boolean
  /** The confirmed course (where the ride goes), or null for a flat road. Set only by confirmSetup or a resumed ride. */
  course: CourseLive | null
  /** The setup can be picked and confirmed until Start is pressed (connected or not). */
  canChooseCourse: boolean
  /** The picks on the Workout tab. */
  staged: StagedSetup
  workouts: WorkoutOption[]
  workoutsLoaded: boolean
  /** The confirmed workout (what the trainer does), or null. Set only by confirmSetup or a resumed ride. */
  workout: WorkoutLive | null
  heartRate: HeartRateLive
}

/**
 * How often the ride snapshot is rebuilt, and so the fastest the screen is drawn again.
 * `--ww-dur-glide` in src/styles/tokens.css must equal this: a glide fills the gap between two snapshots.
 */
export const TICK_MS = 250

export class RideController {
  private listeners = new Set<() => void>()
  private snapshot: RideSnapshot
  private readonly trainer: Trainer
  private readonly fake = isFakeMode()
  private readonly supported = this.fake || bluetoothSupported()

  private phase: Phase = 'idle'
  private connection: ConnectionStatus = { kind: 'disconnected' }
  private smoothing: SmoothingSeconds = DEFAULT_SMOOTHING
  private smoother = new PowerSmoother(Math.max(...SMOOTHING_OPTIONS))
  /** The live power trace. Written by onReading, read by the snapshot; nothing sent to the trainer looks at it. */
  private trace = new PowerTrace()
  private speed = new SpeedModel(riderParams(loadProfile()))

  private rideId: Promise<number> | null = null
  /** The ride's row id once known, with its name, origin and Strava mark: for the ended ride's buttons. */
  private rideRowId: number | null = null
  private rideOrigin: RideOrigin | null = null
  private rideName = 'Free ride'
  private rideStrava: recorder.StravaMark | null = null
  private startedAt = 0
  private endedAt = 0
  private distanceM = 0
  private lastPowerW = 0
  private cadenceRpm = 0
  private lastDataAt = 0
  private lastPhysicsAt = 0
  private lastRecordedSec = -1
  /** The sample last written, kept to fill seconds a late reading skipped. */
  private lastSample: Omit<recorder.SampleRow, 'rideId'> | null = null
  /** Auto-pause. pausedAt is when the rider stopped; pausedTotalMs is every finished pause and dropout. */
  private paused = false
  private pausedAt = 0
  private pausedTotalMs = 0
  /** First reading of a run of zero power and zero cadence, and the ride as it stood just before it. */
  private zeroSince: number | null = null
  private zeroMark: {
    distanceM: number
    climbedM: number
    workoutS: number
    lastRecordedSec: number
    lastSample: Omit<recorder.SampleRow, 'rideId'> | null
  } | null = null
  /** Samples held back while a pause is pending: saved if the rider resumes, dropped if the pause is confirmed. */
  private heldSamples: Omit<recorder.SampleRow, 'rideId'>[] = []
  private recovery: recorder.UnfinishedRide | null = null
  private recordingFailed = false
  private notice: string | null = null
  private pairing: PairKind | null = null
  private resistancePct = loadPct(RESISTANCE_KEY, DEFAULT_RESISTANCE_PCT)
  private profile = loadProfile()
  private mode: ControlMode = storageGet(MODE_KEY) === 'erg' ? 'erg' : 'resistance'
  private gradeFeelPct = loadPct(GRADE_FEEL_KEY, DEFAULT_GRADE_FEEL_PCT)
  /** Course grade (rise / run) smoothed over GRADE_SMOOTH_S, for the trainer. */
  private smoothGrade = 0
  private lastSentGradePct: number | null = null
  private gradeUnsupported = false
  private ergTargetW = this.loadErgTarget()
  private ergReleased = true
  private lowCadenceSince: number | null = null
  private stoppedSince: number | null = null
  private resumeSince: number | null = null
  /** Soft start in progress: when ERG engaged and the power it ramps up from. */
  private ergRamp: { startAt: number; fromW: number } | null = null
  private lastControlAt = 0
  private ergUnsupported = false
  private controlState: ControlState = 'idle'
  private controlInFlight = false
  private controlDirty = false

  /** Heart rate sensor: its own connection. Readings from the last few seconds, newest last. */
  private readonly hrSensor: HeartRateSensor
  private hrStatus: HeartRateStatus = 'off'
  private hrReadings: { t: number; bpm: number }[] = []

  private courses: Course[] = []
  private coursesLoaded = false
  private course: Course | null = null
  private startOffsetM = 0
  private lastEndM: number | null = null
  private climbedM = 0
  /** Staged on the Workout tab: course, start and workout. See confirmSetup. */
  private stagedCourse: Course | null = null
  private stagedStartM = 0
  private stagedLastEndM: number | null = null
  private stagedWorkoutId: string | null = storageGet(STAGED_WORKOUT_KEY)
  /** Counts confirmSetup calls, so stageCourse can tell a confirm that happened while it was reading. */
  private confirmCount = 0

  private workouts: Workout[] = []
  private workoutOptions: WorkoutOption[] = []
  private workoutsLoaded = false
  private workout: Workout | null = null
  private intervals: Interval[] = []
  /** Seconds into the workout. Advances with live data only, from timestamps. */
  private workoutS = 0
  private workoutStarted = false
  private intensityPct = 100
  private lastWorkoutW: number | null = null
  private testEnded = false
  private testWindow: { t: number; w: number }[] = []
  private testBestW: number | null = null
  private testApplied = false

  constructor() {
    const handlers = {
      onReading: (r: TrainerReading) => this.onReading(r),
      onStatus: (s: ConnectionStatus) => this.onStatus(s),
    }
    this.trainer = this.fake ? createFakeTrainer(handlers) : createBleTrainer(handlers)
    const hrHandlers = {
      onBpm: (t: number, bpm: number) => this.onHeartRate(t, bpm),
      onStatus: (st: HeartRateStatus) => this.onHeartRateStatus(st),
    }
    this.hrSensor = this.fake ? createFakeHeartRate(hrHandlers, () => this.fakeEffortW()) : createBleHeartRate(hrHandlers)
    for (const key of OLD_SETUP_KEYS) storageSet(key, null)
    this.snapshot = this.build()
    setInterval(() => this.emit(), TICK_MS)
    void this.checkRecovery()
    void this.initCourses()
    void this.initWorkouts()
    this.watchWorkouts()
  }

  // --- store plumbing for useSyncExternalStore ---

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.snapshot

  private emit() {
    this.snapshot = this.build()
    this.listeners.forEach((fn) => fn())
  }

  private build(): RideSnapshot {
    const now = Date.now()
    const live = this.phase === 'ready' || this.phase === 'riding'
    const stale =
      live &&
      (this.connection.kind === 'reconnecting' ||
        this.connection.kind === 'failed' ||
        this.connection.kind === 'disconnected' ||
        (this.connection.kind === 'connected' &&
          this.lastDataAt > 0 &&
          now - this.lastDataAt > STALE_AFTER_MS))
    const hasData = live && this.lastDataAt > 0
    const avg = hasData ? this.smoother.average(this.smoothing) : null

    let elapsedMs = 0
    if (this.startedAt > 0) {
      if (this.phase === 'riding') elapsedMs = this.clockEnd(now) - this.startedAt - this.pausedTotalMs
      else if (this.phase === 'ended') elapsedMs = this.endedAt - this.startedAt - this.pausedTotalMs
    }

    return {
      phase: this.phase,
      connection: this.connection,
      stale,
      paused: this.phase === 'riding' && this.paused,
      fake: this.fake,
      supported: this.supported,
      pairing: this.pairing,
      smoothing: this.smoothing,
      powerW: avg === null ? null : Math.max(0, Math.round(avg)),
      powerTrace: this.trace.view(),
      cadenceRpm: hasData ? Math.round(this.cadenceRpm) : null,
      speedMph: hasData ? this.speed.speedMps * MPS_TO_MPH : null,
      distanceMi: this.distanceM / METERS_PER_MILE,
      elapsedMs: Math.max(0, elapsedMs),
      recovery: this.recovery?.last
        ? {
            startedAt: this.recovery.ride.startedAt,
            distanceMi: this.recovery.last.distanceM / METERS_PER_MILE,
            lastAt: this.recovery.last.t,
          }
        : null,
      resuming: this.phase === 'idle' && this.rideId !== null,
      canDownload: this.phase === 'ended' && this.rideId !== null && !this.recordingFailed,
      ended:
        this.phase === 'ended' && this.rideRowId !== null && !this.recordingFailed
          ? { id: this.rideRowId, name: this.rideName, origin: this.rideOrigin, strava: this.rideStrava }
          : null,
      notice: this.notice,
      resistancePct: this.resistancePct,
      mode: this.mode,
      modes: this.course ? ['resistance', 'erg', 'grade'] : ['resistance', 'erg'],
      gradeFeelPct: this.gradeFeelPct,
      trainerGradePct: this.trainerGradePct(),
      gradeUnsupported: this.gradeUnsupported,
      ergTargetW: this.ergW(),
      ergReleased: this.ergReleased,
      ergEasing: this.mode === 'erg' && !this.ergReleased && this.ergRamp !== null,
      controlState: this.controlState,
      ergUnsupported: this.ergUnsupported,
      profile: this.profile,
      canEditProfile: this.phase !== 'riding',
      courses: this.courses.map((c) => ({
        id: c.id,
        name: c.name,
        source: c.source,
        description: c.description,
        lengthMi: c.lengthM / METERS_PER_MILE,
        ascentFt: c.ascentM * FEET_PER_METER,
        profile: cardProfile(c),
      })),
      coursesLoaded: this.coursesLoaded,
      course: this.courseLive(),
      canChooseCourse: this.canChoose(),
      staged: {
        course: this.stagedCourse
          ? {
              course: this.stagedCourse,
              startMi: this.stagedStartM / METERS_PER_MILE,
              lastEndMi: this.stagedLastEndM === null ? null : this.stagedLastEndM / METERS_PER_MILE,
            }
          : null,
        workout: this.workoutOptions.find((w) => w.id === this.stagedWorkoutId) ?? null,
        onRide: this.stagedOnRide(),
      },
      workouts: this.workoutOptions,
      workoutsLoaded: this.workoutsLoaded,
      workout: this.workoutLive(),
      heartRate: this.heartRateLive(now),
    }
  }

  // --- heart rate sensor ---

  private heartRateLive(now: number): HeartRateLive {
    const last = this.hrReadings[this.hrReadings.length - 1]
    const showing = this.hrStatus === 'connected' || this.hrStatus === 'reconnecting'
    return {
      status: this.hrStatus,
      bpm: showing && last ? last.bpm : null,
      stale: this.hrStatus !== 'connected' || !last || now - last.t > HR_STALE_AFTER_MS,
    }
  }

  private onHeartRate(t: number, bpm: number) {
    this.hrReadings.push({ t, bpm })
    // Only the last few seconds are ever needed (a late trainer reading fills up to 3 skipped seconds).
    while (this.hrReadings.length > 1 && this.hrReadings[0].t < t - 10000) this.hrReadings.shift()
  }

  private onHeartRateStatus(st: HeartRateStatus) {
    this.hrStatus = st
    if (st === 'off' || st === 'failed') this.hrReadings = []
    this.emit()
  }

  /**
   * The heart rate for a recorded second ending at `t`: the newest reading
   * from the HR_FRESH_MS before it, or null. A second with no fresh reading
   * has no heart rate; an old value is never carried forward.
   */
  private heartRateAt(t: number): number | null {
    for (let i = this.hrReadings.length - 1; i >= 0; i--) {
      const r = this.hrReadings[i]
      if (r.t <= t) return t - r.t <= HR_FRESH_MS ? r.bpm : null
    }
    return null
  }

  /** What the fake heart rate follows: the fake rider's power while the trainer is sending it. */
  private fakeEffortW(): number {
    return this.connection.kind === 'connected' && Date.now() - this.lastDataAt <= STALE_AFTER_MS ? this.lastPowerW : 0
  }

  /** From a click on the Heart rate tile. Separate from the trainer in every way. */
  connectHeartRate = () => {
    if (!this.supported || this.hrBusy()) return
    if (this.fake) return void this.hrSensor.connect()
    // A sensor the browser can hand back connects at once. Otherwise its device list is next: say so first.
    void heartRateNeedsList().then((needsList) => {
      if (this.hrBusy()) return
      if (needsList) this.openPairing('heartRate')
      else void this.hrSensor.connect()
    })
  }

  private hrBusy(): boolean {
    return this.hrStatus === 'connecting' || this.hrStatus === 'connected' || this.hrStatus === 'reconnecting'
  }

  // --- pairing step ---

  private openPairing(kind: PairKind) {
    this.pairing = kind
    this.emit()
  }

  /** From the pairing step's button. The device list needs a click, so the connect starts here, in the same one. */
  confirmPairing = () => {
    const kind = this.pairing
    if (!kind) return
    this.pairing = null
    this.emit()
    if (kind === 'trainer') void this.trainer.connect()
    else void this.hrSensor.connect()
  }

  cancelPairing = () => {
    if (!this.pairing) return
    this.pairing = null
    this.emit()
  }

  disconnectHeartRate = () => {
    if (this.hrStatus === 'off') return
    this.hrSensor.disconnect()
  }

  // --- workout player ---

  /** Planned workout target right now, after intensity, started or not. */
  private plannedW(): number | null {
    if (!this.workout) return null
    const base = wattsAt(this.intervals, this.workoutS, this.profile.ftpW)
    return Math.min(ERG_MAX_W, Math.max(ERG_MIN_W, Math.round((base * this.intensityPct) / 100)))
  }

  /** Workout target the trainer should follow. Null until the workout is started. */
  private workoutTargetW(): number | null {
    return this.workoutStarted ? this.plannedW() : null
  }

  /** The ERG target: the workout's once started, else the rider's own. */
  private ergW(): number {
    return this.workoutTargetW() ?? this.ergTargetW
  }

  private workoutLive(): WorkoutLive | null {
    const w = this.workout
    if (!w) return null
    const total = totalS(this.intervals)
    const done = this.workoutS >= total
    const index = indexAt(this.intervals, Math.min(this.workoutS, total - 0.001))
    const iv = this.intervals[index]
    const next = done ? null : (this.intervals[index + 1] ?? null)
    const ftp = this.profile.ftpW
    const targetW = this.plannedW() ?? 0
    const ftpEstimate = this.testBestW === null ? null : Math.round(this.testBestW * RAMP_TEST_FTP_SHARE)
    return {
      workout: w,
      intervals: this.intervals,
      totalS: total,
      elapsedS: Math.min(this.workoutS, total),
      index,
      intervalLeftS: done ? 0 : iv.startS + iv.durS - this.workoutS,
      targetW,
      targetPct: (targetW / ftp) * 100,
      nextTargetW: next ? Math.round((targetWatts(next.from, ftp) * this.intensityPct) / 100) : null,
      nextLabel: next ? next.label : null,
      cadenceTargetRpm: done ? null : (iv.cadenceRpm ?? null),
      done,
      started: this.workoutStarted,
      waiting: !this.workoutStarted && this.phase === 'ready',
      canStart: !this.workoutStarted && this.phase === 'riding',
      intensityPct: this.intensityPct,
      rampTest: w.rampTest
        ? { ended: this.testEnded, bestW: this.testBestW, ftpW: this.testEnded ? ftpEstimate : null, applied: this.testApplied }
        : null,
    }
  }

  /** In the ramp of a ramp test: past the warm-up, before the cool-down. */
  private inRamp(): boolean {
    if (!this.workout?.rampTest || this.testEnded) return false
    const i = indexAt(this.intervals, this.workoutS)
    return i > 0 && i < this.intervals.length - 1
  }

  private advanceWorkout(dtS: number, t: number, powerW: number) {
    if (!this.workout || !this.workoutStarted) return
    const total = totalS(this.intervals)
    const beforeS = this.workoutS
    this.workoutS = Math.min(total, this.workoutS + dtS)
    // Interval sounds, when the rider has them on. Only this clock asks for one, and it stands still while paused.
    const cue = intervalCue(this.intervals, beforeS, this.workoutS)
    if (cue) playCue(cue)
    const test = this.workout.rampTest
    if (test && !this.testEnded && dtS > 0) {
      const win = this.testWindow
      win.push({ t, w: powerW })
      while (win.length && win[0].t <= t - test.windowS * 1000) win.shift()
      // A full window only (one sample per second, so windowS - 1 seconds apart).
      if (win.length && t - win[0].t >= (test.windowS - 1) * 1000) {
        const avg = win.reduce((a, x) => a + x.w, 0) / win.length
        if (this.testBestW === null || avg > this.testBestW) this.testBestW = Math.round(avg)
      }
      // Ran out of ramp steps.
      if (indexAt(this.intervals, this.workoutS) === this.intervals.length - 1 && this.workoutS > this.intervals[1].startS) {
        this.endRampTest()
      }
    }
    this.syncWorkoutTarget()
  }

  /** Send the workout target when it changes (interval boundary, ramp, intensity). */
  private syncWorkoutTarget() {
    const w = this.workoutTargetW()
    if (w === this.lastWorkoutW) return
    this.lastWorkoutW = w
    if (this.mode === 'erg' && !this.ergReleased) this.pushControl()
  }

  private endRampTest() {
    if (!this.workout?.rampTest || this.testEnded) return
    this.testEnded = true
    this.testWindow = []
    const cool = this.intervals[this.intervals.length - 1]
    this.jumpWorkoutTo(Math.max(this.workoutS, cool.startS))
    this.syncWorkoutTarget()
  }

  /**
   * Move the workout clock on purpose (skip, end of a ramp test). A pending
   * auto-pause puts the clock back to where the rider stopped, so that mark moves too.
   */
  private jumpWorkoutTo(s: number) {
    this.workoutS = s
    if (this.zeroMark) this.zeroMark.workoutS = s
  }

  /**
   * Start the loaded workout: its clock starts and ERG follows it. Start
   * (startRide) does this with the ride. On its own it is only for an old
   * unfinished ride whose workout was never started.
   */
  startWorkout = () => {
    if (!this.workout || this.workoutStarted) return
    if (this.phase !== 'riding') return
    this.workoutStarted = true
    this.lastWorkoutW = null
    if (this.mode !== 'erg') this.setMode('erg')
    else {
      // Already holding the rider's own target: ease into the workout's.
      if (!this.ergReleased) this.startErgRamp(Date.now())
      this.syncWorkoutTarget()
    }
    this.emit()
  }

  /** Jump to the next interval. In a ramp test's ramp, this ends the test. */
  skipInterval = () => {
    if (!this.workout || !this.workoutStarted || this.phase !== 'riding') return
    if (this.inRamp()) {
      this.endRampTest()
    } else {
      const total = totalS(this.intervals)
      if (this.workoutS >= total) return
      const next = this.intervals[indexAt(this.intervals, this.workoutS) + 1]
      this.jumpWorkoutTo(next ? next.startS : total)
      this.syncWorkoutTarget()
    }
    this.emit()
  }

  setIntensity = (pct: number) => {
    const next = Math.min(INTENSITY_MAX_PCT, Math.max(INTENSITY_MIN_PCT, Math.round(pct)))
    if (next === this.intensityPct || !this.workout) return
    this.intensityPct = next
    this.syncWorkoutTarget()
    this.emit()
  }

  stepIntensity = (delta: number) => this.setIntensity(this.intensityPct + delta)

  /** Save the ramp test's FTP estimate. Allowed mid-ride: the cool-down is in watts. */
  applyTestFtp = () => {
    const live = this.workoutLive()?.rampTest
    if (!live?.ftpW) return
    const fromW = this.profile.ftpW
    this.profile = normalizeProfile({ ...this.profile, ftpW: live.ftpW })
    saveProfile(this.profile)
    logFtpChange(fromW, this.profile.ftpW, 'ramp')
    this.testApplied = true
    this.emit()
  }

  private resetWorkoutRun() {
    this.workoutS = 0
    this.workoutStarted = false
    this.intensityPct = 100
    this.lastWorkoutW = null
    this.testEnded = false
    this.testWindow = []
    this.testBestW = null
    this.testApplied = false
  }

  private async initWorkouts() {
    try {
      const loaded = await loadWorkouts(this.fake)
      // Anything imported or saved while the list was loading is newer than what was read: keep it.
      const mine = new Map(this.workouts.map((w) => [w.id, w]))
      this.workouts = [...loaded.map((w) => mine.get(w.id) ?? w), ...this.workouts.filter((w) => !loaded.some((l) => l.id === w.id))]
    } catch (err) {
      console.error('Workouts failed to load:', err)
    }
    this.refreshWorkoutOptions()
    this.workoutsLoaded = true
    this.syncSetupToLists()
    this.emit()
  }

  private refreshWorkoutOptions() {
    this.workoutOptions = this.workouts.map((w) => {
      const intervals = flatten(w)
      return {
      id: w.id,
      name: w.name,
      description: w.description,
      source: w.source,
      tag: w.tag,
      durationS: totalS(intervals),
      rampTest: !!w.rampTest,
      intervals,
      }
    })
  }

  /**
   * Stage a workout on the Workout tab, or null for a free ride. Nothing on
   * the ride changes: no workout row, no mode switch. See confirmSetup.
   */
  stageWorkout = (id: string | null) => {
    if (!this.canChoose()) return
    this.stagedWorkoutId = id && this.workouts.some((x) => x.id === id) ? id : null
    storageSet(STAGED_WORKOUT_KEY, this.stagedWorkoutId)
    this.emit()
  }

  /** The ride's workout, set directly. Only confirmSetup and the list sync call this. */
  private setRideWorkout(w: Workout | null) {
    this.workout = w
    this.intervals = w ? flatten(w) : []
    this.resetWorkoutRun()
  }

  /**
   * After the workout list changed (loaded, saved, removed, another tab): a
   * staged workout that is gone is dropped, and before a ride the confirmed
   * workout picks up an edit or is dropped too. A ride in progress keeps the
   * workout it started with.
   */
  private syncSetupToLists() {
    if (!this.workoutsLoaded) return
    if (this.stagedWorkoutId && !this.workouts.some((x) => x.id === this.stagedWorkoutId)) {
      this.stagedWorkoutId = null
      storageSet(STAGED_WORKOUT_KEY, null)
    }
    if (this.workout && this.canChoose()) {
      const now = this.workouts.find((x) => x.id === this.workout?.id) ?? null
      if (now !== this.workout) {
        this.setRideWorkout(now)
        // An edit keeps the mode the rider has. Losing the workout drops back like any free ride.
        if (!now) this.autoMode()
      }
    }
  }

  /** The Ride tab already has exactly what is staged. */
  private stagedOnRide(): boolean {
    return (
      (this.stagedCourse?.id ?? null) === (this.course?.id ?? null) &&
      (!this.course || this.stagedStartM === this.startOffsetM) &&
      (this.stagedWorkoutId ?? null) === (this.workout?.id ?? null)
    )
  }

  /**
   * The one way a setup reaches the Ride tab: copy the staged course, start
   * mile and workout onto the ride, and switch to the mode it calls for.
   * Pass a workout id (or null for a free ride) to stage that first:
   * "Ride this workout" does. Allowed until Start is pressed. With the trainer
   * already connected, the command for the new setup is sent right away.
   */
  confirmSetup = (workoutId?: string | null) => {
    if (!this.canChoose()) return
    this.confirmCount++
    if (workoutId !== undefined) {
      this.stagedWorkoutId = workoutId && this.workouts.some((x) => x.id === workoutId) ? workoutId : null
      storageSet(STAGED_WORKOUT_KEY, this.stagedWorkoutId)
    }
    this.course = this.stagedCourse
    this.startOffsetM = this.stagedCourse ? this.stagedStartM : 0
    this.lastEndM = this.stagedCourse ? this.stagedLastEndM : null
    this.seedGrade()
    this.setRideWorkout(this.workouts.find((x) => x.id === this.stagedWorkoutId) ?? null)
    this.autoMode()
    // Connected and waiting: the trainer gets the new setup's command even if the mode did not change.
    this.lastSentGradePct = null
    this.pushControl()
    this.emit()
  }

  /** Back to a plain free ride on a flat road. The staged picks stay on the Workout tab. */
  private clearRideSetup() {
    this.course = null
    this.startOffsetM = 0
    this.lastEndM = null
    this.smoothGrade = 0
    this.setRideWorkout(null)
    this.autoMode()
  }

  importWorkout = async (file: File) => {
    try {
      const w = await importZwoFile(file)
      this.workouts = [...this.workouts, w]
      this.refreshWorkoutOptions()
      // Importing lists the workout; it is loaded for a ride only when picked on the Workout tab.
      this.notice = null
      this.emit()
    } catch (err) {
      this.notice = err instanceof Error ? `Import failed: ${err.message}` : 'Import failed.'
      this.emit()
    }
  }

  removeWorkout = async (id: string) => {
    const w = this.workouts.find((x) => x.id === id)
    if (!w || w.source === 'builtin' || !this.canChoose()) return
    try {
      if (w.source === 'custom') await removeCustomWorkout(id)
      else await removeImportedWorkout(id)
    } catch (err) {
      console.error('Could not remove the workout:', err)
    }
    this.workouts = this.workouts.filter((x) => x.id !== id)
    this.refreshWorkoutOptions()
    // Gone from the Workout tab and, if it was confirmed, from the Ride tab.
    this.syncSetupToLists()
    if (w.source === 'custom') this.announceWorkouts()
    this.emit()
  }

  /** The full workout behind a list row, for the builder to edit or copy. */
  getWorkout = (id: string): Workout | null => this.workouts.find((x) => x.id === id) ?? null

  /** A message for the notice bar on the Workout and Profile tabs. */
  notify = (message: string | null) => {
    this.notice = message
    this.emit()
  }

  /**
   * Save a workout from the builder and list it. Locked mid-ride,
   * like every other change to the setup.
   */
  saveCustomWorkout = async (input: CustomWorkoutInput, overwrite = false): Promise<SaveWorkoutResult> => {
    if (!this.canChoose()) return { ok: false, conflict: false, message: 'End the ride to save a workout.' }
    try {
      const w = await saveCustomWorkout(input, overwrite)
      const at = this.workouts.findIndex((x) => x.id === w.id)
      this.workouts = at >= 0 ? this.workouts.map((x) => (x.id === w.id ? w : x)) : [...this.workouts, w]
      this.refreshWorkoutOptions()
      this.notice = null
      // Saving does not put the workout on the ride. If it is the one already confirmed, the edit is picked up.
      this.syncSetupToLists()
      this.emit()
      this.announceWorkouts()
      return { ok: true, id: w.id }
    } catch (err) {
      if (err instanceof WorkoutConflictError) return { ok: false, conflict: true, message: err.message }
      // Our own checks throw plain Errors with rider-facing text; anything else is the browser's storage.
      const known = err instanceof Error && err.constructor === Error
      if (!known) console.error('Could not save the workout:', err)
      return {
        ok: false,
        conflict: false,
        message: known ? (err as Error).message : "This browser didn't save the workout. Check that site data is allowed.",
      }
    }
  }

  private workoutsChannel: BroadcastChannel | null = null

  private watchWorkouts() {
    try {
      this.workoutsChannel = new BroadcastChannel(WORKOUTS_CHANNEL)
      this.workoutsChannel.onmessage = () => void this.reloadCustomWorkouts()
    } catch {
      // No BroadcastChannel: other tabs see changes after a reload.
    }
  }

  private announceWorkouts() {
    try {
      this.workoutsChannel?.postMessage('changed')
    } catch {
      // not fatal
    }
  }

  /**
   * Another tab saved or removed a custom workout. The list follows. A ride in
   * progress keeps the workout it started with; before a ride, the staged and
   * confirmed workouts are refreshed (or cleared if the workout is gone).
   */
  private async reloadCustomWorkouts() {
    let custom: Workout[]
    try {
      custom = await loadCustomWorkouts()
    } catch {
      return
    }
    this.workouts = [...this.workouts.filter((x) => x.source !== 'custom'), ...custom]
    this.refreshWorkoutOptions()
    this.syncSetupToLists()
    this.emit()
  }

  private positionM(): number {
    return this.course ? Math.min(this.course.lengthM, this.startOffsetM + this.distanceM) : 0
  }

  private courseLive(): CourseLive | null {
    const c = this.course
    if (!c) return null
    const pos = this.positionM()
    return {
      course: c,
      startMi: this.startOffsetM / METERS_PER_MILE,
      lastEndMi: this.lastEndM === null ? null : this.lastEndM / METERS_PER_MILE,
      positionMi: pos / METERS_PER_MILE,
      toGoMi: Math.max(0, c.lengthM - pos) / METERS_PER_MILE,
      gradePct: gradeAt(c, pos) * 100,
      elevationFt: elevationAt(c, pos) * FEET_PER_METER,
      climbedFt: this.climbedM * FEET_PER_METER,
      finished: pos >= c.lengthM,
    }
  }

  // --- trainer events ---

  private onStatus(s: ConnectionStatus) {
    this.connection = s
    if (s.kind === 'connected') {
      this.notice = null
      // Every connect and reconnect: ERG starts released until the rider is
      // seen spinning, and the current level or target is sent again.
      this.controlState = 'idle'
      this.lastSentGradePct = null
      this.releaseErg()
      this.pushControl()
      if (this.phase === 'idle') {
        // A resumed ride goes straight on. Otherwise: live numbers, and nothing recorded until Start.
        this.phase = this.rideId ? 'riding' : 'ready'
        this.lastDataAt = 0
        this.lastPhysicsAt = 0
        if (!this.rideId) this.speed.reset()
        this.trace.clear()
        keepAwake(true)
      }
    }
    if ((s.kind === 'failed' || s.kind === 'disconnected') && this.phase === 'ready') {
      this.phase = 'idle'
      // The trainer is gone and no ride is on: its trace goes with it.
      this.trace.clear()
      keepAwake(false)
    }
    this.emit()
  }

  private onReading(r: TrainerReading) {
    if (this.phase !== 'ready' && this.phase !== 'riding') return
    const sinceLastMs = this.lastDataAt > 0 ? r.t - this.lastDataAt : 0
    this.lastDataAt = r.t
    if (r.cadenceRpm !== undefined) {
      this.cadenceRpm = r.cadenceRpm
      this.checkErgCadence(r.t)
    }
    this.nudgeControl(r.t)

    if (r.powerW !== undefined) {
      const power = Math.max(0, r.powerW)
      this.lastPowerW = power
      this.smoother.push(r.t, power)
      const pedaling = power > 0 || this.cadenceRpm > 0

      // Waiting for Start: speed is live, and nothing else moves or is saved.
      if (this.phase === 'ready') this.idleStep(r.t, power)

      if (this.phase === 'riding') {
        if (this.paused && pedaling) this.resume(r.t)
        if (!this.paused) this.advance(r.t, power, pedaling)
      }
      this.lastPhysicsAt = r.t
      // The trace gets every reading the tile shows, except while paused: time that was not ridden is not drawn.
      if (!(this.phase === 'riding' && this.paused)) this.trace.push(r.t, this.traceWatts(), this.traceTargetW())
    }

    if (this.phase === 'riding' && !this.paused) this.record(r.t, sinceLastMs)
    this.emit()
  }

  /** What the Power tile shows right now for each smoothing window, in the order of SMOOTHING_OPTIONS. */
  private traceWatts(): number[] {
    return SMOOTHING_OPTIONS.map((s) => Math.max(0, Math.round(this.smoother.average(s) ?? this.lastPowerW)))
  }

  /**
   * What is being asked of the rider right now, for the band behind the
   * trace: the workout's target while it runs, else the ERG target in ERG,
   * else nothing (a resistance or Grade ride has no target power).
   */
  private traceTargetW(): number | null {
    if (this.workout && this.workoutStarted && this.workoutS < totalS(this.intervals)) return this.plannedW()
    return this.mode === 'erg' && !this.ergUnsupported ? this.ergW() : null
  }

  /**
   * One power reading before Start. The speed model runs at the grade of the
   * start point so Speed is live; no distance, climbing, clock or pause state.
   */
  private idleStep(t: number, power: number) {
    const gap = this.lastPhysicsAt ? t - this.lastPhysicsAt : 0
    const dtS = gap > 0 && gap <= MAX_SAMPLE_GAP_MS ? gap / 1000 : 0
    this.seedGrade()
    this.speed.step(power, dtS, this.course ? gradeAt(this.course, this.positionM()) : 0)
  }

  /** The trainer's grade starts at the grade where the rider is, not at 0 (Grade mode before Start). */
  private seedGrade() {
    this.smoothGrade = this.course ? gradeAt(this.course, this.positionM()) : 0
  }

  /** One power reading while riding: move the bike and the workout clock, and watch for a stop. */
  private advance(t: number, power: number, pedaling: boolean) {
    const gap = this.lastPhysicsAt ? t - this.lastPhysicsAt : 0
    if (gap > MAX_SAMPLE_GAP_MS) {
      if (this.zeroSince !== null) {
        // Data dropped while a pause was pending: the pause stands from the first zero.
        this.pause()
        if (!pedaling) return
        this.resume(t)
      } else {
        // A dropout counts as paused time, so the clock on screen matches the FIT timer.
        this.pausedTotalMs += gap - 1000
      }
    }
    const dtS = gap > 0 && gap <= MAX_SAMPLE_GAP_MS ? gap / 1000 : 0

    if (pedaling) {
      if (this.zeroSince !== null) this.cancelPendingPause()
    } else if (this.zeroSince === null) {
      this.zeroSince = t
      this.zeroMark = {
        distanceM: this.distanceM,
        climbedM: this.climbedM,
        workoutS: this.workoutS,
        lastRecordedSec: this.lastRecordedSec,
        lastSample: this.lastSample,
      }
    }

    const c = this.course
    if (c) {
      const before = this.positionM()
      const eleBefore = elevationAt(c, before)
      const grade = gradeAt(c, before)
      this.smoothGrade += (grade - this.smoothGrade) * Math.min(1, dtS / GRADE_SMOOTH_S)
      this.distanceM += this.speed.step(power, dtS, grade)
      const rise = elevationAt(c, this.positionM()) - eleBefore
      if (rise > 0) this.climbedM += rise
    } else {
      this.distanceM += this.speed.step(power, dtS)
    }
    this.advanceWorkout(dtS, t, power)

    if (this.zeroSince !== null && t - this.zeroSince >= AUTO_PAUSE_AFTER_MS) this.pause()
  }

  /**
   * Auto-pause: power and cadence both 0 for AUTO_PAUSE_AFTER_MS. The pause is
   * backdated to the first zero reading, so the ride (and the FIT file) stops
   * where the rider stopped pedaling: distance, climbing and the workout clock
   * go back to that moment and the zero samples held since then are dropped.
   */
  private pause() {
    const mark = this.zeroMark
    if (this.zeroSince === null || !mark) return
    this.paused = true
    this.pausedAt = this.zeroSince
    this.distanceM = mark.distanceM
    this.climbedM = mark.climbedM
    this.workoutS = mark.workoutS
    this.lastRecordedSec = mark.lastRecordedSec
    this.lastSample = mark.lastSample
    this.testWindow = this.testWindow.filter((x) => x.t < this.pausedAt)
    this.trace.dropFrom(this.pausedAt)
    this.zeroSince = null
    this.zeroMark = null
    this.heldSamples = []
    this.speed.reset()
    this.syncWorkoutTarget()
  }

  /** The rider pedaled again before the pause was confirmed: keep the coasting seconds. */
  private cancelPendingPause() {
    const held = this.heldSamples
    this.zeroSince = null
    this.zeroMark = null
    this.heldSamples = []
    if (held.length && this.rideId) {
      void this.rideId.then((rideId) => {
        // No ride row (the browser is not saving): nothing to write to, as in record().
        if (rideId === NO_RIDE) return
        for (const s of held) void recorder.recordSample({ rideId, ...s })
      })
    }
  }

  /** First reading with power or cadence after a pause. */
  private resume(t: number) {
    this.pausedTotalMs += Math.max(0, t - this.pausedAt)
    this.paused = false
    this.trace.breakLine()
    this.lastPhysicsAt = t
    // Never back before a second already recorded, or before Start.
    this.lastRecordedSec = Math.max(this.lastRecordedSec, Math.floor(t / 1000) - 1)
    this.lastSample = null
  }

  /** Where the ride clock stands: frozen at a pause, and during a dropout until data returns. */
  private clockEnd(now: number): number {
    if (this.paused) return this.pausedAt
    if (this.lastDataAt > 0 && now - this.lastDataAt > MAX_SAMPLE_GAP_MS) return this.lastDataAt + 1000
    return now
  }

  /**
   * Start: the clock, the recording and (if one is loaded) the workout begin
   * together, from zero. Until this is pressed nothing is saved, however long
   * the rider pedals. Pressed while not pedaling, the ride starts paused at
   * 0:00 and the first pedal stroke resumes it, so the FIT file begins there.
   */
  startRide = () => {
    if (this.phase !== 'ready' || this.connection.kind !== 'connected') return
    const now = Date.now()
    const pedaling =
      this.lastDataAt > 0 && now - this.lastDataAt <= MAX_SAMPLE_GAP_MS && (this.lastPowerW > 0 || this.cadenceRpm > 0)
    this.beginRide(now)
    if (pedaling) {
      // Distance and the workout clock count from this moment, not from the last reading.
      this.lastPhysicsAt = now
    } else {
      this.paused = true
      this.pausedAt = now
      this.speed.reset()
    }
    this.startWorkout()
    this.emit()
  }

  private beginRide(t: number) {
    this.phase = 'riding'
    this.startedAt = t
    this.distanceM = 0
    // The first sample is stamped on a whole second after Start, never before it.
    this.lastRecordedSec = Math.floor(t / 1000)
    this.lastSample = null
    this.climbedM = 0
    this.resetPause()
    // The trace is of the ride: what was pedaled before Start is not part of it.
    this.trace.clear()
    // A fake ride is marked as one for good: on its row and in its FIT file. It can never be uploaded.
    this.rideOrigin = this.fake ? 'fake' : 'trainer'
    this.rideName = this.setupName()
    this.rideStrava = null
    this.rideRowId = null
    this.rideId = recorder
      .startRide(
        t,
        this.course?.id,
        this.course ? this.startOffsetM : undefined,
        this.workout?.id,
        // A custom workout can be edited or deleted later; the ride keeps its own copy for recovery.
        this.workout?.source === 'custom' ? snapshotOf(this.workout) : undefined,
        { origin: this.rideOrigin, name: this.rideName, ftpW: this.profile.ftpW },
      )
      .then((id) => {
        this.rideRowId = id
        return id
      })
      .catch((err) => {
        console.error('Could not start recording:', err)
        this.notice = "This browser isn't saving the ride, so there will be no FIT file. Check that site data is allowed."
        this.recordingFailed = true
        this.emit()
        return NO_RIDE
      })
  }

  /** The ride's name from its setup. Also the Strava activity name. */
  private setupName(): string {
    const w = this.workout?.name.trim()
    const c = this.course?.name.trim()
    return (w && c ? `${w} on ${c}` : w || c || 'Free ride').slice(0, 100)
  }

  private resetPause() {
    this.paused = false
    this.pausedAt = 0
    this.pausedTotalMs = 0
    this.zeroSince = null
    this.zeroMark = null
    this.heldSamples = []
  }

  /** The ride as it stands now, stamped with a whole wall-clock second. */
  private sampleAt(sec: number, now: number): Omit<recorder.SampleRow, 'rideId'> {
    const bpm = this.heartRateAt(now)
    return {
      t: sec * 1000,
      powerW: Math.round(this.lastPowerW),
      cadenceRpm: Math.round(this.cadenceRpm),
      speedMps: this.speed.speedMps,
      distanceM: this.distanceM,
      ...(this.course
        ? { courseM: this.positionM(), altitudeM: elevationAt(this.course, this.positionM()) }
        : {}),
      ...(this.workout && this.workoutStarted
        ? { lap: indexAt(this.intervals, Math.min(this.workoutS, totalS(this.intervals) - 0.001)), workoutS: this.workoutS }
        : {}),
      ...(this.pausedTotalMs > 0 ? { pausedMs: Math.round(this.pausedTotalMs) } : {}),
      ...(bpm !== null ? { heartRateBpm: bpm } : {}),
    }
  }

  /**
   * Exactly one sample per wall-clock second, stamped on the second.
   * Readings don't land one per second (the trainer's clock drifts against
   * ours, and a hidden tab delivers them late), so a reading that skips a
   * second or two fills them in: power and cadence hold the last values,
   * distance and position are spread evenly. A gap longer than
   * MAX_SAMPLE_GAP_MS is a real dropout and stays a gap.
   */
  private record(t: number, sinceLastMs: number) {
    const sec = Math.floor(t / 1000)
    if (sec <= this.lastRecordedSec || !this.rideId) return
    const sample = this.sampleAt(sec, t)
    const prev = this.lastSample
    const missed = sec - this.lastRecordedSec - 1
    const fills: Omit<recorder.SampleRow, 'rideId'>[] = []
    if (prev && missed > 0 && sinceLastMs <= MAX_SAMPLE_GAP_MS && prev.t === this.lastRecordedSec * 1000) {
      const mix = (a: number | undefined, b: number | undefined, f: number) =>
        a === undefined || b === undefined ? a : a + (b - a) * f
      for (let k = 1; k <= missed; k++) {
        const f = k / (missed + 1)
        // A filled second holds the last power and cadence, but heart rate only if the sensor read in that second.
        const { heartRateBpm: _old, ...held } = prev
        const bpm = this.heartRateAt((this.lastRecordedSec + k + 1) * 1000)
        fills.push({
          ...held,
          ...(bpm !== null ? { heartRateBpm: bpm } : {}),
          t: (this.lastRecordedSec + k) * 1000,
          distanceM: mix(prev.distanceM, sample.distanceM, f) as number,
          courseM: mix(prev.courseM, sample.courseM, f),
          altitudeM: mix(prev.altitudeM, sample.altitudeM, f),
          workoutS: prev.lap === sample.lap ? mix(prev.workoutS, sample.workoutS, f) : prev.workoutS,
        })
      }
    }
    this.lastRecordedSec = sec
    this.lastSample = sample
    if (this.zeroSince !== null) {
      // The rider may have stopped. Hold these until we know (see pause()).
      this.heldSamples.push(...fills, sample)
      return
    }
    void this.rideId.then((rideId) => {
      if (rideId === NO_RIDE) return
      for (const s of [...fills, sample]) void recorder.recordSample({ rideId, ...s })
    })
  }

  // --- trainer control: resistance level or ERG target ---

  private loadErgTarget(): number {
    const saved = Number(storageGet(ERG_KEY))
    if (storageGet(ERG_KEY) !== null && Number.isFinite(saved) && saved >= ERG_MIN_W && saved <= ERG_MAX_W) return saved
    return Math.round((this.profile.ftpW * DEFAULT_ERG_FTP_SHARE) / 5) * 5
  }

  /**
   * ERG release and re-engage, from cadence.
   * Release: below 50 rpm held 3 s, or clearly stopped (below 20 rpm) held 1 s.
   * Re-engage: 60 rpm held 1 s, then a soft start.
   */
  private checkErgCadence(t: number) {
    if (this.mode !== 'erg') return
    const rpm = this.cadenceRpm
    if (this.ergReleased) {
      if (rpm >= ERG_RESUME_RPM) {
        this.resumeSince ??= t
        if (t - this.resumeSince >= ERG_RESUME_AFTER_MS) {
          this.engageErg(t)
          this.pushControl()
        }
      } else {
        this.resumeSince = null
      }
      return
    }
    this.lowCadenceSince = rpm < ERG_RELEASE_RPM ? (this.lowCadenceSince ?? t) : null
    this.stoppedSince = rpm < ERG_STOPPED_RPM ? (this.stoppedSince ?? t) : null
    const low = this.lowCadenceSince !== null && t - this.lowCadenceSince >= ERG_RELEASE_AFTER_MS
    const stopped = this.stoppedSince !== null && t - this.stoppedSince >= ERG_STOPPED_AFTER_MS
    if (low || stopped) {
      this.releaseErg()
      // Can't hold the ramp any more: that's the end of the test.
      if (this.inRamp()) this.endRampTest()
      this.pushControl()
    }
  }

  private releaseErg() {
    this.ergReleased = true
    this.ergRamp = null
    this.lowCadenceSince = null
    this.stoppedSince = null
    this.resumeSince = null
  }

  private engageErg(t: number) {
    this.ergReleased = false
    this.lowCadenceSince = null
    this.stoppedSince = null
    this.resumeSince = null
    this.startErgRamp(t)
  }

  /** Soft start: ramp from about the rider's current power. No ramp if that is already at or above the target. */
  private startErgRamp(t: number) {
    const current = this.smoother.average(DEFAULT_SMOOTHING) ?? this.lastPowerW
    const fromW = Math.max(ERG_MIN_W, Math.round(current))
    this.ergRamp = fromW < this.ergW() ? { startAt: t, fromW } : null
  }

  /** The watts to command right now: the target, or partway there during a soft start. */
  private commandedErgW(now: number): number {
    const target = this.ergW()
    const ramp = this.ergRamp
    if (!ramp) return target
    const f = (now - ramp.startAt) / ERG_SOFT_START_MS
    if (f >= 1 || target <= ramp.fromW) {
      this.ergRamp = null
      return target
    }
    return Math.round(ramp.fromW + (target - ramp.fromW) * Math.max(0, f))
  }

  /** On every reading: step a soft start along, and send a refused command again. */
  private nudgeControl(t: number) {
    if (this.connection.kind !== 'connected' || this.controlInFlight) return
    const easing = this.mode === 'erg' && !this.ergReleased && !this.ergUnsupported && this.ergRamp !== null
    // No retries while stopped: a trainer that refuses a command at a standstill would refuse it again.
    const regrade =
      this.mode === 'grade' &&
      !this.gradeUnsupported &&
      this.course !== null &&
      this.trainerGradePct() !== this.lastSentGradePct &&
      t - this.lastControlAt >= GRADE_SEND_EVERY_MS
    const moving = this.phase === 'riding' ? !this.paused : this.lastPowerW > 0 || this.cadenceRpm > 0
    const retry = this.controlState === 'failed' && moving && t - this.lastControlAt >= CONTROL_RETRY_MS
    if (easing || regrade || retry) this.pushControl()
  }

  /** What the trainer should be doing right now. */
  private desiredCommand():
    | { kind: 'resistance'; pct: number }
    | { kind: 'power'; watts: number }
    | { kind: 'release' }
    | { kind: 'grade'; pct: number } {
    if (this.mode === 'grade' && this.course && !this.gradeUnsupported) return { kind: 'grade', pct: this.trainerGradePct() }
    if (this.mode === 'erg' && !this.ergUnsupported) {
      return this.ergReleased ? { kind: 'release' } : { kind: 'power', watts: this.commandedErgW(Date.now()) }
    }
    return { kind: 'resistance', pct: this.resistancePct }
  }

  /** Send the latest command. Taps during a write coalesce into one follow-up write. */
  private pushControl() {
    if (this.connection.kind !== 'connected') return
    if (this.controlInFlight) {
      this.controlDirty = true
      return
    }
    this.controlInFlight = true
    this.controlDirty = false
    this.controlState = 'sending'
    this.lastControlAt = Date.now()
    const cmd = this.desiredCommand()
    if (cmd.kind === 'grade') this.lastSentGradePct = cmd.pct
    const send =
      cmd.kind === 'power'
        ? this.trainer.setTargetPower(cmd.watts)
        : cmd.kind === 'release'
          ? this.trainer.release()
          : cmd.kind === 'grade'
            ? this.trainer.setGrade(cmd.pct, 0.5 * AIR_DENSITY * riderParams(this.profile).cdaM2)
            : this.trainer.setResistance(cmd.pct)
    void send
      .catch((): ControlResult => 'failed')
      .then((result) => {
        this.controlInFlight = false
        this.controlState = result
        if (result === 'unsupported' && cmd.kind !== 'resistance') {
          if (cmd.kind === 'grade') this.gradeUnsupported = true
          else this.ergUnsupported = true
          this.controlDirty = true // fall back to the resistance level
        }
        if (this.controlDirty) this.pushControl()
        this.emit()
      })
    this.emit()
  }

  setResistance = (pct: number) => {
    const next = Math.min(100, Math.max(0, Math.round(pct)))
    if (next === this.resistancePct) return
    this.resistancePct = next
    storageSet(RESISTANCE_KEY, String(next))
    if (this.mode === 'resistance') this.pushControl()
    this.emit()
  }

  /** Change resistance by a signed amount in percentage points. */
  stepResistance = (delta: number) => this.setResistance(this.resistancePct + delta)

  setErgTarget = (watts: number) => {
    const next = Math.min(ERG_MAX_W, Math.max(ERG_MIN_W, Math.round(watts)))
    if (next === this.ergTargetW) return
    this.ergTargetW = next
    storageSet(ERG_KEY, String(next))
    if (this.mode === 'erg' && !this.ergReleased) this.pushControl()
    this.emit()
  }

  /** Change the ERG target by a signed number of watts. */
  stepErg = (delta: number) => this.setErgTarget(this.ergTargetW + delta)

  /**
   * The mode the setup calls for: a workout rides in ERG, a course without a
   * workout follows the hills. The rider can still switch by hand afterwards.
   */
  private autoMode() {
    if (this.workout) this.setMode('erg')
    else if (this.course) this.setMode('grade')
    else if (this.mode === 'grade') this.setMode('resistance')
  }

  /** The grade the trainer should ride, in %: smoothed course grade times the feel, inside what it can simulate. */
  private trainerGradePct(): number {
    const pct = this.smoothGrade * 100 * (this.gradeFeelPct / 100)
    return Math.round(Math.min(GRADE_MAX_PCT, Math.max(GRADE_MIN_PCT, pct)) * 10) / 10
  }

  setGradeFeel = (pct: number) => {
    const next = Math.min(100, Math.max(0, Math.round(pct)))
    if (next === this.gradeFeelPct) return
    this.gradeFeelPct = next
    storageSet(GRADE_FEEL_KEY, String(next))
    this.emit()
  }

  stepGradeFeel = (delta: number) => this.setGradeFeel(this.gradeFeelPct + delta)

  setMode = (mode: ControlMode) => {
    if (mode === this.mode || (mode === 'grade' && !this.course)) return
    this.mode = mode
    this.lastSentGradePct = null
    storageSet(MODE_KEY, mode)
    // Entering ERG engages right away (with a soft start) only if the rider is already spinning.
    if (mode === 'erg' && this.cadenceRpm >= ERG_RESUME_RPM && this.lastDataAt > 0 && !this.paused) this.engageErg(Date.now())
    else this.releaseErg()
    this.pushControl()
    this.emit()
  }

  /** E key: the next mode on offer. */
  toggleMode = () => {
    const modes: ControlMode[] = this.course ? ['resistance', 'erg', 'grade'] : ['resistance', 'erg']
    this.setMode(modes[(modes.indexOf(this.mode) + 1) % modes.length])
  }

  // --- rider profile ---

  /** `ftpSource` says where a new FTP came from, for the FTP history: typed unless told otherwise. */
  setProfile = (p: Partial<Profile>, ftpSource: FtpSource = 'typed') => {
    // Open until Start, like the setup: connected and waiting is not a ride yet.
    if (this.phase === 'riding') return
    const fromW = this.profile.ftpW
    this.profile = normalizeProfile({ ...this.profile, ...p })
    saveProfile(this.profile)
    logFtpChange(fromW, this.profile.ftpW, ftpSource)
    this.speed.setRider(riderParams(this.profile))
    this.emit()
  }

  // --- actions ---

  connect = () => {
    if (!this.supported || this.trainerBusy()) return
    this.notice = null
    if (this.fake) return void this.trainer.connect()
    // A trainer the browser can hand back connects at once. Otherwise its device list is next: say so first.
    void trainerNeedsList().then((needsList) => {
      if (this.trainerBusy()) return
      if (needsList) this.openPairing('trainer')
      else void this.trainer.connect()
    })
  }

  private trainerBusy(): boolean {
    return this.connection.kind === 'connecting' || this.connection.kind === 'connected'
  }

  setSmoothing = (s: SmoothingSeconds) => {
    this.smoothing = s
    this.emit()
  }

  /**
   * Before Start there is no ride yet: just disconnect. Nothing was saved.
   * The confirmed setup stays on the Ride tab; only New ride clears it.
   */
  disconnect = () => {
    if (this.phase !== 'ready') return
    keepAwake(false)
    this.trainer.disconnect()
    this.resetRide()
    this.emit()
  }

  endRide = async () => {
    if (this.phase === 'ready') return this.disconnect()
    if (this.phase !== 'riding' || !this.rideId) return
    // Stopped pedaling and never resumed: the ride ends where the pedaling did.
    if (this.zeroSince !== null) this.pause()
    this.endedAt = this.clockEnd(Date.now())
    this.phase = 'ended'
    keepAwake(false)
    this.trainer.disconnect()
    this.emit()
    const id = await this.rideId
    if (id === NO_RIDE) return
    try {
      await recorder.endRide(id, this.endedAt)
    } catch (err) {
      console.error('Could not close the ride:', err)
    }
    await this.download()
  }

  download = async () => {
    if (!this.rideId) return
    const id = await this.rideId
    if (id === NO_RIDE) return
    try {
      const samples = await recorder.getSamples(id)
      if (samples.length === 0) {
        // Start was pressed but the rider never pedaled.
        this.recordingFailed = true
        this.notice = 'Nothing was recorded.'
        this.emit()
        return
      }
      downloadFit(samples, samples[0].t, this.rideOrigin ?? undefined)
    } catch (err) {
      console.error('FIT export failed:', err)
      this.notice = 'Could not build the FIT file. The ride is still saved in this browser; try Download FIT again.'
      this.emit()
    }
  }

  /**
   * The ended ride as a file for Strava: built by the same code as Download
   * FIT. Refused for anything but a ride made on a real trainer: a fake ride
   * (?fake=1) is never uploadable, and the server refuses its file as well.
   */
  rideFile = async (): Promise<RideFile> => {
    if (this.phase !== 'ended' || this.rideRowId === null) throw new Error('There is no finished ride to upload.')
    if (this.fake || this.rideOrigin !== 'trainer') throw new Error('Only a ride made on a real trainer can be uploaded.')
    const rideId = this.rideRowId
    const samples = await recorder.getSamples(rideId)
    if (samples.length === 0) throw new Error('Nothing was recorded.')
    return {
      rideId,
      bytes: buildFit(samples, 'trainer'),
      name: this.rideName,
      externalId: `weem-watts-${Math.round(samples[0].t / 1000)}`,
    }
  }

  /** Remember this ride's Strava upload on the ride, so a reload does not invite a second one. */
  markStrava = async (rideId: number, mark: recorder.StravaMark | null) => {
    const clean = cleanStravaMark(mark)
    if (this.rideRowId === rideId) {
      this.rideStrava = clean
      this.emit()
    }
    if (!clean) return
    try {
      await recorder.markStrava(rideId, clean)
    } catch (err) {
      console.error('Could not save the upload state:', err)
    }
  }

  /**
   * Show a finished ride as "Ride ended" again, with its Download and Upload
   * buttons. Used when the rider comes back from connecting Strava: the
   * sign-in leaves the page, and the ride they wanted to upload must still be there.
   */
  reopenEnded = async (id: number): Promise<boolean> => {
    if (this.phase !== 'idle' || this.rideId !== null) return false
    try {
      const row = await recorder.getRide(id)
      if (!row || row.status !== 'ended') return false
      const samples = await recorder.getSamples(id)
      const last = samples[samples.length - 1]
      if (!last || this.phase !== 'idle' || this.rideId !== null) return false
      this.rideId = Promise.resolve(id)
      this.adoptRow(row)
      this.startedAt = row.startedAt
      this.endedAt = row.endedAt ?? last.t + 1000
      this.pausedTotalMs = last.pausedMs ?? 0
      this.distanceM = last.distanceM
      this.phase = 'ended'
      this.emit()
      return true
    } catch (err) {
      console.error('Could not reopen the ride:', err)
      return false
    }
  }

  /** Take the name, origin and Strava mark from a saved ride row. */
  private adoptRow(row: recorder.RideRow) {
    this.rideRowId = row.id
    this.rideOrigin = cleanOrigin(row.origin)
    this.rideName = cleanName(row.name)
    this.rideStrava = cleanStravaMark(row.strava)
  }

  /**
   * After a ride: back to a plain free ride on a flat road, nothing loaded.
   * The next setup has to be confirmed on the Workout tab again; the picks
   * there are kept.
   */
  newRide = () => {
    const ridden = this.course
    this.resetRide()
    this.clearRideSetup()
    // The start mile there defaults to where this ride ended.
    if (ridden && this.stagedCourse === ridden) void this.stageCourse(ridden.id)
    this.emit()
  }

  /** Ride counters back to zero. The setup is left alone. */
  private resetRide() {
    this.phase = 'idle'
    this.rideId = null
    this.rideRowId = null
    this.rideOrigin = null
    this.rideName = 'Free ride'
    this.rideStrava = null
    this.recordingFailed = false
    this.startedAt = 0
    this.endedAt = 0
    this.distanceM = 0
    this.lastDataAt = 0
    this.lastPhysicsAt = 0
    this.cadenceRpm = 0
    this.lastPowerW = 0
    this.notice = null
    this.climbedM = 0
    this.resetPause()
    this.smoother.clear()
    this.trace.clear()
    this.speed.reset()
    this.resetWorkoutRun()
  }

  // --- courses ---

  private async initCourses() {
    try {
      this.courses = await loadCourses()
    } catch (err) {
      console.error('Courses failed to load:', err)
    }
    this.coursesLoaded = true
    // The last pick comes back on the Workout tab only. The ride starts as a flat road.
    const saved = storageGet(STAGED_COURSE_KEY)
    if (saved && this.canChoose()) await this.stageCourse(saved)
    this.emit()
  }

  /**
   * The setup can change until Start: not connected, or connected and waiting.
   * A resumed ride (rideId set) is locked from Resume.
   */
  private canChoose(): boolean {
    return (this.phase === 'idle' || this.phase === 'ready') && this.rideId === null
  }

  /**
   * Stage a course on the Workout tab (or null for a flat road). Start
   * defaults to where the last ride on it ended. Nothing on the ride changes:
   * no course row, no mode switch. See confirmSetup.
   */
  stageCourse = async (id: string | null) => {
    if (!this.canChoose()) return
    const c = id ? (this.courses.find((x) => x.id === id) ?? null) : null
    this.stagedCourse = c
    this.stagedStartM = 0
    this.stagedLastEndM = null
    storageSet(STAGED_COURSE_KEY, c?.id ?? null)
    this.emit()
    if (!c) return
    const confirmsBefore = this.confirmCount
    try {
      const last = await recorder.lastPositionOn(c.id)
      if (this.stagedCourse !== c) return
      // Confirmed before the last position came back: the ride gets the same default start.
      // Only then: picking a course that is already on the ride must not move the ride's start.
      const confirmed = this.confirmCount !== confirmsBefore && this.canChoose() && this.stagedOnRide()
      this.stagedLastEndM = last
      if (last !== null && last < c.lengthM - NEAR_FINISH_M) this.stagedStartM = last
      if (confirmed) {
        this.startOffsetM = this.stagedStartM
        this.lastEndM = this.stagedLastEndM
        this.seedGrade()
      }
    } catch (err) {
      console.error('Could not read last position:', err)
    }
    this.emit()
  }

  /** Set the start mile of the staged course. */
  setStartMi = (mi: number) => {
    if (!this.stagedCourse || !this.canChoose() || !Number.isFinite(mi)) return
    const m = mi * METERS_PER_MILE
    this.stagedStartM = Math.min(Math.max(0, m), Math.max(0, this.stagedCourse.lengthM - NEAR_FINISH_M))
    this.emit()
  }

  /**
   * After a restore: list any course or workout that was added to the saved
   * files. Nothing already listed is replaced, so the ride and the picks on
   * the Workout tab keep the objects they hold.
   */
  reloadLists = async () => {
    try {
      const all = await loadCourses()
      this.courses = [...this.courses, ...all.filter((c) => !this.courses.some((x) => x.id === c.id))]
    } catch (err) {
      console.error('Courses failed to load:', err)
    }
    await this.initWorkouts()
  }

  importCourse = async (file: File) => {
    try {
      const c = await importGpxFile(file)
      this.courses = [...this.courses, c]
      this.notice = null
      // Importing lists the course and picks it on the Workout tab. It is not on the ride until confirmed there.
      if (this.canChoose()) await this.stageCourse(c.id)
      this.emit()
    } catch (err) {
      this.notice = err instanceof Error ? `Import failed: ${err.message}` : 'Import failed.'
      this.emit()
    }
  }

  removeCourse = async (id: string) => {
    const c = this.courses.find((x) => x.id === id)
    if (!c || c.source !== 'imported' || !this.canChoose()) return
    try {
      await removeImportedCourse(id)
    } catch (err) {
      console.error('Could not remove the course:', err)
    }
    this.courses = this.courses.filter((x) => x.id !== id)
    // Gone from the Workout tab and, if it was confirmed, from the Ride tab.
    if (this.stagedCourse?.id === id) await this.stageCourse(null)
    if (this.course?.id === id) {
      this.course = null
      this.startOffsetM = 0
      this.lastEndM = null
      this.smoothGrade = 0
      this.autoMode()
    }
    this.emit()
  }

  // --- crash / reload recovery ---

  private async checkRecovery() {
    try {
      this.recovery = await recorder.findUnfinished()
    } catch (err) {
      console.error('Recovery check failed:', err)
    }
    this.emit()
  }

  /** Keep adding to the unfinished ride. The rider presses Connect next. */
  resumeRecovered = () => {
    const rec = this.recovery
    if (!rec?.last || this.phase !== 'idle') return
    this.rideId = Promise.resolve(rec.ride.id)
    this.adoptRow(rec.ride)
    this.startedAt = rec.ride.startedAt
    this.distanceM = rec.last.distanceM
    this.lastRecordedSec = Math.floor(rec.last.t / 1000)
    this.lastSample = null
    // The time since the last saved second is a pause. The first pedal stroke ends it.
    this.resetPause()
    this.paused = true
    this.pausedAt = rec.last.t + 1000
    this.pausedTotalMs = rec.last.pausedMs ?? 0
    this.speed.reset()
    this.recovery = null
    this.course = null
    this.startOffsetM = 0
    this.smoothGrade = 0
    if (rec.ride.courseId) {
      const c = this.courses.find((x) => x.id === rec.ride.courseId) ?? null
      if (c) {
        this.course = c
        this.startOffsetM = rec.ride.startOffsetM ?? 0
        this.seedGrade()
      } else {
        this.notice = 'That ride\'s course is no longer available. Continuing as a free ride.'
      }
    }
    this.workout = null
    this.intervals = []
    this.resetWorkoutRun()
    if (rec.ride.workoutId) {
      // A custom workout rides from the copy saved with the ride: it may have been edited or deleted since.
      const w = workoutFromSnapshot(rec.ride.workoutSnapshot) ?? this.workouts.find((x) => x.id === rec.ride.workoutId) ?? null
      if (w) {
        this.workout = w
        this.intervals = flatten(w)
        this.workoutS = rec.last.workoutS ?? 0
        this.workoutStarted = rec.last.workoutS !== undefined
        if (w.rampTest && this.workoutS >= this.intervals[this.intervals.length - 1].startS) this.testEnded = true
      } else {
        this.notice = 'That ride\'s workout is no longer available. Continuing without it.'
      }
    }
    // The mode the resumed setup calls for: the workout (ERG), else the hills (Grade).
    this.autoMode()
    this.emit()
  }

  /** Close the unfinished ride and download it. */
  endRecovered = async () => {
    const rec = this.recovery
    if (!rec?.last || this.phase !== 'idle') return
    this.recovery = null
    this.rideId = Promise.resolve(rec.ride.id)
    this.adoptRow(rec.ride)
    this.startedAt = rec.ride.startedAt
    this.endedAt = rec.last.t + 1000
    this.pausedTotalMs = rec.last.pausedMs ?? 0
    this.distanceM = rec.last.distanceM
    this.phase = 'ended'
    await recorder.endRide(rec.ride.id, this.endedAt)
    this.emit()
    await this.download()
  }
}
