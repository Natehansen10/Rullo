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
}

class WeemWattsDB extends Dexie {
  rides!: EntityTable<RideRow, 'id'>
  samples!: Table<SampleRow, [number, number]>

  constructor() {
    super('weem-watts')
    this.version(1).stores({
      rides: '++id, status',
      samples: '[rideId+t], rideId',
    })
  }
}

const db = new WeemWattsDB()

export async function startRide(startedAt: number): Promise<number> {
  return db.rides.add({ startedAt, status: 'active' } as RideRow)
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

export async function getRide(id: number): Promise<RideRow | undefined> {
  return db.rides.get(id)
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
