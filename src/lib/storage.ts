/**
 * What the browser says about this site's storage: how much is used, and
 * whether it has promised not to clear it on its own. Rides, courses and
 * workouts all live here, so the Profile tab shows both.
 *
 * A browser may clear a site's data when the disk runs low unless the site
 * has been granted persistent storage. Chrome and Edge decide that without
 * asking the rider (how they decide is not documented, so the app only reports
 * the answer); other browsers may show a prompt, so it is only ever
 * asked for from a button.
 */

export interface StorageStatus {
  /** Bytes this site uses, or null when the browser will not say. */
  usedBytes: number | null
  /** True: the browser will not clear this site on its own. False: it may. Null: it will not say. */
  kept: boolean | null
}

export async function storageStatus(): Promise<StorageStatus> {
  const out: StorageStatus = { usedBytes: null, kept: null }
  try {
    const est = await navigator.storage?.estimate?.()
    if (est && typeof est.usage === 'number') out.usedBytes = est.usage
  } catch {
    // not available: say nothing about size
  }
  try {
    const kept = await navigator.storage?.persisted?.()
    if (typeof kept === 'boolean') out.kept = kept
  } catch {
    // not available: say nothing about the promise
  }
  return out
}

/** Ask the browser to keep this site's data. Returns its answer: false is a no, null is no answer. */
export async function askToKeep(): Promise<boolean | null> {
  try {
    const kept = await navigator.storage?.persist?.()
    return typeof kept === 'boolean' ? kept : null
  } catch {
    return null
  }
}

/** "0.4 MB", "12 MB", "1.2 GB". */
export function formatBytes(n: number): string {
  const mb = n / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}
