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

export function parseGpx(text: string): GpxTrack {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('This file is not valid GPX.')

  let nodes = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'))
  if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagNameNS('*', 'rtept'))

  const points: GpxPoint[] = []
  for (const n of nodes) {
    const lat = Number(n.getAttribute('lat'))
    const lon = Number(n.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const eleText = n.getElementsByTagNameNS('*', 'ele')[0]?.textContent
    const ele = eleText != null && eleText.trim() !== '' ? Number(eleText) : null
    points.push({ lat, lon, ele: ele !== null && Number.isFinite(ele) ? ele : null })
  }

  const nameNode =
    doc.getElementsByTagNameNS('*', 'trk')[0]?.getElementsByTagNameNS('*', 'name')[0] ??
    doc.getElementsByTagNameNS('*', 'metadata')[0]?.getElementsByTagNameNS('*', 'name')[0] ??
    doc.getElementsByTagNameNS('*', 'rte')[0]?.getElementsByTagNameNS('*', 'name')[0]
  return { name: nameNode?.textContent?.trim() || null, points }
}
