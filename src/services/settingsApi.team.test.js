import { describe, it, expect, vi } from 'vitest'

// Per-team Dev Prompt routing: with a team active the template lives in its
// own field (promptTemplate_<team>) on settings/global; teams off → the
// classic shared field. Firestore itself is mocked — the FIELD routing is
// what's under test.
const state = vi.hoisted(() => ({ team: null, setDocs: [], snapCb: null }))

vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: true }))
vi.mock('./teamsApi.js', () => ({ activeTeamSlug: () => state.team }))
vi.mock('firebase/firestore', () => ({
  doc: (_db, col, id) => ({ col, id }),
  onSnapshot: (_ref, cb) => {
    state.snapCb = cb
    return () => {}
  },
  setDoc: (ref, data, opts) => {
    state.setDocs.push({ ref, data, opts })
    return Promise.resolve()
  },
}))

const { watchPromptTemplate, savePromptTemplate, DEFAULT_PROMPT_TEMPLATE } =
  await import('./settingsApi.js')

const fakeSnap = (data) => ({ data: () => data })

describe('Dev Prompt per team', () => {
  it('teams off → the classic shared promptTemplate field', async () => {
    state.team = null
    await savePromptTemplate('shared one {link}')
    expect(state.setDocs.at(-1).data).toEqual({ promptTemplate: 'shared one {link}' })

    let got
    watchPromptTemplate((t) => (got = t))
    state.snapCb(fakeSnap({ promptTemplate: 'shared one {link}', promptTemplate_mp: 'mp own' }))
    expect(got).toBe('shared one {link}')
  })

  it('team active → reads/saves promptTemplate_<team> only', async () => {
    state.team = 'mp'
    await savePromptTemplate('mp only {link}')
    expect(state.setDocs.at(-1).data).toEqual({ promptTemplate_mp: 'mp only {link}' })

    let got
    watchPromptTemplate((t) => (got = t))
    state.snapCb(fakeSnap({ promptTemplate: 'shared', promptTemplate_mp: 'mp own' }))
    expect(got).toBe('mp own')
  })

  it('team active with no own template yet → built-in default (no shared fallback by design)', () => {
    state.team = 'aoa'
    let got
    watchPromptTemplate((t) => (got = t))
    state.snapCb(fakeSnap({ promptTemplate: 'shared' }))
    expect(got).toBe(DEFAULT_PROMPT_TEMPLATE)
  })
})
