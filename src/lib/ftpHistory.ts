/**
 * The rider's FTP over time: each change with its day and where it came from.
 * Saved in this browser with the profile, per rider (the keys are in
 * `RIDER_KEYS`). The history travels in a backup; the dismissed suggestion
 * does not.
 */
import { PROFILE_LIMITS } from './profile'
import type { RideSummary } from './history'

/** Typed on the Profile tab, set from a ramp test, or taken from the suggestion (the best 20 minutes). */
export type FtpSource = 'typed' | 'ramp' | 'best20'

export interface FtpChange {
  /** When it was set, ms since epoch. */
  t: number
  ftpW: number
  /** The FTP it replaced. */
  fromW: number
  source: FtpSource
}

export const FTP_SOURCE_LABEL: Record<FtpSource, string> = {
  typed: 'Typed',
  ramp: 'Ramp test',
  best20: 'Best 20 minutes',
}

const KEY = 'ww.ftpHistory'
const DISMISSED_KEY = 'ww.ftpSuggestionDismissedW'
/** The oldest changes drop off past this, so the list always fits a backup's settings. */
const MAX_CHANGES = 50
/** Typing 225 and then 230 a minute later is one change, not two. */
const RETYPE_MS = 10 * 60 * 1000
/** A 20-minute best is usually held to be about 5% above the power for an hour. */
export const BEST20_FTP_SHARE = 0.95
/** Only recent rides speak for the rider's fitness today. */
export const SUGGEST_DAYS = 60

const SOURCES: readonly FtpSource[] = ['typed', 'ramp', 'best20']
const [MIN_W, MAX_W] = PROFILE_LIMITS.ftpW
const isWatts = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= MIN_W && v <= MAX_W

/** Oldest first. Anything unreadable or out of range is left out. */
export function loadFtpHistory(): FtpChange[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw
      .filter(
        (c): c is FtpChange =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as FtpChange).t === 'number' &&
          Number.isFinite((c as FtpChange).t) &&
          isWatts((c as FtpChange).ftpW) &&
          isWatts((c as FtpChange).fromW) &&
          SOURCES.includes((c as FtpChange).source),
      )
      .map((c) => ({ t: c.t, ftpW: c.ftpW, fromW: c.fromW, source: c.source }))
      .sort((a, b) => a.t - b.t)
      .slice(-MAX_CHANGES)
  } catch {
    return []
  }
}

function save(list: FtpChange[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_CHANGES)))
  } catch {
    // storage unavailable: the FTP itself still applies
  }
}

/** Note a change of FTP. Nothing is written when the value did not change. */
export function logFtpChange(fromW: number, ftpW: number, source: FtpSource, t = Date.now()): void {
  if (fromW === ftpW || !isWatts(fromW) || !isWatts(ftpW)) return
  const list = loadFtpHistory()
  const last = list[list.length - 1]
  // A second typed value soon after the first corrects it: keep one change, from the value before both.
  if (source === 'typed' && last?.source === 'typed' && t - last.t < RETYPE_MS && last.ftpW === fromW) {
    list.pop()
    if (last.fromW !== ftpW) list.push({ t, ftpW, fromW: last.fromW, source })
  } else {
    list.push({ t, ftpW, fromW, source })
  }
  save(list)
}

export interface FtpSuggestion {
  /** The FTP the rider's best 20 minutes points to. */
  ftpW: number
  best20W: number
  /** The ride that best was set on. */
  rideId: number
  startedAt: number
}

/**
 * A higher FTP the rider's recent rides point to, or null. It is 95% of the
 * best 20 minutes in the last 60 days, offered only when that is above the
 * FTP now and the rider has not already turned this value (or a higher one) down.
 * A suggestion only: nothing sets the FTP but the rider.
 */
export function suggestFtp(rides: RideSummary[], ftpW: number, now: number): FtpSuggestion | null {
  const since = now - SUGGEST_DAYS * 24 * 3600 * 1000
  let best: RideSummary | null = null
  for (const r of rides) {
    const w = r.bests[1200]
    if (r.startedAt < since || w === null) continue
    if (!best || w > (best.bests[1200] ?? 0)) best = r
  }
  const best20W = best?.bests[1200] ?? null
  if (!best || best20W === null) return null
  const suggested = Math.min(MAX_W, Math.round(best20W * BEST20_FTP_SHARE))
  if (suggested <= ftpW || suggested <= dismissedW()) return null
  return { ftpW: suggested, best20W: Math.round(best20W), rideId: best.id, startedAt: best.startedAt }
}

function dismissedW(): number {
  try {
    const w = Number(localStorage.getItem(DISMISSED_KEY))
    return Number.isFinite(w) ? w : 0
  } catch {
    return 0
  }
}

/** "Not now": this value is not offered again. A higher one, from a better ride, still is. */
export function dismissFtpSuggestion(ftpW: number): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(ftpW))
  } catch {
    // storage unavailable: it will be offered again next visit
  }
}
