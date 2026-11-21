import { useEffect, useRef, useState, type ReactNode } from 'react'
import { POSITIONS, type Position } from '../config'
import { MPS_TO_MPH, steadySpeedMps } from '../lib/physics'
import { riderParams, type Profile } from '../lib/profile'
import { MAX_RIDER_NAME_CHARS, MAX_RIDERS, type Riders } from '../lib/rider'
import type { CourseOption, WorkoutOption } from '../lib/ride'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { SegmentedControl } from './SegmentedControl'
import { TextField } from './TextField'
import { ZoneTable } from './ZoneTable'

interface ProfilePageProps {
  profile: Profile
  onChange: (p: Partial<Profile>) => void
  /** Editing is locked during a ride. */
  editable: boolean
  courses: CourseOption[]
  workouts: WorkoutOption[]
  onImportCourse: (f: File) => void
  onRemoveCourse: (id: string) => void
  onImportWorkout: (f: File) => void
  onRemoveWorkout: (id: string) => void
  /** Open the workout builder: a new workout, a custom workout, or a copy of an imported one. */
  onNewWorkout: () => void
  onEditWorkout: (id: string) => void
  onCopyWorkout: (id: string) => void
  notice?: ReactNode
  /** Everyone who rides on this browser, and who is riding now. Null until the first visit has made a rider. */
  riders: Riders | null
  /** Riders can be switched and added only with the trainer disconnected and no ride on: it reloads the page. */
  canSwitchRider: boolean
  onSwitchRider: (id: string) => void
  onAddRider: () => void
  /** Returns false when the name is empty or another rider has it. */
  onRenameRider: (name: string) => boolean
  onRemoveRider: (id: string) => void
  /** The outcome of the last rider action, in plain words. */
  riderNote: string | null
  /** Download one file with everything saved in this browser. */
  onBackup: () => void
  /** Add what a backup file holds and this browser does not. */
  onRestore: (f: File) => void
  /** The outcome of the last back up or restore, in plain words. */
  backupNote: string | null
}

const CONFIRM_MS = 3000

interface FileItem {
  id: string
  name: string
  meta: string
  /** A second button before Remove, e.g. Edit. */
  action?: { label: string; onClick: () => void }
  /** Removing can't be undone by importing the file again: ask twice. */
  confirmRemove?: boolean
}

/** One kind of file: its buttons (import, and New workout for workouts) and the rider's own files, each with Remove. */
function Files({
  title,
  help,
  button,
  accept,
  items,
  disabled,
  onImport,
  onRemove,
  extra,
}: {
  title: string
  help: string
  button: string
  accept: string
  items: FileItem[]
  disabled: boolean
  onImport: (f: File) => void
  onRemove: (id: string) => void
  /** A button before the import button. */
  extra?: { label: string; onClick: () => void }
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(null), CONFIRM_MS)
    return () => clearTimeout(t)
  }, [confirming])
  return (
    <div className="border-t border-line first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-fg">{title}</span>
          <span className="text-fg-muted">{help}</span>
        </div>
        <div className="flex gap-3">
          {extra && (
            <Button onClick={extra.onClick} disabled={disabled}>
              {extra.label}
            </Button>
          )}
          <Button onClick={() => fileRef.current?.click()} disabled={disabled}>
            {button}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f)
            e.target.value = ''
          }}
        />
      </div>
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-4 border-t border-line px-6 py-3">
          <span className="font-semibold whitespace-nowrap text-fg">{it.name}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-mono text-fg-subtle">{it.meta}</span>
          {it.action && (
            <Button onClick={it.action.onClick} disabled={disabled} aria-label={`${it.action.label} ${it.name}`}>
              {it.action.label}
            </Button>
          )}
          {it.confirmRemove && confirming === it.id ? (
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(null)
                onRemove(it.id)
              }}
              disabled={disabled}
              aria-label={`Confirm remove ${it.name}`}
            >
              Confirm remove
            </Button>
          ) : (
            <Button
              onClick={() => (it.confirmRemove ? setConfirming(it.id) : onRemove(it.id))}
              disabled={disabled}
              aria-label={`Remove ${it.name}`}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
    </div>
  )
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

/** The current rider's name as a field: saved when the field is left, put back when the name can't be used. */
function RiderName({ name, disabled, onRename }: { name: string; disabled: boolean; onRename: (name: string) => boolean }) {
  const [text, setText] = useState(name)
  const [bad, setBad] = useState(false)
  useEffect(() => setText(name), [name])
  return (
    <TextField
      aria-label="Your name"
      value={text}
      maxLength={MAX_RIDER_NAME_CHARS}
      disabled={disabled}
      invalid={bad}
      onChange={(v) => {
        setText(v)
        setBad(false)
      }}
      onCommit={() => {
        if (text.trim() === name) return setText(name)
        setBad(!onRename(text))
      }}
      inputClassName="w-full font-semibold"
      className="min-w-0 flex-1"
    />
  )
}

/** Rider profile on its own screen. Saved in this browser; applies to the next ride. */
export function ProfilePage({
  profile,
  onChange,
  editable,
  courses,
  workouts,
  onImportCourse,
  onRemoveCourse,
  onImportWorkout,
  onRemoveWorkout,
  onNewWorkout,
  onEditWorkout,
  onCopyWorkout,
  notice,
  riders,
  canSwitchRider,
  onSwitchRider,
  onAddRider,
  onRenameRider,
  onRemoveRider,
  riderNote,
  onBackup,
  onRestore,
  backupNote,
}: ProfilePageProps) {
  const restoreRef = useRef<HTMLInputElement>(null)
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

      {riders && (
        <section aria-label="Riders" className="rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold text-fg">Who's riding</h2>
              <span className="text-fg-muted">
                Each rider has their own profile, rides, courses and workouts on this browser. No passwords.
              </span>
            </div>
            <Button onClick={onAddRider} disabled={!canSwitchRider || riders.riders.length >= MAX_RIDERS}>
              Add rider
            </Button>
          </div>
          {riders.riders.map((r) => {
            const current = r.id === riders.current
            return (
              <div key={r.id} data-rider={r.id} className="flex items-center gap-4 border-t border-line px-6 py-3">
                {current ? (
                  <RiderName name={r.name} disabled={!editable} onRename={onRenameRider} />
                ) : (
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg">{r.name}</span>
                )}
                {current ? (
                  <span className="font-mono text-mono whitespace-nowrap text-fg-muted">riding now</span>
                ) : (
                  <>
                    <Button onClick={() => onSwitchRider(r.id)} disabled={!canSwitchRider} aria-label={`Switch to ${r.name}`}>
                      Switch
                    </Button>
                    <Button onClick={() => onRemoveRider(r.id)} disabled={!canSwitchRider} aria-label={`Remove ${r.name}`}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
            )
          })}
          {(riderNote || !canSwitchRider) && (
            <p className="border-t border-line px-6 py-3 text-fg" aria-live="polite">
              {riderNote ?? 'Disconnect the trainer and end the ride to switch or add riders.'}
            </p>
          )}
        </section>
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
        {/* Right under the FTP field, so it follows the FTP as it changes. */}
        <div className="flex flex-col gap-3 border-t border-line px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-fg">Power zones</h2>
            <span className="text-fg-muted">Watt ranges at your FTP of {profile.ftpW} W. Workout blocks use the same colors.</span>
          </div>
          <ZoneTable ftpW={profile.ftpW} />
        </div>
      </section>

      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-fg">Your files</h2>
        <p className="text-fg-muted">Your own courses and workouts. They are saved in this browser and show on the Workout tab.</p>
      </div>
      {notice}
      <section aria-label="Your files" className="rounded-lg border border-line bg-surface">
        <Files
          title="Courses"
          help="GPX files. Any route with elevation works."
          button="Import GPX"
          accept=".gpx,application/gpx+xml"
          items={courses
            .filter((c) => c.source === 'imported')
            .map((c) => ({ id: c.id, name: c.name, meta: `${c.lengthMi.toFixed(1)} mi · ${Math.round(c.ascentFt).toLocaleString()} ft climbing` }))}
          disabled={!editable}
          onImport={onImportCourse}
          onRemove={onRemoveCourse}
        />
        <Files
          title="Workouts"
          help="Build your own, or import ZWO files, the format Zwift and most workout sites use."
          button="Import ZWO"
          accept=".zwo,application/xml,text/xml"
          extra={{ label: 'Custom Workout', onClick: onNewWorkout }}
          items={workouts
            .filter((w) => w.source !== 'builtin')
            .map((w) =>
              w.source === 'custom'
                ? {
                    id: w.id,
                    name: w.name,
                    meta: `custom · ${w.tag ?? 'medium'} · ${formatDuration(w.durationS)}`,
                    action: { label: 'Edit', onClick: () => onEditWorkout(w.id) },
                    confirmRemove: true,
                  }
                : {
                    id: w.id,
                    name: w.name,
                    meta: `imported · ${formatDuration(w.durationS)}`,
                    action: { label: 'Edit a copy', onClick: () => onCopyWorkout(w.id) },
                  },
            )}
          disabled={!editable}
          onImport={onImportWorkout}
          onRemove={onRemoveWorkout}
        />
      </section>

      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-fg">Back up and restore</h2>
        <p className="text-fg-muted">
          Everything here lives in this browser only, and clearing site data wipes it. Keep a backup file somewhere safe.
        </p>
      </div>
      <section aria-label="Back up and restore" className="rounded-lg border border-line bg-surface">
        <Row label="Back up everything" help="One file: your rides, courses, workouts, profile and settings.">
          <Button onClick={onBackup}>Back up</Button>
        </Row>
        <Row
          label="Restore from a backup"
          help="Adds the rides, courses and workouts this browser does not have. Nothing already here is changed or removed."
        >
          <Button onClick={() => restoreRef.current?.click()} disabled={!editable}>
            Restore
          </Button>
          <input
            ref={restoreRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Backup file to restore"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onRestore(f)
              e.target.value = ''
            }}
          />
        </Row>
        {backupNote && (
          <p className="border-t border-line px-6 py-3 text-fg" aria-live="polite">
            {backupNote}
          </p>
        )}
      </section>

      <p className="font-mono text-mono text-fg-subtle">
        total {profile.riderLb + profile.bikeLb} lb · {PREVIEW_W} W on a flat road ≈ {previewMph.toFixed(1)} mph
      </p>
    </div>
  )
}
