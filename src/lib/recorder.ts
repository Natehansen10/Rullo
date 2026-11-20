/**
 * Per-second ride autosave to IndexedDB (Dexie).
 * Each sample is written as it is taken, so a crash or reload loses at most
 * the current second. Pattern informed by Croissant Ride recorder.ts (Apache-2.0).
 * No code copied.
 */
import Dexie, { type EntityTable, type Table } from 'dexie'

export interface RideRow {
  id: number
  startedAt: number
  endedAt?: number
  status: 'active' | 'ended'
  /** Course ridden, or undefined for a free ride. */
  courseId?: string
  /** Where on the course the ride started, meters along the slope. */
  startOffsetM?: number
  /** Workout ridden, if any. */
  workoutId?: string
  /**
   * The workout as it was when the ride started, for workouts the rider can
   * edit or delete (custom ones). Recovery rides this copy, so a later edit
   * can't move the intervals under a ride in progress. Untrusted on load.
   */
  workoutSnapshot?: unknown
}

export interface SampleRow {
  rideId: number
  /** Wall-clock ms since epoch. */
  t: number
  powerW: number
  cadenceRpm: number
  speedMps: number
  /** Cumulative distance in meters. */
  distanceM: number
  /** Course rides only: position on the course (m) and elevation (m). */
  courseM?: number
  altitudeM?: number
  /** Workout rides only: interval index (one FIT lap each) and seconds into the workout. */
  lap?: number
  workoutS?: number
  /** Total paused time before this sample, ms (auto-pauses and dropouts). Absent until the first pause. */
  pausedMs?: number
}

/** A GPX the rider imported. Rebuilt into a Course on load. */
export interface ImportedCourseRow {
  id: string
  name: string
  gpx: string
  addedAt: number
}

/** A ZWO workout the rider imported. Parsed again on load. */
export interface ImportedWorkoutRow {
  id: string
  name: string
  zwo: string
  addedAt: number
}

/**
 * A workout built in the app, stored as its own step list (not ZWO text) so it
 * reopens exactly as built. Untrusted on load: cleaned and validated again.
 */
export interface CustomWorkoutRow {
  id: string
  name: string
  description: string
  tag: string
  steps: unknown
  createdAt: number
  updatedAt: number
  v: 1
}

class WeemWattsDB extends Dexie {
  rides!: EntityTable<RideRow, 'id'>
  samples!: Table<SampleRow, [number, number]>
  courses!: EntityTable<ImportedCourseRow, 'id'>
  workouts!: EntityTable<ImportedWorkoutRow, 'id'>
  customWorkouts!: EntityTable<CustomWorkoutRow, 'id'>

  constructor() {
    super('weem-watts')
    this.version(1).stores({
      rides: '++id, status',
      samples: '[rideId+t], rideId',
    })
    this.version(2).stores({
      rides: '++id, status, courseId',
      samples: '[rideId+t], rideId',
      courses: 'id, addedAt',
    })
    this.version(3).stores({
      rides: '++id, status, courseId',
      samples: '[rideId+t], rideId',
      courses: 'id, addedAt',
      workouts: 'id, addedAt',
    })
    // v4 adds a table only. Rides, samples, courses and imports are untouched.
    this.version(4).stores({
      rides: '++id, status, courseId',
      samples: '[rideId+t], rideId',
      courses: 'id, addedAt',
      workouts: 'id, addedAt',
      customWorkouts: 'id, createdAt',
    })
  }
}

const db = new WeemWattsDB()

export async function startRide(
  startedAt: number,
  courseId?: string,
  startOffsetM?: number,
  workoutId?: string,
  workoutSnapshot?: unknown,
): Promise<number> {
  return db.rides.add({
    startedAt,
    status: 'active',
    courseId,
    startOffsetM,
    workoutId,
    ...(workoutSnapshot !== undefined ? { workoutSnapshot } : {}),
  } as RideRow)
}

/** Where the most recent ride on this course ended (m along the course), if any. */
export async function lastPositionOn(courseId: string): Promise<number | null> {
  const rides = await db.rides.where('courseId').equals(courseId).sortBy('startedAt')
  for (let i = rides.length - 1; i >= 0; i--) {
    const last = await db.samples
      .where('[rideId+t]')
      .between([rides[i].id, Dexie.minKey], [rides[i].id, Dexie.maxKey])
      .last()
    if (last?.courseM !== undefined) return last.courseM
  }
  return null
}

export async function saveImportedCourse(row: ImportedCourseRow): Promise<void> {
  await db.courses.put(row)
}

export async function listImportedCourses(): Promise<ImportedCourseRow[]> {
  return db.courses.orderBy('addedAt').toArray()
}

export async function deleteImportedCourse(id: string): Promise<void> {
  await db.courses.delete(id)
}

export async function saveImportedWorkout(row: ImportedWorkoutRow): Promise<void> {
  await db.workouts.put(row)
}

export async function listImportedWorkouts(): Promise<ImportedWorkoutRow[]> {
  return db.workouts.orderBy('addedAt').toArray()
}

export async function deleteImportedWorkout(id: string): Promise<void> {
  await db.workouts.delete(id)
}

export async function saveCustomWorkout(row: CustomWorkoutRow): Promise<void> {
  await db.customWorkouts.put(row)
}

export async function getCustomWorkout(id: string): Promise<CustomWorkoutRow | undefined> {
  return db.customWorkouts.get(id)
}

export async function listCustomWorkouts(): Promise<CustomWorkoutRow[]> {
  return db.customWorkouts.orderBy('createdAt').toArray()
}

export async function deleteCustomWorkout(id: string): Promise<void> {
  await db.customWorkouts.delete(id)
}

export async function recordSample(s: SampleRow): Promise<void> {
  try {
    await db.samples.put(s)
  } catch (err) {
    console.error('Could not save sample:', err)
  }
}

export async function endRide(id: number, endedAt: number): Promise<void> {
  await db.rides.update(id, { endedAt, status: 'ended' })
}

export async function getSamples(rideId: number): Promise<SampleRow[]> {
  return db.samples.where('[rideId+t]').between([rideId, Dexie.minKey], [rideId, Dexie.maxKey]).toArray()
}

export interface UnfinishedRide {
  ride: RideRow
  last: SampleRow | null
}

/** The most recent ride that was never ended (crash, reload, closed tab). */
export async function findUnfinished(): Promise<UnfinishedRide | null> {
  const active = await db.rides.where('status').equals('active').reverse().sortBy('startedAt')
  const ride = active[0]
  if (!ride) return null
  const last = await db.samples
    .where('[rideId+t]')
    .between([ride.id, Dexie.minKey], [ride.id, Dexie.maxKey])
    .last()
  if (!last) {
    // Nothing was recorded; close it quietly.
    await endRide(ride.id, ride.startedAt)
    return null
  }
  return { ride, last }
}
