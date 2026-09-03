import { describe, it, expect, vi, beforeEach } from 'vitest'

const batch = { delete: vi.fn(), commit: vi.fn().mockResolvedValue() }
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: () => batch,
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: (db, col, id) => ({ id }),
  serverTimestamp: vi.fn(),
}))
vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: true }))

const { pruneOldNotifications, PRUNE_AFTER_DAYS } = await import('./notificationsApi.js')

const daysAgo = (d) => ({ seconds: Date.now() / 1000 - d * 86400 })

describe('pruneOldNotifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes only READ items older than the retention window (once per session)', async () => {
    const items = [
      { id: 'old-read', read: true, createdAt: daysAgo(PRUNE_AFTER_DAYS + 5) },
      { id: 'old-unread', read: false, createdAt: daysAgo(PRUNE_AFTER_DAYS + 5) },
      { id: 'fresh-read', read: true, createdAt: daysAgo(2) },
      { id: 'no-timestamp', read: true, createdAt: null },
    ]
    const n = await pruneOldNotifications(items)
    expect(n).toBe(1)
    expect(batch.delete).toHaveBeenCalledTimes(1)
    expect(batch.delete.mock.calls[0][0].id).toBe('old-read')

    // second call in the same session is a no-op
    const n2 = await pruneOldNotifications(items)
    expect(n2).toBe(0)
    expect(batch.commit).toHaveBeenCalledTimes(1)
  })
})
