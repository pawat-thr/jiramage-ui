import { describe, it, expect } from 'vitest'
import { CFG } from '../../config/appConfig.js'
import { deliveryStats, qaStats, qaRollup, releaseRollup, storyProgress } from './deliveryUtils.js'

// subtask factory: role prefix goes in the summary, cat = statusCategory key
const st = (summary, pts, cat = 'new') => ({
  fields: { summary, [CFG.pointField]: pts, status: { statusCategory: { key: cat } } },
})
const story = (key, cat = 'new') => ({
  key,
  fields: { status: { statusCategory: { key: cat } } },
})

describe('deliveryStats', () => {
  it('splits points by role and status category', () => {
    const s = deliveryStats([
      st('[FE] build page', 3, 'done'),
      st('[FE] polish', 2, 'indeterminate'),
      st('[BE] api', 5, 'new'),
      st('[QA] Test case', 1, 'done'),
      st('no role prefix', 99, 'done'), // ignored
    ])
    expect(s.roles.FE).toMatchObject({ total: 5, done: 3, inprog: 2, todo: 0, count: 2, doneCount: 1 })
    expect(s.roles.BE).toMatchObject({ total: 5, todo: 5, count: 1 })
    expect(s.roles.QA).toMatchObject({ total: 1, done: 1 })
    expect(s.deliveryPoints).toBe(11)
    expect(s.taggedCount).toBe(4)
  })

  it('role prefix is case-insensitive and non-numeric points count as 0', () => {
    const s = deliveryStats([st('[fe] thing', undefined, 'new')])
    expect(s.roles.FE.count).toBe(1)
    expect(s.roles.FE.total).toBe(0)
  })
})

describe('qaStats', () => {
  it('buckets QA subtasks into categories', () => {
    const s = qaStats([
      st('[QA] Test case', 2, 'done'),
      st('[QA] Review test case', 1, 'indeterminate'),
      st('[QA] Support UAT', 3, 'new'),
      st('[FE] not qa', 9, 'done'), // ignored entirely
    ])
    expect(s.total).toMatchObject({ count: 3, doneCount: 1, inprogCount: 1, pts: 6, donePts: 2 })
    expect(s.cats.test_case).toMatchObject({ count: 1, donePts: 2 })
    expect(s.cats.test_review.count).toBe(1)
    expect(s.cats.support_uat.count).toBe(1)
    expect(s.cats.support_reg.count).toBe(0)
  })

  it('plain "[QA] Test case" matches test_case but "Review test case" does not', () => {
    const s = qaStats([st('[QA] Review test case', 1, 'new')])
    expect(s.cats.test_case.count).toBe(0)
    expect(s.cats.test_review.count).toBe(1)
  })
})

describe('releaseRollup', () => {
  it('aggregates roles + story statuses and counts untagged stories', () => {
    const subMap = {
      'A-1': [st('[FE] a', 2, 'done'), st('[BE] b', 3, 'new')],
      'A-2': [], // untagged
    }
    const r = releaseRollup([story('A-1', 'indeterminate'), story('A-2', 'done')], subMap)
    expect(r.totalPts).toBe(5)
    expect(r.donePts).toBe(2)
    expect(r.storyCount).toBe(2)
    expect(r.storyDone).toBe(1)
    expect(r.storyInprog).toBe(1)
    expect(r.untagged).toBe(1)
  })
})

describe('qaRollup', () => {
  it('merges per-story QA stats across the release', () => {
    const subMap = {
      'A-1': [st('[QA] Test case', 2, 'done')],
      'A-2': [st('[QA] Test case', 4, 'new')],
    }
    const agg = qaRollup([story('A-1'), story('A-2')], subMap)
    expect(agg.total).toMatchObject({ count: 2, doneCount: 1, pts: 6, donePts: 2 })
    expect(agg.cats.test_case.count).toBe(2)
  })
})

describe('storyProgress', () => {
  it('uses point completion when estimated', () => {
    const stats = deliveryStats([st('[FE] a', 2, 'done'), st('[BE] b', 2, 'new')])
    expect(storyProgress(story('A-1'), stats)).toBe(0.5)
  })

  it('falls back to story status when unestimated', () => {
    const stats = deliveryStats([])
    expect(storyProgress(story('A-1', 'done'), stats)).toBe(1)
    expect(storyProgress(story('A-2', 'new'), stats)).toBe(0)
  })
})
