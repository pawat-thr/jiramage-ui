import { describe, it, expect, vi, beforeEach } from 'vitest'

const batches = []
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  // doc(col, id) or doc(db, col, id) — the ref keeps the last segment (the id)
  doc: (dbOrCol, ...parts) => ({ id: parts.at(-1) ?? 'generated' }),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  writeBatch: () => {
    const b = { ops: [], set: null, update: null, delete: null, commit: vi.fn().mockResolvedValue() }
    b.set = (ref, data) => b.ops.push({ type: 'set', ref, data })
    b.update = (ref, data) => b.ops.push({ type: 'update', ref, data })
    b.delete = (ref) => b.ops.push({ type: 'delete', ref })
    batches.push(b)
    return b
  },
  serverTimestamp: () => 'TS',
}))
vi.mock('./firebase.js', () => ({ db: {}, firebaseEnabled: true }))

const { syncPlan, savePlanRows } = await import('./integrationApi.js')

const story = (key, summary, status) => ({ key, fields: { summary, status: { name: status } } })

describe('syncPlan', () => {
  beforeEach(() => (batches.length = 0))

  it('adds new, refreshes changed meta, keeps inputs, deletes gone', async () => {
    const jira = [story('DX-1', 'One', 'To Do'), story('DX-2', 'Two RENAMED', 'Done'), story('DX-3', 'Three', 'To Do')]
    const stored = [
      { id: 'a', key: 'DX-2', name: 'Two', status: 'To Do', env: 'SIT', remark: 'keep me' },
      { id: 'b', key: 'DX-3', name: 'Three', status: 'To Do' }, // unchanged
      { id: 'c', key: 'DX-99', name: 'Gone', status: 'Done' },
    ]
    const res = await syncPlan('R1', jira, stored)
    expect(res).toEqual({ added: 1, removed: 1 })
    const ops = batches.flatMap((b) => b.ops)
    const set = ops.find((o) => o.type === 'set')
    expect(set.data).toMatchObject({ key: 'DX-1', env: '', targetDates: {}, remark: '' })
    const upd = ops.find((o) => o.type === 'update')
    expect(upd.data).toMatchObject({ name: 'Two RENAMED', status: 'Done' })
    expect(upd.data.env).toBeUndefined() // user inputs never touched
    expect(ops.filter((o) => o.type === 'delete')).toHaveLength(1)
    expect(ops.filter((o) => o.type === 'update')).toHaveLength(1) // unchanged DX-3 untouched
  })

  it('chunks big syncs under the 500-op batch cap', async () => {
    const jira = Array.from({ length: 1000 }, (_, i) => story(`DX-${i}`, `S${i}`, 'To Do'))
    await syncPlan('R1', jira, [])
    expect(batches.length).toBe(3) // 450 + 450 + 100
    expect(Math.max(...batches.map((b) => b.ops.length))).toBeLessThanOrEqual(450)
  })
})

describe('team-rooted rows', () => {
  beforeEach(() => (batches.length = 0))

  it('with a team active: new rows are stamped and their ids carry the team', async () => {
    const { applyTeamRoster } = await import('./teamsApi.js')
    applyTeamRoster({ team: 'mp', members: [] }, 'me@x.co')
    try {
      await syncPlan('R9', [story('DX-7', 'Seven', 'To Do')], [])
      const set = batches.flatMap((b) => b.ops).find((o) => o.type === 'set')
      expect(set.data.team).toBe('mp') // stamped → filtered to team MP readers
      expect(set.ref.id).toBe(encodeURIComponent('mp|R9|DX-7')) // two teams can track the same release
    } finally {
      applyTeamRoster({ team: null, members: [] }, 'me@x.co') // teams off again for other tests
    }
  })
})

describe('savePlanRows', () => {
  beforeEach(() => (batches.length = 0))

  it('writes only the editable fields with safe defaults', async () => {
    await savePlanRows([{ id: 'x', env: 'SIT-2', targetDates: { BE: '2026-09-15' } }])
    const op = batches[0].ops[0]
    expect(op.type).toBe('update')
    expect(op.data).toEqual({ env: 'SIT-2', targetDates: { BE: '2026-09-15' }, remark: '', updatedAt: 'TS' })
  })
})
