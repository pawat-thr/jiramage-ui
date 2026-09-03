import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const api = {
  watchInbox: vi.fn(),
  markRead: vi.fn().mockResolvedValue(),
  markAllRead: vi.fn().mockResolvedValue(),
  deleteNotification: vi.fn().mockResolvedValue(),
}
vi.mock('../services/notificationsApi.js', () => ({
  watchInbox: (...a) => api.watchInbox(...a),
  markRead: (...a) => api.markRead(...a),
  markAllRead: (...a) => api.markAllRead(...a),
  deleteNotification: (...a) => api.deleteNotification(...a),
}))

const { default: InboxPage } = await import('./InboxPage.jsx')

const ts = { seconds: 1, toDate: () => new Date() }
const ITEMS = [
  { id: '1', type: 'pr_comment', toEmail: 'me@x.co', fromEmail: 'a@x.co', fromName: 'anna', refId: 'p1', title: 'PR One', read: false, createdAt: ts },
  { id: '2', type: 'pr_comment', toEmail: 'me@x.co', fromEmail: 'b@x.co', fromName: 'bob', refId: 'p2', title: 'PR Two', read: true, createdAt: ts },
]

const renderPage = (items = ITEMS) => {
  api.watchInbox.mockImplementation((email, cb) => {
    cb(items)
    return () => {}
  })
  return render(
    <MemoryRouter>
      <InboxPage user={{ email: 'me@x.co', uid: 'u1' }} onNotify={() => {}} />
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('InboxPage', () => {
  it('All tab shows everything, Unread tab filters', async () => {
    renderPage()
    expect(screen.getByText('PR One')).toBeInTheDocument()
    expect(screen.getByText('PR Two')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Unread (1)' }))
    expect(screen.getByText('PR One')).toBeInTheDocument()
    expect(screen.queryByText('PR Two')).toBeNull()
  })

  it('delete button removes without navigating', async () => {
    renderPage()
    await userEvent.click(screen.getAllByLabelText('Delete notification')[0])
    expect(api.deleteNotification).toHaveBeenCalledWith('1')
    expect(api.markRead).not.toHaveBeenCalled()
  })

  it('Mark all read appears only with unread items', () => {
    renderPage(ITEMS.map((n) => ({ ...n, read: true })))
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull()
  })

  it('empty inbox shows the friendly message', () => {
    renderPage([])
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
  })
})
