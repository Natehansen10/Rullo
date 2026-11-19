import { useSyncExternalStore } from 'react'

/** Two screens, switched by the URL hash so no router or server config is needed. */
export type Route = 'ride' | 'profile'

function current(): Route {
  return window.location.hash === '#/profile' ? 'profile' : 'ride'
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

export function go(r: Route): void {
  window.location.hash = r === 'profile' ? '/profile' : '/'
}
