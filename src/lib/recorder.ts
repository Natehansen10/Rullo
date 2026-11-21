/**
 * Per-second ride autosave to IndexedDB (Dexie).
 * Each sample is written as it is taken, so a crash or reload loses at most
 * the current second. Pattern informed by Croissant Ride recorder.ts (Apache-2.0).
 * No code copied.
 */
import Dexie, { type EntityTable, type Table } from 'dexie'
import { currentRider, knownRiderIds, renameCurrentRider, resolveRider } from './rider'

export interface RideRow {
  id: number
  startedAt: number
  endedAt?: number
  status: 'active' | 'ended'
  /**
   * The rider this belongs to (see rider.ts). Not indexed: no database change.
   * Records saved before riders existed get the current rider's id on the next load.
   */
  riderId?: string
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
  /** Heart rate in bpm, only when the sensor gave a fresh reading for this second. Never carried forward, never 0. */
  heartRateBpm?: number
}

/** A GPX the rider imported. Rebuilt into a Course on load. */
export interface ImportedCourseRow {
  id: string
  /** The rider this belongs to. */
  riderId?: string
  name: string
  gpx: string
  addedAt: number
}

/** A ZWO workout the rider imported. Parsed again on load. */
export interface ImportedWorkoutRow {
  id: string
  /** The rider this belongs to. */
  riderId?: string
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
  /** The rider this belongs to. */
  riderId?: string
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

// --- the rider who owns what is saved ---

type Owned = { riderId?: string }
const OWNED_TABLES = () => [db.rides, db.courses, db.workouts, db.customWorkouts] as unknown as Table<Owned>[]

/** Rider ids stamped on saved records, the one with the most rides first. */
async function riderIdsInRecords(): Promise<string[]> {
  const count = new Map<string, number>()
  for (const table of OWNED_TABLES()) {
    const rides = (table as unknown) === db.rides
    await table.each((row) => {
      if (typeof row.riderId === 'string') count.set(row.riderId, (count.get(row.riderId) ?? 0) + (rides ? 1000 : 1))
    })
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

/**
 * Give the rider every record that has no rider, or one this browser does not
 * know: rides saved before riders existed, and anything left by a list that
 * was lost. So no saved record can end up belonging to nobody. Only the
 * `riderId` field is written; rides, samples and files are otherwise untouched.
 */
async function claimStrays(riderId: string): Promise<void> {
  const known = new Set([riderId, ...knownRiderIds()])
  await db.transaction('rw', OWNED_TABLES(), async () => {
    for (const table of OWNED_TABLES()) {
      await table.filter((row) => row.riderId === undefined || !known.has(row.riderId)).modify({ riderId })
    }
  })
}

/**
 * The current rider's id. Every read below waits for it and returns only that
 * rider's records; every write is stamped with it. Resolved once per page
 * load, after the strays are claimed.
 */
let owner: Promise<string> = resolveRider(riderIdsInRecords)
  .catch((err) => {
    // Never let the rider lookup take the saved rides down with it: fall back to the saved rider, or a new one.
    console.error('Could not work out the rider:', err)
    return currentRider()?.id ?? `r-${Date.now().toString(36)}`
  })
  .then(async (id) => {
    try {
      await claimStrays(id)
    } catch (err) {
      // Unclaimed records still read as the rider's (see `mine`), so nothing is hidden.
      console.error('Could not stamp the saved records with their rider:', err)
    }
    return id
  })

/** A record is the rider's when it carries their id, or none at all. */
const mine =
  (riderId: string) =>
  (row: Owned): boolean =>
    row.riderId === undefined || row.riderId === riderId

export async function startRide(
  startedAt: number,
  courseId?: string,
  startOffsetM?: number,
  workoutId?: string,
  workoutSnapshot?: unknown,
): Promise<number> {
  const riderId = await owner
  return db.rides.add({
    startedAt,
    status: 'active',
    riderId,
    courseId,
    startOffsetM,
    workoutId,
    ...(workoutSnapshot !== undefined ? { workoutSnapshot } : {}),
  } as RideRow)
}

/** Where the most recent ride on this course ended (m along the course), if any. */
export async function lastPositionOn(courseId: string): Promise<number | null> {
  const me = await owner
  const rides = (await db.rides.where('courseId').equals(courseId).sortBy('startedAt')).filter(mine(me))
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
  await db.courses.put({ ...row, riderId: await owner })
}

export async function listImportedCourses(): Promise<ImportedCourseRow[]> {
  const me = await owner
  return (await db.courses.orderBy('addedAt').toArray()).filter(mine(me))
}

export async function deleteImportedCourse(id: string): Promise<void> {
  await db.courses.delete(id)
}

export async function saveImportedWorkout(row: ImportedWorkoutRow): Promise<void> {
  await db.workouts.put({ ...row, riderId: await owner })
}

export async function listImportedWorkouts(): Promise<ImportedWorkoutRow[]> {
  const me = await owner
  return (await db.workouts.orderBy('addedAt').toArray()).filter(mine(me))
}

export async function deleteImportedWorkout(id: string): Promise<void> {
  await db.workouts.delete(id)
}

export async function saveCustomWorkout(row: CustomWorkoutRow): Promise<void> {
  await db.customWorkouts.put({ ...row, riderId: await owner })
}

export async function getCustomWorkout(id: string): Promise<CustomWorkoutRow | undefined> {
  const me = await owner
  const row = await db.customWorkouts.get(id)
  return row && mine(me)(row) ? row : undefined
}

export async function listCustomWorkouts(): Promise<CustomWorkoutRow[]> {
  const me = await owner
  return (await db.customWorkouts.orderBy('createdAt').toArray()).filter(mine(me))
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

/** One of the rider's rides. Another rider's ride reads as not there. */
export async function getRide(id: number): Promise<RideRow | undefined> {
  const me = await owner
  const ride = await db.rides.get(id)
  return ride && mine(me)(ride) ? ride : undefined
}

/** Every ride of the rider's that was ended, in no particular order. An unfinished ride (crash, reload) is not one of them. */
export async function listEndedRides(): Promise<RideRow[]> {
  const me = await owner
  return (await db.rides.where('status').equals('ended').toArray()).filter(mine(me))
}

/**
 * Delete a finished ride and every sample of it, in one transaction. Only an
 * ended ride: a ride in progress or waiting to be recovered is never touched.
 * Returns false when there was nothing to delete.
 */
export async function deleteEndedRide(id: number): Promise<boolean> {
  const me = await owner
  return db.transaction('rw', db.rides, db.samples, async () => {
    const ride = await db.rides.get(id)
    if (!ride || ride.status !== 'ended' || !mine(me)(ride)) return false
    await db.samples.where('[rideId+t]').between([id, Dexie.minKey], [id, Dexie.maxKey]).delete()
    await db.rides.delete(id)
    return true
  })
}

/** True when the rider has nothing saved at all: no ride (finished or not), course or workout. */
export async function nothingSaved(): Promise<boolean> {
  const me = await owner
  for (const table of OWNED_TABLES()) {
    if ((await table.filter(mine(me)).count()) > 0) return false
  }
  return true
}

/** True when no saved record carries this rider's id. For a rider who is not the one riding. */
export async function nothingSavedFor(riderId: string): Promise<boolean> {
  await owner
  for (const table of OWNED_TABLES()) {
    if ((await table.filter((row) => row.riderId === riderId).count()) > 0) return false
  }
  return true
}

/** Everything the rider has saved, for a backup: finished rides and their own files. */
export async function exportRows(): Promise<{
  rides: RideRow[]
  courses: ImportedCourseRow[]
  workouts: ImportedWorkoutRow[]
  customWorkouts: CustomWorkoutRow[]
}> {
  const [rides, courses, workouts, customWorkouts] = await Promise.all([
    listEndedRides(),
    listImportedCourses(),
    listImportedWorkouts(),
    listCustomWorkouts(),
  ])
  return { rides: rides.sort((a, b) => a.startedAt - b.startedAt), courses, workouts, customWorkouts }
}

export interface ImportRows {
  rides: { ride: Omit<RideRow, 'id'>; samples: Omit<SampleRow, 'rideId'>[] }[]
  courses: ImportedCourseRow[]
  workouts: ImportedWorkoutRow[]
  customWorkouts: CustomWorkoutRow[]
}

export interface ImportCounts {
  rides: number
  courses: number
  workouts: number
  /** Already here, left as they were. */
  ridesKept: number
  filesKept: number
}

/**
 * Add what a backup holds and this browser does not. Nothing already saved is
 * changed or removed: a ride with the same start time, or a course or workout
 * with the same id, is left as it is. One transaction: all of it or none.
 *
 * Everything added is stamped with the current rider. `asRider` first gives
 * the current rider that id (the backup's own), for a browser with nothing
 * saved: the id is switched only once the rows are safely in.
 */
export async function importRows(input: ImportRows, asRider?: string): Promise<ImportCounts> {
  const me = asRider ?? (await owner)
  const counts = await db.transaction('rw', [db.rides, db.samples, db.courses, db.workouts, db.customWorkouts], async () => {
    const counts: ImportCounts = { rides: 0, courses: 0, workouts: 0, ridesKept: 0, filesKept: 0 }
    const have = new Set((await db.rides.toArray()).filter(mine(me)).map((r) => r.startedAt))
    for (const { ride, samples } of input.rides) {
      if (have.has(ride.startedAt)) {
        counts.ridesKept++
        continue
      }
      have.add(ride.startedAt)
      const id = await db.rides.add({ ...ride, status: 'ended', riderId: me } as RideRow)
      await db.samples.bulkPut(samples.map((s) => ({ ...s, rideId: id })))
      counts.rides++
    }
    for (const c of input.courses) {
      if (await db.courses.get(c.id)) counts.filesKept++
      else {
        await db.courses.put({ ...c, riderId: me })
        counts.courses++
      }
    }
    for (const w of input.workouts) {
      if (await db.workouts.get(w.id)) counts.filesKept++
      else {
        await db.workouts.put({ ...w, riderId: me })
        counts.workouts++
      }
    }
    for (const w of input.customWorkouts) {
      if (await db.customWorkouts.get(w.id)) counts.filesKept++
      else {
        await db.customWorkouts.put({ ...w, riderId: me })
        counts.workouts++
      }
    }
    return counts
  })
  if (asRider !== undefined) {
    renameCurrentRider(asRider)
    owner = Promise.resolve(asRider)
  }
  return counts
}

export interface UnfinishedRide {
  ride: RideRow
  last: SampleRow | null
}

/** The most recent ride that was never ended (crash, reload, closed tab). */
export async function findUnfinished(): Promise<UnfinishedRide | null> {
  const me = await owner
  const active = (await db.rides.where('status').equals('active').reverse().sortBy('startedAt')).filter(mine(me))
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
