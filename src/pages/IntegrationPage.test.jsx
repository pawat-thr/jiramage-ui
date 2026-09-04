import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CFG } from '../config/appConfig.js'

const jiraStory = (key, summary) => ({
  key,
  fields: { summary, status: { name: 'To Do' }, [CFG.releaseField]: { value: 'R1' } },
})
const planRow = (id, key, extra = {}) => ({
  id,
  release: 'R1',
  key,
  name: `Story ${key}`,
  status: 'To Do',
  env: '',
  targetDates: {},
  remark: '',
  ...extra,
})

vi.mock('../services/jiraApi.js', () => ({
  fetchStories: vi.fn().mockResolvedValue([jiraStory('DX-1', 'Story DX-1'), jiraStory('DX-2', 'Story DX-2')]),
}))
const api = {
  fetchPlan: vi.fn(),
  syncPlan: vi.fn().mockResolvedValue({ added: 2, removed: 0 }),
  savePlanRows: vi.fn().mockResolvedValue(),
  deletePlanRow: vi.fn().mockResolvedValue(),
}
vi.mock('../services/integrationApi.js', () => ({
  fetchPlan: (...a) => api.fetchPlan(...a),
  syncPlan: (...a) => api.syncPlan(...a),
  savePlanRows: (...a) => api.savePlanRows(...a),
  deletePlanRow: (...a) => api.deletePlanRow(...a),
}))

const { default: IntegrationPage } = await import('./IntegrationPage.jsx')

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/integration']}>
      <Routes>
        <Route path="/integration/*" element={<IntegrationPage defaultRelease="R1" onNotify={() => {}} />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.syncPlan.mockResolvedValue({ added: 2, removed: 0 })
  api.fetchPlan.mockResolvedValue([planRow('a', 'DX-1'), planRow('b', 'DX-2')])
})

describe('IntegrationPage', () => {
  it('loads the stored plan with frozen columns and role date headers', async () => {
    renderPage()
    await screen.findByText('DX-1')
    expect(screen.getByText('Story DX-2')).toBeInTheDocument()
    for (const r of CFG.integrationRoles) {
      expect(screen.getByText(`Target · ${r}`)).toBeInTheDocument()
    }
  })

  it('editing stays LOCAL: save bar appears, nothing written until Save is pushed', async () => {
    renderPage()
    await screen.findByText('DX-1')
    const envInput = screen.getAllByPlaceholderText('env…')[0]
    await userEvent.type(envInput, 'SIT-2')
    await userEvent.tab()
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
    expect(api.savePlanRows).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Save 1 change/ }))
    await waitFor(() => expect(api.savePlanRows).toHaveBeenCalledTimes(1))
    const saved = api.savePlanRows.mock.calls[0][0]
    expect(saved).toHaveLength(1) // only the changed row
    expect(saved[0]).toMatchObject({ id: 'a', env: 'SIT-2' })
    await waitFor(() => expect(screen.queryByText(/unsaved change/)).toBeNull())
  })

  it('Sync is locked while dirty', async () => {
    renderPage()
    await screen.findByText('DX-1')
    const syncBtn = screen.getByRole('button', { name: /Sync from Jira/ })
    expect(syncBtn).toBeEnabled()
    await userEvent.type(screen.getAllByPlaceholderText('remark…')[0], 'wip')
    await userEvent.tab()
    await screen.findByText('1 unsaved change')
    expect(syncBtn).toBeDisabled()
  })

  it('Sync passes the stored rows and reloads the plan', async () => {
    renderPage()
    await screen.findByText('DX-1')
    await userEvent.click(screen.getByRole('button', { name: /Sync from Jira/ }))
    await waitFor(() => expect(api.syncPlan).toHaveBeenCalledTimes(1))
    const [release, jira, existing] = api.syncPlan.mock.calls[0]
    expect(release).toBe('R1')
    expect(jira).toHaveLength(2)
    expect(existing).toHaveLength(2) // never [] when the plan is loaded
    expect(api.fetchPlan).toHaveBeenCalledTimes(2) // initial + after sync
  })

  it('row delete asks for confirmation, then deletes', async () => {
    renderPage()
    await screen.findByText('DX-1')
    await userEvent.click(screen.getByLabelText('Remove DX-1 from plan'))
    expect(screen.getByText(/Remove DX-1 from the plan\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.deletePlanRow).toHaveBeenCalledWith('a'))
  })

  it('empty plan shows the sync hint', async () => {
    api.fetchPlan.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/No stories in this plan yet/)).toBeInTheDocument()
  })
})
