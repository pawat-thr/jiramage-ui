import { describe, it, expect } from 'vitest'
import {
  shortName,
  emailUsername,
  uniqueSorted,
  typeName,
  groupByType,
  filterIssues,
  assigneeName,
} from './format.js'

const issue = (overrides = {}) => ({
  key: 'DX-1',
  fields: {
    summary: 'Fix login flow',
    status: { name: 'In Dev', statusCategory: { key: 'indeterminate' } },
    assignee: { displayName: 'Somchai P. (Golf)', emailAddress: 's@x.com' },
    issuetype: { name: 'Story', hierarchyLevel: 0 },
    ...overrides,
  },
})

describe('shortName', () => {
  it('extracts the nickname in parentheses', () => {
    expect(shortName('Somchai P. (Golf)')).toBe('Golf')
  })
  it('returns the name unchanged when there is no nickname', () => {
    expect(shortName('Somchai P.')).toBe('Somchai P.')
  })
  it('uses the last parenthesized group', () => {
    expect(shortName('[Orbit][BE] Peradone C. (Mon)')).toBe('Mon')
  })
})

describe('emailUsername', () => {
  it('strips the domain', () => {
    expect(emailUsername('pawat.t@orbitdigital.co.th')).toBe('pawat.t')
  })
  it('passes through non-emails', () => {
    expect(emailUsername('no-at-sign')).toBe('no-at-sign')
  })
})

describe('uniqueSorted', () => {
  it('dedupes and sorts', () => {
    expect(uniqueSorted(['b', 'a', 'b', 'c', 'a'])).toEqual(['a', 'b', 'c'])
  })
})

describe('assigneeName / typeName', () => {
  it('falls back for missing assignee and type', () => {
    expect(assigneeName(issue({ assignee: null }))).toBe('Unassigned')
    expect(typeName(issue({ issuetype: undefined }))).toBe('Other')
  })
})

describe('groupByType', () => {
  it('orders groups Epic tier -> standard -> Sub-task tier', () => {
    const issues = [
      issue({ issuetype: { name: 'Subtask', hierarchyLevel: -1 } }),
      issue({ issuetype: { name: 'Story', hierarchyLevel: 0 } }),
      issue({ issuetype: { name: 'Epic', hierarchyLevel: 1 } }),
      issue({ issuetype: { name: 'Bug', hierarchyLevel: 0 } }),
    ]
    expect(groupByType(issues).map((g) => g.name)).toEqual(['Epic', 'Bug', 'Story', 'Subtask'])
  })

  it('counts issues per group', () => {
    const issues = [issue(), issue(), issue({ issuetype: { name: 'Bug', hierarchyLevel: 0 } })]
    const groups = groupByType(issues)
    expect(groups.find((g) => g.name === 'Story').issues).toHaveLength(2)
    expect(groups.find((g) => g.name === 'Bug').issues).toHaveLength(1)
  })
})

describe('filterIssues', () => {
  const done = issue({ status: { name: 'Done', statusCategory: { key: 'done' } } })

  it('hides done-category issues when hideDone is set', () => {
    expect(filterIssues([issue(), done], { hideDone: true })).toHaveLength(1)
    expect(filterIssues([issue(), done], { hideDone: false })).toHaveLength(2)
  })

  it('filters by status name, type, and assignee name', () => {
    const issues = [issue(), done]
    expect(filterIssues(issues, { status: 'Done' })).toHaveLength(1)
    expect(filterIssues(issues, { type: 'Story' })).toHaveLength(2)
    expect(filterIssues(issues, { type: 'Bug' })).toHaveLength(0)
    expect(filterIssues(issues, { name: 'Somchai P. (Golf)' })).toHaveLength(2)
    expect(filterIssues(issues, { name: 'Nobody' })).toHaveLength(0)
  })

  it('searches key and summary case-insensitively', () => {
    expect(filterIssues([issue()], { search: 'dx-1' })).toHaveLength(1)
    expect(filterIssues([issue()], { search: 'LOGIN' })).toHaveLength(1)
    expect(filterIssues([issue()], { search: 'nothing' })).toHaveLength(0)
  })

  it('handles null input', () => {
    expect(filterIssues(null, {})).toEqual([])
  })
})
