import { useSyncExternalStore } from 'react'

/**
 * Screens, switched by the URL hash so no router or server config is needed.
 * `builder` is the workout builder: a side trip from the Workout tab, not a tab of its own.
 */
export const ROUTES = ['ride', 'workout', 'profile', 'builder'] as const
export type Route = (typeof ROUTES)[number]

const HASH: Record<Route, string> = { ride: '#/', workout: '#/workout', profile: '#/profile', builder: '#/workout/build' }

function current(): Route {
  const h = window.location.hash
  return h === HASH.workout ? 'workout' : h === HASH.profile ? 'profile' : h === HASH.builder ? 'builder' : 'ride'
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
