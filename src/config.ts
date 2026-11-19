/**
 * App constants. Units here are lb and miles where a person reads them.
 * physics.ts converts to SI internally.
 */

/** Rider profile defaults. The rider edits these in the Profile panel (src/lib/profile.ts). */
export const DEFAULT_RIDER_WEIGHT_LB = 185
export const DEFAULT_BIKE_WEIGHT_LB = 18
export const DEFAULT_FTP_W = 200

export const POSITIONS = ['hoods', 'drops', 'aero'] as const
export type Position = (typeof POSITIONS)[number]
export const DEFAULT_POSITION: Position = 'hoods'

/**
 * Drag area (m^2) by riding position, for a tall rider (6'3").
 * Typical road range is 0.28 (drops) to 0.40 (upright); aero bars 0.24 to 0.28.
 */
export const CDA_BY_POSITION: Record<Position, number> = { hoods: 0.34, drops: 0.3, aero: 0.26 }
/** Rolling resistance coefficient, good road tires on smooth asphalt. */
export const CRR = 0.004
/** Air density at sea level, 20 C (kg/m^3). */
export const AIR_DENSITY = 1.204
/** Share of trainer power that would reach the road. */
export const DRIVETRAIN_EFFICIENCY = 0.976

/** No data for this long means the numbers are stale. */
export const STALE_AFTER_MS = 3000
/** Reconnect cadence and limit after an unexpected disconnect. */
export const RECONNECT_INTERVAL_MS = 2000
export const RECONNECT_MAX_TRIES = 30
/** Gaps between samples longer than this add no distance. */
export const MAX_SAMPLE_GAP_MS = 3000
/** Timeout for one FTMS control point write to get its reply. */
export const CONTROL_POINT_TIMEOUT_MS = 3000

/** Power smoothing windows (seconds) and the default. */
export const SMOOTHING_OPTIONS = [1, 3, 10] as const
export type SmoothingSeconds = (typeof SMOOTHING_OPTIONS)[number]
export const DEFAULT_SMOOTHING: SmoothingSeconds = 3

/** Manual resistance, as % of the trainer's range. Steps: arrows 1, + / - 5, Shift+arrows 10. */
export const RESISTANCE_STEPS_PCT = [1, 5, 10] as const
export const DEFAULT_RESISTANCE_PCT = 20

/** ERG mode: target watts. Steps: arrows 5, + / - 10, Shift+arrows 25. */
export const ERG_STEPS_W = [5, 10, 25] as const
export const ERG_MIN_W = 25
export const ERG_MAX_W = 1500
/** First-time ERG target, as a share of FTP. */
export const DEFAULT_ERG_FTP_SHARE = 0.65

/** Low-cadence release: ERG lets go below this cadence held this long, re-engages at the resume cadence. */
export const ERG_RELEASE_RPM = 50
export const ERG_RELEASE_AFTER_MS = 3000
export const ERG_RESUME_RPM = 60

/** Workout intensity, % of every workout target. Steps: arrows 1, + / - 5, Shift+arrows 10. */
export const INTENSITY_STEPS_PCT = [1, 5, 10] as const
export const INTENSITY_MIN_PCT = 50
export const INTENSITY_MAX_PCT = 150
