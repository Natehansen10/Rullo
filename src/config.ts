/**
 * App constants. Units here are lb and miles where a person reads them.
 * physics.ts converts to SI internally.
 */

/** Rider weight in pounds. */
export const RIDER_WEIGHT_LB = 185
/** Bike weight in pounds. */
export const BIKE_WEIGHT_LB = 20

/**
 * Drag area (m^2) for a tall rider (6'3") on the hoods.
 * Typical road range is 0.28 (drops) to 0.40 (upright).
 */
export const CDA_M2 = 0.34
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

/** Manual resistance, as % of the trainer's range. */
/** Direct step buttons, mirrored minus / plus. Keys: arrows 1, + / - 5, Shift+arrows 10. */
export const RESISTANCE_STEPS_PCT = [1, 5, 10] as const
export const DEFAULT_RESISTANCE_PCT = 20
