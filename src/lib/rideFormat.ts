/** How a saved ride's numbers and names are written, shared by Home and the ride summary. Miles and feet at display only. */
import { FEET_PER_METER, METERS_PER_MILE } from './physics'
import type { RideSnapshot } from './ride'

/** m:ss, or h:mm:ss from an hour up. */
export function hms(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const ss = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export const miles = (m: number, digits: number) =>
  (m / METERS_PER_MILE).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const feet = (m: number) => Math.round(m * FEET_PER_METER).toLocaleString()

/** The day of a ride ("Fri, Nov 20"; with the year when it is not this one) and its start time. */
export function dateOf(t: number, now: number): { day: string; time: string } {
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return {
    day: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }),
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  }
}

/**
 * "Test Hills · Sweet Spot 3x12" for a ride, with "Flat road" and "Free ride"
 * where there is none, the words the Workout tab uses. A course or workout
 * that has since been removed says so; a custom workout keeps the name saved
 * with the ride.
 */
export function setupOf(s: RideSnapshot, r: { courseId?: string; workoutId?: string; workoutName?: string }): string {
  const course = r.courseId ? (s.courses.find((c) => c.id === r.courseId)?.name ?? (s.coursesLoaded ? 'Removed course' : '')) : 'Flat road'
  const workout = r.workoutId
    ? (s.workouts.find((w) => w.id === r.workoutId)?.name ?? r.workoutName ?? (s.workoutsLoaded ? 'Removed workout' : ''))
    : 'Free ride'
  return `${course} · ${workout}`
}
