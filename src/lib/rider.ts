/**
 * Who is riding. A browser can hold more than one rider (a shared trainer):
 * each has a name and an id, and every saved ride, course and workout is
 * stamped with its rider's id. No passwords: picking a rider is a click.
 * An optional sign-in later would map an account to this id.
 *
 * The list lives in localStorage. The saved records in IndexedDB carry the
 * ids too, so if the list is lost and the records are not, it is rebuilt
 * from them and nothing is orphaned.
 *
 * The profile and the settings stay in their own localStorage keys, as
 * before, and those keys always hold the current rider's. Switching riders
 * puts the old rider's away and the new rider's in their place, then the
 * page reloads, so no other code has to know about riders.
 */

const KEY = 'ww.riders'
const LOCK = 'ww.riders'
/** Each rider's saved ride summaries (history.ts) live under this plus the rider's id. */
export const SUMMARIES_KEY_PREFIX = 'ww.rideSummaries.v3.'
/** Where a rider's profile and settings are kept while someone else is riding: this plus the rider's id. */
const STASH = 'ww.riderSettings.'
/** The keys that belong to a rider and move with them. */
const RIDER_KEYS = [
  'ww.profile',
  'ww.resistancePct',
  'ww.mode',
  'ww.gradeFeelPct',
  'ww.ergW',
  'ww.stagedCourseId',
  'ww.stagedWorkoutId',
  'ww.workoutDraft',
  'ww.builderUnit',
  'ww.builderList',
] as const

export const MAX_RIDER_NAME_CHARS = 30
export const MAX_RIDERS = 12

export interface Rider {
  id: string
  name: string
  createdAt: number
}

export interface Riders {
  /** The rider using this browser now. Always one of `riders`. */
  current: string
  riders: Rider[]
}

/** What an id may look like: ours are UUIDs, and one may come from a backup file. */
export const isRiderId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v)

/** A name as typed or read from a file: one line, trimmed, capped. Empty when there is nothing usable. */
export function cleanRiderName(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_RIDER_NAME_CHARS) : ''
}

function newRiderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // An old browser or a page not served over https: still unique enough for one browser's list.
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** "Rider 2" for the second rider, "Rider 3" for the third: their place in the list, moved up if that name is taken. */
function defaultName(riders: Rider[]): string {
  for (let n = riders.length + 1; ; n++) {
    const name = `Rider ${n}`
    if (!riders.some((r) => r.name === name)) return name
  }
}

/** The saved list, checked field by field. Null when there is none or it can't be read. */
function read(): Riders | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const v = JSON.parse(raw) as { current?: unknown; riders?: unknown }
    if (typeof v !== 'object' || v === null || !Array.isArray(v.riders)) return null
    const riders: Rider[] = []
    for (const r of v.riders as { id?: unknown; name?: unknown; createdAt?: unknown }[]) {
      if (r && isRiderId(r.id) && !riders.some((x) => x.id === r.id) && riders.length < MAX_RIDERS) {
        riders.push({
          id: r.id,
          // A list saved before riders had names: the rider gets one.
          name: cleanRiderName(r.name) || defaultName(riders),
          createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0,
        })
      }
    }
    if (!isRiderId(v.current) || !riders.some((r) => r.id === v.current)) return null
    return { current: v.current, riders }
  } catch {
    return null
  }
}

function write(v: Riders): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
    return true
  } catch {
    // storage unavailable: the id holds for this page, and is taken back from the saved records next time
    return false
  }
}

/** One tab at a time, so two tabs opened together can't each make a rider. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? (locks.request(LOCK, fn) as Promise<T>) : fn()
}

/**
 * The current rider's id, made on the first visit. `idsInSavedRecords` lists
 * the rider ids already stamped on saved records, most used first. When the
 * list is gone but the records are not, it is rebuilt with every one of them
 * (so two riders stay two), and the one with the most rides is riding.
 */
export function resolveRider(idsInSavedRecords: () => Promise<string[]>): Promise<string> {
  return locked(async () => {
    const saved = read()
    if (saved) return saved.current
    let ids: string[] = []
    try {
      ids = (await idsInSavedRecords()).filter(isRiderId).slice(0, MAX_RIDERS)
    } catch (err) {
      console.error('Could not look for riders in the saved records:', err)
    }
    if (ids.length === 0) ids = [newRiderId()]
    const riders: Rider[] = []
    for (const id of ids) riders.push({ id, name: defaultName(riders), createdAt: Date.now() })
    write({ current: ids[0], riders })
    return ids[0]
  })
}

/** Every rider this browser knows. A saved record stamped with any other id belongs to nobody here. */
export function knownRiderIds(): string[] {
  return read()?.riders.map((r) => r.id) ?? []
}

/** The list, for the rider picker. Null before the first visit has made a rider. */
export function listRiders(): Riders | null {
  return read()
}

/** The current rider as saved. Null before the first visit has made one. */
export function currentRider(): Rider | null {
  const saved = read()
  return saved?.riders.find((r) => r.id === saved.current) ?? null
}

/** Rename a rider. An empty name is refused, and so is one another rider has. Returns whether it was saved. */
export function renameRider(id: string, name: string): boolean {
  const saved = read()
  const clean = cleanRiderName(name)
  if (!saved || !clean || saved.riders.some((r) => r.id !== id && r.name.toLowerCase() === clean.toLowerCase())) return false
  return write({ ...saved, riders: saved.riders.map((r) => (r.id === id ? { ...r, name: clean } : r)) })
}

/**
 * Give the current rider another id: the one from a backup, restored into a
 * rider that has nothing saved yet. So a person keeps one identity across a
 * wipe or a move to another computer. Refused when another rider here
 * already has that id.
 */
export function renameCurrentRider(id: string): void {
  if (!isRiderId(id)) return
  const saved = read()
  if (!saved) {
    write({ current: id, riders: [{ id, name: 'Rider 1', createdAt: Date.now() }] })
    return
  }
  if (saved.current === id || saved.riders.some((r) => r.id === id)) return
  const old = saved.current
  if (!write({ current: id, riders: saved.riders.map((r) => (r.id === old ? { ...r, id } : r)) })) return
  try {
    // Their put-away settings, if any, follow the id.
    const stash = localStorage.getItem(STASH + old)
    if (stash !== null) {
      localStorage.setItem(STASH + id, stash)
      localStorage.removeItem(STASH + old)
    }
  } catch {
    // storage unavailable
  }
}

/** Put the current rider's profile and settings away under their id. */
function stashSettings(id: string): void {
  const kept: Record<string, string> = {}
  for (const k of RIDER_KEYS) {
    const v = localStorage.getItem(k)
    if (v !== null) kept[k] = v
  }
  localStorage.setItem(STASH + id, JSON.stringify(kept))
}

/** Bring a rider's profile and settings back into place. A rider with none put away starts from the defaults. */
function unstashSettings(id: string): void {
  let kept: Record<string, unknown> = {}
  try {
    const raw = localStorage.getItem(STASH + id)
    const parsed = raw === null ? null : (JSON.parse(raw) as unknown)
    if (typeof parsed === 'object' && parsed !== null) kept = parsed as Record<string, unknown>
  } catch {
    // unreadable: defaults
  }
  for (const k of RIDER_KEYS) {
    const v = kept[k]
    if (typeof v === 'string') localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  }
  localStorage.removeItem(STASH + id)
}

/**
 * Make `id` the rider. Their profile and settings take the place of the
 * current rider's, which are put away. The caller reloads the page right
 * after, so everything is read again for the new rider. Returns false, with
 * nothing changed, when it can't be done.
 */
export function switchRider(id: string): boolean {
  const saved = read()
  if (!saved || !saved.riders.some((r) => r.id === id)) return false
  if (saved.current === id) return true
  try {
    stashSettings(saved.current)
    unstashSettings(id)
    localStorage.setItem(KEY, JSON.stringify({ ...saved, current: id }))
    return true
  } catch (err) {
    console.error('Could not switch riders:', err)
    return false
  }
}

/** Add a rider and return their id, or null when the list is full or the name is taken. They are not riding yet: switchRider does that. */
export function addRider(name?: string): string | null {
  const saved = read()
  if (!saved || saved.riders.length >= MAX_RIDERS) return null
  const clean = cleanRiderName(name) || defaultName(saved.riders)
  if (saved.riders.some((r) => r.name.toLowerCase() === clean.toLowerCase())) return null
  const id = newRiderId()
  return write({ ...saved, riders: [...saved.riders, { id, name: clean, createdAt: Date.now() }] }) ? id : null
}

/**
 * Take a rider off the list, with their put-away profile and settings. Never
 * the current rider. The caller has checked that they have nothing saved: a
 * rider's rides are never deleted this way.
 */
export function removeRider(id: string): boolean {
  const saved = read()
  if (!saved || saved.current === id || !saved.riders.some((r) => r.id === id)) return false
  if (!write({ ...saved, riders: saved.riders.filter((r) => r.id !== id) })) return false
  try {
    localStorage.removeItem(STASH + id)
    localStorage.removeItem(SUMMARIES_KEY_PREFIX + id)
  } catch {
    // storage unavailable
  }
  return true
}

/** Call `fn` when another tab changes who is riding. Returns the way to stop listening. */
export function onRiderChanged(fn: () => void): () => void {
  const mine = read()?.current
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    const now = read()?.current
    if (now && now !== mine) fn()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
