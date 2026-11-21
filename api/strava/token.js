/**
 * POST /api/strava/token
 * Body { code }: trade a sign-in code for tokens (once, right after the rider
 * approves on Strava). Body { refresh_token }: get a fresh access token.
 * The tokens go straight back to the rider's own browser, which keeps them.
 * Nothing is stored or logged here.
 */
import { fail, guard, isToken, json, readJson, smallJson, stravaError, tokenReply, tokenRequest } from '../../server/strava.js'

export async function POST(request) {
  const { stop, app } = guard(request)
  if (stop) return stop
  const body = await smallJson(request)
  if (!body) return fail(400, 'bad_request')

  const grant = isToken(body.code)
    ? { grant_type: 'authorization_code', code: body.code }
    : isToken(body.refresh_token)
      ? { grant_type: 'refresh_token', refresh_token: body.refresh_token }
      : null
  if (!grant) return fail(400, 'bad_request')

  const res = await tokenRequest(app, grant)
  if (!res) return fail(502, 'strava_down')
  // Strava answers 400 or 401 to a code or refresh token it does not accept: the rider has to sign in again.
  if (res.status === 400 || res.status === 401) return fail(401, 'unauthorized')
  if (!res.ok) return stravaError(res)
  const tokens = tokenReply(await readJson(res))
  return tokens ? json(200, tokens) : fail(502, 'strava_down')
}
