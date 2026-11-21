/**
 * Web Bluetooth trainer connection: FTMS first, Cycling Power as fallback.
 *
 * The device object is kept in memory, so reconnects (and a second ride in the
 * same tab) skip the device picker. Chrome cannot restore it after a page reload.
 * Reconnect loop pattern informed by Croissant Ride ble.ts (Apache-2.0). No code copied.
 */
import { CRR, ERG_RELEASE_W, RECONNECT_INTERVAL_MS, RECONNECT_MAX_TRIES } from '../config'
import { CYCLING_POWER_MEASUREMENT, CYCLING_POWER_SERVICE, CyclingPowerParser } from './cyclingPower'
import {
  CONTROL_POINT,
  ControlPointError,
  DEFAULT_RESISTANCE_RANGE,
  encodePower,
  encodeResistance,
  encodeSimulation,
  FTMS_SERVICE,
  FtmsControlPoint,
  INDOOR_BIKE_DATA,
  OP_REQUEST_CONTROL,
  OP_RESET,
  OP_SET_SIMULATION,
  OP_SET_TARGET_POWER,
  OP_SET_TARGET_RESISTANCE,
  parseIndoorBikeData,
  parseResistanceRange,
  percentToLevel,
  RESULT_CONTROL_NOT_PERMITTED,
  RESULT_INVALID_PARAMETER,
  RESULT_NOT_SUPPORTED,
  SUPPORTED_RESISTANCE_RANGE,
  type ResistanceRange,
} from './ftms'
import type { ControlResult, Trainer, TrainerHandlers } from './types'

export const GATT_CONNECT_TIMEOUT_MS = 10000

let device: BluetoothDevice | null = null

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export function createBleTrainer(h: TrainerHandlers): Trainer {
  let userClosed = false
  let generation = 0
  let controlPoint: FtmsControlPoint | null = null
  let resistanceRange: ResistanceRange = DEFAULT_RESISTANCE_RANGE
  let resistanceFormat: 'sint16' | 'uint8' = 'sint16'
  let formatSettled = false
  const cps = new CyclingPowerParser()

  const onDisconnected = () => {
    controlPoint?.stop()
    controlPoint = null
    if (userClosed) {
      h.onStatus({ kind: 'disconnected' })
      return
    }
    void reconnectLoop(++generation)
  }

  async function setup(): Promise<void> {
    if (!device?.gatt) throw new Error('No trainer selected')
    const server = await withTimeout(device.gatt.connect(), GATT_CONNECT_TIMEOUT_MS)

    let ftms: BluetoothRemoteGATTService | null = null
    try {
      ftms = await server.getPrimaryService(FTMS_SERVICE)
    } catch {
      ftms = null
    }

    if (ftms) {
      const data = await ftms.getCharacteristic(INDOOR_BIKE_DATA)
      data.addEventListener('characteristicvaluechanged', (e) => {
        const v = (e.target as BluetoothRemoteGATTCharacteristic).value
        if (v && v.byteLength >= 2) h.onReading(parseIndoorBikeData(v, Date.now()))
      })
      await data.startNotifications()

      try {
        const range = parseResistanceRange(
          await (await ftms.getCharacteristic(SUPPORTED_RESISTANCE_RANGE)).readValue(),
        )
        if (range) resistanceRange = range
      } catch {
        resistanceRange = DEFAULT_RESISTANCE_RANGE
      }

      // Request Control, then Reset, then Request Control again (Reset releases
      // control). One write at a time, each waits for its reply.
      // Failure here is not fatal: live data still flows without control.
      try {
        const cp = new FtmsControlPoint(await ftms.getCharacteristic(CONTROL_POINT))
        await cp.start()
        controlPoint = cp
        await cp.send(OP_REQUEST_CONTROL)
        await cp.send(OP_RESET)
        await cp.send(OP_REQUEST_CONTROL)
      } catch (err) {
        console.warn('FTMS control point:', err)
      }
      h.onStatus({ kind: 'connected', protocol: 'FTMS' })
      return
    }

    const cpService = await server.getPrimaryService(CYCLING_POWER_SERVICE)
    const meas = await cpService.getCharacteristic(CYCLING_POWER_MEASUREMENT)
    cps.reset()
    meas.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value
      if (v && v.byteLength >= 4) h.onReading(cps.parse(v, Date.now()))
    })
    await meas.startNotifications()
    h.onStatus({ kind: 'connected', protocol: 'Cycling Power' })
  }

  async function reconnectLoop(gen: number): Promise<void> {
    for (let attempt = 1; attempt <= RECONNECT_MAX_TRIES; attempt++) {
      if (gen !== generation || userClosed) return
      h.onStatus({ kind: 'reconnecting', attempt, max: RECONNECT_MAX_TRIES })
      await sleep(RECONNECT_INTERVAL_MS)
      if (gen !== generation || userClosed) return
      try {
        await setup()
        return
      } catch (err) {
        console.warn(`Reconnect attempt ${attempt} failed:`, err)
      }
    }
    if (gen === generation && !userClosed) {
      h.onStatus({
        kind: 'failed',
        message: 'Lost the trainer. Check that it has power, then press Connect.',
      })
    }
  }

  async function setTargetPower(watts: number): Promise<ControlResult> {
    const cp = controlPoint
    if (!cp) return 'unsupported'
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await cp.send(OP_SET_TARGET_POWER, encodePower(watts))
        return 'ok'
      } catch (err) {
        const code = err instanceof ControlPointError ? err.code : undefined
        if (code === RESULT_NOT_SUPPORTED) return 'unsupported'
        if (code === RESULT_CONTROL_NOT_PERMITTED && attempt === 0) {
          try {
            await cp.send(OP_REQUEST_CONTROL)
          } catch {
            return 'failed'
          }
          continue
        }
        console.warn('Set target power failed:', err)
        return 'failed'
      }
    }
    return 'failed'
  }

  async function setResistance(pct: number): Promise<ControlResult> {
    const cp = controlPoint
    if (!cp) return 'unsupported'
    const level = percentToLevel(pct, resistanceRange)
    const send = () => cp.send(OP_SET_TARGET_RESISTANCE, encodeResistance(level, resistanceFormat))
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await send()
        formatSettled = true
        return 'ok'
      } catch (err) {
        const code = err instanceof ControlPointError ? err.code : undefined
        if (code === RESULT_NOT_SUPPORTED) return 'unsupported'
        if (code === RESULT_INVALID_PARAMETER && !formatSettled && resistanceFormat === 'sint16') {
          resistanceFormat = 'uint8'
          continue
        }
        if (code === RESULT_CONTROL_NOT_PERMITTED) {
          try {
            await cp.send(OP_REQUEST_CONTROL)
          } catch {
            return 'failed'
          }
          continue
        }
        console.warn('Set resistance failed:', err)
        return 'failed'
      }
    }
    return 'failed'
  }

  async function setGrade(gradePct: number, cwKgPerM: number): Promise<ControlResult> {
    const cp = controlPoint
    if (!cp) return 'unsupported'
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await cp.send(OP_SET_SIMULATION, encodeSimulation(gradePct, CRR, cwKgPerM))
        return 'ok'
      } catch (err) {
        const code = err instanceof ControlPointError ? err.code : undefined
        if (code === RESULT_NOT_SUPPORTED) return 'unsupported'
        if (code === RESULT_CONTROL_NOT_PERMITTED && attempt === 0) {
          try {
            await cp.send(OP_REQUEST_CONTROL)
          } catch {
            return 'failed'
          }
          continue
        }
        console.warn('Set grade failed:', err)
        return 'failed'
      }
    }
    return 'failed'
  }

  /**
   * ERG released. Two steps, so the pedals are light whichever one the trainer takes:
   * 1. A low ERG target. This stays in ERG, which trainers accept at a standstill.
   * 2. Minimum resistance level, which leaves ERG. A Kickr Core 2 has been
   *    reported to answer "operation failed" to this while the flywheel is
   *    nearly stopped; then step 1 still holds, and 'failed' asks for a retry.
   */
  async function release(): Promise<ControlResult> {
    const low = await setTargetPower(ERG_RELEASE_W)
    const level = await setResistance(0)
    if (level === 'ok') return 'ok'
    if (level === 'unsupported') return low === 'ok' ? 'ok' : low
    return 'failed'
  }

  return {
    async connect() {
      userClosed = false
      generation++
      h.onStatus({ kind: 'connecting' })
      try {
        if (!device) {
          device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [FTMS_SERVICE] }, { services: [CYCLING_POWER_SERVICE] }],
            optionalServices: [FTMS_SERVICE, CYCLING_POWER_SERVICE],
          })
        }
        device.removeEventListener('gattserverdisconnected', onDisconnected)
        device.addEventListener('gattserverdisconnected', onDisconnected)
        await setup()
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          // User closed the picker without choosing.
          h.onStatus({ kind: 'disconnected' })
          return
        }
        console.warn('Connect failed:', err)
        userClosed = true
        device?.gatt?.disconnect()
        h.onStatus({
          kind: 'failed',
          message:
            'Could not connect. Close the Wahoo app (and Zwift) on your phone and computer, then try again.',
        })
      }
    },
    setTargetPower,
    setResistance,
    setGrade,
    release,
    disconnect() {
      userClosed = true
      generation++
      controlPoint?.stop()
      controlPoint = null
      if (device?.gatt?.connected) device.gatt.disconnect()
      else h.onStatus({ kind: 'disconnected' })
    },
  }
}
