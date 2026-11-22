import { useEffect, useRef, type CSSProperties } from 'react'
import { GLIDE_JUMP_SHARE, GLIDE_MAX_MS } from '../config'
import { TICK_MS } from '../lib/ride'

interface Glide {
  /** `ww-glide` when this position change should be eased, else ''. */
  className: string
  /** Sets how long the glide takes. Spread it into the moving element's style. */
  style: CSSProperties
}

interface Seen {
  pos: number | null
  span: number
  keys: readonly unknown[]
  live: boolean
  /** When `pos` last changed. */
  at: number
  out: Glide
}

const SNAP: Glide = { className: '', style: {} }

function same(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/**
 * Glide for a position that follows the ride (the workout playhead, the
 * course dot). The position itself is set with a CSS transform; this decides,
 * render by render, whether the browser may ease to it (`ww-glide`: transform,
 * linear) or must snap.
 *
 * It only ever fills the gap up to data that has arrived. The glide takes as
 * long as the last gap between two position changes, never less than one
 * snapshot (TICK_MS, the `--ww-dur-glide` token) and never more than
 * GLIDE_MAX_MS, so the mark reaches a reading about when the next one lands
 * and then rests there. Nothing is extrapolated: with no new data it stops.
 *
 * It snaps on the first paint, when `span` (the track's width) or any of
 * `keys` changes (a resize, another course or workout, Skip interval), on the
 * first change after `live` was false (a resume), on any backwards move and on
 * a jump of more than GLIDE_JUMP_SHARE of the span. A render that does not
 * move the position changes nothing, so a glide in flight always finishes.
 */
export function useGlide(pos: number | null, span: number, keys: readonly unknown[], live: boolean): Glide {
  const seen = useRef<Seen | null>(null)
  const p = seen.current
  const now = performance.now()

  let out = SNAP
  if (p && pos !== null && p.pos !== null && p.span === span && same(p.keys, keys)) {
    if (pos === p.pos) {
      out = p.out
    } else if (p.live && live && pos > p.pos && pos - p.pos <= span * GLIDE_JUMP_SHARE) {
      const ms = Math.round(Math.min(GLIDE_MAX_MS, Math.max(TICK_MS, now - p.at)))
      out = { className: 'ww-glide', style: { '--ww-glide-for': `${ms}ms` } as CSSProperties }
    }
  }

  // Remembered at commit, so a render React throws away (StrictMode, a retry) leaves no trace.
  useEffect(() => {
    const q = seen.current
    seen.current = { pos, span, keys, live, at: q && q.pos === pos ? q.at : now, out }
  })

  return out
}
