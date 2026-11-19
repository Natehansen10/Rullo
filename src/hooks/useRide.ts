import { useSyncExternalStore } from 'react'
import { RideController } from '../lib/ride'

export const ride = new RideController()

export function useRide() {
  return useSyncExternalStore(ride.subscribe, ride.getSnapshot)
}
