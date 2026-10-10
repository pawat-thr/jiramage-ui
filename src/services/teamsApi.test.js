import { describe, it, expect, vi } from 'vitest'

vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: true }))
vi.mock('../config/appConfig.js', () => ({
  CFG: { teams: ['mp', 'aoa'], teamLeads: ['lead.mp@x.com', 'lead.aoa@x.com'] },
}))

const { leadTeamOf, leadsOf, unassignedOf, teamsEnabled, teamStamp, inActiveTeam, activeTeamSlug, applyTeamRoster } = await import('./teamsApi.js')

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

describe('team-rooted data scoping (stamp + filter)', () => {
  it('teams OFF: no stamp, everything visible', () => {
    // activeTeam starts null in a fresh module
    expect(activeTeamSlug()).toBeNull()
    expect(teamStamp()).toEqual({})
    expect(inActiveTeam({ team: 'aoa' })).toBe(true)
    expect(inActiveTeam({})).toBe(true)
  })

  it('after membership resolves: creates stamp MY team, reads show ONLY my team', () => {
    applyTeamRoster({ team: 'mp', members: ['a@x.com'] }, 'a@x.com')
    expect(teamStamp()).toEqual({ team: 'mp' })
    expect(inActiveTeam({ team: 'mp' })).toBe(true)
    expect(inActiveTeam({ team: 'aoa' })).toBe(false) // another team's PR/task
    expect(inActiveTeam({})).toBe(false) // untagged legacy doc: invisible until migrated
  })

  it('moving teams hides the old team\'s data (the PR-history rule)', () => {
    applyTeamRoster({ team: 'mp', members: [] }, 'a@x.com')
    const myOldPr = { team: 'mp', authorEmail: 'a@x.com' }
    applyTeamRoster({ team: 'aoa', members: [] }, 'a@x.com')
    expect(inActiveTeam(myOldPr)).toBe(false) // authored it, still can't see it — it's team MP's
  })
})
