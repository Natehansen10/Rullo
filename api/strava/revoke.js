/**
 * POST /api/strava/revoke
 * Body { token }: remove this app's access at Strava (Disconnect). Strava's
 * revoke endpoint needs the app's credentials, so it has to go through here.
 */
import { fail, guard, isToken, json, smallJson, strava, stravaError } from '../../server/strava.js'

export async function POST(request) {
  const { stop, app } = guard(request)
  if (stop) return stop
  const body = await smallJson(request)
  if (!body || !isToken(body.token)) return fail(400, 'bad_request')

  const res = await strava('/oauth/revoke', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${app.id}:${app.secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token: body.token }).toString(),
  })
  // 200 even when the token was already gone.
  return res?.ok ? json(200, { ok: true }) : stravaError(res)
}
