import { describe, it, expect } from 'vitest'
import { parseInterval, list, CONFIG_FIELDS, parseFieldRaw, validateFieldRaw } from './configFields.js'

const field = (env) => CONFIG_FIELDS.find((f) => f.env === env)

describe('parseInterval', () => {
  it('parses s/m/h', () => {
    expect(parseInterval('30s')).toBe(30000)
    expect(parseInterval('5m')).toBe(300000)
    expect(parseInterval('1h')).toBe(3600000)
    expect(parseInterval(' 2m ')).toBe(120000)
  })

  it('returns null on anything else (caller picks the fallback)', () => {
    for (const bad of ['', '10 min', 'nonsense', '5', 'm5', '1d', null, undefined]) {
      expect(parseInterval(bad)).toBeNull()
    }
  })
})

describe('list', () => {
  it('splits, trims, drops empties', () => {
    expect(list(' a@x.com , b@x.com ,, ')).toEqual(['a@x.com', 'b@x.com'])
    expect(list('')).toEqual([])
  })

  it('uppercases when asked (project keys)', () => {
    expect(list('app, dx', true)).toEqual(['APP', 'DX'])
  })
})

describe('parseFieldRaw', () => {
  it('routes by kind', () => {
    expect(parseFieldRaw(field('REFRESH_INTERVAL'), '2m')).toBe(120000)
    expect(parseFieldRaw(field('JIRA_PROJECT'), 'app,dx')).toEqual(['APP', 'DX'])
    expect(parseFieldRaw(field('BURN_STATUSES'), 'In Dev, Done')).toEqual(['In Dev', 'Done'])
    expect(parseFieldRaw(field('JIRA_TEAM_FROM'), ' 2026-01-01 ')).toBe('2026-01-01')
  })
})

describe('WORK_TIME field', () => {
  it('valid windows pass, malformed ones are rejected', () => {
    const f = field('WORK_TIME')
    expect(validateFieldRaw(f, '09:30-12:00,13:00-18:30')).toBeNull()
    expect(validateFieldRaw(f, '09:00-17:00')).toBeNull()
    expect(validateFieldRaw(f, 'nine to five')).toMatch(/HH:MM/)
    expect(validateFieldRaw(f, '13:00-09:00')).toMatch(/HH:MM/)
    expect(validateFieldRaw(f, '')).toBeNull() // empty = no override
  })
})

describe('validateFieldRaw', () => {
  it('empty is always valid (= no override)', () => {
    for (const f of CONFIG_FIELDS) {
      expect(validateFieldRaw(f, '')).toBeNull()
      expect(validateFieldRaw(f, '   ')).toBeNull()
    }
  })

  it('rejects double quotes everywhere (JQL safety)', () => {
    expect(validateFieldRaw(field('JIRA_TEAM_FROM'), '2026-01-01"')).toMatch(/quotes/)
    expect(validateFieldRaw(field('BURN_STATUSES'), 'In "Dev"')).toMatch(/quotes/)
  })

  it('rejects unparsable intervals', () => {
    expect(validateFieldRaw(field('REFRESH_INTERVAL'), '10 min')).toBeTruthy()
    expect(validateFieldRaw(field('REFRESH_INTERVAL'), '5m')).toBeNull()
  })

  it('rejects malformed JIRA_TEAM_FROM dates', () => {
    expect(validateFieldRaw(field('JIRA_TEAM_FROM'), 'last week')).toMatch(/date/)
    expect(validateFieldRaw(field('JIRA_TEAM_FROM'), '2026-9-1')).toMatch(/date/)
    expect(validateFieldRaw(field('JIRA_TEAM_FROM'), '2026-09-01')).toBeNull()
  })

  it('rejects a list that parses to nothing', () => {
    expect(validateFieldRaw(field('BURN_STATUSES'), ',,,')).toMatch(/comma-separated/)
    expect(validateFieldRaw(field('BURN_STATUSES'), 'In Dev')).toBeNull()
  })
})
