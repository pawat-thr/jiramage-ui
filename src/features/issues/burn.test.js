import { describe, it, expect, afterEach } from 'vitest'
import { workingMandays, workWindows, burnIntervals, intervalMandays, isBurnStatus } from './burn.js'
import { CFG } from '../../config/appConfig.js'
import { parseWorkTime, parseWorkDays, DEFAULT_WORK_TIME } from '../../config/configFields.js'

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

describe('configurable work time (WORK_TIME)', () => {
  const orig = CFG.workTime
  afterEach(() => {
    CFG.workTime = orig
  })

  it('parseWorkTime accepts windows and rejects garbage', () => {
    expect(parseWorkTime('09:30-12:00,13:00-18:30')).toHaveLength(2)
    expect(parseWorkTime(' 9:00 - 17:00 ')).toHaveLength(1)
    for (const bad of ['', 'nine to five', '09:30-12', '12:00-12:00', '13:00-09:00', '25:00-26:00']) {
      expect(parseWorkTime(bad)).toBeNull()
    }
  })

  it('workWindows derives hours/day from the configured windows', () => {
    expect(workWindows(DEFAULT_WORK_TIME).hoursPerDay).toBe(8)
    expect(workWindows('09:00-17:00').hoursPerDay).toBe(8)
    expect(workWindows('10:00-12:00,13:00-16:00').hoursPerDay).toBe(5)
  })

  it('invalid WORK_TIME falls back to the default windows', () => {
    expect(workWindows('nonsense')).toEqual(workWindows(DEFAULT_WORK_TIME))
  })

  it('workingMandays follows CFG.workTime (1 full custom day = 1 manday)', () => {
    CFG.workTime = '10:00-12:00,13:00-16:00' // 5h day
    expect(workingMandays('2026-09-07T10:00:00', new Date('2026-09-07T16:00:00'))).toBeCloseTo(1, 5)
    expect(workingMandays('2026-09-07T10:00:00', new Date('2026-09-07T12:30:00'))).toBeCloseTo(2 / 5, 5)
  })
})

describe('configurable work days (WORK_DAYS)', () => {
  const orig = CFG.workDays
  afterEach(() => {
    CFG.workDays = orig
  })

  it('parseWorkDays accepts names (3-letter or full, any case), rejects garbage', () => {
    expect(parseWorkDays('Mon,Tue,Wed,Thu,Fri')).toEqual([1, 2, 3, 4, 5])
    expect(parseWorkDays('saturday, SUNDAY')).toEqual([0, 6])
    expect(parseWorkDays('mon, mon')).toEqual([1]) // deduped
    for (const bad of ['', 'someday', 'mon,xx']) expect(parseWorkDays(bad)).toBeNull()
  })

  it('burn counts a configured Saturday as working time', () => {
    CFG.workDays = 'Mon,Tue,Wed,Thu,Fri,Sat'
    // Fri 18:30 → Mon 09:30 now includes Saturday's full 8h = 1 manday
    expect(workingMandays('2026-09-04T18:30:00', new Date('2026-09-07T09:30:00'))).toBeCloseTo(1, 5)
  })
})
