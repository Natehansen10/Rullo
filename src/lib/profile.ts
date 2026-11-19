/** Rider profile: weights, riding position and FTP. Saved in this browser, no account. */
import {
  CDA_BY_POSITION,
  DEFAULT_BIKE_WEIGHT_LB,
  DEFAULT_FTP_W,
  DEFAULT_POSITION,
  DEFAULT_RIDER_WEIGHT_LB,
  POSITIONS,
  type Position,
} from '../config'
import { LB_TO_KG, type RiderParams } from './physics'

export interface Profile {
  riderLb: number
  bikeLb: number
  position: Position
  ftpW: number
}

export const DEFAULT_PROFILE: Profile = {
  riderLb: DEFAULT_RIDER_WEIGHT_LB,
  bikeLb: DEFAULT_BIKE_WEIGHT_LB,
  position: DEFAULT_POSITION,
  ftpW: DEFAULT_FTP_W,
}

/** Allowed ranges. Values outside are clamped. */
export const PROFILE_LIMITS = {
  riderLb: [70, 400],
  bikeLb: [10, 60],
  ftpW: [50, 600],
} as const

const KEY = 'ww.profile'

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v))

export function normalizeProfile(p: Partial<Profile>): Profile {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return {
    riderLb: Math.round(clamp(num(p.riderLb, DEFAULT_PROFILE.riderLb), PROFILE_LIMITS.riderLb)),
    bikeLb: Math.round(clamp(num(p.bikeLb, DEFAULT_PROFILE.bikeLb), PROFILE_LIMITS.bikeLb) * 10) / 10,
    position: POSITIONS.includes(p.position as Position) ? (p.position as Position) : DEFAULT_PROFILE.position,
    ftpW: Math.round(clamp(num(p.ftpW, DEFAULT_PROFILE.ftpW), PROFILE_LIMITS.ftpW)),
  }
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeProfile(JSON.parse(raw) as Partial<Profile>)
  } catch {
    // storage unavailable or corrupt: defaults
  }
  return DEFAULT_PROFILE
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage unavailable: the profile still applies this session
  }
}

export function riderParams(p: Profile): RiderParams {
  return { massKg: (p.riderLb + p.bikeLb) * LB_TO_KG, cdaM2: CDA_BY_POSITION[p.position] }
}
