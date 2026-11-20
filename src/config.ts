/**
 * App constants. Units here are lb and miles where a person reads them.
 * physics.ts converts to SI internally.
 */

/** Rider profile defaults. The rider edits these in the Profile panel (src/lib/profile.ts). */
export const DEFAULT_RIDER_WEIGHT_LB = 185
export const DEFAULT_BIKE_WEIGHT_LB = 18
/**
 * Starting FTP until a ramp test sets it. Zwift lists 249 W, but the best
 * 20 minutes on record is 222 W (about 211 W FTP), so this sits between.
 */
export const DEFAULT_FTP_W = 220

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

/**
 * How much of the rider's mass resists a change of speed. On the road it is
 * all of it, and speed takes close to a minute to settle after a power change.
 * Indoors that reads as lag, so only this share counts: speed settles in a
 * few seconds, like the flywheel does. Steady speed for a given power is not
 * affected (inertia only matters while speed is changing).
 */
export const INERTIA_SHARE = 0.15
/** With no power, speed runs down to 0 in this long, like the flywheel does when the rider stops. */
export const COAST_DOWN_S = 4

/** No data for this long means the numbers are stale. */
export const STALE_AFTER_MS = 3000
/** Reconnect cadence and limit after an unexpected disconnect. */
export const RECONNECT_INTERVAL_MS = 2000
export const RECONNECT_MAX_TRIES = 30
/** Gaps between samples longer than this add no distance. */
export const MAX_SAMPLE_GAP_MS = 3000
/** Auto-pause: power and cadence both 0 for this long. The first reading with either above 0 resumes. */
export const AUTO_PAUSE_AFTER_MS = 3000
/** Timeout for one FTMS control point write to get its reply. */
export const CONTROL_POINT_TIMEOUT_MS = 3000

/** Power smoothing windows (seconds) and the default. */
export const SMOOTHING_OPTIONS = [1, 3, 10] as const
export type SmoothingSeconds = (typeof SMOOTHING_OPTIONS)[number]
export const DEFAULT_SMOOTHING: SmoothingSeconds = 3

/** Manual resistance, as % of the trainer's range. Steps: arrows 1, + / - 5, Shift+arrows 10. */
export const RESISTANCE_STEPS_PCT = [1, 5, 10] as const
export const DEFAULT_RESISTANCE_PCT = 20

/** ERG mode: target watts. Steps: arrows 1, + / - 5, Shift+arrows 10. */
export const ERG_STEPS_W = [1, 5, 10] as const
export const ERG_MIN_W = 25
export const ERG_MAX_W = 1500
/** First-time ERG target, as a share of FTP. */
export const DEFAULT_ERG_FTP_SHARE = 0.65

/** Low-cadence release: ERG lets go below this cadence held this long, re-engages at the resume cadence. */
export const ERG_RELEASE_RPM = 50
export const ERG_RELEASE_AFTER_MS = 3000
export const ERG_RESUME_RPM = 60
/**
 * A rider below this cadence has clearly stopped: release after 1 s, not 3,
 * so the brake lets go while the flywheel is still turning.
 */
export const ERG_STOPPED_RPM = 20
export const ERG_STOPPED_AFTER_MS = 1000
/** Re-engage only after the resume cadence has held this long, so one stray cadence reading can't slam the load on. */
export const ERG_RESUME_AFTER_MS = 1000
/**
 * Soft start: when ERG engages, the target ramps from about the rider's
 * current power to the real target over this long. 6 s is long enough for the
 * flywheel to be up to speed before the full load arrives, and short enough
 * to cost little of an interval. (Wahoo's own ERG Easy Ramp takes 10 to 15 s.)
 */
export const ERG_SOFT_START_MS = 6000
/** While released the trainer is also given this ERG target, so it is light even if it refuses to leave ERG. */
export const ERG_RELEASE_W = 25
/** A control command the trainer refused is sent again after this long. */
export const CONTROL_RETRY_MS = 2000

/**
 * Grade mode: on a course with no workout, the trainer follows the hills
 * (FTMS simulation). The grade sent is the course grade times the feel,
 * smoothed over GRADE_SMOOTH_S and held inside what a Kickr Core can do
 * (it cannot simulate a descent, so those ride as flat).
 * Feel steps: arrows 1, + / - 5, Shift+arrows 10.
 */
export const GRADE_FEEL_STEPS_PCT = [1, 5, 10] as const
export const DEFAULT_GRADE_FEEL_PCT = 50
export const GRADE_SMOOTH_S = 2
export const GRADE_MIN_PCT = 0
export const GRADE_MAX_PCT = 16
/** The trainer gets a new grade at most this often. */
export const GRADE_SEND_EVERY_MS = 1000

/** Workout intensity, % of every workout target. Steps: arrows 1, + / - 5, Shift+arrows 10. */
export const INTENSITY_STEPS_PCT = [1, 5, 10] as const
export const INTENSITY_MIN_PCT = 50
export const INTENSITY_MAX_PCT = 150
