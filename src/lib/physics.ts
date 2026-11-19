/**
 * Road speed from power and grade, with rider inertia.
 *
 * Energy balance each step:
 *   d(KE)/dt = P * eff - (m*g*(Crr*cos(a) + sin(a)) + 0.5*rho*CdA*v^2) * v
 * where a is the road angle (grade = tan a). Grade 0 is the v1 flat road.
 * Integrating kinetic energy (not v) avoids the P/v blow-up at v = 0, so the
 * model starts from a standstill and coasts down smoothly when power drops.
 * Speed depends only on power, so it reads the same in any gear.
 *
 * Written from the standard cycling power model (Martin et al., 1998).
 * Reference for the approach: serpentine physics.ts (MIT).
 */
import {
  AIR_DENSITY,
  BIKE_WEIGHT_LB,
  CDA_M2,
  CRR,
  DRIVETRAIN_EFFICIENCY,
  RIDER_WEIGHT_LB,
} from '../config'

const G = 9.80665
const LB_TO_KG = 0.45359237
const SUBSTEP_S = 0.05

export const TOTAL_MASS_KG = (RIDER_WEIGHT_LB + BIKE_WEIGHT_LB) * LB_TO_KG

function resistiveForce(v: number, grade = 0): number {
  const a = Math.atan(grade)
  return TOTAL_MASS_KG * G * (CRR * Math.cos(a) + Math.sin(a)) + 0.5 * AIR_DENSITY * CDA_M2 * v * v
}

/** Steady-state speed (m/s) for a constant power on a flat road. */
export function steadySpeedMps(powerW: number): number {
  const p = Math.max(0, powerW) * DRIVETRAIN_EFFICIENCY
  if (p === 0) return 0
  // Newton's method on f(v) = F(v) * v - p
  let v = 8
  for (let i = 0; i < 30; i++) {
    const f = resistiveForce(v) * v - p
    const df = TOTAL_MASS_KG * G * CRR + 1.5 * AIR_DENSITY * CDA_M2 * v * v
    const next = v - f / df
    if (Math.abs(next - v) < 1e-6) return Math.max(0, next)
    v = Math.max(0.1, next)
  }
  return v
}

export class SpeedModel {
  private ke = 0

  get speedMps(): number {
    return Math.sqrt((2 * this.ke) / TOTAL_MASS_KG)
  }

  /** Advance the model by dt seconds at constant power and grade. Returns meters traveled along the road. */
  step(powerW: number, dtS: number, grade = 0): number {
    const p = Math.max(0, powerW) * DRIVETRAIN_EFFICIENCY
    let meters = 0
    let remaining = dtS
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP_S, remaining)
      // From a standstill on a descent, gravity needs a tiny speed to act on.
      const v = grade < 0 ? Math.max(this.speedMps, 0.1) : this.speedMps
      this.ke = Math.max(0, this.ke + (p - resistiveForce(v, grade) * v) * h)
      meters += ((v + this.speedMps) / 2) * h
      remaining -= h
    }
    return meters
  }

  /** Jump straight to a speed, e.g. when resuming a recovered ride. */
  setSpeed(v: number): void {
    this.ke = 0.5 * TOTAL_MASS_KG * v * v
  }

  reset(): void {
    this.ke = 0
  }
}

export const MPS_TO_MPH = 2.2369362920544
export const METERS_PER_MILE = 1609.344
export const FEET_PER_METER = 3.28084
