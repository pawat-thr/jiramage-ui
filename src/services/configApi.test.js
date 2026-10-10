import { describe, it, expect, vi, beforeEach } from 'vitest'

// The overlay/save logic only — Firestore itself is not under test.
const fs = vi.hoisted(() => ({ setDocs: [], addDocs: [] }))
vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: false }))
vi.mock('firebase/firestore', () => ({
  addDoc: (_col, data) => {
    fs.addDocs.push(data)
    return Promise.resolve({ id: 'h1' })
  },
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: () => 'TS',
  setDoc: (_ref, data) => {
    fs.setDocs.push(data)
    return Promise.resolve()
  },
}))
vi.mock('../config/appConfig.js', () => ({
  CFG: {},
  teamMembers: () => [],
}))

const { CFG } = await import('../config/appConfig.js')
const {
  applyTeamConfig,
  missingRequired,
  cfgToRaw,
  envRawOf,
  configDiffers,
  CONFIG_FIELDS,
  storeKeyOf,
  saveTeamConfig,
  cachedTeamConfig,
  cacheTeamConfig,
  logConfigChange,
} = await import('./configApi.js')
const { applyTeamRoster } = await import('./teamsApi.js')

const setTeam = (team) => applyTeamRoster({ team, members: [] }, 'me@x.co')

const resetCfg = () => {
  setTeam(null) // teams off unless a test turns them on
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
    applyTeamConfig({ BURN_STATUSES: '   ', INTEGRATION_ROLES: '' })
    expect(CFG.burnStatuses).toEqual(['In Dev', 'In Dev Testing'])
    expect(CFG.integrationRoles).toEqual(['BE', 'WEB', 'MOB'])
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

describe('per-team config fields', () => {
  it('storeKeyOf: team key only for perTeam fields with a team active', () => {
    const project = CONFIG_FIELDS.find((f) => f.env === 'JIRA_PROJECT')
    const refresh = CONFIG_FIELDS.find((f) => f.env === 'REFRESH_INTERVAL')
    expect(storeKeyOf(project)).toBe('JIRA_PROJECT') // teams off → shared key
    setTeam('mp')
    expect(storeKeyOf(project)).toBe('JIRA_PROJECT__mp')
    expect(storeKeyOf(refresh)).toBe('REFRESH_INTERVAL') // not per-team
  })

  it('the team value wins over the shared one: team > shared > .env', () => {
    setTeam('mp')
    applyTeamConfig({ JIRA_PROJECT: 'shared1', JIRA_PROJECT__mp: 'mine1', BURN_STATUSES: 'S1, S2' })
    expect(CFG.projects).toEqual(['MINE1']) // team beats shared
    expect(CFG.burnStatuses).toEqual(['S1', 'S2']) // no team value → shared applies
    expect(CFG.teamFrom).toBe('2024-05-01') // neither → .env stands
  })

  it("another team's value never leaks in", () => {
    setTeam('mp')
    applyTeamConfig({ JIRA_PROJECT__aoa: 'theirs', CONFLUENCE_SPEC_SPACE__aoa: 'TheirSpace' })
    expect(CFG.projects).toEqual(['APP', 'DX'])
    expect(CFG.specSpace).toBe('Merchant')
  })

  it('an invalid team value falls back to the shared one', () => {
    setTeam('mp')
    applyTeamConfig({ JIRA_TEAM_FROM__mp: '   ', JIRA_TEAM_FROM: '2025-01-01' })
    expect(CFG.teamFrom).toBe('2025-01-01')
  })

  it('teams off → suffixed keys are ignored entirely (legacy behavior)', () => {
    applyTeamConfig({ JIRA_PROJECT__mp: 'mine1' })
    expect(CFG.projects).toEqual(['APP', 'DX'])
  })

  it("configDiffers sees my team's key but not another team's", () => {
    setTeam('mp')
    expect(configDiffers({ JIRA_PROJECT__mp: 'x' }, {})).toBe(true)
    expect(configDiffers({ JIRA_PROJECT__aoa: 'x' }, {})).toBe(false)
  })
})

describe('split saves (two editor boxes)', () => {
  it('saveTeamConfig merges a partial save into the boot cache', async () => {
    localStorage.clear()
    cacheTeamConfig({ REFRESH_INTERVAL: '2m', JIRA_PROJECT__mp: 'OLD' })
    await saveTeamConfig({ JIRA_PROJECT__mp: 'NEW' }) // the team box's keys only
    expect(fs.setDocs.at(-1)).toEqual({ JIRA_PROJECT__mp: 'NEW' })
    // the shared box's cached value survives the partial save
    expect(cachedTeamConfig()).toEqual({ REFRESH_INTERVAL: '2m', JIRA_PROJECT__mp: 'NEW' })
  })

  it("logConfigChange diffs only the keys the save carried — other box's fields never log as cleared", async () => {
    fs.addDocs.length = 0
    const before = { REFRESH_INTERVAL: '2m', JIRA_PROJECT__mp: 'OLD' }
    await logConfigChange('me@x.co', before, { JIRA_PROJECT__mp: 'NEW' })
    expect(fs.addDocs).toHaveLength(1)
    expect(fs.addDocs[0].changes).toEqual({ JIRA_PROJECT__mp: { from: 'OLD', to: 'NEW' } })
  })

  it('logConfigChange with nothing changed writes no history entry', async () => {
    fs.addDocs.length = 0
    const out = await logConfigChange('me@x.co', { JIRA_PROJECT__mp: 'SAME' }, { JIRA_PROJECT__mp: ' SAME ' })
    expect(out).toBeNull()
    expect(fs.addDocs).toHaveLength(0)
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
    expect(configDiffers({ BURN_STATUSES: 'a' }, { BURN_STATUSES: ' a ' })).toBe(false)
    expect(configDiffers({ BURN_STATUSES: 'a' }, { BURN_STATUSES: 'b' })).toBe(true)
    expect(configDiffers({}, {})).toBe(false)
    expect(configDiffers({ BURN_STATUSES: 'X' }, {})).toBe(true)
    expect(configDiffers({ UNRELATED: 'x' }, {})).toBe(false) // unknown keys ignored
  })
})
