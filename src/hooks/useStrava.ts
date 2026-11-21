import { useSyncExternalStore } from 'react'
import { strava } from '../lib/strava'

export function useStrava() {
  return useSyncExternalStore(strava.subscribe, strava.getSnapshot)
}
