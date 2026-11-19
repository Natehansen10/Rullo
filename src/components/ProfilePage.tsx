import { useEffect, useState, type ReactNode } from 'react'
import { POSITIONS, type Position } from '../config'
import { MPS_TO_MPH, steadySpeedMps } from '../lib/physics'
import { riderParams, type Profile } from '../lib/profile'
import { SegmentedControl } from './SegmentedControl'

interface ProfilePageProps {
  profile: Profile
  onChange: (p: Partial<Profile>) => void
  /** Editing is locked during a ride. */
  editable: boolean
}

const POSITION_LABEL: Record<Position, string> = { hoods: 'Hoods', drops: 'Drops', aero: 'Aero' }
const PREVIEW_W = 200

function NumberInput({
  id,
  value,
  step,
  unit,
  disabled,
  onCommit,
}: {
  id: string
  value: number
  step: number
  unit: string
  disabled: boolean
  onCommit: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const v = Number.parseFloat(text)
    if (Number.isFinite(v)) onCommit(v)
    else setText(String(value))
  }
  return (
    <div className="flex items-baseline gap-2">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          e.stopPropagation()
        }}
        className="ww-num w-[7ch] rounded-md border border-line-strong bg-raised px-3 py-2 text-right text-title text-fg disabled:text-fg-subtle"
      />
      <span className="w-6 text-fg-muted">{unit}</span>
    </div>
  )
}

function Row({ label, htmlFor, help, children }: { label: string; htmlFor?: string; help: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4 first:border-t-0">
      <div className="flex flex-col gap-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-semibold text-fg">
            {label}
          </label>
        ) : (
          <span className="font-semibold text-fg">{label}</span>
        )}
        <span className="text-fg-muted">{help}</span>
      </div>
      {children}
    </div>
  )
}

/** Rider profile on its own screen. Saved in this browser; applies to the next ride. */
export function ProfilePage({ profile, onChange, editable }: ProfilePageProps) {
  const previewMph = steadySpeedMps(riderParams(profile), PREVIEW_W) * MPS_TO_MPH
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-fg">Profile</h1>
        <p className="text-fg-muted">
          Saved in this browser. Changes apply to your next ride. Past rides don't change.
        </p>
      </div>

      {!editable && (
        <div className="rounded-lg border border-line bg-surface px-6 py-4 text-fg">
          You're mid-ride. End the ride to edit your profile.
        </div>
      )}

      <section aria-label="Rider profile" className="rounded-lg border border-line bg-surface">
        <Row label="Rider weight" htmlFor="rider-lb" help="Used for speed. Matters most on climbs.">
          <NumberInput id="rider-lb" value={profile.riderLb} step={1} unit="lb" disabled={!editable} onCommit={(v) => onChange({ riderLb: v })} />
        </Row>
        <Row label="Bike weight" htmlFor="bike-lb" help="Bike plus bottles and anything on it.">
          <NumberInput id="bike-lb" value={profile.bikeLb} step={0.5} unit="lb" disabled={!editable} onCommit={(v) => onChange({ bikeLb: v })} />
        </Row>
        <Row label="Riding position" help="Sets air drag. Aero is for tri or clip-on bars.">
          <SegmentedControl
            label="Riding position"
            options={POSITIONS}
            value={profile.position}
            onChange={(position) => editable && onChange({ position })}
            format={(p) => POSITION_LABEL[p]}
          />
        </Row>
        <Row label="FTP" htmlFor="ftp-w" help="The power you can hold for about an hour. ERG shows targets as a % of it.">
          <NumberInput id="ftp-w" value={profile.ftpW} step={1} unit="W" disabled={!editable} onCommit={(v) => onChange({ ftpW: v })} />
        </Row>
      </section>

      <p className="font-mono text-mono text-fg-subtle">
        total {profile.riderLb + profile.bikeLb} lb · {PREVIEW_W} W on a flat road ≈ {previewMph.toFixed(1)} mph
      </p>
    </div>
  )
}
