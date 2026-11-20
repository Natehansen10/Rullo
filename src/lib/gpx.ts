/** Minimal GPX reader: track points (or route points) with lat, lon and elevation. */
export interface GpxPoint {
  lat: number
  lon: number
  ele: number | null
}

export interface GpxTrack {
  name: string | null
  points: GpxPoint[]
}

/** Limits on a file from outside. A 112-mile course at 1 point per second is about 20,000 points and 3 MB. */
export const MAX_GPX_BYTES = 30 * 1024 * 1024
const MAX_POINTS = 500_000
const MAX_NAME_CHARS = 80

export function parseGpx(text: string): GpxTrack {
  if (text.length > MAX_GPX_BYTES) throw new Error('The file is too large for a course (limit 30 MB).')
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('This file is not valid GPX.')

  let nodes = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'))
  if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagNameNS('*', 'rtept'))
  if (nodes.length > MAX_POINTS) throw new Error('This GPX has too many points (limit 500,000).')

  const points: GpxPoint[] = []
  for (const n of nodes) {
    const lat = Number(n.getAttribute('lat'))
    const lon = Number(n.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    if (n.getAttribute('lat') === null || n.getAttribute('lon') === null) continue
    const eleText = n.getElementsByTagNameNS('*', 'ele')[0]?.textContent
    const ele = eleText != null && eleText.trim() !== '' ? Number(eleText) : null
    // Elevations outside anything on Earth are treated as missing.
    points.push({ lat, lon, ele: ele !== null && Number.isFinite(ele) && Math.abs(ele) < 10000 ? ele : null })
  }

  const nameNode =
    doc.getElementsByTagNameNS('*', 'trk')[0]?.getElementsByTagNameNS('*', 'name')[0] ??
    doc.getElementsByTagNameNS('*', 'metadata')[0]?.getElementsByTagNameNS('*', 'name')[0] ??
    doc.getElementsByTagNameNS('*', 'rte')[0]?.getElementsByTagNameNS('*', 'name')[0]
  return { name: nameNode?.textContent?.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_CHARS) || null, points }
}
