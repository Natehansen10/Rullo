/**
 * GET /api/strava/config
 * Is Strava upload set up on this deployment? Returns the public client id
 * (it is part of the sign-in address, so it is not a secret). The client
 * secret is never returned by anything.
 */
import { credentials, fail, json, sameOrigin } from '../../server/strava.js'

export function GET(request) {
  if (!sameOrigin(request)) return fail(403, 'forbidden')
  const app = credentials()
  return json(200, app ? { configured: true, client_id: app.id } : { configured: false })
}
