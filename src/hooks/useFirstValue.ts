import { useState } from 'react'

/**
 * Counts the times a value arrives: `has` going from false to true after the
 * first render. Use the count as a React key (and animate only when it is
 * above 0), so an enter plays once when "--" turns into a number and never on
 * a later update, and never for a value that was already there on mount.
 */
export function useFirstValue(has: boolean): number {
  const [seen, setSeen] = useState({ has, arrivals: 0 })
  if (seen.has !== has) setSeen({ has, arrivals: seen.arrivals + (has ? 1 : 0) })
  return seen.arrivals
}
