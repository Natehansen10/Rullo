import { useRef } from 'react'

/**
 * Hysteresis for a value that is read on every ride snapshot: what is returned
 * changes only after the value has been away from it for `holdMs`, and then it
 * becomes the value of that moment. Going back to the shown value restarts
 * the wait, so a value that hovers at an edge never flickers; a value that
 * keeps moving (a ramp through several zones) still catches up every `holdMs`
 * and is never left behind. `null` (nothing to show) passes straight through,
 * and the first value after a null shows at once.
 * It is checked when the component renders, so it needs a host that renders
 * on every snapshot, as the Ride tab does.
 */
export function useHeld<T>(value: T | null, holdMs: number): T | null {
  const state = useRef<{ shown: T | null; awaySince: number | null }>({ shown: value, awaySince: null })
  const st = state.current
  const now = performance.now()
  if (value === null || st.shown === null || value === st.shown) {
    st.shown = value
    st.awaySince = null
  } else if (st.awaySince === null) {
    st.awaySince = now
  } else if (now - st.awaySince >= holdMs) {
    st.shown = value
    st.awaySince = null
  }
  return st.shown
}
