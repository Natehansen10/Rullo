/**
 * POST /api/strava/upload?name=...&external_id=...
 *   Body: the FIT file (application/octet-stream). Authorization: Bearer <the rider's access token>.
 *   Passes the file to Strava as a virtual ride on a trainer. Strava processes it in the background.
 * GET /api/strava/upload?id=<upload id>
 *   Asks Strava how that upload is doing.
 *
 * Only a FIT file this app made on a real trainer is accepted: anything else
 * (a fake ride, another file, too big) is refused before Strava is called.
 * The file and the token pass through memory only.
 */
import { bearer, checkFit, fail, guard, isId, json, MAX_FIT_BYTES, plain, readJson, strava, stravaError, uploadReply } from '../../server/strava.js'

const auth = (token) => ({ authorization: `Bearer ${token}` })

export async function POST(request) {
  const { stop } = guard(request)
  if (stop) return stop
  const token = bearer(request)
  if (!token) return fail(401, 'unauthorized')
  if ((request.headers.get('content-type') ?? '').toLowerCase() !== 'application/octet-stream') return fail(400, 'bad_request')
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FIT_BYTES) return fail(413, 'too_large')

  let bytes
  try {
    bytes = new Uint8Array(await request.arrayBuffer())
  } catch {
    return fail(400, 'bad_request')
  }
  const bad = checkFit(bytes)
  if (bad) return fail(bad === 'too_large' ? 413 : 400, bad)

  const url = new URL(request.url)
  const name = plain(url.searchParams.get('name') ?? '', 100) || 'Free ride'
  const externalId = /^weem-watts-\d{6,12}$/.test(url.searchParams.get('external_id') ?? '') ? url.searchParams.get('external_id') : `weem-watts-${Date.now()}`

  const form = new FormData()
  form.set('file', new Blob([bytes], { type: 'application/octet-stream' }), `${externalId}.fit`)
  form.set('data_type', 'fit')
  form.set('sport_type', 'VirtualRide')
  form.set('trainer', '1')
  form.set('name', name)
  form.set('external_id', externalId)

  const res = await strava('/api/v3/uploads', { method: 'POST', headers: auth(token), body: form })
  if (!res) return fail(502, 'strava_down')
  // 201: accepted for processing. 400: refused at once, with a reason (a duplicate, a bad file).
  if (res.status === 201 || res.status === 400) {
    const upload = uploadReply(await readJson(res))
    if (upload && (upload.id || upload.error)) return json(200, upload)
    return res.status === 201 ? fail(502, 'strava_down') : fail(400, 'rejected')
  }
  return stravaError(res)
}

export async function GET(request) {
  const { stop } = guard(request)
  if (stop) return stop
  const token = bearer(request)
  if (!token) return fail(401, 'unauthorized')
  const id = new URL(request.url).searchParams.get('id')
  if (!isId(id)) return fail(400, 'bad_request')

  const res = await strava(`/api/v3/uploads/${id}`, { headers: auth(token) })
  if (!res?.ok) return stravaError(res)
  const upload = uploadReply(await readJson(res))
  return upload ? json(200, upload) : fail(502, 'strava_down')
}
