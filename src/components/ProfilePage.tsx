import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { POSITIONS, type Position } from '../config'
import { PROFILE_SECTIONS, profileHref, type ProfileSection } from '../hooks/useRoute'
import { lastBackupAt } from '../lib/backup'
import { loadHistory, peekHistory, type RideSummary } from '../lib/history'
import { MPS_TO_MPH, steadySpeedMps } from '../lib/physics'
import { hasSavedProfile, riderParams, type Profile } from '../lib/profile'
import { dateOf } from '../lib/rideFormat'
import { MAX_RIDER_NAME_CHARS, MAX_RIDERS, type Riders } from '../lib/rider'
import type { CourseOption, WorkoutOption } from '../lib/ride'
import { formatDuration } from '../lib/workout'
import { Button } from './Button'
import { SegmentedControl } from './SegmentedControl'
import { Stat } from './Stat'
import { TextField } from './TextField'
import { ZoneTable } from './ZoneTable'

interface ProfilePageProps {
  /** The one section on screen, from the address. */
  section: ProfileSection
  /** Read the ride list again when this changes (a ride started or ended). */
  ridePhase: string
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
  /** The Strava block (connect, who is connected, disconnect), the last block on the page. */
  strava?: ReactNode
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
/** The climb in the speed preview: steep enough that weight shows, common enough to know. */
const PREVIEW_GRADE = 0.05
const EMPTY = '--'

const SECTION_LABEL: Record<ProfileSection, string> = {
  numbers: 'Your numbers',
  riders: 'Riders',
  files: 'Your files',
  data: 'Data and connections',
}

/** One line of the rail's rider panel: what it is on the left, the value on the right. */
function Fact({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line px-6 py-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={`text-right font-semibold ${dim ? 'text-fg-subtle' : 'text-fg'}`}>{value}</dd>
    </div>
  )
}

/** A section's title and its one line of help. */
function SectionHead({ title, help }: { title: string; help: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-title font-semibold text-fg">{title}</h2>
      <p className="text-fg-muted">{help}</p>
    </div>
  )
}

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

/**
 * The rider on their own screen: a left rail (who is riding, at a glance, and
 * the section menu) and one section at a time in the main column. Saved in
 * this browser; changes apply to the next ride.
 */
export function ProfilePage({
  section,
  ridePhase,
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
  strava,
  onBackup,
  onRestore,
  backupNote,
}: ProfilePageProps) {
  const restoreRef = useRef<HTMLInputElement>(null)
  const params = riderParams(profile)
  const flatMph = steadySpeedMps(params, PREVIEW_W) * MPS_TO_MPH
  const climbMph = steadySpeedMps(params, PREVIEW_W, PREVIEW_GRADE) * MPS_TO_MPH
  /** Fixed for this visit, so the dates do not shift while the page is open. */
  const [now] = useState(() => Date.now())

  /** The rider's finished rides, for the rail. Null until they are read; the facts wait as "--". */
  const [rides, setRides] = useState<RideSummary[] | null>(peekHistory)
  useEffect(() => {
    let live = true
    loadHistory()
      .then((all) => live && setRides(all))
      .catch((err) => console.error('Could not read ride history:', err))
    return () => {
      live = false
    }
  }, [ridePhase])

  // Read again after a back up, a restore or a change to the numbers: each can change the answer.
  const backedUpAt = useMemo(() => lastBackupAt(), [backupNote])
  const starting = useMemo(() => !hasSavedProfile(), [profile, backupNote])

  const me = riders?.riders.find((r) => r.id === riders.current) ?? null
  const myFiles = courses.filter((c) => c.source === 'imported').length + workouts.filter((w) => w.source !== 'builtin').length
  const day = (t: number) => dateOf(t, now).day
  // A rider made before riders had a date still has rides from earlier: the first ride is the better start.
  const since = me ? Math.min(me.createdAt, ...(rides ?? []).map((r) => r.startedAt)) : null
  const count: Partial<Record<ProfileSection, number>> = { riders: riders?.riders.length, files: myFiles }

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-fg">Profile</h1>
        <p className="text-fg-muted">Saved in this browser. Changes apply to your next ride. Past rides don't change.</p>
      </div>

      <div className="ww-home">
        <div className="ww-home-rail">
          <section aria-label="Rider" className="rounded-lg border border-line bg-surface">
            <div className="flex flex-col gap-1 px-6 py-4">
              <h2 className="truncate font-semibold text-fg">{me?.name ?? 'Rider'}</h2>
              <span className="text-fg-muted">
                {profile.ftpW} W FTP · {profile.riderLb} lb
              </span>
            </div>
            <dl>
              <Fact label="Rides" value={rides ? String(rides.length) : EMPTY} dim={!rides} />
              <Fact label="Last ride" value={rides ? (rides[0] ? day(rides[0].startedAt) : 'None yet') : EMPTY} dim={!rides?.[0]} />
              <Fact label="Riding since" value={since !== null ? day(since) : EMPTY} dim={since === null} />
              <Fact label="Last backup" value={backedUpAt !== null ? day(backedUpAt) : 'Never'} dim={backedUpAt === null} />
            </dl>
          </section>

          <nav aria-label="Profile sections" className="flex flex-col gap-1">
            {PROFILE_SECTIONS.map((p) => (
              <a
                key={p}
                href={profileHref(p)}
                aria-current={p === section ? 'page' : undefined}
                className={`ww-press flex items-baseline justify-between gap-2 rounded-md border px-3 py-2 font-semibold ${
                  p === section ? 'border-line-strong bg-surface text-fg' : 'border-transparent text-fg-muted hover:text-fg'
                }`}
              >
                {SECTION_LABEL[p]}
                {count[p] !== undefined && <span className="font-mono text-mono font-normal text-fg-subtle">{count[p]}</span>}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex max-w-3xl min-w-0 flex-col gap-6">
          {!editable && (
            <div className="rounded-lg border border-line bg-surface px-6 py-4 text-fg">
              You're mid-ride. End the ride to edit your profile.
            </div>
          )}
          {notice}

          {section === 'numbers' && (
            <>
              <SectionHead title="Your numbers" help="Weight and position set your speed. FTP sets your zones and every workout target." />
              {starting && (
                <div className="rounded-lg border border-line bg-surface px-6 py-4 text-fg">
                  These are starting numbers, not yours. Set your weight and FTP so speed and zones fit you.
                </div>
              )}
              <section aria-label="Weight and position" className="rounded-lg border border-line bg-surface">
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
                {/* What the three rows above come to, so a change shows at once. */}
                <div className="flex flex-col gap-3 border-t border-line px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-fg">On the road at {PREVIEW_W} W</h3>
                    <span className="text-fg-muted">How fast these numbers make you. Weight shows on the climb, position on the flat.</span>
                  </div>
                  <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                    <Stat label="Flat road" value={flatMph.toFixed(1)} unit="mph" dim={false} />
                    <Stat label="5% climb" value={climbMph.toFixed(1)} unit="mph" dim={false} />
                    <Stat label="You and the bike" value={String(Math.round((profile.riderLb + profile.bikeLb) * 10) / 10)} unit="lb" dim={false} />
                  </div>
                </div>
              </section>

              <section aria-label="FTP and power zones" className="rounded-lg border border-line bg-surface">
                <Row label="FTP" htmlFor="ftp-w" help="The power you can hold for about an hour. ERG shows targets as a % of it.">
                  <NumberInput id="ftp-w" value={profile.ftpW} step={1} unit="W" disabled={!editable} onCommit={(v) => onChange({ ftpW: v })} />
                </Row>
                {/* Right under the FTP field, so it follows the FTP as it changes. */}
                <div className="flex flex-col gap-3 border-t border-line px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-fg">Power zones</h3>
                    <span className="text-fg-muted">Watt ranges at your FTP of {profile.ftpW} W. Workout blocks use the same colors.</span>
                  </div>
                  <ZoneTable ftpW={profile.ftpW} />
                </div>
              </section>
            </>
          )}

          {section === 'riders' && (
            <>
              <SectionHead title="Riders" help="For a shared trainer. Each rider has their own profile, rides, courses and workouts on this browser. No passwords." />
              {riders && (
                <section aria-label="Riders" className="rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-semibold text-fg">Who's riding</h3>
                      <span className="text-fg-muted">Your name is the field. Add rider makes a new rider and switches to them.</span>
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
            </>
          )}

          {section === 'files' && (
            <>
              <SectionHead title="Your files" help="Your own courses and workouts. They are saved in this browser and show on the Workout tab." />
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
            </>
          )}

          {section === 'data' && (
            <>
              <SectionHead
                title="Back up and restore"
                help="Everything here lives in this browser only, and clearing site data wipes it. Keep a backup file somewhere safe."
              />
              <section aria-label="Back up and restore" className="rounded-lg border border-line bg-surface">
                <Row
                  label="Back up everything"
                  help={`One file: your rides, courses, workouts, profile and settings. ${
                    backedUpAt !== null ? `Last backed up ${day(backedUpAt)}.` : 'Not backed up from this browser yet.'
                  }`}
                >
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

              {strava}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
