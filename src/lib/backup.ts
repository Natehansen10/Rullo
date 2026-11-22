/**
 * Back up and restore: everything the rider has saved in this browser, in one
 * JSON file. Browser storage can be wiped, so this is the stand-in for a
 * cloud account, and the file is the shape a sync would send later.
 *
 * Restore only adds. It never changes or removes a ride, course or workout
 * that is already here. A backup file is as untrusted as any imported file:
 * every field is checked before anything is written, and it is all written in
 * one transaction or not at all.
 */
import { customFromRow } from './customWorkouts'
import { MAX_GPX_BYTES } from './gpx'
import { normalizeProfile, PROFILE_LIMITS, type Profile } from './profile'
import * as recorder from './recorder'
import { cleanRiderName, currentRider, isRiderId, knownRiderIds, renameRider, type Rider } from './rider'
import type { CustomWorkoutRow, ImportedCourseRow, ImportedWorkoutRow, RideRow, SampleRow } from './recorder'
import { MAX_ZWO_BYTES } from './zwo'

/** The id stays as it was before the app was renamed Rullo, so every old backup still restores. Do not rename it. */
const FORMAT = 'weem-watts-backup'
/** 2 added `rider`. A version 1 file has none and restores the same way otherwise. */
const VERSION = 2
/** A backup bigger than this is refused before it is read (about 500 hours of riding). */
export const MAX_BACKUP_BYTES = 300 * 1024 * 1024
const MAX_RIDES = 20000
/** Samples in one ride: 48 hours at one a second. */
const MAX_SAMPLES = 48 * 3600
const MAX_FILES = 5000
const MAX_ID_CHARS = 200
const MAX_NAME_CHARS = 200
const MAX_SETTING_CHARS = 4000

const PROFILE_KEY = 'ww.profile'
/** Settings that travel with a backup. Each is restored only where this browser has none saved. */
const SETTING_KEYS = [PROFILE_KEY, 'ww.resistancePct', 'ww.mode', 'ww.gradeFeelPct', 'ww.ergW', 'ww.builderUnit', 'ww.builderList', 'ww.ftpHistory', 'ww.intervalSounds'] as const

/** Sample fields every sample has, then the ones only some rides have. Each is one column in the file. */
const REQUIRED = ['powerW', 'cadenceRpm', 'speedMps', 'distanceM'] as const
const OPTIONAL = ['courseM', 'altitudeM', 'lap', 'workoutS', 'pausedMs', 'heartRateBpm'] as const

interface BackupRide {
  startedAt: number
  endedAt: number
  courseId?: string
  startOffsetM?: number
  workoutId?: string
  workoutSnapshot?: unknown
  /** The rider's FTP when the ride started. Rides saved before Nov 22, 2026 have none. */
  ftpW?: number
  /** Columns, one value per sample. `t` is ms after the first sample's time `t0`. Optional columns hold null where a sample has none. */
  samples: { t0: number; t: number[] } & Record<string, unknown>
}

interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: number
  /** Whose backup this is. Rows in the file carry no rider of their own: they are all this rider's. */
  rider: Rider | null
  settings: Record<string, string>
  rides: BackupRide[]
  courses: ImportedCourseRow[]
  workouts: ImportedWorkoutRow[]
  customWorkouts: CustomWorkoutRow[]
}

export interface BackupCounts {
  rides: number
  courses: number
  workouts: number
}

function columns(samples: SampleRow[]): BackupRide['samples'] {
  const t0 = samples[0]?.t ?? 0
  const out: BackupRide['samples'] = { t0, t: samples.map((s) => s.t - t0) }
  for (const k of REQUIRED) out[k] = samples.map((s) => s[k])
  for (const k of OPTIONAL) if (samples.some((s) => s[k] !== undefined)) out[k] = samples.map((s) => s[k] ?? null)
  return out
}

/** Read everything saved and build the backup. Rides with no samples are left out. */
export async function buildBackup(): Promise<{ file: BackupFile; counts: BackupCounts }> {
  const rows = await recorder.exportRows()
  const rides: BackupRide[] = []
  for (const r of rows.rides) {
    const samples = await recorder.getSamples(r.id)
    if (samples.length === 0) continue
    rides.push({
      startedAt: r.startedAt,
      endedAt: r.endedAt ?? samples[samples.length - 1].t + 1000,
      ...(r.courseId !== undefined ? { courseId: r.courseId } : {}),
      ...(r.startOffsetM !== undefined ? { startOffsetM: r.startOffsetM } : {}),
      ...(r.workoutId !== undefined ? { workoutId: r.workoutId } : {}),
      ...(r.workoutSnapshot !== undefined ? { workoutSnapshot: r.workoutSnapshot } : {}),
      ...(r.ftpW !== undefined ? { ftpW: r.ftpW } : {}),
      samples: columns(samples),
    })
  }
  const settings: Record<string, string> = {}
  for (const k of SETTING_KEYS) {
    try {
      const v = localStorage.getItem(k)
      if (v !== null) settings[k] = v
    } catch {
      // storage unavailable: the backup goes without settings
    }
  }
  return {
    file: {
      format: FORMAT,
      version: VERSION,
      exportedAt: Date.now(),
      rider: currentRider(),
      settings,
      rides,
      courses: rows.courses.map((c) => ({ id: c.id, name: c.name, gpx: c.gpx, addedAt: c.addedAt })),
      workouts: rows.workouts.map((w) => ({ id: w.id, name: w.name, zwo: w.zwo, addedAt: w.addedAt })),
      customWorkouts: rows.customWorkouts.map((w) => ({ id: w.id, name: w.name, description: w.description, tag: w.tag, steps: w.steps, createdAt: w.createdAt, updatedAt: w.updatedAt, v: 1 as const })),
    },
    counts: { rides: rides.length, courses: rows.courses.length, workouts: rows.workouts.length + rows.customWorkouts.length },
  }
}

export function backupFileName(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `rullo-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

/** When this rider last pressed Back up on this browser. Per rider: it is in `RIDER_KEYS`. */
const LAST_BACKUP_KEY = 'ww.lastBackupAt'

/** The time of the rider's last backup from this browser, or null when there has been none. */
export function lastBackupAt(): number | null {
  try {
    const t = Number(localStorage.getItem(LAST_BACKUP_KEY))
    return Number.isFinite(t) && t > 0 ? t : null
  } catch {
    return null
  }
}

function noteBackupAt(t: number): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(t))
  } catch {
    // storage unavailable: nothing to note it in
  }
}

/** From this many rides with no backup, Home and the Profile tab say so. */
export const BACKUP_NUDGE_RIDES = 5

/** How many of these rides started after the rider's last backup: all of them when there has been none. */
export function ridesSinceBackup(rides: { startedAt: number }[], at: number | null = lastBackupAt()): number {
  return at === null ? rides.length : rides.filter((r) => r.startedAt > at).length
}

/** Build the backup and hand it to the browser as a download. */
export async function downloadBackup(): Promise<BackupCounts> {
  const { file, counts } = await buildBackup()
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(file.exportedAt)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  noteBackupAt(file.exportedAt)
  return counts
}

// --- reading a backup ---

const BAD = 'This is not a Rullo backup, or the file is damaged.'
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const isId = (v: unknown): v is string => isText(v, MAX_ID_CHARS) && v.length > 0

function list(v: unknown, max: number): unknown[] {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > max) throw new Error(BAD)
  return v
}

function readRide(v: unknown): ImportRide {
  if (!isObject(v) || !isNum(v.startedAt) || !isNum(v.endedAt) || !isObject(v.samples)) throw new Error(BAD)
  const c = v.samples
  const t = c.t
  if (!isNum(c.t0) || !Array.isArray(t) || t.length === 0 || t.length > MAX_SAMPLES) throw new Error(BAD)
  const n = t.length
  const column = (k: string, optional: boolean): unknown[] | null => {
    const col = c[k]
    if (col === undefined && optional) return null
    if (!Array.isArray(col) || col.length !== n) throw new Error(BAD)
    return col
  }
  const required = REQUIRED.map((k) => column(k, false) as unknown[])
  const optional = OPTIONAL.map((k) => column(k, true))
  const samples: Omit<SampleRow, 'rideId'>[] = []
  let last = -1
  for (let i = 0; i < n; i++) {
    const dt = t[i]
    // Whole milliseconds, each later than the one before: the sample's key is its time.
    if (!isNum(dt) || dt <= last) throw new Error(BAD)
    last = dt
    const s: Record<string, number> = { t: c.t0 + dt }
    REQUIRED.forEach((k, j) => {
      const x = required[j][i]
      if (!isNum(x) || x < 0) throw new Error(BAD)
      s[k] = x
    })
    OPTIONAL.forEach((k, j) => {
      const x = optional[j]?.[i]
      if (x === null || x === undefined) return
      if (!isNum(x)) throw new Error(BAD)
      s[k] = x
    })
    samples.push(s as unknown as Omit<SampleRow, 'rideId'>)
  }
  const ride: Omit<RideRow, 'id'> = { startedAt: v.startedAt, endedAt: v.endedAt, status: 'ended' }
  if (v.courseId !== undefined) {
    if (!isId(v.courseId)) throw new Error(BAD)
    ride.courseId = v.courseId
  }
  if (v.workoutId !== undefined) {
    if (!isId(v.workoutId)) throw new Error(BAD)
    ride.workoutId = v.workoutId
  }
  if (v.startOffsetM !== undefined) {
    if (!isNum(v.startOffsetM) || v.startOffsetM < 0) throw new Error(BAD)
    ride.startOffsetM = v.startOffsetM
  }
  // Kept as it came: the app already treats a ride's workout copy as untrusted when it reads it.
  if (isObject(v.workoutSnapshot)) ride.workoutSnapshot = v.workoutSnapshot
  // A ride with no FTP, or one out of range, simply has none: its zones then use the FTP of the day it is looked at.
  if (isNum(v.ftpW) && v.ftpW >= PROFILE_LIMITS.ftpW[0] && v.ftpW <= PROFILE_LIMITS.ftpW[1]) ride.ftpW = Math.round(v.ftpW)
  return { ride, samples }
}

type ImportRide = recorder.ImportRows['rides'][number]

function readCourse(v: unknown): ImportedCourseRow {
  if (!isObject(v) || !isId(v.id) || !isText(v.name, MAX_NAME_CHARS) || !isText(v.gpx, MAX_GPX_BYTES) || !isNum(v.addedAt)) throw new Error(BAD)
  return { id: v.id, name: v.name, gpx: v.gpx, addedAt: v.addedAt }
}

function readWorkout(v: unknown): ImportedWorkoutRow {
  if (!isObject(v) || !isId(v.id) || !isText(v.name, MAX_NAME_CHARS) || !isText(v.zwo, MAX_ZWO_BYTES) || !isNum(v.addedAt)) throw new Error(BAD)
  return { id: v.id, name: v.name, zwo: v.zwo, addedAt: v.addedAt }
}

function readCustom(v: unknown): CustomWorkoutRow {
  if (!isObject(v) || !isId(v.id) || !isNum(v.createdAt) || !isNum(v.updatedAt)) throw new Error(BAD)
  // The same checks a stored workout gets on every load. It throws on a step list that can't be ridden.
  const w = customFromRow({ id: v.id, name: v.name, description: v.description, tag: v.tag, steps: v.steps })
  return { id: v.id, name: w.name, description: w.description, tag: w.tag ?? 'medium', steps: w.steps, createdAt: v.createdAt, updatedAt: v.updatedAt, v: 1 }
}

/** Check a parsed backup from top to bottom. Throws with a rider-facing message; writes nothing. */
export function readBackup(data: unknown): { rows: recorder.ImportRows; settings: Record<string, string>; riderId: string | null; riderName: string } {
  if (!isObject(data) || data.format !== FORMAT || !isNum(data.version)) throw new Error(BAD)
  if (data.version > VERSION) throw new Error('This backup was made by a newer Rullo. Reload the app to update it, then restore again.')
  const settings: Record<string, string> = {}
  if (isObject(data.settings)) {
    for (const k of SETTING_KEYS) {
      const v = data.settings[k]
      if (isText(v, MAX_SETTING_CHARS)) settings[k] = v
    }
  }
  return {
    rows: {
      rides: list(data.rides, MAX_RIDES).map(readRide),
      courses: list(data.courses, MAX_FILES).map(readCourse),
      workouts: list(data.workouts, MAX_FILES).map(readWorkout),
      // A built workout that can no longer be ridden is left out, as the app's own list leaves it out.
      customWorkouts: list(data.customWorkouts, MAX_FILES).flatMap((v) => {
        try {
          return [readCustom(v)]
        } catch {
          return []
        }
      }),
    },
    settings,
    riderId: isObject(data.rider) && isRiderId(data.rider.id) ? data.rider.id : null,
    riderName: isObject(data.rider) ? cleanRiderName(data.rider.name) : '',
  }
}

export interface RestoreResult extends recorder.ImportCounts {
  /** The backup's profile, when this browser had none saved. The caller applies it. */
  profile: Profile | null
}

/**
 * Restore from a backup file. Adds the rides, courses and workouts this
 * browser does not have; leaves everything already here alone. Settings,
 * the profile among them, are restored only where none is saved here.
 */
export async function restoreBackup(file: File): Promise<RestoreResult> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('The file is too large to be a backup (limit 300 MB).')
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error(BAD)
  }
  const { rows, settings, riderId, riderName } = readBackup(data)
  // A rider with nothing saved takes on the backup's rider, so a rider stays one rider across a wipe or a new
  // computer. A browser that already has rides keeps its own, and what is restored joins it.
  // Not when another rider on this browser already has that id: then the rows simply join whoever is riding.
  const adopt = riderId !== null && !knownRiderIds().includes(riderId) && (await recorder.nothingSaved()) ? riderId : undefined
  // With nothing saved here before, every ride after the restore is in this file: the file is the last backup.
  const wasEmpty = await recorder.nothingSaved()
  const counts = await recorder.importRows(rows, adopt)
  const exportedAt = isObject(data) ? data.exportedAt : null
  if (wasEmpty && isNum(exportedAt) && exportedAt > 0 && exportedAt <= Date.now() && lastBackupAt() === null) noteBackupAt(exportedAt)
  // The name comes along with the id, unless another rider here has it.
  if (adopt && riderName) renameRider(adopt, riderName)
  let profile: Profile | null = null
  for (const [k, v] of Object.entries(settings)) {
    try {
      if (localStorage.getItem(k) !== null) continue
      if (k === PROFILE_KEY) {
        // Through the profile's own clamps, and saved by the caller the way an edit is.
        profile = normalizeProfile(JSON.parse(v) as Partial<Profile>)
        continue
      }
      localStorage.setItem(k, v)
    } catch {
      // storage unavailable or a setting that is not JSON: skip it
    }
  }
  return { ...counts, profile }
}
