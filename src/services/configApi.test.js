import { describe, it, expect, vi, beforeEach } from 'vitest'

// The pure overlay logic only — Firestore itself is not under test.
vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: false }))
vi.mock('../config/appConfig.js', () => ({
  CFG: {},
  teamMembers: () => [],
}))

const { CFG } = await import('../config/appConfig.js')
const { applyTeamConfig, missingRequired, cfgToRaw, envRawOf, configDiffers, CONFIG_FIELDS } =
  await import('./configApi.js')

const resetCfg = () => {
  for (const k of Object.keys(CFG)) delete CFG[k]
  Object.assign(CFG, {
    refreshMs: 300000,
    projects: ['APP', 'DX'],
    teamFrom: '2024-05-01',
    specSpace: 'Merchant',
    subtaskPrefixBe: '[BE][MP]',
    subtaskPrefixFe: '[FE][MP]',
    subtaskPrefixQa: '[QA][MP]',
    integrationRoles: ['BE', 'WEB', 'MOB'],
    burnStatuses: ['In Dev', 'In Dev Testing'],
    burnFinishedStatuses: ['Done'],
    qaEmails: ['q1@x.com'],
    qaBurnStatuses: ['In Progress'],
    qaBurnFinishedStatuses: ['Done'],
  })
}
beforeEach(resetCfg)

describe('applyTeamConfig — the 4 precedence rules', () => {
  it('rule 1: a non-empty Firebase value overwrites .env (parsed per kind)', () => {
    const applied = applyTeamConfig({ BURN_STATUSES: 'AAA, BBB', JIRA_PROJECT: 'zz,yy', REFRESH_INTERVAL: '2m' })
    expect(CFG.burnStatuses).toEqual(['AAA', 'BBB'])
    expect(CFG.projects).toEqual(['ZZ', 'YY'])
    expect(CFG.refreshMs).toBe(120000)
    expect(applied.sort()).toEqual(['BURN_STATUSES', 'JIRA_PROJECT', 'REFRESH_INTERVAL'])
  })

  it('rule 3: empty/blank Firebase values leave the .env value standing', () => {
    applyTeamConfig({ BURN_STATUSES: '   ', QA_EMAILS: '' })
    expect(CFG.burnStatuses).toEqual(['In Dev', 'In Dev Testing'])
    expect(CFG.qaEmails).toEqual(['q1@x.com'])
  })

  it('invalid values are skipped, not applied', () => {
    applyTeamConfig({ REFRESH_INTERVAL: 'nonsense' })
    expect(CFG.refreshMs).toBe(300000)
  })

  it('rule 4: missingRequired reports a required field with no value anywhere', () => {
    CFG.projects = []
    expect(missingRequired()).toEqual(['JIRA_PROJECT'])
    applyTeamConfig({ JIRA_PROJECT: 'app' })
    expect(missingRequired()).toEqual([])
  })
})

describe('cfgToRaw', () => {
  it('renders CFG values back as env-style strings', () => {
    const f = (env) => CONFIG_FIELDS.find((x) => x.env === env)
    expect(cfgToRaw(f('REFRESH_INTERVAL'))).toBe('5m')
    expect(cfgToRaw(f('JIRA_PROJECT'))).toBe('APP, DX')
    expect(cfgToRaw(f('JIRA_TEAM_FROM'))).toBe('2024-05-01')
    CFG.refreshMs = 30000
    expect(cfgToRaw(f('REFRESH_INTERVAL'))).toBe('30s')
    CFG.refreshMs = 3600000
    expect(cfgToRaw(f('REFRESH_INTERVAL'))).toBe('1h')
  })
})

describe('envRawOf — the pre-overlay baseline', () => {
  it('keeps showing the .env value after an overlay overrides it', () => {
    const f = CONFIG_FIELDS.find((x) => x.env === 'BURN_STATUSES')
    const before = envRawOf(f) // snapshots the baseline
    applyTeamConfig({ BURN_STATUSES: 'XXX' })
    expect(CFG.burnStatuses).toEqual(['XXX']) // effective value changed…
    expect(envRawOf(f)).toBe(before) // …baseline did not
  })
})

describe('configDiffers', () => {
  it('field-wise trimmed comparison', () => {
    expect(configDiffers({ QA_EMAILS: 'a@x.com' }, { QA_EMAILS: ' a@x.com ' })).toBe(false)
    expect(configDiffers({ QA_EMAILS: 'a@x.com' }, { QA_EMAILS: 'b@x.com' })).toBe(true)
    expect(configDiffers({}, {})).toBe(false)
    expect(configDiffers({ BURN_STATUSES: 'X' }, {})).toBe(true)
    expect(configDiffers({ UNRELATED: 'x' }, {})).toBe(false) // unknown keys ignored
  })
})
