/**
 * Strava upload, browser side. The rider connects once (OAuth), then uploads
 * a finished ride with a click. Nothing here runs on its own: no upload, no
 * post, no request to Strava without a click.
 *
 * - The athlete's tokens live in this browser (localStorage), like the
 *   profile and rides. Disconnect clears them and revokes access at Strava.
 * - Every call goes through the app's own functions in /api/strava. Strava's
 *   docs say nothing about calling the API from a browser (CORS), and the
 *   token exchange needs the client secret, which only the server has.
 * - Nothing is ever read back from Strava except the athlete's name at
 *   sign-in and the state of an upload the rider made.
 *
 * Built from Strava's docs as read on Nov 20, 2026 (Authentication, Uploads).
 */

/** The smallest scope that allows an upload. Nothing is read. */
const SCOPE = 'activity:write'
const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize'
const TOKENS_KEY = 'ww.strava'
const PENDING_KEY = 'ww.strava.signin'
/** A sign-in that takes longer than this to come back is not trusted. */
const SIGNIN_MAX_MS = 15 * 60 * 1000
/** Refresh when the access token has less than this left. */
const REFRESH_MARGIN_S = 300
/** Strava asks for a second or more between checks; processing takes about 2 s on average. */
const POLL_EVERY_MS = 2000
const POLL_MAX_TRIES = 30

export interface StravaTokens {
  accessToken: string
  refreshToken: string
  /** Seconds since the epoch. */
  expiresAt: number
  athlete: string
}

export type UploadPhase = 'idle' | 'uploading' | 'processing'

export interface StravaState {
  /** unknown: not asked yet. off: STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set on the server. */
  setup: 'unknown' | 'on' | 'off'
  /** The connected athlete's name, or null. */
  athlete: string | null
  /** Connecting or disconnecting. */
  busy: boolean
  upload: UploadPhase
  /** A plain sentence about the last thing that went wrong, or a note. */
  message: string | null
}

/** What an upload came to. `pending`: Strava has it and is still working on it. */
export type UploadResult =
  | { kind: 'done'; activityId: string | null; duplicate: boolean; uploadId: string | null }
  | { kind: 'pending'; uploadId: string }
  | { kind: 'failed'; message: string }

const MESSAGES = {
  offline: "You're offline. The ride is saved in this browser. Upload it when you're back online.",
  down: 'Strava is not responding. The ride is saved in this browser. Try again later.',
  rateLimited: "Strava's rate limit is reached. Try again in 15 minutes.",
  revoked: 'Strava access was removed. Connect again on the Profile tab.',
  noPermission: 'Strava did not get permission to upload. Disconnect, connect again, and leave the upload box checked.',
  notSetUp: 'Strava upload is not set up yet.',
  refused: "This ride can't be uploaded.",
  fake: "A ride from the fake trainer can't be uploaded.",
  cancelled: 'Strava sign-in was cancelled.',
  unverified: 'The Strava sign-in could not be verified. Try connecting again.',
  signInFailed: 'Strava did not accept the sign-in. Try connecting again.',
  stillProcessing: 'Strava is still processing the ride. Check again in a minute.',
} as const

function loadTokens(): StravaTokens | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null') as Partial<StravaTokens> | null
    if (!t || typeof t.accessToken !== 'string' || typeof t.refreshToken !== 'string' || typeof t.expiresAt !== 'number') return null
    return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: t.expiresAt, athlete: typeof t.athlete === 'string' ? t.athlete.slice(0, 80) : '' }
  } catch {
    return null
  }
}

function saveTokens(t: StravaTokens | null): void {
  try {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t))
    else localStorage.removeItem(TOKENS_KEY)
  } catch {
    // storage unavailable: connected for this session only
  }
}

interface Reply {
  /** 0: the request never got an answer (offline, or the function is not there). */
  status: number
  body: Record<string, unknown> | null
}

/** Call one of the app's own functions. Never throws. */
async function call(path: string, init?: RequestInit): Promise<Reply> {
  try {
    const res = await fetch(path, { ...init, cache: 'no-store', credentials: 'omit' })
    let body: Record<string, unknown> | null = null
    try {
      const parsed: unknown = await res.json()
      if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>
    } catch {
      // Not JSON: the function is not deployed here (local dev serves the page instead).
    }
    return { status: res.status, body }
  } catch {
    return { status: 0, body: null }
  }
}

interface PendingSignIn {
  state?: unknown
  origin?: unknown
  rideId?: unknown
  at?: unknown
}

/** The sign-in this tab started, read once and removed. */
function takePending(): PendingSignIn | null {
  try {
    const p: unknown = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null')
    sessionStorage.removeItem(PENDING_KEY)
    return p && typeof p === 'object' ? (p as PendingSignIn) : null
  } catch {
    return null
  }
}

const errorOf = (r: Reply): string => (typeof r.body?.error === 'string' && r.status >= 400 ? r.body.error : '')
const isDigits = (v: unknown): v is string => typeof v === 'string' && /^\d{1,20}$/.test(v)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The link to an activity. The id is digits only, checked wherever it comes from. */
export function activityUrl(activityId: string): string | null {
  return isDigits(activityId) ? `https://www.strava.com/activities/${activityId}` : null
}

class Strava {
  private listeners = new Set<() => void>()
  private tokens = loadTokens()
  private clientId: string | null = null
  private configAsked: Promise<void> | null = null
  private state: StravaState = { setup: 'unknown', athlete: this.tokens ? this.tokens.athlete || 'your Strava account' : null, busy: false, upload: 'idle', message: null }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.state

  private set(patch: Partial<StravaState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  clearMessage = () => {
    if (this.state.message) this.set({ message: null })
  }

  /**
   * Ask the server whether Strava upload is set up. Called only where Strava
   * shows (the Profile tab, an ended ride), never at page load, so the app
   * does not depend on a server. No answer, or an answer that is not ours
   * (local dev), counts as not set up, with nothing in the console.
   */
  checkSetup = (): Promise<void> => {
    this.configAsked ??= (async () => {
      const r = await call('/api/strava/config')
      const id = r.body?.client_id
      if (r.status === 200 && r.body?.configured === true && typeof id === 'string' && /^\d{1,12}$/.test(id)) {
        this.clientId = id
        this.set({ setup: 'on' })
      } else {
        this.set({ setup: 'off' })
        // Offline is not "not set up": ask again next time.
        if (r.status === 0) this.configAsked = null
      }
    })()
    return this.configAsked
  }

  /**
   * Go to Strava to sign in. Leaves the page. A random state is kept for this
   * tab and checked on the way back (CSRF), with the origin the sign-in must
   * return to. `rideId`: the ended ride to show again afterwards.
   */
  connect = async (rideId: number | null = null) => {
    if (this.state.busy) return
    this.set({ busy: true, message: null })
    await this.checkSetup()
    if (!this.clientId) {
      this.set({ busy: false, message: navigator.onLine === false ? MESSAGES.offline : MESSAGES.notSetUp })
      return
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, origin: window.location.origin, rideId, at: Date.now() }))
    } catch {
      this.set({ busy: false, message: 'This browser blocks the storage the Strava sign-in needs.' })
      return
    }
    const q = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${window.location.origin}/`,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: SCOPE,
      state,
    })
    window.location.assign(`${AUTHORIZE_URL}?${q.toString()}`)
  }

  /**
   * On page load: is this the way back from a Strava sign-in? If so, check
   * it, trade the code for tokens, and clean the address bar. Returns null
   * when the page was opened normally.
   */
  finishSignIn = async (): Promise<{ ok: boolean; rideId: number | null } | null> => {
    const q = new URLSearchParams(window.location.search)
    const state = q.get('state')
    const code = q.get('code')
    const denied = q.get('error')
    if (!state || (!code && !denied)) return null

    const pending = takePending()
    // The code must never stay in the address bar or the history.
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)

    const rideId = typeof pending?.rideId === 'number' && Number.isInteger(pending.rideId) ? pending.rideId : null
    const fresh = typeof pending?.at === 'number' && Date.now() - pending.at < SIGNIN_MAX_MS
    if (!pending || pending.state !== state || pending.origin !== window.location.origin || !fresh) {
      this.set({ message: MESSAGES.unverified })
      return { ok: false, rideId: null }
    }
    if (denied || !code) {
      this.set({ message: MESSAGES.cancelled })
      return { ok: false, rideId }
    }
    // The rider can untick a permission on Strava's page. Without upload there is nothing to connect.
    const granted = (q.get('scope') ?? '').split(/[ ,]+/)
    if (!granted.includes(SCOPE)) {
      this.set({ message: MESSAGES.noPermission })
      return { ok: false, rideId }
    }

    this.set({ busy: true, message: null })
    const r = await call('/api/strava/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    const t = this.tokensFrom(r, '')
    if (!t) {
      this.set({ busy: false, message: this.failure(r, MESSAGES.signInFailed) })
      return { ok: false, rideId }
    }
    this.tokens = t
    saveTokens(t)
    this.set({ busy: false, setup: 'on', athlete: t.athlete || 'your Strava account', message: null })
    return { ok: true, rideId }
  }

  private tokensFrom(r: Reply, athlete: string): StravaTokens | null {
    const b = r.body
    if (r.status !== 200 || !b || typeof b.access_token !== 'string' || typeof b.refresh_token !== 'string' || typeof b.expires_at !== 'number') return null
    return {
      accessToken: b.access_token,
      refreshToken: b.refresh_token,
      expiresAt: b.expires_at,
      athlete: typeof b.athlete === 'string' && b.athlete.trim() ? b.athlete.trim().slice(0, 80) : athlete,
    }
  }

  /** A failed reply as a plain sentence. */
  private failure(r: Reply, fallback: string): string {
    const e = errorOf(r)
    if (r.status === 0) return navigator.onLine === false ? MESSAGES.offline : MESSAGES.down
    if (e === 'not_configured') return MESSAGES.notSetUp
    if (e === 'rate_limited') return MESSAGES.rateLimited
    if (e === 'strava_down' || r.status >= 500) return MESSAGES.down
    if (e === 'no_permission') return MESSAGES.noPermission
    if (e === 'fake_ride') return MESSAGES.fake
    if (e === 'not_fit' || e === 'not_a_trainer_ride' || e === 'too_large' || e === 'bad_request' || e === 'forbidden') return MESSAGES.refused
    return fallback
  }

  /** Forget the connection here, for good or because Strava no longer accepts it. */
  private forget(message: string | null) {
    this.tokens = null
    saveTokens(null)
    this.set({ athlete: null, busy: false, upload: 'idle', message })
  }

  /** Clear the tokens here and revoke this app's access at Strava. */
  disconnect = async () => {
    const t = this.tokens
    if (!t || this.state.busy) return
    this.set({ busy: true, message: null })
    const r = await call('/api/strava/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t.refreshToken }) })
    // Disconnected here whatever Strava said: the tokens are gone from this browser.
    this.forget(
      r.status === 200 || errorOf(r) === 'unauthorized'
        ? null
        : 'Disconnected here. Strava could not be reached to remove access: remove Rullo under Settings, My Apps on strava.com.',
    )
  }

  /**
   * A token that works, refreshed first when it is about to expire (`force`:
   * Strava just refused it). Null with `revoked` when Strava no longer
   * accepts the refresh token: the rider removed access, and has to connect again.
   */
  private async freshToken(force = false): Promise<{ token: string } | { fail: Reply; revoked: boolean }> {
    const t = this.tokens
    if (!t) return { fail: { status: 401, body: { error: 'unauthorized' } }, revoked: true }
    if (!force && t.expiresAt - Date.now() / 1000 > REFRESH_MARGIN_S) return { token: t.accessToken }
    const r = await call('/api/strava/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refreshToken }) })
    const next = this.tokensFrom(r, t.athlete)
    if (next) {
      // Strava may hand back a new refresh token; the old one stops working at once.
      this.tokens = next
      saveTokens(next)
      return { token: next.accessToken }
    }
    return { fail: r, revoked: errorOf(r) === 'unauthorized' }
  }

  /** One call with the rider's token; on a refusal, refresh once and try again. */
  private async authed(send: (token: string) => Promise<Reply>): Promise<Reply | { revoked: true }> {
    for (const force of [false, true]) {
      const t = await this.freshToken(force)
      if ('fail' in t) return t.revoked ? { revoked: true } : t.fail
      const r = await send(t.token)
      if (errorOf(r) !== 'unauthorized') return r
    }
    return { revoked: true }
  }

  /**
   * Upload one ride and wait for Strava to process it. Always from a click.
   * `resumeUploadId`: an upload Strava already has; only ask how it is doing.
   */
  upload = async (file: { bytes: Uint8Array; name: string; externalId: string } | null, resumeUploadId: string | null = null): Promise<UploadResult> => {
    if (this.state.upload !== 'idle') return { kind: 'failed', message: 'An upload is already running.' }
    const done = (result: UploadResult): UploadResult => {
      this.set({ upload: 'idle', message: result.kind === 'failed' ? result.message : result.kind === 'pending' ? MESSAGES.stillProcessing : null })
      return result
    }
    const failed = (r: Reply | { revoked: true }, fallback: string): UploadResult => {
      if ('revoked' in r) {
        this.forget(MESSAGES.revoked)
        return { kind: 'failed', message: MESSAGES.revoked }
      }
      if (errorOf(r) === 'not_configured') this.set({ setup: 'off' })
      return done({ kind: 'failed', message: this.failure(r, fallback) })
    }
    /** What Strava says about the upload: finished, failed, or still working (null). */
    const read = (b: Record<string, unknown> | null, uploadId: string | null): UploadResult | null => {
      if (!b) return { kind: 'failed', message: MESSAGES.down }
      if (b.duplicate === true) return { kind: 'done', activityId: isDigits(b.duplicate_of) ? b.duplicate_of : null, duplicate: true, uploadId }
      if (typeof b.error === 'string' && b.error) return { kind: 'failed', message: `Strava could not use the file: ${b.error.slice(0, 160)}` }
      if (isDigits(b.activity_id)) return { kind: 'done', activityId: b.activity_id, duplicate: false, uploadId }
      if (typeof b.status === 'string' && /deleted/i.test(b.status)) return { kind: 'failed', message: 'The activity was deleted on Strava.' }
      return null
    }

    this.set({ upload: resumeUploadId ? 'processing' : 'uploading', message: null })
    let uploadId = resumeUploadId
    if (!uploadId) {
      if (!file) return done({ kind: 'failed', message: MESSAGES.refused })
      const q = new URLSearchParams({ name: file.name, external_id: file.externalId })
      const r = await this.authed((token) =>
        call(`/api/strava/upload?${q.toString()}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
          body: file.bytes,
        }),
      )
      if ('revoked' in r || r.status !== 200) return failed(r, MESSAGES.refused)
      const first = read(r.body, isDigits(r.body?.id) ? r.body.id : null)
      if (first) return done(first)
      if (!isDigits(r.body?.id)) return done({ kind: 'failed', message: MESSAGES.down })
      uploadId = r.body.id
      this.set({ upload: 'processing' })
    }

    for (let i = 0; i < POLL_MAX_TRIES; i++) {
      await sleep(POLL_EVERY_MS)
      const id = uploadId
      const r = await this.authed((token) => call(`/api/strava/upload?id=${id}`, { headers: { authorization: `Bearer ${token}` } }))
      if ('revoked' in r) return failed(r, MESSAGES.down)
      if (r.status !== 200) {
        // Strava has the file. A hiccup while asking is not a failed upload: it can be checked again.
        this.set({ upload: 'idle', message: `${this.failure(r, MESSAGES.down)} Strava has the ride; press Check upload.` })
        return { kind: 'pending', uploadId }
      }
      const now = read(r.body, uploadId)
      if (now) return done(now)
    }
    return done({ kind: 'pending', uploadId })
  }
}

export const strava = new Strava()
