import { QA_CATEGORIES, qaStats } from './deliveryUtils.js'

// Round like the UI's fmtPts but keep numbers as numbers for Excel.
const pts = (n) => (n % 1 ? Number(n.toFixed(1)) : n)

// Points only: "done/total" (— when the story has no such subtask).
const bucketPts = (b) => (b.count ? `${pts(b.donePts)}/${pts(b.pts)}` : '—')

// Build and download a two-sheet workbook: Delivery (role-split points) + QA Info
// (the QA category table). `rows` / `qaRows` are the page's filtered row lists.
// SheetJS is lazy-loaded so the main bundle doesn't pay for it.
export async function exportDeliveryXlsx({ release, rows, qaRows, subMap }) {
  const XLSX = await import('xlsx')

  // ---- Sheet 1: Delivery — two-row header, columns grouped by role:
  //   FE [Total | In Progress | Done] · BE [...] · QA [...]
  const groupRow = ['Key', 'Name', 'Status', 'FE', '', '', 'BE', '', '', 'QA', '', '']
  const subRow = ['', '', '', ...['FE', 'BE', 'QA'].flatMap(() => ['Total', 'In Progress', 'Done'])]
  const deliveryRows = rows.map(({ s, stats }) => {
    const r = stats.roles
    return [
      s.key,
      s.fields.summary,
      s.fields.status.name,
      ...['FE', 'BE', 'QA'].flatMap((id) => [pts(r[id].total), pts(r[id].inprog), pts(r[id].done)]),
    ]
  })
  const wsDelivery = XLSX.utils.aoa_to_sheet([groupRow, subRow, ...deliveryRows])
  // Merge Key/Name/Status vertically and each role group across its 3 columns.
  wsDelivery['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Key
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Name
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Status
    { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } }, // FE
    { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } }, // BE
    { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } }, // QA
  ]
  wsDelivery['!cols'] = [
    { wch: 12 },
    { wch: 46 },
    { wch: 16 },
    ...Array.from({ length: 9 }, () => ({ wch: 12 })),
  ]

  // ---- Sheet 2: QA Info — points only per category, plus a QA subtask count column
  const qaHeader = [
    'Key',
    'Name',
    'Status',
    'QA Subtasks (Done/Total)',
    'QA Total',
    ...QA_CATEGORIES.map((c) => c.label),
  ]
  const qaSheetRows = qaRows.map(({ s }) => {
    const qa = qaStats(subMap?.[s.key])
    return [
      s.key,
      s.fields.summary,
      s.fields.status.name,
      qa.total.count ? `${qa.total.doneCount}/${qa.total.count}` : '—',
      bucketPts(qa.total),
      ...QA_CATEGORIES.map((c) => bucketPts(qa.cats[c.id])),
    ]
  })
  const wsQa = XLSX.utils.aoa_to_sheet([qaHeader, ...qaSheetRows])
  wsQa['!cols'] = [
    { wch: 12 },
    { wch: 46 },
    { wch: 16 },
    { wch: 22 },
    ...Array.from({ length: QA_CATEGORIES.length + 1 }, () => ({ wch: 16 })),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsDelivery, 'Delivery')
  XLSX.utils.book_append_sheet(wb, wsQa, 'QA Info')

  const day = new Date().toISOString().slice(0, 10)
  // Release names can contain characters Windows filenames reject (e.g. "#").
  const safeRelease = release.replace(/[\\/:*?"<>|#]+/g, '-').replace(/\s+/g, ' ').trim()
  XLSX.writeFile(wb, `delivery-${safeRelease}-${day}.xlsx`)
}
