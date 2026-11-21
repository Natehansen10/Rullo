/**
 * Heart rate sensor over the standard Bluetooth Heart Rate service (0x180D),
 * Heart Rate Measurement (0x2A37, notify). Written from the Bluetooth SIG
 * Heart Rate Service 1.0 spec. Any strap, armband or watch relay app that
 * shows up as a standard sensor works the same way.
 *
 * This is a second device, separate from the trainer: its own picker, its own
 * connection and its own reconnect loop (same pattern as ble.ts). Nothing here
 * touches the trainer.
 */
import { RECONNECT_INTERVAL_MS, RECONNECT_MAX_TRIES } from '../config'
import { GATT_CONNECT_TIMEOUT_MS, sleep, withTimeout } from './ble'

export const HEART_RATE_SERVICE = 0x180d
export const HEART_RATE_MEASUREMENT = 0x2a37

/** Values outside this range are not a heart rate (0 is what a strap sends with no skin contact). */
const MIN_BPM = 20
const MAX_BPM = 250

export type HeartRateStatus = 'off' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

export interface HeartRateHandlers {
  onBpm: (t: number, bpm: number) => void
  onStatus: (s: HeartRateStatus) => void
}

export interface HeartRateSensor {
  /** Must be called from a click the first time (device picker). */
  connect(): Promise<void>
  /** Rider-initiated. Stops any reconnect loop. */
  disconnect(): void
}

/**
 * Parse a Heart Rate Measurement (0x2A37) packet. Returns bpm, or null when
 * the packet carries no usable value.
 *
 * Byte 0 is the flags. Bit 0: 0 = the value is one byte (uint8), 1 = two
 * bytes (uint16, little-endian). Bits 1 to 2: sensor contact (2 = contact
 * is supported and not detected, so the value is not a reading). Bit 3:
 * energy expended follows. Bit 4: RR intervals follow. Both come after the
 * value and are ignored. A packet shorter than its flags claim is dropped.
 */
export function parseHeartRate(view: DataView): number | null {
  if (view.byteLength < 2) return null
  const flags = view.getUint8(0)
  const wide = (flags & 0x01) !== 0
  if (wide && view.byteLength < 3) return null
  if (((flags >> 1) & 0x03) === 2) return null
  const bpm = wide ? view.getUint16(1, true) : view.getUint8(1)
  return bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null
}

/** Kept in memory so a reconnect, or a second connect in the same tab, skips the picker. Chrome cannot restore it after a reload. */
let device: BluetoothDevice | null = null

export function createBleHeartRate(h: HeartRateHandlers): HeartRateSensor {
  let userClosed = true
  let generation = 0

  const onDisconnected = () => {
    if (userClosed) {
      h.onStatus('off')
      return
    }
    void reconnectLoop(++generation)
  }

  async function setup(): Promise<void> {
    if (!device?.gatt) throw new Error('No heart rate sensor selected')
    const server = await withTimeout(device.gatt.connect(), GATT_CONNECT_TIMEOUT_MS)
    const service = await server.getPrimaryService(HEART_RATE_SERVICE)
    const meas = await service.getCharacteristic(HEART_RATE_MEASUREMENT)
    meas.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value
      const bpm = v ? parseHeartRate(v) : null
      if (bpm !== null) h.onBpm(Date.now(), bpm)
    })
    await meas.startNotifications()
    h.onStatus('connected')
  }

  async function reconnectLoop(gen: number): Promise<void> {
    for (let attempt = 1; attempt <= RECONNECT_MAX_TRIES; attempt++) {
      if (gen !== generation || userClosed) return
      h.onStatus('reconnecting')
      await sleep(RECONNECT_INTERVAL_MS)
      if (gen !== generation || userClosed) return
      try {
        await setup()
        return
      } catch (err) {
        console.warn(`Heart rate reconnect attempt ${attempt} failed:`, err)
      }
    }
    if (gen === generation && !userClosed) {
      userClosed = true
      h.onStatus('failed')
    }
  }

  return {
    async connect() {
      userClosed = false
      generation++
      h.onStatus('connecting')
      try {
        if (!device) {
          device = await navigator.bluetooth.requestDevice({ filters: [{ services: [HEART_RATE_SERVICE] }] })
        }
        device.removeEventListener('gattserverdisconnected', onDisconnected)
        device.addEventListener('gattserverdisconnected', onDisconnected)
        await setup()
      } catch (err) {
        userClosed = true
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          // The rider closed the picker without choosing.
          h.onStatus('off')
          return
        }
        console.warn('Heart rate connect failed:', err)
        if (device?.gatt?.connected) device.gatt.disconnect()
        // Pick again next time: the remembered device may be the wrong one, or gone.
        device = null
        h.onStatus('failed')
      }
    },
    disconnect() {
      userClosed = true
      generation++
      if (device?.gatt?.connected) device.gatt.disconnect()
      else h.onStatus('off')
    },
  }
}
