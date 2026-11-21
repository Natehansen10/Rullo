import type { EndedRide } from '../lib/ride'
import { activityUrl, type StravaState } from '../lib/strava'
import { Button } from './Button'

interface StravaUploadProps {
  ended: EndedRide
  strava: StravaState
  /** May this be the screen's one primary button? */
  primary: boolean
  onUpload: () => void
  onConnect: () => void
}

/** Has this ride reached Strava (uploaded now, or found there already)? */
export function isOnStrava(ended: EndedRide | null): boolean {
  return !!ended?.strava && (!!ended.strava.activityId || ended.strava.duplicate === true)
}

/**
 * The ended ride's Strava slot in the top bar, beside Download FIT. One of:
 * Upload to Strava, a busy label, Check upload (Strava is still processing),
 * the link to the activity, or the way to Profile when Strava is not connected.
 * Always a click; nothing is sent on its own.
 */
export function StravaUpload({ ended, strava, primary, onUpload, onConnect }: StravaUploadProps) {
  const mark = ended.strava
  if (isOnStrava(ended)) {
    const url = mark?.activityId ? activityUrl(mark.activityId) : null
    return (
      <span className="flex items-center gap-3 whitespace-nowrap">
        <span className="ww-label">{mark?.duplicate ? 'Already on Strava' : 'Uploaded'}</span>
        {url && (
          <a className="ww-link" href={url} target="_blank" rel="noopener noreferrer">
            View on Strava
          </a>
        )}
      </span>
    )
  }
  if (!strava.athlete) return <Button onClick={onConnect}>Connect Strava to upload</Button>
  if (strava.upload !== 'idle') {
    return <Button disabled>{strava.upload === 'uploading' ? 'Uploading to Strava' : 'Strava is processing'}</Button>
  }
  return (
    <Button variant={primary ? 'primary' : 'secondary'} onClick={onUpload}>
      {mark?.uploadId ? 'Check upload' : 'Upload to Strava'}
    </Button>
  )
}
