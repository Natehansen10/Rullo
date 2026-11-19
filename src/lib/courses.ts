/** Course catalog: built-in courses shipped in public/courses plus GPX files the rider imported. */
import { buildCourse, type Course } from './course'
import { parseGpx } from './gpx'
import * as recorder from './recorder'

interface BuiltinEntry {
  id: string
  name: string
  file: string
  description?: string
}

const COURSES_BASE = `${import.meta.env.BASE_URL}courses/`

async function loadBuiltins(): Promise<Course[]> {
  const res = await fetch(`${COURSES_BASE}index.json`)
  if (!res.ok) throw new Error('Could not load the course list.')
  const entries = (await res.json()) as BuiltinEntry[]
  const out: Course[] = []
  for (const e of entries) {
    try {
      const gpx = await (await fetch(COURSES_BASE + e.file)).text()
      out.push(buildCourse(parseGpx(gpx).points, { id: e.id, name: e.name, source: 'builtin', description: e.description }))
    } catch (err) {
      console.error(`Course ${e.id} failed to load:`, err)
    }
  }
  return out
}

function fromImported(row: recorder.ImportedCourseRow): Course {
  return buildCourse(parseGpx(row.gpx).points, { id: row.id, name: row.name, source: 'imported' })
}

export async function loadCourses(): Promise<Course[]> {
  const [builtins, imported] = await Promise.all([
    loadBuiltins().catch((err) => {
      console.error(err)
      return [] as Course[]
    }),
    recorder.listImportedCourses().catch(() => [] as recorder.ImportedCourseRow[]),
  ])
  const mine: Course[] = []
  for (const row of imported) {
    try {
      mine.push(fromImported(row))
    } catch (err) {
      console.error(`Imported course ${row.name} failed to load:`, err)
    }
  }
  return [...builtins, ...mine]
}

/** Parse, validate and save a GPX file. Throws with a rider-facing message on bad files. */
export async function importGpxFile(file: File): Promise<Course> {
  const text = await file.text()
  const parsed = parseGpx(text)
  const name = parsed.name || file.name.replace(/\.gpx$/i, '')
  const row: recorder.ImportedCourseRow = { id: `imported-${Date.now()}`, name, gpx: text, addedAt: Date.now() }
  const course = fromImported(row) // throws if unusable
  await recorder.saveImportedCourse(row)
  return course
}

export async function removeImportedCourse(id: string): Promise<void> {
  await recorder.deleteImportedCourse(id)
}
