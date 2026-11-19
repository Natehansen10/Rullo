/** Workouts that ship with the app. % FTP targets scale with the rider's FTP. */
import type { RampStep, SteadyStep, Workout } from './workout'

const steady = (min: number, pct: number, label?: string): SteadyStep => ({ type: 'steady', durS: min * 60, target: { pct }, label })
const ramp = (min: number, from: number, to: number, label?: string): RampStep => ({
  type: 'ramp',
  durS: min * 60,
  from: { pct: from },
  to: { pct: to },
  label,
})

/** Ramp test: 1-minute steps of +20 W from 120 W, up to 700 W. Nobody reaches the end. */
function rampSteps(stepS: number, startW: number, stepW: number, count: number): SteadyStep[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'steady',
    durS: stepS,
    target: { w: startW + i * stepW },
    label: 'Ramp',
  }))
}

export const BUILTIN_WORKOUTS: Workout[] = [
  {
    id: 'endurance-60',
    name: 'Endurance 60',
    description: 'One long steady block in zone 2.',
    source: 'builtin',
    steps: [ramp(10, 50, 65, 'Warm-up'), steady(45, 68, 'Endurance'), ramp(5, 60, 45, 'Cool-down')],
  },
  {
    id: 'sweet-spot-3x12',
    name: 'Sweet Spot 3x12',
    description: '3 x 12 min at 90% FTP with 5 min easy between.',
    source: 'builtin',
    steps: [
      ramp(10, 50, 75, 'Warm-up'),
      { type: 'repeat', times: 3, steps: [steady(12, 90, 'Sweet spot'), steady(5, 55, 'Recover')] },
      ramp(8, 60, 45, 'Cool-down'),
    ],
  },
  {
    id: 'vo2-5x3',
    name: 'VO2 5x3',
    description: '5 x 3 min at 115% FTP with 3 min easy between.',
    source: 'builtin',
    steps: [
      ramp(10, 50, 75, 'Warm-up'),
      steady(2, 55, 'Easy'),
      { type: 'repeat', times: 5, steps: [steady(3, 115, 'VO2'), steady(3, 50, 'Recover')] },
      ramp(10, 55, 45, 'Cool-down'),
    ],
  },
  {
    id: 'ramp-test',
    name: 'Ramp FTP test',
    description: '+20 W every minute until you can\'t hold it. FTP is 75% of your best minute.',
    source: 'builtin',
    rampTest: { windowS: 60 },
    steps: [
      { type: 'steady', durS: 300, target: { w: 100 }, label: 'Warm-up' },
      ...rampSteps(60, 120, 20, 30),
      { type: 'steady', durS: 600, target: { w: 90 }, label: 'Cool-down' },
    ],
  },
  {
    id: 'test-intervals',
    name: 'Test Intervals',
    description: 'Two minutes of short steps for testing with the fake trainer.',
    source: 'builtin',
    fakeOnly: true,
    steps: [
      { type: 'steady', durS: 20, target: { pct: 60 }, label: 'Warm-up' },
      {
        type: 'repeat',
        times: 2,
        steps: [
          { type: 'steady', durS: 20, target: { pct: 120 }, label: 'Hard' },
          { type: 'steady', durS: 15, target: { pct: 50 }, label: 'Easy' },
        ],
      },
      { type: 'ramp', durS: 20, from: { pct: 50 }, to: { pct: 80 }, label: 'Ramp' },
    ],
  },
  {
    id: 'test-ramp',
    name: 'Test Ramp',
    description: 'Ramp test with 10-second steps, for testing with the fake trainer.',
    source: 'builtin',
    fakeOnly: true,
    rampTest: { windowS: 10 },
    steps: [
      { type: 'steady', durS: 15, target: { w: 100 }, label: 'Warm-up' },
      ...rampSteps(10, 120, 20, 30),
      { type: 'steady', durS: 120, target: { w: 90 }, label: 'Cool-down' },
    ],
  },
]
