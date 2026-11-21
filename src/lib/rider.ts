/**
 * Who is riding. One rider per browser today, with no name and no picker:
 * just an id that every saved ride, course and workout is stamped with.
 * It is the groundwork for more than one rider on a browser, and for an
 * optional sign-in later (an account would map to this id).
 *
 * The list lives in localStorage. The saved records in IndexedDB carry the
 * id too, so if the list is lost and the records are not, the id is taken
 * back from them and nothing is orphaned.
 */

const KEY = 'ww.riders'
const LOCK = 'ww.riders'

export interface Rider {
  id: string
  createdAt: number
}

interface Riders {
  /** The rider using this browser now. Always one of `riders`. */
  current: string
  riders: Rider[]
}

/** What an id may look like: ours are UUIDs, and one may come from a backup file. */
export const isRiderId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v)

function newRiderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // An old browser or a page not served over https: still unique enough for one browser's list.
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** The saved list, checked field by field. Null when there is none or it can't be read. */
function read(): Riders | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const v = JSON.parse(raw) as { current?: unknown; riders?: unknown }
    if (typeof v !== 'object' || v === null || !Array.isArray(v.riders)) return null
    const riders: Rider[] = []
    for (const r of v.riders as { id?: unknown; createdAt?: unknown }[]) {
      if (r && isRiderId(r.id) && !riders.some((x) => x.id === r.id)) {
        riders.push({ id: r.id, createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0 })
      }
    }
    if (!isRiderId(v.current) || !riders.some((r) => r.id === v.current)) return null
    return { current: v.current, riders }
  } catch {
    return null
  }
}

function write(v: Riders): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // storage unavailable: the id holds for this page, and is taken back from the saved records next time
  }
}

/** One tab at a time, so two tabs opened together can't each make a rider. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? (locks.request(LOCK, fn) as Promise<T>) : fn()
}

/**
 * The current rider's id, made on the first visit. `idsInSavedRecords` lists
 * the rider ids already stamped on saved records, most used first: when the
 * list is gone but the records are not, the first of them is taken back.
 */
export function resolveRider(idsInSavedRecords: () => Promise<string[]>): Promise<string> {
  return locked(async () => {
    const saved = read()
    if (saved) return saved.current
    let id: string | undefined
    try {
      id = (await idsInSavedRecords()).find(isRiderId)
    } catch (err) {
      console.error('Could not look for a rider in the saved records:', err)
    }
    id ??= newRiderId()
    write({ current: id, riders: [{ id, createdAt: Date.now() }] })
    return id
  })
}

/** Every rider this browser knows. A saved record stamped with any other id belongs to nobody here. */
export function knownRiderIds(): string[] {
  return read()?.riders.map((r) => r.id) ?? []
}

/**
 * Give the current rider another id: the one from a backup, restored into a
 * browser that has nothing saved yet. So a rider keeps one identity across a
 * wipe or a move to another computer.
 */
export function renameCurrentRider(id: string): void {
  if (!isRiderId(id)) return
  const saved = read()
  if (!saved) {
    write({ current: id, riders: [{ id, createdAt: Date.now() }] })
    return
  }
  if (saved.current === id) return
  const riders = saved.riders.filter((r) => r.id !== id).map((r) => (r.id === saved.current ? { ...r, id } : r))
  write({ current: id, riders })
}

/** The current rider as saved, for a backup. Null before the first visit has made one. */
export function currentRider(): Rider | null {
  const saved = read()
  return saved?.riders.find((r) => r.id === saved.current) ?? null
}
