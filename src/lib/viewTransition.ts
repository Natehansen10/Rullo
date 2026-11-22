import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'

/**
 * Layout moves on the setup flow (see "Motion" in DESIGN.md): a change of
 * what is on the page is drawn as a move from the old layout to the new one,
 * with the browser's View Transitions (Chrome and Edge, the browsers the app
 * runs in). No library. `kind` is put on <html> as `data-vt` while it runs, so
 * the stylesheet can tell a step forward from a step back.
 *
 * Without the API, or with prefers-reduced-motion, the change just happens.
 * `update` must change state synchronously; it is flushed to the page inside
 * the transition. Returns when the move has finished.
 */
export function moveLayout(update: () => void, kind: MoveKind | 'step-next' | 'step-back'): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (typeof document.startViewTransition !== 'function' || reduced) {
    update()
    return Promise.resolve()
  }
  const root = document.documentElement
  root.dataset.vt = kind
  const t = document.startViewTransition(() => flushSync(update))
  // A move that is cut short by the next one rejects these; that is not an error.
  t.ready.catch(() => {})
  t.updateCallbackDone.catch(() => {})
  const done = () => {
    if (root.dataset.vt === kind) delete root.dataset.vt
  }
  return t.finished.then(done, done)
}

/**
 * Naming an element for a move. A name is only live while a move of the right
 * kind runs (the `ww-move-*` classes in index.css), so at rest nothing is
 * named and a move never captures more than it animates.
 */
export type MoveKind = 'step' | 'open' | 'reflow' | 'course'
export const MOVE_ANY = 'ww-move-any'
export const MOVE_STEP = 'ww-move-step'
export const MOVE_CARD = 'ww-move-card'
export const MOVE_OPEN = 'ww-move-open'
/** The style that carries the name: `open` is the name used while a card opens or closes, if it differs. */
export function moveStyle(name: string, open?: string): CSSProperties {
  return { '--ww-move': name, ...(open ? { '--ww-move-open': open } : {}) } as CSSProperties
}

/** A view-transition name for one item of a list, from its id. Names must be CSS identifiers. */
export function moveName(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)}`
}
