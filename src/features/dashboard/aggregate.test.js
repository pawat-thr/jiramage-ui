import { describe, it, expect, vi } from 'vitest'

vi.mock('../../config/appConfig.js', () => ({
  CFG: { email: 'me@x.com', teamEmails: ['tm@x.com'] },
}))

const { memberStats, statusStats, typeStats, summaryStats } = await import('./aggregate.js')

const issue = ({ email = 'me@x.com', name = 'Me (BANK)', cat = 'new', status = 'To Do', type = 'Story', tier = 0 } = {}) => ({
  key: 'DX-1',
  fields: {
    summary: 's',
    status: { name: status, statusCategory: { key: cat } },
    assignee: email ? { displayName: name, emailAddress: email } : null,
    issuetype: { name: type, hierarchyLevel: tier },
  },
})

describe('memberStats', () => {
  it('seeds every configured member even with zero issues, me first flagged', () => {
    const rows = memberStats([])
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.total === 0)).toBe(true)
    expect(rows.find((r) => r.key === 'me@x.com').isMe).toBe(true)
    expect(rows.find((r) => r.key === 'tm@x.com').isMe).toBe(false)
  })

  it('counts by status category and sorts by total desc', () => {
    const rows = memberStats([
      issue({ email: 'tm@x.com', name: 'Team M.', cat: 'done' }),
      issue({ email: 'tm@x.com', name: 'Team M.', cat: 'indeterminate' }),
      issue({ cat: 'new' }),
    ])
    expect(rows[0].key).toBe('tm@x.com')
    expect(rows[0].counts).toEqual({ new: 0, indeterminate: 1, done: 1 })
    expect(rows[1].counts.new).toBe(1)
  })

  it('uses the short display name and keeps the full name for filtering', () => {
    const rows = memberStats([issue()])
    const me = rows.find((r) => r.key === 'me@x.com')
    expect(me.name).toBe('BANK')
    expect(me.filterName).toBe('Me (BANK)')
  })
})

describe('statusStats', () => {
  it('counts per status name, sorted desc', () => {
    const rows = statusStats([
      issue({ status: 'Done', cat: 'done' }),
      issue({ status: 'Done', cat: 'done' }),
      issue({ status: 'In Dev', cat: 'indeterminate' }),
    ])
    expect(rows[0]).toMatchObject({ name: 'Done', cat: 'done', count: 2 })
    expect(rows[1]).toMatchObject({ name: 'In Dev', count: 1 })
  })
})

describe('typeStats', () => {
  it('orders by hierarchy tier then count', () => {
    const rows = typeStats([
      issue({ type: 'Subtask', tier: -1 }),
      issue({ type: 'Subtask', tier: -1 }),
      issue({ type: 'Story', tier: 0 }),
      issue({ type: 'Epic', tier: 1 }),
    ])
    expect(rows.map((r) => r.name)).toEqual(['Epic', 'Story', 'Subtask'])
    expect(rows[2].count).toBe(2)
  })
})

describe('summaryStats', () => {
  it('computes the five tiles', () => {
    const team = [issue({ cat: 'new' }), issue({ cat: 'indeterminate' }), issue({ cat: 'done' })]
    const mine = [issue({ cat: 'new' }), issue({ cat: 'done' })]
    const labels = Object.fromEntries(summaryStats(team, mine).map((s) => [s.label, s.value]))
    expect(labels).toEqual({
      'Team tasks': 3,
      'To Do': 1,
      'In Progress': 1,
      Done: 1,
      'My open tasks': 1,
    })
  })

  it('handles null datasets', () => {
    expect(summaryStats(null, null).every((s) => s.value === 0)).toBe(true)
  })
})
