import { describe, it, expect, afterEach } from 'vitest'
import { CFG, teamMembers } from './appConfig.js'

// CFG is the real (mutable) build-time object — swap the email fields per
// test and restore afterwards.
const orig = { email: CFG.email, teamEmails: CFG.teamEmails }
afterEach(() => Object.assign(CFG, orig))

describe('teamMembers', () => {
  it('TEAM_EMAILS is the roster; JIRA_EMAIL dedupes into it', () => {
    Object.assign(CFG, { email: 'me@x.com', teamEmails: ['me@x.com', 'a@x.com'] })
    expect(teamMembers()).toEqual(['me@x.com', 'a@x.com'])
  })

  it('old-style .env without yourself in TEAM_EMAILS still works', () => {
    Object.assign(CFG, { email: 'me@x.com', teamEmails: ['a@x.com'] })
    expect(teamMembers()).toEqual(['me@x.com', 'a@x.com'])
  })

  it('dedupes case-insensitively and trims, keeping the first casing', () => {
    Object.assign(CFG, { email: ' Me@X.com ', teamEmails: ['me@x.com', 'a@x.com'] })
    expect(teamMembers()).toEqual(['Me@X.com', 'a@x.com'])
  })

  it('drops an empty JIRA_EMAIL (deploy mode: roster stands alone)', () => {
    Object.assign(CFG, { email: '', teamEmails: ['a@x.com', 'b@x.com'] })
    expect(teamMembers()).toEqual(['a@x.com', 'b@x.com'])
  })
})
