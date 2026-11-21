/**
 * One finished ride in full, for its summary screen: the FIT writer's totals,
 * the power bests, time in each power zone and the per-second series for the
 * charts. Worked out from the saved samples each time the screen opens (about
 * 20 ms per hour ridden); nothing is stored.
 */
import { rideTotals, stoppedBetween, type RideTotals } from './fit'
import { bestsOf, type Bests } from './history'
import * as recorder from './recorder'
import { ZONES, zoneOfWatts } from './workout'

export interface RideDetail {
  ride: recorder.RideRow
  totals: RideTotals
  bests: Bests
  /** Seconds in each zone, Z1 first, at the FTP given. */
  zoneS: number[]
  /** One value per recorded second (moving time; pauses take no room). */
  powerW: number[]
  cadenceRpm: number[]
  /** Null for a second with no reading. All null when no sensor was connected. */
  heartRateBpm: (number | null)[]
  /** Course rides only. */
  altitudeM: (number | null)[]
  hasHeartRate: boolean
  hasAltitude: boolean
  /** Indexes where a new workout interval (FIT lap) starts. */
  lapStarts: number[]
  /** Indexes of the first second after a pause or a dropout. */
  stops: number[]
  /** The file name the FIT download gets. */
  samples: recorder.SampleRow[]
}

/** Null when there is no such finished ride, or it has no samples. */
export async function loadRideDetail(id: number, ftpW: number): Promise<RideDetail | null> {
  const ride = await recorder.getRide(id)
  if (!ride || ride.status !== 'ended') return null
  const samples = await recorder.getSamples(id)
  if (samples.length === 0) return null
  const zoneS = ZONES.map(() => 0)
  const lapStarts: number[] = []
  const stops: number[] = []
  samples.forEach((s, i) => {
    zoneS[zoneOfWatts(s.powerW, ftpW) - 1]++
    if (i > 0 && s.lap !== samples[i - 1].lap) lapStarts.push(i)
    if (i > 0 && stoppedBetween(samples[i - 1], s)) stops.push(i)
  })
  return {
    ride,
    totals: rideTotals(samples),
    bests: bestsOf(samples),
    zoneS,
    powerW: samples.map((s) => s.powerW),
    cadenceRpm: samples.map((s) => s.cadenceRpm),
    heartRateBpm: samples.map((s) => s.heartRateBpm ?? null),
    altitudeM: samples.map((s) => s.altitudeM ?? null),
    hasHeartRate: samples.some((s) => s.heartRateBpm !== undefined),
    hasAltitude: samples.some((s) => s.altitudeM !== undefined),
    lapStarts,
    stops,
    samples,
  }
}
