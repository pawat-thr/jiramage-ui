import { describe, it, expect } from 'vitest'
import { workingMandays, burnIntervals, intervalMandays, isBurnStatus } from './burn.js'

// 2026-09-07 is a Monday
const D = (s) => new Date(s)

describe('workingMandays', () => {
  it('same day 9:30→14:00: 2.5h morning + 1h afternoon = 3.5h = 0.4375 manday', () => {
    expect(workingMandays('2026-09-07T09:30:00', D('2026-09-07T14:00:00'))).toBeCloseTo(3.5 / 8, 5)
  })

  it('lunch 12:00→13:00 counts zero', () => {
    expect(workingMandays('2026-09-07T12:00:00', D('2026-09-07T13:00:00'))).toBeCloseTo(0, 5)
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

describe('burnIntervals / isBurnStatus', () => {
  it('pauses on leaving dev and continues on re-entry (open tail)', () => {
    const log = [
      { created: '2026-09-01T10:00:00', items: [{ field: 'status', toString: 'In Dev' }] },
      { created: '2026-09-02T10:00:00', items: [{ field: 'status', toString: 'PR Review' }] },
      { created: '2026-09-03T10:00:00', items: [{ field: 'status', toString: 'In Dev Testing' }] },
      { created: '2026-09-02T12:00:00', items: [{ field: 'assignee', toString: 'In Dev' }] }, // not a status change
    ]
    expect(burnIntervals(log)).toEqual([
      ['2026-09-01T10:00:00', '2026-09-02T10:00:00'],
      ['2026-09-03T10:00:00', null],
    ])
  })

  it('closed intervals only for finished cards; empty when never in dev', () => {
    const done = [
      { created: '2026-09-01T10:00:00', items: [{ field: 'status', toString: 'In Dev' }] },
      { created: '2026-09-01T15:00:00', items: [{ field: 'status', toString: 'Done' }] },
    ]
    expect(burnIntervals(done)).toEqual([['2026-09-01T10:00:00', '2026-09-01T15:00:00']])
    expect(burnIntervals([{ created: 'x', items: [{ field: 'status', toString: 'Done' }] }])).toEqual([])
  })

  it('intervalMandays sums closed intervals and runs the open one to now', () => {
    // Mon 9:30-12:00 closed (2.5h) + open from Tue 13:00 to Tue 15:00 "now" (2h) = 4.5h
    const now = new Date('2026-09-08T15:00:00')
    const m = intervalMandays([
      ['2026-09-07T09:30:00', '2026-09-07T12:00:00'],
      ['2026-09-08T13:00:00', null],
    ], now)
    expect(m).toBeCloseTo(4.5 / 8, 5)
  })

  it('status match is case-insensitive', () => {
    expect(isBurnStatus('in dev')).toBe(true)
    expect(isBurnStatus('Done')).toBe(false)
  })
})
