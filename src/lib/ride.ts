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
import { bluetoothSupported, createBleTrainer } from './ble'
import { elevationAt, gradeAt, type Course } from './course'
import { importGpxFile, loadCourses, removeImportedCourse } from './courses'
import { createFakeTrainer, isFakeMode } from './fakeTrainer'
import { downloadFit } from './fit'
import { FEET_PER_METER, METERS_PER_MILE, MPS_TO_MPH, SpeedModel } from './physics'
import { loadProfile, normalizeProfile, riderParams, saveProfile, type Profile } from './profile'
import * as recorder from './recorder'
import { PowerSmoother } from './smoothing'
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

/** idle: no ride. ready: connected, waiting for the first pedal stroke. */
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
const COURSE_KEY = 'ww.courseId'
const WORKOUT_KEY = 'ww.workoutId'
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

export interface WorkoutOption {
  id: string
  name: string
  description: string
  source: Workout['source']
  tag?: string
  durationS: number
  rampTest: boolean
}

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
  done: boolean
  /** The rider pressed Start workout. Before that the ride is a free ride. */
  started: boolean
  /** Start workout is available: connected, not started yet. */
  canStart: boolean
  intensityPct: number
  rampTest: RampTestLive | null
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
  smoothing: SmoothingSeconds
  powerW: number | null
  cadenceRpm: number | null
  speedMph: number | null
  distanceMi: number
  elapsedMs: number
  recovery: Recovery | null
  /** True while a resumed ride is waiting for the trainer. */
  resuming: boolean
  canDownload: boolean
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
  /** Profile can be edited only between rides. */
  canEditProfile: boolean
  courses: CourseOption[]
  coursesLoaded: boolean
  /** Selected course (where the ride goes), or null for a flat road. */
  course: CourseLive | null
  /** Course or workout selection and start mile can change only before a ride starts. */
  canChooseCourse: boolean
  workouts: WorkoutOption[]
  workoutsLoaded: boolean
  /** Selected workout (what the trainer does), or null. Independent of the course. */
  workout: WorkoutLive | null
}

const TICK_MS = 250

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
  private speed = new SpeedModel(riderParams(loadProfile()))

  private rideId: Promise<number> | null = null
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

  private courses: Course[] = []
  private coursesLoaded = false
  private course: Course | null = null
  private startOffsetM = 0
  private lastEndM: number | null = null
  private climbedM = 0

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
    this.snapshot = this.build()
    setInterval(() => this.emit(), TICK_MS)
    void this.checkRecovery()
    void this.initCourses()
    void this.initWorkouts()
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
      smoothing: this.smoothing,
      powerW: avg === null ? null : Math.max(0, Math.round(avg)),
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
      canEditProfile: this.phase === 'idle' || this.phase === 'ended',
      courses: this.courses.map((c) => ({
        id: c.id,
        name: c.name,
        source: c.source,
        description: c.description,
        lengthMi: c.lengthM / METERS_PER_MILE,
        ascentFt: c.ascentM * FEET_PER_METER,
      })),
      coursesLoaded: this.coursesLoaded,
      course: this.courseLive(),
      canChooseCourse: this.phase === 'idle' && this.rideId === null,
      workouts: this.workoutOptions,
      workoutsLoaded: this.workoutsLoaded,
      workout: this.workoutLive(),
    }
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
      done,
      started: this.workoutStarted,
      canStart: !this.workoutStarted && (this.phase === 'ready' || this.phase === 'riding'),
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
    this.workoutS = Math.min(total, this.workoutS + dtS)
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

  /** Start the loaded workout: the clock starts and ERG follows it. */
  startWorkout = () => {
    if (!this.workout || this.workoutStarted) return
    if (this.phase !== 'ready' && this.phase !== 'riding') return
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
    this.profile = normalizeProfile({ ...this.profile, ftpW: live.ftpW })
    saveProfile(this.profile)
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
      this.workouts = await loadWorkouts(this.fake)
    } catch (err) {
      console.error('Workouts failed to load:', err)
    }
    this.refreshWorkoutOptions()
    this.workoutsLoaded = true
    const saved = storageGet(WORKOUT_KEY)
    if (saved && this.canChoose()) this.selectWorkout(saved)
    this.emit()
  }

  private refreshWorkoutOptions() {
    this.workoutOptions = this.workouts.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      source: w.source,
      tag: w.tag,
      durationS: totalS(flatten(w)),
      rampTest: !!w.rampTest,
    }))
  }

  /** Pick a workout, or null for none. Independent of the course. Switches to ERG. */
  selectWorkout = (id: string | null) => {
    if (!this.canChoose()) return
    const w = id ? (this.workouts.find((x) => x.id === id) ?? null) : null
    this.workout = w
    this.intervals = w ? flatten(w) : []
    this.resetWorkoutRun()
    storageSet(WORKOUT_KEY, w?.id ?? null)
    this.autoMode()
    this.emit()
  }

  importWorkout = async (file: File) => {
    try {
      const w = await importZwoFile(file)
      this.workouts = [...this.workouts, w]
      this.refreshWorkoutOptions()
      this.notice = null
      this.selectWorkout(w.id)
    } catch (err) {
      this.notice = err instanceof Error ? `Import failed: ${err.message}` : 'Import failed.'
      this.emit()
    }
  }

  removeWorkout = async (id: string) => {
    const w = this.workouts.find((x) => x.id === id)
    if (!w || w.source !== 'imported' || !this.canChoose()) return
    try {
      await removeImportedWorkout(id)
    } catch (err) {
      console.error('Could not remove the workout:', err)
    }
    this.workouts = this.workouts.filter((x) => x.id !== id)
    this.refreshWorkoutOptions()
    if (this.workout?.id === id) this.selectWorkout(null)
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
        this.phase = this.rideId ? 'riding' : 'ready'
        this.lastDataAt = 0
        this.lastPhysicsAt = 0
        keepAwake(true)
      }
    }
    if ((s.kind === 'failed' || s.kind === 'disconnected') && this.phase === 'ready') {
      this.phase = 'idle'
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

      if (this.phase === 'ready' && pedaling) this.beginRide(r.t)

      if (this.phase === 'riding') {
        if (this.paused && pedaling) this.resume(r.t)
        if (!this.paused) this.advance(r.t, power, pedaling)
      }
      this.lastPhysicsAt = r.t
    }

    if (this.phase === 'riding' && !this.paused) this.record(r.t, sinceLastMs)
    this.emit()
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
        for (const s of held) void recorder.recordSample({ rideId, ...s })
      })
    }
  }

  /** First reading with power or cadence after a pause. */
  private resume(t: number) {
    this.pausedTotalMs += Math.max(0, t - this.pausedAt)
    this.paused = false
    this.lastPhysicsAt = t
    this.lastRecordedSec = Math.floor(t / 1000) - 1
    this.lastSample = null
  }

  /** Where the ride clock stands: frozen at a pause, and during a dropout until data returns. */
  private clockEnd(now: number): number {
    if (this.paused) return this.pausedAt
    if (this.lastDataAt > 0 && now - this.lastDataAt > MAX_SAMPLE_GAP_MS) return this.lastDataAt + 1000
    return now
  }

  private beginRide(t: number) {
    this.phase = 'riding'
    this.startedAt = t
    this.distanceM = 0
    this.speed.reset()
    this.lastRecordedSec = -1
    this.lastSample = null
    this.climbedM = 0
    this.resetPause()
    this.rideId = recorder
      .startRide(t, this.course?.id, this.course ? this.startOffsetM : undefined, this.workout?.id)
      .catch((err) => {
        console.error('Could not start recording:', err)
        this.notice = "This browser isn't saving the ride, so there will be no FIT file. Check that site data is allowed."
        this.recordingFailed = true
        this.emit()
        return NO_RIDE
      })
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
  private sampleAt(sec: number): Omit<recorder.SampleRow, 'rideId'> {
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
    const sample = this.sampleAt(sec)
    const prev = this.lastSample
    const missed = sec - this.lastRecordedSec - 1
    const fills: Omit<recorder.SampleRow, 'rideId'>[] = []
    if (prev && missed > 0 && sinceLastMs <= MAX_SAMPLE_GAP_MS && prev.t === this.lastRecordedSec * 1000) {
      const mix = (a: number | undefined, b: number | undefined, f: number) =>
        a === undefined || b === undefined ? a : a + (b - a) * f
      for (let k = 1; k <= missed; k++) {
        const f = k / (missed + 1)
        fills.push({
          ...prev,
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
    const retry =
      this.controlState === 'failed' && this.phase === 'riding' && !this.paused && t - this.lastControlAt >= CONTROL_RETRY_MS
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

  setProfile = (p: Partial<Profile>) => {
    if (!(this.phase === 'idle' || this.phase === 'ended')) return
    this.profile = normalizeProfile({ ...this.profile, ...p })
    saveProfile(this.profile)
    this.speed.setRider(riderParams(this.profile))
    this.emit()
  }

  // --- actions ---

  connect = () => {
    if (!this.supported || this.connection.kind === 'connecting' || this.connection.kind === 'connected') return
    this.notice = null
    void this.trainer.connect()
  }

  setSmoothing = (s: SmoothingSeconds) => {
    this.smoothing = s
    this.emit()
  }

  /** Before the first pedal stroke there is no ride yet: just disconnect. */
  disconnect = () => {
    if (this.phase !== 'ready') return
    keepAwake(false)
    this.trainer.disconnect()
    this.newRide()
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
        this.notice = 'Nothing was recorded.'
        this.emit()
        return
      }
      downloadFit(samples, samples[0].t)
    } catch (err) {
      console.error('FIT export failed:', err)
      this.notice = 'Could not build the FIT file. The ride is still saved in this browser; try Download FIT again.'
      this.emit()
    }
  }

  newRide = () => {
    this.phase = 'idle'
    this.rideId = null
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
    this.speed.reset()
    if (this.course) void this.selectCourse(this.course.id)
    if (this.workout) this.selectWorkout(this.workout.id)
    this.emit()
  }

  // --- courses ---

  private async initCourses() {
    try {
      this.courses = await loadCourses()
    } catch (err) {
      console.error('Courses failed to load:', err)
    }
    this.coursesLoaded = true
    const saved = storageGet(COURSE_KEY)
    if (saved && this.canChoose()) await this.selectCourse(saved)
    this.emit()
  }

  private canChoose(): boolean {
    return this.phase === 'idle' && this.rideId === null
  }

  /** Pick a course (or null for a flat road). Independent of the workout. Start defaults to where the last ride on it ended. */
  selectCourse = async (id: string | null) => {
    if (!this.canChoose()) return
    const c = id ? (this.courses.find((x) => x.id === id) ?? null) : null
    this.course = c
    this.startOffsetM = 0
    this.lastEndM = null
    storageSet(COURSE_KEY, c?.id ?? null)
    this.smoothGrade = 0
    this.autoMode()
    this.emit()
    if (!c) return
    try {
      const last = await recorder.lastPositionOn(c.id)
      if (this.course !== c) return
      this.lastEndM = last
      if (last !== null && last < c.lengthM - NEAR_FINISH_M) this.startOffsetM = last
    } catch (err) {
      console.error('Could not read last position:', err)
    }
    this.emit()
  }

  /** Set the start mile for the next ride on the selected course. */
  setStartMi = (mi: number) => {
    if (!this.course || !this.canChoose() || !Number.isFinite(mi)) return
    const m = mi * METERS_PER_MILE
    this.startOffsetM = Math.min(Math.max(0, m), Math.max(0, this.course.lengthM - NEAR_FINISH_M))
    this.emit()
  }

  importCourse = async (file: File) => {
    try {
      const c = await importGpxFile(file)
      this.courses = [...this.courses, c]
      this.notice = null
      await this.selectCourse(c.id)
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
    if (this.course?.id === id) await this.selectCourse(null)
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
    if (rec.ride.courseId) {
      const c = this.courses.find((x) => x.id === rec.ride.courseId) ?? null
      if (c) {
        this.course = c
        this.startOffsetM = rec.ride.startOffsetM ?? 0
      } else {
        this.notice = 'That ride\'s course is no longer available. Continuing as a free ride.'
      }
    }
    this.workout = null
    this.intervals = []
    this.resetWorkoutRun()
    if (rec.ride.workoutId) {
      const w = this.workouts.find((x) => x.id === rec.ride.workoutId) ?? null
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
    this.emit()
  }

  /** Close the unfinished ride and download it. */
  endRecovered = async () => {
    const rec = this.recovery
    if (!rec?.last || this.phase !== 'idle') return
    this.recovery = null
    this.rideId = Promise.resolve(rec.ride.id)
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
