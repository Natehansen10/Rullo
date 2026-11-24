import { useEffect, useState } from 'react'
import { addDays, dayStart } from '../lib/training'

/**
 * Local midnight at the start of today. It moves on at midnight, and is
 * checked again when the tab is shown (a sleeping tab's timer can be late),
 * so a page left open overnight never calls yesterday "today".
 */
export function useToday(): number {
  const [today, setToday] = useState(() => dayStart(Date.now()))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      const now = Date.now()
      setToday(dayStart(now))
      clearTimeout(timer)
      // One second past the next local midnight. The Date constructor finds it, so a 23 or 25 hour day is right.
      timer = setTimeout(check, addDays(now, 1) - now + 1000)
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
