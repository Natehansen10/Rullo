/**
 * Road speed from power and grade, with rider inertia.
 *
 * Energy balance each step:
 *   d(KE)/dt = P * eff - (m*g*(Crr*cos(a) + sin(a)) + 0.5*rho*CdA*v^2) * v
 * where a is the road angle (grade = tan a). Grade 0 is the v1 flat road.
 * Integrating kinetic energy (not v) avoids the P/v blow-up at v = 0, so the
 * model starts from a standstill.
 * Speed depends only on power, so it reads the same in any gear.
 *
 * Two indoor adjustments (see config.ts): only INERTIA_SHARE of the mass
 * resists a change of speed, so speed settles in seconds; and with no power
 * the speed runs down to 0 in COAST_DOWN_S. Neither changes the steady speed
 * for a given power and grade.
 *
 * Written from the standard cycling power model (Martin et al., 1998).
 * Reference for the approach: serpentine physics.ts (MIT).
 */
import {
  AIR_DENSITY,
  CDA_BY_POSITION,
  COAST_DOWN_S,
  CRR,
  DEFAULT_BIKE_WEIGHT_LB,
  DEFAULT_POSITION,
  DEFAULT_RIDER_WEIGHT_LB,
  DRIVETRAIN_EFFICIENCY,
  INERTIA_SHARE,
} from '../config'

const G = 9.80665
export const LB_TO_KG = 0.45359237
const SUBSTEP_S = 0.05

/** The rider-specific inputs to the model. Built from the rider profile. */
export interface RiderParams {
  /** Rider plus bike, kg. */
  massKg: number
  /** Drag area, m^2. */
  cdaM2: number
}

export const DEFAULT_RIDER: RiderParams = {
  massKg: (DEFAULT_RIDER_WEIGHT_LB + DEFAULT_BIKE_WEIGHT_LB) * LB_TO_KG,
  cdaM2: CDA_BY_POSITION[DEFAULT_POSITION],
}

function resistiveForce(r: RiderParams, v: number, grade = 0): number {
  const a = Math.atan(grade)
  return r.massKg * G * (CRR * Math.cos(a) + Math.sin(a)) + 0.5 * AIR_DENSITY * r.cdaM2 * v * v
}

/** Steady-state speed (m/s) for a constant power on a flat road. */
export function steadySpeedMps(r: RiderParams, powerW: number): number {
  const p = Math.max(0, powerW) * DRIVETRAIN_EFFICIENCY
  if (p === 0) return 0
  // Newton's method on f(v) = F(v) * v - p
  let v = 8
  for (let i = 0; i < 30; i++) {
    const f = resistiveForce(r, v) * v - p
    const df = r.massKg * G * CRR + 1.5 * AIR_DENSITY * r.cdaM2 * v * v
    const next = v - f / df
    if (Math.abs(next - v) < 1e-6) return Math.max(0, next)
    v = Math.max(0.1, next)
  }
  return v
}

export class SpeedModel {
  private v = 0
  private rider: RiderParams
  /** Speed when the power went to 0; the coast-down runs from here. Null while pedaling. */
  private coastFrom: number | null = null

  constructor(rider: RiderParams = DEFAULT_RIDER) {
    this.rider = rider
  }

  /** Swap rider inputs, keeping the current speed. */
  setRider(rider: RiderParams): void {
    this.rider = rider
  }

  get speedMps(): number {
    return this.v
  }

  /** Advance the model by dt seconds at constant power and grade. Returns meters traveled along the road. */
  step(powerW: number, dtS: number, grade = 0): number {
    const p = Math.max(0, powerW) * DRIVETRAIN_EFFICIENCY
    if (p > 0) this.coastFrom = null
    else if (this.coastFrom === null) this.coastFrom = this.v
    const inertiaKg = this.rider.massKg * INERTIA_SHARE
    let meters = 0
    let remaining = dtS
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP_S, remaining)
      const before = this.v
      // From a standstill on a descent, gravity needs a tiny speed to act on.
      const v = grade < 0 ? Math.max(before, 0.1) : before
      const ke = Math.max(0, 0.5 * inertiaKg * v * v + (p - resistiveForce(this.rider, v, grade) * v) * h)
      let next = Math.sqrt((2 * ke) / inertiaKg)
      // Not pedaling: run down in a straight line to 0 in COAST_DOWN_S, even on a descent.
      if (this.coastFrom !== null) next = Math.max(0, Math.min(next, before - (this.coastFrom / COAST_DOWN_S) * h))
      this.v = next
      meters += ((before + next) / 2) * h
      remaining -= h
    }
    return meters
  }

  /** Jump straight to a speed. */
  setSpeed(v: number): void {
    this.v = Math.max(0, v)
  }

  reset(): void {
    this.v = 0
    this.coastFrom = null
  }
}

export const MPS_TO_MPH = 2.2369362920544
export const METERS_PER_MILE = 1609.344
export const FEET_PER_METER = 3.28084
