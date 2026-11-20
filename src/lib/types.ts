/** A partial reading from the trainer. Fields are present only when the packet carried them. */
export interface TrainerReading {
  /** Wall-clock time the reading arrived (ms since epoch). */
  t: number
  powerW?: number
  cadenceRpm?: number
  /** Speed as reported by the trainer. Not shown; speed is calculated from power. */
  trainerSpeedKph?: number
}

export type ConnectionStatus =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected'; protocol: 'FTMS' | 'Cycling Power' | 'Fake' }
  | { kind: 'reconnecting'; attempt: number; max: number }
  | { kind: 'failed'; message: string }

export interface TrainerHandlers {
  onReading: (r: TrainerReading) => void
  onStatus: (s: ConnectionStatus) => void
}

/** Result of a trainer control command (resistance or ERG target). */
export type ControlResult = 'ok' | 'unsupported' | 'failed'
/** @deprecated use ControlResult */
export type ResistanceResult = ControlResult

export interface Trainer {
  /** Must be called from a user gesture the first time (device picker). */
  connect(): Promise<void>
  /** User-initiated disconnect. Stops any reconnect loop. */
  disconnect(): void
  /** Set resistance as 0 to 100% of the trainer's range. Only call while connected. */
  setResistance(pct: number): Promise<ControlResult>
  /** ERG: hold this power in watts. Only call while connected. */
  setTargetPower(watts: number): Promise<ControlResult>
  /**
   * ERG released: make the pedals as light as the trainer can. 'failed' means
   * it is not fully released yet and the call is worth repeating.
   */
  release(): Promise<ControlResult>
}
