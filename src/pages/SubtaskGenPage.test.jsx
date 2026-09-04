import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CFG } from '../config/appConfig.js'

const SPACE = CFG.specSpace || 'Merchant'
const api = {
  createSubtasks: vi.fn(),
}
vi.mock('../services/jiraApi.js', () => ({
  searchStoriesByText: vi.fn().mockResolvedValue([]),
  fetchIssueDetail: vi.fn().mockResolvedValue({
    key: 'DX-1',
    fields: {
      summary: 'My story',
      project: { key: 'DX' },
      subtasks: [
        { fields: { summary: '[BE][MP] GRPC ValidateFooCart' } }, // claims a spec page
        { fields: { summary: '[QA] Test case' } }, // covers the QA test_case category
      ],
    },
  }),
  fetchRemoteLinks: vi.fn().mockResolvedValue([
    { object: { url: 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=1', title: '[R1] GRPC ValidateFooCart' } },
    { object: { url: 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=2', title: '[R1] GRPC ReserveFooOrder' } },
    { object: { url: 'https://x.atlassian.net/wiki/pages/viewpage.action?pageId=3', title: '[R1] Foreign page' } },
  ]),
  fetchPageSpaces: vi.fn().mockImplementation(async (ids) => ({ 1: SPACE, 2: SPACE, 3: 'OTHER' })),
  fetchSubtaskType: vi.fn().mockResolvedValue({ id: '10043', name: 'Subtask' }),
  resolveAccountIds: vi.fn().mockResolvedValue(Object.fromEntries([CFG.email, ...CFG.teamEmails].map((e) => [e, 'acc-' + e]))),
  createSubtasks: (...a) => api.createSubtasks(...a),
  browseUrl: (k) => `https://x/browse/${k}`,
}))

const { default: SubtaskGenPage } = await import('./SubtaskGenPage.jsx')

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/subtask-gen/DX-1']}>
      <Routes>
        <Route path="/subtask-gen/*" element={<SubtaskGenPage onNotify={() => {}} />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  api.createSubtasks.mockResolvedValue({ issues: [{ key: 'DX-100' }], errors: [] })
})

describe('SubtaskGenPage', () => {
  it('role tabs show correct counts: 1 BE suggestion, 8 QA (test case covered)', async () => {
    renderPage()
    await screen.findByText('My story')
    const tab = (r) => screen.getAllByRole('button').find((b) => b.textContent.replace(/\s/g, '').startsWith(r))
    expect(tab('BE').textContent).toContain('1')
    expect(tab('FE').textContent).toContain('0')
    expect(tab('QA').textContent).toContain('8')
  })

  it('claimed spec + covered QA category land in "Already covered"', async () => {
    renderPage()
    await screen.findByText(/Already covered/)
    const heading = screen.getByText(/Already covered/).closest('h3')
    expect(heading.textContent).toContain('(2)')
    expect(screen.getByText('[R1] GRPC ValidateFooCart')).toBeInTheDocument()
    expect(screen.getByText('Test Case')).toBeInTheDocument()
  })

  it('foreign-space pages are skipped with a note', async () => {
    renderPage()
    await screen.findByText(/page skipped/)
    expect(screen.getByText(/OTHER/)).toBeInTheDocument()
  })

  it('Create sends only the ACTIVE role tab rows', async () => {
    renderPage()
    await screen.findByText('My story')
    // active tab defaults to BE (1 row)
    await userEvent.click(screen.getByRole('button', { name: /Create 1 BE subtask/ }))
    await waitFor(() => expect(api.createSubtasks).toHaveBeenCalledTimes(1))
    const rows = api.createSubtasks.mock.calls[0][0].rows
    expect(rows).toHaveLength(1)
    expect(rows[0].summary).toContain('GRPC ReserveFooOrder')
  })

  it('partial failure keeps only the failed rows for retry', async () => {
    renderPage()
    await screen.findByText('My story')
    const qaTab = screen.getAllByRole('button').find((b) => b.textContent.replace(/\s/g, '').startsWith('QA'))
    await userEvent.click(qaTab)
    api.createSubtasks.mockResolvedValue({
      issues: Array.from({ length: 7 }, (_, i) => ({ key: `DX-${i}` })),
      errors: [{ failedElementNumber: 0 }],
    })
    await userEvent.click(screen.getByRole('button', { name: /Create 8 QA subtasks/ }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Create 1 QA subtask on/ })).toBeInTheDocument(),
    )
  })

  it('created keys accumulate in the success card', async () => {
    renderPage()
    await screen.findByText('My story')
    await userEvent.click(screen.getByRole('button', { name: /Create 1 BE subtask/ }))
    await screen.findByText(/Created \(1\)/)
    expect(screen.getByRole('link', { name: /DX-100/ })).toBeInTheDocument()
  })
})
