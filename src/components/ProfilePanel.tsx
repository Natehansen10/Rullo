import { useEffect, useState } from 'react'
import { POSITIONS, type Position } from '../config'
import type { Profile } from '../lib/profile'
import { SegmentedControl } from './SegmentedControl'

interface ProfilePanelProps {
  profile: Profile
  onChange: (p: Partial<Profile>) => void
}

const POSITION_LABEL: Record<Position, string> = { hoods: 'Hoods', drops: 'Drops', aero: 'Aero' }

function NumberField({
  id,
  label,
  unit,
  value,
  step,
  onCommit,
}: {
  id: string
  label: string
  unit: string
  value: number
  step: number
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
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="ww-label">
        {label}
      </label>
      <div className="flex items-baseline gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            e.stopPropagation()
          }}
          className="ww-num w-[7ch] rounded-md border border-line-strong bg-raised px-3 py-2 text-title text-fg"
        />
        <span className="text-fg-muted">{unit}</span>
      </div>
    </div>
  )
}

/** Rider profile. Edited between rides only; changes apply to the next ride. */
export function ProfilePanel({ profile, onChange }: ProfilePanelProps) {
  return (
    <section aria-label="Rider profile" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <span className="ww-label">Profile</span>
        <span className="font-mono text-mono text-fg-subtle">saved in this browser · applies to your next ride</span>
      </div>
      <div className="flex flex-wrap items-end gap-8 border-t border-line px-6 py-4">
        <NumberField id="rider-lb" label="Rider weight" unit="lb" step={1} value={profile.riderLb} onCommit={(v) => onChange({ riderLb: v })} />
        <NumberField id="bike-lb" label="Bike weight" unit="lb" step={0.5} value={profile.bikeLb} onCommit={(v) => onChange({ bikeLb: v })} />
        <NumberField id="ftp-w" label="FTP" unit="W" step={1} value={profile.ftpW} onCommit={(v) => onChange({ ftpW: v })} />
        <div className="flex flex-col gap-2">
          <span className="ww-label">Position</span>
          <SegmentedControl
            label="Riding position"
            options={POSITIONS}
            value={profile.position}
            onChange={(position) => onChange({ position })}
            format={(p) => POSITION_LABEL[p]}
          />
        </div>
      </div>
    </section>
  )
}
