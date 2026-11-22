/**
 * Getting to a Bluetooth device without the browser's device list.
 *
 * The device list ("rullo.vercel.app wants to pair") is drawn by the browser
 * and cannot be styled or replaced. What a page can do is not need it: a
 * browser with `navigator.bluetooth.getDevices()` hands back the devices this
 * site was already allowed to use, so the same trainer or sensor connects
 * again with no list. In Chrome and Edge that is still behind flags (read from
 * Chromium's source on Nov 22, 2026), so everything here is feature-detected
 * and the app works the same without it: the list opens, after Rullo's own
 * pairing step. See `docs/pairing.md`.
 *
 * Written from the Web Bluetooth spec. No code copied.
 */

export type PairKind = 'trainer' | 'heartRate'

/**
 * The id the browser gave the device that last connected. It means something
 * only to this site in this browser, so it is never written into a backup.
 * The trainer belongs to the room, so its key is shared by every rider here;
 * a heart rate sensor is worn, so its key moves with its rider (`RIDER_KEYS`).
 */
const KEYS: Record<PairKind, string> = { trainer: 'ww.trainerDeviceId', heartRate: 'ww.hrDeviceId' }

/** How long to wait for a remembered device to be heard before giving up on it. */
export const REMEMBERED_SEEN_TIMEOUT_MS = 10000

/** Remembered devices that failed since the page loaded: the next connect opens the list instead. */
const skipped = new Set<PairKind>()

export function rememberDevice(kind: PairKind, id: string): void {
  skipped.delete(kind)
  try {
    localStorage.setItem(KEYS[kind], id)
  } catch {
    // storage is full or off: the list opens next time, as before
  }
}

/** The remembered device did not connect: do not try it again until one is picked from the list. */
export function skipRemembered(kind: PairKind): void {
  skipped.add(kind)
}

/**
 * The device that connected last time, if the browser can hand it back
 * without the list. Null in a browser without `getDevices()`, when nothing is
 * remembered, when the permission is gone, or after it failed once.
 */
export async function rememberedDevice(kind: PairKind): Promise<BluetoothDevice | null> {
  if (skipped.has(kind)) return null
  try {
    const id = localStorage.getItem(KEYS[kind])
    if (!id || typeof navigator.bluetooth?.getDevices !== 'function') return null
    const devices = await navigator.bluetooth.getDevices()
    return devices.find((d) => d.id === id) ?? null
  } catch {
    return null
  }
}

/**
 * Wait until a remembered device is heard advertising, so the connect that
 * follows has something to reach. Rejects when it stays silent (asleep, out
 * of range, or held by another app). Where the browser cannot watch for a
 * device, returns at once and the connect is tried directly.
 */
export async function waitUntilSeen(device: BluetoothDevice, ms = REMEMBERED_SEEN_TIMEOUT_MS): Promise<void> {
  if (typeof device.watchAdvertisements !== 'function') return
  const stop = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Remembered device was not seen')), ms)
      device.addEventListener('advertisementreceived', () => resolve(), { once: true, signal: stop.signal })
      // Watching is refused on some systems: connect directly there.
      device.watchAdvertisements({ signal: stop.signal }).catch(() => resolve())
    })
  } finally {
    clearTimeout(timer)
    stop.abort()
  }
}
