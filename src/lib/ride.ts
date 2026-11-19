/**
 * Ride state, outside React. One instance per tab.
 * Time and distance come from timestamps, never from counting timer ticks,
 * so a throttled background tab does not drift.
 */
import {
  DEFAULT_RESISTANCE_PCT,
  DEFAULT_SMOOTHING,
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
import * as recorder from './recorder'
import { PowerSmoother } from './smoothing'
import type { ConnectionStatus, ResistanceResult, Trainer, TrainerReading } from './types'
import { keepAwake } from './wakeLock'

/** idle: no ride. ready: connected, waiting for the first pedal stroke. */
export type Phase = 'idle' | 'ready' | 'riding' | 'ended'

/** idle: nothing sent yet. sending: a write is in flight. */
export type ResistanceState = 'idle' | 'sending' | ResistanceResult

const RESISTANCE_KEY = 'ww.resistancePct'
const COURSE_KEY = 'ww.courseId'
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

function loadResistance(): number {
  try {
    const v = Number(localStorage.getItem(RESISTANCE_KEY))
    if (Number.isFinite(v) && v >= 0 && v <= 100 && localStorage.getItem(RESISTANCE_KEY) !== null) return v
  } catch {
    // storage unavailable
  }
  return DEFAULT_RESISTANCE_PCT
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

export interface RideSnapshot {
  phase: Phase
  connection: ConnectionStatus
  /** No data for STALE_AFTER_MS while a ride needs it. Numbers must not read as live. */
  stale: boolean
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
  resistanceState: ResistanceState
  courses: CourseOption[]
  coursesLoaded: boolean
  /** Selected course, or null for a free ride. */
  course: CourseLive | null
  /** Course selection and start mile can change only before a ride starts. */
  canChooseCourse: boolean
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
  private speed = new SpeedModel()

  private rideId: Promise<number> | null = null
  private startedAt = 0
  private endedAt = 0
  private distanceM = 0
  private lastPowerW = 0
  private cadenceRpm = 0
  private lastDataAt = 0
  private lastPhysicsAt = 0
  private lastRecordedSec = -1
  private recovery: recorder.UnfinishedRide | null = null
  private notice: string | null = null
  private resistancePct = loadResistance()
  private resistanceState: ResistanceState = 'idle'
  private resistanceInFlight = false
  private resistanceDirty = false

  private courses: Course[] = []
  private coursesLoaded = false
  private course: Course | null = null
  private startOffsetM = 0
  private lastEndM: number | null = null
  private climbedM = 0

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
      if (this.phase === 'riding') elapsedMs = now - this.startedAt
      else if (this.phase === 'ended') elapsedMs = this.endedAt - this.startedAt
    }

    return {
      phase: this.phase,
      connection: this.connection,
      stale,
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
      canDownload: this.phase === 'ended' && this.rideId !== null,
      notice: this.notice,
      resistancePct: this.resistancePct,
      resistanceState: this.resistanceState,
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
    }
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
      // Apply the current level on every connect and reconnect.
      this.resistanceState = 'idle'
      this.pushResistance()
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
    this.lastDataAt = r.t
    if (r.cadenceRpm !== undefined) this.cadenceRpm = r.cadenceRpm

    if (r.powerW !== undefined) {
      const power = Math.max(0, r.powerW)
      this.lastPowerW = power
      this.smoother.push(r.t, power)

      if (this.phase === 'ready' && (power > 0 || this.cadenceRpm > 0)) this.beginRide(r.t)

      if (this.phase === 'riding') {
        const gap = this.lastPhysicsAt ? r.t - this.lastPhysicsAt : 0
        const dtS = gap > 0 && gap <= MAX_SAMPLE_GAP_MS ? gap / 1000 : 0
        const c = this.course
        if (c) {
          const before = this.positionM()
          const eleBefore = elevationAt(c, before)
          this.distanceM += this.speed.step(power, dtS, gradeAt(c, before))
          const rise = elevationAt(c, this.positionM()) - eleBefore
          if (rise > 0) this.climbedM += rise
        } else {
          this.distanceM += this.speed.step(power, dtS)
        }
      }
      this.lastPhysicsAt = r.t
    }

    if (this.phase === 'riding') this.record(r.t)
    this.emit()
  }

  private beginRide(t: number) {
    this.phase = 'riding'
    this.startedAt = t
    this.distanceM = 0
    this.speed.reset()
    this.lastRecordedSec = -1
    this.climbedM = 0
    this.rideId = recorder.startRide(t, this.course?.id, this.course ? this.startOffsetM : undefined)
  }

  /** One sample per wall-clock second. */
  private record(t: number) {
    const sec = Math.floor(t / 1000)
    if (sec === this.lastRecordedSec || !this.rideId) return
    this.lastRecordedSec = sec
    const sample = {
      t,
      powerW: Math.round(this.lastPowerW),
      cadenceRpm: Math.round(this.cadenceRpm),
      speedMps: this.speed.speedMps,
      distanceM: this.distanceM,
      ...(this.course
        ? { courseM: this.positionM(), altitudeM: elevationAt(this.course, this.positionM()) }
        : {}),
    }
    void this.rideId.then((rideId) => recorder.recordSample({ rideId, ...sample }))
  }

  // --- resistance ---

  /** Send the latest level. Taps during a write coalesce into one follow-up write. */
  private pushResistance() {
    if (this.connection.kind !== 'connected') return
    if (this.resistanceInFlight) {
      this.resistanceDirty = true
      return
    }
    this.resistanceInFlight = true
    this.resistanceDirty = false
    this.resistanceState = 'sending'
    const pct = this.resistancePct
    void this.trainer
      .setResistance(pct)
      .catch((): ResistanceResult => 'failed')
      .then((result) => {
        this.resistanceInFlight = false
        this.resistanceState = result
        if (this.resistanceDirty && result !== 'unsupported') this.pushResistance()
        this.emit()
      })
    this.emit()
  }

  setResistance = (pct: number) => {
    const next = Math.min(100, Math.max(0, Math.round(pct)))
    if (next === this.resistancePct) return
    this.resistancePct = next
    try {
      localStorage.setItem(RESISTANCE_KEY, String(next))
    } catch {
      // storage unavailable; level still applies this session
    }
    if (this.resistanceState !== 'unsupported') this.pushResistance()
    this.emit()
  }

  /** Change resistance by a signed amount in percentage points. */
  stepResistance = (delta: number) => this.setResistance(this.resistancePct + delta)

  // --- actions ---

  connect = () => {
    if (!this.supported) return
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
    this.endedAt = Date.now()
    this.phase = 'ended'
    keepAwake(false)
    this.trainer.disconnect()
    this.emit()
    const id = await this.rideId
    await recorder.endRide(id, this.endedAt)
    await this.download()
  }

  download = async () => {
    if (!this.rideId) return
    const id = await this.rideId
    const samples = await recorder.getSamples(id)
    if (samples.length === 0) {
      this.notice = 'Nothing was recorded.'
      this.emit()
      return
    }
    downloadFit(samples, samples[0].t)
  }

  newRide = () => {
    this.phase = 'idle'
    this.rideId = null
    this.startedAt = 0
    this.endedAt = 0
    this.distanceM = 0
    this.lastDataAt = 0
    this.lastPhysicsAt = 0
    this.cadenceRpm = 0
    this.lastPowerW = 0
    this.notice = null
    this.climbedM = 0
    this.smoother.clear()
    this.speed.reset()
    if (this.course) void this.selectCourse(this.course.id)
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

  /** Pick a course (or null for a free ride). Start defaults to where the last ride on it ended. */
  selectCourse = async (id: string | null) => {
    if (!this.canChoose()) return
    const c = id ? (this.courses.find((x) => x.id === id) ?? null) : null
    this.course = c
    this.startOffsetM = 0
    this.lastEndM = null
    storageSet(COURSE_KEY, c?.id ?? null)
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
    await removeImportedCourse(id)
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
    this.emit()
  }

  /** Close the unfinished ride and download it. */
  endRecovered = async () => {
    const rec = this.recovery
    if (!rec?.last || this.phase !== 'idle') return
    this.recovery = null
    this.rideId = Promise.resolve(rec.ride.id)
    this.startedAt = rec.ride.startedAt
    this.endedAt = rec.last.t
    this.distanceM = rec.last.distanceM
    this.phase = 'ended'
    await recorder.endRide(rec.ride.id, rec.last.t)
    this.emit()
    await this.download()
  }
}
