/**
 * Shared code for the Strava functions in /api/strava. Server only.
 *
 * This is the app's one server piece (an exception made for Strava upload on
 * Nov 21, 2026; see CLAUDE.md). It exists because Strava's token exchange
 * needs the client secret, which must never reach a browser. Rules it keeps:
 * - Stateless. No database, no accounts, nothing written anywhere.
 * - Nothing is logged: no tokens, no ride data, no Strava responses.
 * - The secret is read from the environment here and only here. It is never
 *   put in a response, an error message or a thrown Error.
 * - Errors go to the browser as a short code. Strava's own response bodies
 *   are never passed through, apart from an upload's status text with any
 *   markup stripped.
 *
 * Built from Strava's docs as read on Nov 20, 2026: Authentication, Uploads,
 * Rate Limits. Plain Node, no dependencies.
 */

const STRAVA = 'https://www.strava.com'
const TIMEOUT_MS = 20000

/** Vercel caps a request body at 4.5 MB. A 6-hour ride is about 0.5 MB. */
export const MAX_FIT_BYTES = 4 * 1024 * 1024

/** file_id product numbers written by src/lib/fit.ts: only a real trainer's ride may be uploaded. */
const PRODUCT_TRAINER = 1
const PRODUCT_FAKE = 2
const MANUFACTURER_DEVELOPMENT = 255
const FILE_TYPE_ACTIVITY = 4

/** The app's Strava credentials, or null when either variable is missing. */
export function credentials() {
  const id = (process.env.STRAVA_CLIENT_ID ?? '').trim()
  const secret = (process.env.STRAVA_CLIENT_SECRET ?? '').trim()
  return /^\d{1,12}$/.test(id) && secret.length > 0 ? { id, secret } : null
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })
}

/** A plain error: a short code the app turns into its own words. */
export const fail = (status, error) => json(status, { error })

/**
 * Only this site's own pages may call these functions. A browser always sends
 * Origin on a POST and Sec-Fetch-Site on a same-origin GET. No CORS headers
 * are ever sent, so another site could not read a reply either.
 */
export function sameOrigin(request) {
  const hosts = [request.headers.get('host'), request.headers.get('x-forwarded-host')].filter(Boolean)
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      return hosts.includes(new URL(origin).host)
    } catch {
      return false
    }
  }
  return request.method === 'GET' && request.headers.get('sec-fetch-site') === 'same-origin'
}

/** Checks shared by every function. Returns a Response to send back, or the credentials. */
export function guard(request) {
  if (!sameOrigin(request)) return { stop: fail(403, 'forbidden') }
  const app = credentials()
  if (!app) return { stop: fail(503, 'not_configured') }
  return { app }
}

/** A JSON body of at most a few hundred bytes, or null. */
export async function smallJson(request) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return null
  try {
    const text = await request.text()
    if (text.length > 2000) return null
    const body = JSON.parse(text)
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

/** Codes, tokens and ids from the browser: one short run of safe characters. */
export const isToken = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{8,200}$/.test(v)
export const isId = (v) => typeof v === 'string' && /^\d{1,20}$/.test(v)

/** The bearer token from the Authorization header, or null. */
export function bearer(request) {
  const m = /^Bearer ([A-Za-z0-9_-]{8,200})$/.exec(request.headers.get('authorization') ?? '')
  return m ? m[1] : null
}

/** Call Strava. Never throws: a network failure or timeout comes back as null. */
export async function strava(path, init) {
  try {
    return await fetch(STRAVA + path, { ...init, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return null
  }
}

/** A Strava reply that is not a success, as this app's error. */
export function stravaError(res) {
  if (!res) return fail(502, 'strava_down')
  if (res.status === 401) return fail(401, 'unauthorized')
  if (res.status === 403) return fail(403, 'no_permission')
  if (res.status === 429) return fail(429, 'rate_limited')
  if (res.status >= 500) return fail(502, 'strava_down')
  return fail(400, 'rejected')
}

export async function readJson(res) {
  try {
    const body = await res.json()
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}

/** POST /oauth/token with the app's credentials. `params` is the grant. */
export async function tokenRequest(app, params) {
  return strava('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: app.id, client_secret: app.secret, ...params }).toString(),
  })
}

/** The token fields the browser keeps. Everything else Strava sent is dropped. */
export function tokenReply(body) {
  if (!body || !isToken(body.access_token) || !isToken(body.refresh_token) || !Number.isFinite(body.expires_at)) return null
  const out = { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Math.round(body.expires_at) }
  if (typeof body.scope === 'string') out.scope = body.scope.slice(0, 200)
  const a = body.athlete
  if (a && typeof a === 'object') {
    const name = [a.firstname, a.lastname].filter((x) => typeof x === 'string' && x.trim()).join(' ')
    out.athlete = plain(name, 80)
  }
  return out
}

/** Text from Strava with any markup removed, on one line, cut short. */
export function plain(text, max = 200) {
  return String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** An upload as Strava reports it, cut down to what the app needs. */
export function uploadReply(body) {
  if (!body) return null
  const id = typeof body.id_str === 'string' ? body.id_str : Number.isSafeInteger(body.id) ? String(body.id) : null
  const activity = Number.isSafeInteger(body.activity_id) ? String(body.activity_id) : isId(body.activity_id) ? body.activity_id : null
  const raw = typeof body.error === 'string' ? body.error : null
  // A duplicate names the activity Strava already has, sometimes inside a link.
  const dup = raw ? (/activities\/(\d{1,20})/.exec(raw) ?? /duplicate of activity (\d{1,20})/i.exec(raw)) : null
  return {
    id: id && isId(id) ? id : null,
    status: plain(body.status, 120),
    error: raw ? plain(raw) : null,
    activity_id: activity,
    duplicate: raw ? /duplicate/i.test(raw) : false,
    duplicate_of: dup ? dup[1] : null,
  }
}

// --- FIT checks ---

const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400]

function crc16(bytes, end) {
  let crc = 0
  for (let i = 0; i < end; i++) {
    const b = bytes[i]
    let tmp = CRC_TABLE[crc & 0xf]
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[b & 0xf]
    tmp = CRC_TABLE[crc & 0xf]
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf]
  }
  return crc
}

/**
 * Is this a FIT activity file this app made on a real trainer?
 * Checks the header, the size it declares, the file checksum, and the first
 * message, which must be a file_id of type activity with this app's
 * manufacturer and the "real trainer" product number. Returns null when it
 * is, or the error code.
 */
export function checkFit(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 14 + 2 + 12) return 'not_fit'
  if (bytes.length > MAX_FIT_BYTES) return 'too_large'
  const headerSize = bytes[0]
  if (headerSize !== 14 && headerSize !== 12) return 'not_fit'
  if (String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) !== '.FIT') return 'not_fit'
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const dataSize = view.getUint32(4, true)
  if (headerSize + dataSize + 2 !== bytes.length) return 'not_fit'
  if (crc16(bytes, bytes.length - 2) !== view.getUint16(bytes.length - 2, true)) return 'not_fit'

  // First message: a definition for file_id (global message 0), little-endian.
  let o = headerSize
  const end = bytes.length - 2
  if ((bytes[o] & 0xf0) !== 0x40 || bytes[o + 2] !== 0 || o + 6 > end) return 'not_fit'
  if (view.getUint16(o + 3, true) !== 0) return 'not_fit'
  const count = bytes[o + 5]
  o += 6
  if (o + count * 3 + 1 > end) return 'not_fit'
  const fields = []
  for (let i = 0; i < count; i++) fields.push({ num: bytes[o + i * 3], size: bytes[o + i * 3 + 1] })
  o += count * 3
  // Then its one data message.
  if ((bytes[o] & 0xf0) !== 0x00) return 'not_fit'
  o += 1
  const got = {}
  for (const f of fields) {
    if (o + f.size > end) return 'not_fit'
    if (f.size === 1) got[f.num] = bytes[o]
    else if (f.size === 2) got[f.num] = view.getUint16(o, true)
    o += f.size
  }
  if (got[0] !== FILE_TYPE_ACTIVITY || got[1] !== MANUFACTURER_DEVELOPMENT) return 'not_fit'
  if (got[2] === PRODUCT_FAKE) return 'fake_ride'
  if (got[2] !== PRODUCT_TRAINER) return 'not_a_trainer_ride'
  return null
}
