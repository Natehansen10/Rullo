import { useSyncExternalStore } from 'react'

/**
 * Screens, switched by the URL hash so no router or server config is needed.
 * `builder` is the workout builder: a side trip from the Workout tab, not a tab of its own.
 * Home is `#/`, and anything unknown (no hash, an old link): the app opens there.
 * The Ride tab was `#/` until the Home tab took it (Nov 20, 2026).
 */
export const ROUTES = ['home', 'ride', 'workout', 'profile', 'builder', 'summary'] as const
export type Route = (typeof ROUTES)[number]

const HASH: Record<Route, string> = { home: '#/', ride: '#/ride', workout: '#/workout', profile: '#/profile', builder: '#/workout/build', summary: '#/rides' }
/** One finished ride's summary: `#/rides/12`. A side trip from Home, not a tab of its own. */
const SUMMARY = /^#\/rides\/(\d+)$/

function current(): Route {
  const h = window.location.hash
  if (SUMMARY.test(h)) return 'summary'
  return h === HASH.ride ? 'ride' : h === HASH.workout ? 'workout' : h === HASH.profile ? 'profile' : h === HASH.builder ? 'builder' : 'home'
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current)
}

export function isRoute(r: Route): boolean {
  return current() === r
}

export function href(r: Route): string {
  return HASH[r]
}

export function go(r: Route): void {
  window.location.hash = HASH[r].slice(1)
}

/** The ride a summary link points at, or null on any other screen. */
function summaryId(): number | null {
  const m = SUMMARY.exec(window.location.hash)
  return m ? Number(m[1]) : null
}

export function useSummaryId(): number | null {
  return useSyncExternalStore(subscribe, summaryId)
}

export function summaryHref(rideId: number): string {
  return `${HASH.summary}/${rideId}`
}
