import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * The selected chip of a segmented control or tab row as one element that
 * slides to the selected option. Put `trackRef` on the track, `chipRef` on an
 * absolutely positioned `.ww-chip-indicator` inside it, and mark the selected
 * option with `data-chip="on"`. The chip's place is written straight to the
 * element (no render): it snaps on the first paint and whenever the track is
 * resized, and eases (transform and width) when `selected` changes.
 */
export function useSlidingChip<T extends HTMLElement>(selected: unknown): { trackRef: RefObject<T>; chipRef: RefObject<HTMLSpanElement> } {
  const trackRef = useRef<T>(null)
  const chipRef = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  const place = (ease: boolean) => {
    const track = trackRef.current
    const chip = chipRef.current
    if (!track || !chip) return
    const on = track.querySelector<HTMLElement>('[data-chip="on"]')
    if (!on) {
      chip.style.opacity = '0'
      placed.current = false
      return
    }
    const snap = !ease || !placed.current
    if (snap) chip.style.transition = 'none'
    chip.style.opacity = '1'
    // Measured to the fraction of a pixel, from the track's padding box (where the chip's 0,0 is).
    const t = track.getBoundingClientRect()
    const o = on.getBoundingClientRect()
    chip.style.width = `${o.width}px`
    chip.style.height = `${o.height}px`
    chip.style.transform = `translate(${o.left - t.left - track.clientLeft}px, ${o.top - t.top - track.clientTop}px)`
    if (snap) {
      void chip.offsetWidth
      chip.style.transition = ''
    }
    placed.current = true
  }

  // Before paint, so the chip is never seen out of place.
  useLayoutEffect(() => place(true), [selected])

  // A resize (the window, a font arriving, an option added) is not a selection: snap.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(track)
    // The options too (a font arriving changes their widths), but never the chip: its own slide is not a resize.
    for (const el of track.children) if (el !== chipRef.current) ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { trackRef, chipRef }
}
