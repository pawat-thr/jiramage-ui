import { describe, it, expect } from 'vitest'
import { workingMandays, firstBurnStart, isBurnStatus } from './burn.js'

// 2026-09-07 is a Monday
const D = (s) => new Date(s)

describe('workingMandays', () => {
  it('same day, inside working window: 4.5h of the 9h window = 0.5 manday', () => {
    expect(workingMandays('2026-09-07T09:30:00', D('2026-09-07T14:00:00'))).toBeCloseTo(0.5, 5)
  })

  it('full working day = 1 manday', () => {
    expect(workingMandays('2026-09-07T09:30:00', D('2026-09-07T18:30:00'))).toBeCloseTo(1, 5)
  })

  it('start before window / end after window are clamped', () => {
    expect(workingMandays('2026-09-07T06:00:00', D('2026-09-07T23:00:00'))).toBeCloseTo(1, 5)
  })

  it('weekend days count zero: Friday 18:30 → Monday 09:30 = 0', () => {
    expect(workingMandays('2026-09-04T18:30:00', D('2026-09-07T09:30:00'))).toBeCloseTo(0, 5)
  })

  it('Friday noon → Tuesday noon skips Sat+Sun', () => {
    // Fri 12:00→18:30 = 6.5h, Mon full 9h, Tue 9:30→12:00 = 2.5h → 18h / 9 = 2 mandays
    expect(workingMandays('2026-09-04T12:00:00', D('2026-09-08T12:00:00'))).toBeCloseTo(2, 5)
  })

  it('end before start = 0', () => {
    expect(workingMandays('2026-09-08T12:00:00', D('2026-09-07T12:00:00'))).toBe(0)
  })
})

describe('firstBurnStart / isBurnStatus', () => {
  const log = [
    { created: '2026-09-04T12:12:04', items: [{ field: 'status', toString: 'In Dev Testing' }] },
    { created: '2026-09-03T16:52:04', items: [{ field: 'status', toString: 'In Dev' }] },
    { created: '2026-09-01T10:00:00', items: [{ field: 'status', toString: 'To Do' }] },
    { created: '2026-09-02T10:00:00', items: [{ field: 'assignee', toString: 'In Dev' }] }, // not a status change
  ]

  it('finds the earliest transition into any burn status', () => {
    expect(firstBurnStart(log)).toBe('2026-09-03T16:52:04')
  })

  it('returns null when the card never entered a burn status', () => {
    expect(firstBurnStart([{ created: 'x', items: [{ field: 'status', toString: 'Done' }] }])).toBeNull()
  })

  it('status match is case-insensitive', () => {
    expect(isBurnStatus('in dev')).toBe(true)
    expect(isBurnStatus('Done')).toBe(false)
  })
})
