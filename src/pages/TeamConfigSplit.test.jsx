import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// With teams ACTIVE the config editor splits into two boxes: the team's own
// settings (saved under ENV__<team>) and the shared config — ALL fields under
// their plain keys, per-team ones acting as the fallback — with the history
// split between them the same way.
vi.mock('../services/firebase.js', () => ({ db: {}, firebaseEnabled: false }))
vi.mock('../services/teamsApi.js', () => ({
  activeTeamSlug: () => 'mp',
  teamsEnabled: () => true,
}))
const saveTeamConfig = vi.fn(async () => {})
vi.mock('../services/configApi.js', async (importOriginal) => {
  const actual = await importOriginal() // real CONFIG_FIELDS + storeKeyOf (sees the mocked team)
  return {
    ...actual,
    loadTeamConfig: async () => ({ JIRA_PROJECT: 'APP', JIRA_PROJECT__mp: 'MP1' }),
    loadConfigHistory: async () => [
      { id: 'h1', by: 'lead@x.co', changes: { JIRA_PROJECT__mp: { from: '', to: 'MP1' } } },
      { id: 'h2', by: 'any@x.co', changes: { REFRESH_INTERVAL: { from: '', to: '2m' } } },
      { id: 'h3', by: 'aoa@x.co', changes: { JIRA_PROJECT__aoa: { from: '', to: 'A1' } } },
      // legacy entry from BEFORE the split: plain key of a per-team field
      { id: 'h4', by: 'old@x.co', changes: { JIRA_PROJECT: { from: 'X', to: 'APP' } } },
    ],
    saveTeamConfig,
    logConfigChange: vi.fn(async () => {}),
  }
})

const { TeamConfig } = await import('./SettingsPage.jsx')

describe('TeamConfig with teams active — two boxes', () => {
  it('splits fields, history and saves between the team box and the shared box', async () => {
    render(<TeamConfig onNotify={() => {}} user={{ email: 'me@x.co' }} />)
    await screen.findByLabelText('JIRA_PROJECT__mp') // async load done

    // two boxes with their own save buttons
    expect(screen.getByText('Team MP settings')).toBeInTheDocument()
    expect(screen.getByText('Shared config · all teams')).toBeInTheDocument()
    const saveTeam = screen.getByRole('button', { name: /Save team MP/ })
    const saveShared = screen.getByRole('button', { name: /Save shared config/ })

    // team box edits the team key; the shared box edits the PLAIN key of the
    // same field (the fallback every team inherits) — both stay editable
    expect(screen.getByLabelText('JIRA_PROJECT__mp')).toHaveValue('MP1')
    expect(screen.getByLabelText('JIRA_PROJECT')).toHaveValue('APP')
    expect(screen.getByLabelText('REFRESH_INTERVAL')).toBeInTheDocument()

    // history split: my team's entry in the team box; shared + LEGACY
    // (pre-split plain-key) entries in the shared box; AOA's nowhere
    expect(screen.getByText('JIRA_PROJECT__mp')).toBeInTheDocument()
    expect(screen.getByText('old@x.co'.replace('@x.co', ''))).toBeInTheDocument() // legacy entry visible
    expect(screen.queryByText('JIRA_PROJECT__aoa')).not.toBeInTheDocument()

    // the team box saves ONLY team keys — shared values untouched
    fireEvent.change(screen.getByLabelText('JIRA_PROJECT__mp'), { target: { value: 'MP2' } })
    fireEvent.click(saveTeam)
    await waitFor(() => expect(saveTeamConfig).toHaveBeenCalled())
    const teamData = saveTeamConfig.mock.calls[0][0]
    expect(teamData.JIRA_PROJECT__mp).toBe('MP2')
    expect(Object.keys(teamData).every((k) => k.endsWith('__mp'))).toBe(true)

    // the shared box saves ONLY plain keys — fallback stays editable
    fireEvent.change(screen.getByLabelText('JIRA_PROJECT'), { target: { value: 'NEWSHARED' } })
    fireEvent.click(saveShared)
    await waitFor(() => expect(saveTeamConfig).toHaveBeenCalledTimes(2))
    const sharedData = saveTeamConfig.mock.calls[1][0]
    expect(sharedData.JIRA_PROJECT).toBe('NEWSHARED')
    expect(Object.keys(sharedData).every((k) => !k.includes('__'))).toBe(true)
  })
})
