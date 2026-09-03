import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CFG } from '../../config/appConfig.js'

// Intercept SheetJS: capture what the export writes instead of making a file.
const captured = { sheets: [], filename: null }
vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: (rows) => ({ rows }),
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    book_append_sheet: (wb, ws, name) => captured.sheets.push({ name, rows: ws.rows }),
  },
  writeFile: (wb, filename) => {
    captured.filename = filename
  },
}))

const { exportDeliveryXlsx } = await import('./exportXlsx.js')

const st = (summary, pts, cat = 'new') => ({
  fields: { summary, [CFG.pointField]: pts, status: { statusCategory: { key: cat } } },
})
const row = (key, summary, statusName, subtasks) => ({
  s: { key, fields: { summary, status: { name: statusName, statusCategory: { key: 'new' } } } },
  stats: null,
})

describe('exportDeliveryXlsx', () => {
  beforeEach(() => {
    captured.sheets = []
    captured.filename = null
  })

  it('writes Delivery + QA Info sheets with grouped role headers', async () => {
    const { deliveryStats } = await import('./deliveryUtils.js')
    const subs = [st('[FE] a', 2, 'done'), st('[QA] Test case', 1, 'indeterminate')]
    const r = row('DX-1', 'My story', 'In Dev')
    r.stats = deliveryStats(subs)
    await exportDeliveryXlsx({
      release: '6.1 #5 (Nov)',
      rows: [r],
      qaRows: [r],
      subMap: { 'DX-1': subs },
    })

    expect(captured.sheets.map((s) => s.name)).toEqual(['Delivery', 'QA Info'])

    const delivery = captured.sheets[0].rows
    expect(delivery[0]).toEqual(['Key', 'Name', 'Status', 'FE', '', '', 'BE', '', '', 'QA', '', ''])
    expect(delivery[1].slice(3)).toEqual([
      'Total', 'In Progress', 'Done', 'Total', 'In Progress', 'Done', 'Total', 'In Progress', 'Done',
    ])
    // data row: FE total 2 / inprog 0 / done 2 · QA total 1 / inprog 1 / done 0
    expect(delivery[2]).toEqual(['DX-1', 'My story', 'In Dev', 2, 0, 2, 0, 0, 0, 1, 1, 0])

    const qa = captured.sheets[1].rows
    expect(qa[0].slice(0, 5)).toEqual(['Key', 'Name', 'Status', 'QA Subtasks (Done/Total)', 'QA Total'])
    expect(qa[1][3]).toBe('0/1') // one QA subtask, none done
    expect(qa[1][4]).toBe('0/1') // points done/total
  })

  it('sanitizes windows-unsafe characters in the filename', async () => {
    await exportDeliveryXlsx({ release: '6.1 #5 (Nov)', rows: [], qaRows: [], subMap: {} })
    expect(captured.filename).toMatch(/^delivery-6\.1 -5 \(Nov\)-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(captured.filename).not.toContain('#')
  })
})
