import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const api = {
  watchInbox: vi.fn(),
  markRead: vi.fn().mockResolvedValue(),
  markAllRead: vi.fn().mockResolvedValue(),
}
vi.mock('../../services/notificationsApi.js', () => ({
  watchInbox: (...a) => api.watchInbox(...a),
  markRead: (...a) => api.markRead(...a),
  markAllRead: (...a) => api.markAllRead(...a),
  pruneOldNotifications: vi.fn().mockResolvedValue(0),
}))
const playPing = vi.fn()
vi.mock('../../utils/notifSound.js', () => ({ playPing: (...a) => playPing(...a) }))

const { default: NotificationBell } = await import('./NotificationBell.jsx')

const ts = { seconds: 1, toDate: () => new Date('2026-09-01T10:00:00') }
const ITEMS = [
  { id: '1', type: 'pr_review_assigned', toEmail: 'me@x.co', fromEmail: 'a@x.co', fromName: 'anna', refId: 'p1', title: 'PR One', read: false, createdAt: ts },
  { id: '2', type: 'pr_status_changed', toEmail: 'me@x.co', fromEmail: 'b@x.co', fromName: 'bob', statusLabel: 'Approved', refId: 'p2', title: 'PR Two', read: false, createdAt: ts },
  { id: '3', type: 'pr_comment', toEmail: 'me@x.co', fromEmail: 'b@x.co', fromName: 'bob', refId: 'p3', title: 'PR Three', read: true, createdAt: ts },
]

const renderBell = (items = ITEMS) => {
  api.watchInbox.mockImplementation((email, cb) => {
    cb(items)
    return () => {}
  })
  return render(
    <MemoryRouter>
      <NotificationBell user={{ email: 'me@x.co', uid: 'u1' }} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  document.title = 'jiramage'
})

describe('NotificationBell', () => {
  it('shows the unread badge count and pings once on load', () => {
    renderBell()
    expect(screen.getByLabelText('Notifications (2 unread)')).toBeInTheDocument()
    expect(playPing).toHaveBeenCalledTimes(1)
  })

  it('sets the tab title badge', () => {
    renderBell()
    expect(document.title).toBe('(2) jiramage')
  })

  it('dropdown renders per-type messages', async () => {
    renderBell()
    await userEvent.click(screen.getByLabelText(/Notifications/))
    expect(screen.getByText(/assigned you to review/)).toBeInTheDocument()
    expect(screen.getByText(/changed your PR status to/)).toBeInTheDocument()
    expect(screen.getByText(/commented on your PR/)).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('Mark all read sends only the unread ids', async () => {
    renderBell()
    await userEvent.click(screen.getByLabelText(/Notifications/))
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    expect(api.markAllRead).toHaveBeenCalledWith(['1', '2'])
  })

  it('clicking an unread item marks it read', async () => {
    renderBell()
    await userEvent.click(screen.getByLabelText(/Notifications/))
    await userEvent.click(screen.getByText('PR One'))
    expect(api.markRead).toHaveBeenCalledWith('1')
  })

  it('no badge and no ping when everything is read', () => {
    renderBell(ITEMS.map((n) => ({ ...n, read: true })))
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    expect(playPing).not.toHaveBeenCalled()
    expect(document.title).toBe('jiramage')
  })

  it('re-delivering the same list does not re-ping; a new item does', () => {
    let push
    api.watchInbox.mockImplementation((email, cb) => {
      push = cb
      cb(ITEMS)
      return () => {}
    })
    render(
      <MemoryRouter>
        <NotificationBell user={{ email: 'me@x.co', uid: 'u1' }} />
      </MemoryRouter>,
    )
    expect(playPing).toHaveBeenCalledTimes(1)
    push(ITEMS) // reconnect with identical data
    expect(playPing).toHaveBeenCalledTimes(1)
    push([...ITEMS, { ...ITEMS[0], id: '9', title: 'PR Nine' }])
    expect(playPing).toHaveBeenCalledTimes(2)
  })
})
