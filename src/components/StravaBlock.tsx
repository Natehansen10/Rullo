import { useEffect } from 'react'
import { useStrava } from '../hooks/useStrava'
import { strava } from '../lib/strava'
import { Button } from './Button'

interface StravaBlockProps {
  /** Signing in leaves the page, which would drop a connected trainer or a ride in progress. */
  canLeave: boolean
  /** The ended ride to come back to after signing in, if there is one. */
  endedRideId: number | null
}

/**
 * The Profile tab's Strava block: connect, who is connected, disconnect.
 * The connect button is Strava's own "Connect with Strava" asset, unaltered,
 * as their brand guidelines ask (the one exception to this app's own buttons;
 * see DESIGN.md).
 */
export function StravaBlock({ canLeave, endedRideId }: StravaBlockProps) {
  const st = useStrava()
  // Asked here, when the block shows, and never at page load: nothing else in the app waits on a server.
  useEffect(() => {
    void strava.checkSetup()
  }, [])

  const row = (title: string, help: string, control?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex max-w-md flex-col gap-1">
        <span className="font-semibold text-fg">{title}</span>
        <span className="text-fg-muted">{help}</span>
      </div>
      {control}
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-fg">Strava</h2>
        <p className="text-fg-muted">Send a finished ride to Strava with one click. Nothing is uploaded on its own.</p>
      </div>
      <section aria-label="Strava" className="rounded-lg border border-line bg-surface">
        {st.athlete
          ? row(
              `Connected as ${st.athlete}`,
              'After a ride, press Upload to Strava. Disconnect removes Weem Watts from your Strava account.',
              <Button onClick={() => void strava.disconnect()} disabled={st.busy}>
                {st.busy ? 'Disconnecting' : 'Disconnect'}
              </Button>,
            )
          : st.setup === 'unknown'
            ? row('Not connected', 'Checking if Strava upload is set up.')
            : st.setup === 'off'
              ? row(
                  'Strava upload is not set up yet',
                  'Until it is, download the FIT file after a ride and add it on strava.com (Upload activity, File).',
                )
              : row(
                  'Not connected',
                  canLeave
                    ? 'Connect once. Weem Watts asks only for permission to upload, and reads nothing from your account.'
                    : 'End the ride first: connecting opens Strava in this tab.',
                  canLeave && (
                    <button
                      type="button"
                      className="ww-strava-connect"
                      onClick={() => void strava.connect(endedRideId)}
                      disabled={st.busy}
                    >
                      <img src="/strava/btn_strava_connect_with_white.svg" alt="Connect with Strava" width={237} height={48} />
                    </button>
                  ),
                )}
        {st.message && (
          <p role="status" className="border-t border-line px-6 py-3 text-fg">
            {st.message}
          </p>
        )}
      </section>
      <p className="font-mono text-mono text-fg-subtle">Compatible with Strava</p>
    </>
  )
}
