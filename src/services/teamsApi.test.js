import { describe, it, expect, vi } from 'vitest'

vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: true }))
vi.mock('../config/appConfig.js', () => ({
  CFG: { teams: ['mp', 'aoa'], teamLeads: ['lead.mp@x.com', 'lead.aoa@x.com'] },
}))

const { leadTeamOf, leadsOf, unassignedOf, teamsEnabled } = await import('./teamsApi.js')

describe('teamsApi (env mapping + pure helpers)', () => {
  it('leadTeamOf maps parallel lists, case-insensitive', () => {
    expect(leadTeamOf('Lead.MP@x.com')).toBe('mp')
    expect(leadTeamOf('lead.aoa@x.com')).toBe('aoa')
    expect(leadTeamOf('member@x.com')).toBeNull()
  })

  it('leadsOf returns the leads of one team', () => {
    expect(leadsOf('mp')).toEqual(['lead.mp@x.com'])
    expect(leadsOf('nope')).toEqual([])
  })

  it('unassignedOf = whitelist minus everyone already in a team (case-insensitive)', () => {
    const all = ['a@x.com', 'b@x.com', 'C@x.com', 'lead.mp@x.com']
    const taken = ['B@x.com', 'lead.mp@x.com']
    expect(unassignedOf(all, taken)).toEqual(['a@x.com', 'C@x.com'])
  })

  it('teamsEnabled needs firebase AND teams', () => {
    expect(teamsEnabled()).toBe(true)
  })
})
