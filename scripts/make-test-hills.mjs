// Generates public/courses/test-hills.gpx: a made-up 12 mile loop for testing.
// Run: node scripts/make-test-hills.mjs
import { writeFileSync } from 'node:fs'

const MI = 1609.344
const BASE_ELE = 1400
const STEP = 10 // meters between points

// [miles, grade %]. The last segment is solved so the loop ends where it started.
const segments = [
  [1.0, 0], [0.5, 1.5], [0.5, -1],
  [1.5, 6], // the main climb
  [0.5, 2], [1.5, -5], [0.5, 0],
  [0.3, 4], [0.3, -4], [0.3, 4], [0.3, -3], [0.3, 4], [0.3, -4], // rollers
  [0.5, 0],
  [0.5, 8], // steep kicker
  [0.75, -6], [1.0, -1],
]
const TOTAL_MI = 12
const used = segments.reduce((a, [mi]) => a + mi, 0)
const rise = segments.reduce((a, [mi, g]) => a + mi * MI * (g / 100), 0)
segments.push([TOTAL_MI - used, (-rise / ((TOTAL_MI - used) * MI)) * 100])

// Seeded noise so the file is identical every run (mimics GPS elevation jitter).
let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5

const totalM = TOTAL_MI * MI
const radius = totalM / (2 * Math.PI)
const center = { lat: 45.0, lon: -110.0 }
const mPerDegLat = 111132
const mPerDegLon = 111320 * Math.cos((center.lat * Math.PI) / 180)

const pts = []
let x = 0
let ele = BASE_ELE
let segIdx = 0
let segEnd = segments[0][0] * MI
while (x <= totalM + 0.01) {
  const a = (x / totalM) * 2 * Math.PI
  const lat = center.lat + (radius * Math.sin(a)) / mPerDegLat
  const lon = center.lon + (radius * (1 - Math.cos(a))) / mPerDegLon
  pts.push({ lat, lon, ele: ele + rand() * 3 })
  x += STEP
  while (segIdx < segments.length - 1 && x > segEnd) segEnd += segments[++segIdx][0] * MI
  ele += STEP * (segments[segIdx][1] / 100)
}

const trkpts = pts
  .map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`)
  .join('\n')
const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Weem Watts test course generator" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Test Hills</name><desc>Made-up 12 mile loop for testing: a 1.5 mi climb at 6%, rollers, and a steep kicker.</desc></metadata>
  <trk>
    <name>Test Hills</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`
writeFileSync(new URL('../public/courses/test-hills.gpx', import.meta.url), gpx)
console.log(`Wrote ${pts.length} points, ${TOTAL_MI} mi`)
