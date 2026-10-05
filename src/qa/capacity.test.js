import { describe, it, expect, afterEach } from 'vitest'
import { CFG } from '../config/appConfig.js'
import {
  dateKey,
  monthKey,
  isDayOff,
  monthDays,
  capacityOf,
  plannedOn,
  autoPlace,
  removeChunk,
  addChunk,
  setChunkPoints,
  setCapacity,
  reflowFrom,
} from './capacity.js'

// September 2026: Tue 1st … Wed 30th; weekends 5/6, 12/13, 19/20, 26/27.
const EMPTY = { capacity: {}, days: {} }

describe('date helpers', () => {
  it('dateKey / monthKey format', () => {
    const d = new Date(2026, 8, 9)
    expect(dateKey(d)).toBe('2026-09-09')
    expect(monthKey(d)).toBe('2026-09')
  })

  it('isDayOff (default Mon–Fri work days)', () => {
    expect(isDayOff('2026-09-05')).toBe(true) // Sat
    expect(isDayOff('2026-09-06')).toBe(true) // Sun
    expect(isDayOff('2026-09-07')).toBe(false) // Mon
  })

  it('monthDays covers the whole month', () => {
    const days = monthDays('2026-09')
    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-09-01')
    expect(days[29]).toBe('2026-09-30')
  })
})

describe('capacityOf / plannedOn', () => {
  it('defaults: 8 on weekdays, 0 on weekends', () => {
    expect(capacityOf(EMPTY, '2026-09-07')).toBe(8)
    expect(capacityOf(EMPTY, '2026-09-05')).toBe(0)
  })

  it('explicit override wins, even on weekends', () => {
    const plan = { capacity: { '2026-09-07': 4, '2026-09-05': 8 }, days: {} }
    expect(capacityOf(plan, '2026-09-07')).toBe(4) // half day
    expect(capacityOf(plan, '2026-09-05')).toBe(8) // weekend work
  })

  it('plannedOn sums the chunks of one day', () => {
    const plan = { capacity: {}, days: { '2026-09-07': [{ key: 'A', points: 3 }, { key: 'B', points: 2.5 }] } }
    expect(plannedOn(plan, '2026-09-07')).toBe(5.5)
    expect(plannedOn(plan, '2026-09-08')).toBe(0)
  })
})

describe('autoPlace', () => {
  it('spec example: 23 pt from Mon → 8/8/7', () => {
    const { plan, placed, unplaced } = autoPlace(EMPTY, 'DX-1', 23, '2026-09-07')
    expect(placed).toEqual([
      { day: '2026-09-07', points: 8 },
      { day: '2026-09-08', points: 8 },
      { day: '2026-09-09', points: 7 },
    ])
    expect(unplaced).toBe(0)
    expect(plannedOn(plan, '2026-09-09')).toBe(7)
  })

  it('second task fills the remainder of a partial day first', () => {
    const first = autoPlace(EMPTY, 'DX-1', 20, '2026-09-07').plan // 8/8/4
    const { placed } = autoPlace(first, 'DX-2', 15, '2026-09-07')
    expect(placed[0]).toEqual({ day: '2026-09-09', points: 4 }) // tops up day 3
    expect(placed[1]).toEqual({ day: '2026-09-10', points: 8 })
    expect(placed[2]).toEqual({ day: '2026-09-11', points: 3 })
  })

  it('skips weekends and full days', () => {
    const { placed } = autoPlace(EMPTY, 'DX-1', 16, '2026-09-04') // Fri
    expect(placed.map((p) => p.day)).toEqual(['2026-09-04', '2026-09-07']) // Sat/Sun skipped
  })

  it('untilDay clamps to the visible month and reports the spill', () => {
    const { placed, unplaced } = autoPlace(EMPTY, 'DX-1', 24, '2026-09-29', { untilDay: '2026-09-30' })
    expect(placed).toHaveLength(2) // 29th + 30th
    expect(unplaced).toBe(8)
  })

  it('does not mutate the input plan', () => {
    autoPlace(EMPTY, 'DX-1', 8, '2026-09-07')
    expect(EMPTY.days).toEqual({})
  })
})

describe('chunk edits', () => {
  const base = () => autoPlace(EMPTY, 'DX-1', 10, '2026-09-07').plan // 8 + 2

  it('removeChunk returns the chunk and drops empty days', () => {
    const { plan, chunk } = removeChunk(base(), '2026-09-08', 0)
    expect(chunk).toEqual({ key: 'DX-1', points: 2 })
    expect(plan.days['2026-09-08']).toBeUndefined()
  })

  it('addChunk moves a chunk to another day (possibly another user)', () => {
    const { plan, chunk } = removeChunk(base(), '2026-09-08', 0)
    const next = addChunk(plan, '2026-09-10', chunk)
    expect(next.days['2026-09-10']).toEqual([{ key: 'DX-1', points: 2 }])
  })

  it('setChunkPoints updates in place (overload allowed — "actual" values)', () => {
    const next = setChunkPoints(base(), '2026-09-07', 0, 12)
    expect(plannedOn(next, '2026-09-07')).toBe(12) // > capacity, by design
  })

  it('setCapacity sets and clears a day override', () => {
    const set = setCapacity(EMPTY, '2026-09-07', 0)
    expect(capacityOf(set, '2026-09-07')).toBe(0) // leave day
    const cleared = setCapacity(set, '2026-09-07', '')
    expect(capacityOf(cleared, '2026-09-07')).toBe(8)
  })
})

describe('reflowFrom', () => {
  it('re-lays everything from a day and marks later-landing work delayed', () => {
    // A: 8 on Mon, B: 8 on Tue. Block Monday entirely → both shift.
    let plan = autoPlace(EMPTY, 'A', 8, '2026-09-07').plan
    plan = autoPlace(plan, 'B', 8, '2026-09-07').plan
    plan = setCapacity(plan, '2026-09-07', 0) // Monday became a leave day
    const { plan: next, moved } = reflowFrom(plan, '2026-09-07')
    expect(next.days['2026-09-07']).toBeUndefined()
    expect(next.days['2026-09-08']).toEqual([{ key: 'A', points: 8, delayed: true }])
    expect(next.days['2026-09-09']).toEqual([{ key: 'B', points: 8, delayed: true }])
    expect(moved.sort()).toEqual(['A', 'B'])
  })

  it('pin keeps the "actual" chunk in place even over capacity; same-day followers get pushed + delayed', () => {
    // Monday held A(4) + B(4); A ACTUALLY took 12 → pin it, B must move.
    let plan = autoPlace(EMPTY, 'A', 4, '2026-09-07').plan
    plan = autoPlace(plan, 'B', 4, '2026-09-07').plan
    plan = setChunkPoints(plan, '2026-09-07', 0, 12)
    const { plan: next, moved } = reflowFrom(plan, '2026-09-07', { pin: { day: '2026-09-07', index: 0 } })
    expect(plannedOn(next, '2026-09-07')).toBe(12) // pinned actual stays, overloaded
    expect(next.days['2026-09-08']).toEqual([{ key: 'B', points: 4, delayed: true }])
    expect(moved).toEqual(['B'])
  })

  it('a follower already on a LATER day stays put (no false delays)', () => {
    let plan = autoPlace(EMPTY, 'A', 8, '2026-09-07').plan
    plan = autoPlace(plan, 'B', 8, '2026-09-08').plan
    plan = setChunkPoints(plan, '2026-09-07', 0, 12)
    const { plan: next, moved } = reflowFrom(plan, '2026-09-07', { pin: { day: '2026-09-07', index: 0 } })
    expect(next.days['2026-09-08']).toEqual([{ key: 'B', points: 8 }]) // own day, not delayed
    expect(moved).toEqual([])
  })

  it('merges consecutive fragments of the same task while refilling', () => {
    // A split 4+4 across two days collapses back into one 8-pt chunk.
    let plan = { capacity: {}, days: { '2026-09-07': [{ key: 'A', points: 4 }], '2026-09-08': [{ key: 'A', points: 4 }] } }
    const { plan: next } = reflowFrom(plan, '2026-09-07')
    expect(next.days['2026-09-07']).toEqual([{ key: 'A', points: 8 }])
  })

  it('reports points that no longer fit inside untilDay', () => {
    let plan = autoPlace(EMPTY, 'A', 16, '2026-09-29').plan // 29th + 30th
    plan = setCapacity(plan, '2026-09-30', 0)
    const { unplaced } = reflowFrom(plan, '2026-09-29', { untilDay: '2026-09-30' })
    expect(unplaced).toBe(8)
  })

  it('leaves days before fromDay untouched', () => {
    let plan = autoPlace(EMPTY, 'A', 16, '2026-09-07').plan // Mon+Tue
    const { plan: next } = reflowFrom(plan, '2026-09-08')
    expect(next.days['2026-09-07']).toEqual([{ key: 'A', points: 8 }])
  })
})

describe('configurable work days (WORK_DAYS)', () => {
  const orig = CFG.workDays
  afterEach(() => {
    CFG.workDays = orig
  })

  it('Saturday becomes a working day when configured', () => {
    CFG.workDays = 'Mon,Tue,Wed,Thu,Fri,Sat'
    expect(isDayOff('2026-09-05')).toBe(false) // Sat now works
    expect(isDayOff('2026-09-06')).toBe(true) // Sun still off
    expect(capacityOf(EMPTY, '2026-09-05')).toBe(8)
    // auto-place from Friday now flows into Saturday
    const { placed } = autoPlace(EMPTY, 'DX-1', 16, '2026-09-04')
    expect(placed.map((p) => p.day)).toEqual(['2026-09-04', '2026-09-05'])
  })

  it('invalid WORK_DAYS falls back to Mon–Fri', () => {
    CFG.workDays = 'someday'
    expect(isDayOff('2026-09-05')).toBe(true)
    expect(isDayOff('2026-09-07')).toBe(false)
  })
})
