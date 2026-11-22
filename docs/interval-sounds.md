# Interval sounds (Nov 22, 2026)

Asked for by Nate on Nov 22, 2026. From `docs/zwift-complaints-research.md` (complaint 13: audio cues, the most-voted new Zwift request of the past year) and `docs/zwift-ride-experience-research.md` ("optional interval sounds, off by default"). Built ahead of the v3.2 ride test as another exception (see `CLAUDE.md`). Its own ride test is pending.

## What was built

- **Three beeps and a tone.** In a workout, a short beep at 3, 2 and 1 seconds left in an interval, then a longer, higher tone when the next interval starts. The same long tone, a little longer, when the workout ends.
- **Off by default.** One row, Interval sounds, Off / On, the last panel of Your numbers on the Profile tab.
- **Per rider** (`ww.intervalSounds`, in `RIDER_KEYS`), and in a backup's settings.

## Calls

- **The beep lands when the countdown shows the number.** The workout clock moves about once a second, with the trainer's data. A beep is asked for on the step where the time left drops to 3, 2 or 1, so sound and screen agree. It is not scheduled ahead: a pause in the last three seconds would leave a beep sounding over a stopped clock.
- **One place asks for a sound:** `advanceWorkout` in `ride.ts`, the only code that moves the workout clock. A paused ride does not move it, so nothing sounds while paused. That is three lines in `ride.ts`; nothing sent to the trainer changed.
- **The rule has no audio in it.** `intervalCue(intervals, before, now)` in `src/lib/sound.ts` returns count, change, done or nothing. `playCue` makes the sound and does nothing when sounds are off or the browser has no audio. It cannot throw into the ride.
- **Quiet on purpose in four cases:** an interval shorter than 5 seconds gets no countdown (the beeps would run into the last tone); a skipped interval (the rider pressed the button and is looking at it); a clock step over 2.5 seconds (a sleeping tab catching up); and anything outside a workout.
- **A change beats a count.** One sound per step at most.
- **The tones:** sine waves at a low level, 660 Hz for 0.09 s (beep) and 880 Hz for 0.35 s (change; 0.6 s at the end), each with a short fade so it does not click. Constants in `sound.ts`; the levels are a first guess until the ride test.
- **Turning it on plays the tone once.** The rider hears what they chose and how loud it is, and the click lets the browser start audio.
- **The row is open mid-ride.** The rest of the profile is locked then, but a rider must be able to turn a sound off without ending the ride.
- **A ramp test beeps every step.** Its steps are intervals like any other.
- **Cut:** sounds on a free ride or a course (climbs, laps), a volume control (the computer has one), a mute key on the Ride tab, voice, sound files.

## Checked

- **The rule, in Node** (a 10 s, 4 s and 20 s workout, clock steps of 1.00, 0.97 and 1.30 s, and a start 0.4 s off the second): three counts, then a change, for each interval of 5 s or more; no counts in the 4 s interval; done at the end; nothing on a 9 s to 20 s catch-up, on a step of zero, after the end, or with no intervals.
- **In the browser** (headless Chromium, production build, `?fake=1`, the browser's audio replaced by a recorder, an imported workout of 8, 8, 4 and 8 seconds): with sounds on, beeps one second apart at 5, 6 and 7 s into each 8 s interval, the tone at each change, no beeps in the 4 s interval, the end tone at 28 s. With sounds off: no sound at all.
- The setting is Off on a new browser. Turning it on plays one tone and saves it. The row can be used mid-ride.
- Ride tab at 1280x720 in a workout: the key hint is still on screen. No console errors.

## Not checked

- **How it sounds.** Headless Chromium has no speakers; pitch and level were chosen by the numbers. This is the ride test.
- **A pause in the browser.** The rule gives nothing when the clock does not move (checked in Node), and a paused ride does not move the clock; an auto-pause mid-countdown was not run.
- **A ramp test** from start to end.

## Ride test

1. Profile, Your numbers, Interval sounds: On. You should hear one tone.
2. Ride any workout with the fan on. Three beeps should land on 3, 2, 1 of the interval countdown, and the tone on the change.
3. Stop pedaling in the last few seconds of an interval. After the ride pauses, nothing should sound.
4. If the beeps are too quiet or too sharp, say which: the levels and pitches are four numbers in `src/lib/sound.ts`.
