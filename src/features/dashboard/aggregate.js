import { CFG } from '../../config/appConfig.js'
import { emailUsername, shortName } from '../../utils/format.js'

// Status-category ramp for the stacked chart — single-hue mint sequence plus a
// slate for "To Do", validated for CVD separation against the panel surface.
// Colors are CSS-variable references so the chart follows the active theme.
export const CATEGORIES = [
  { key: 'new', label: 'To Do', color: 'var(--color-slate)' },
  { key: 'indeterminate', label: 'In Progress', color: 'var(--color-blue)' },
  { key: 'done', label: 'Done', color: 'var(--color-success)' },
]

// Per-member counts by status category. Every configured member (me included)
// is seeded so people with zero tasks still appear on the chart.
export function memberStats(issues) {
  const byKey = new Map()
  const seed = (key, name, isMe) =>
    byKey.set(key, {
      key,
      name,
      isMe,
      filterName: null, // full displayName, needed to drive the Team tab filter
      counts: { new: 0, indeterminate: 0, done: 0 },
      total: 0,
    })

  seed(CFG.email, emailUsername(CFG.email), true)
  CFG.teamEmails.forEach((e) => seed(e, emailUsername(e), false))

  for (const iss of issues) {
    const a = iss.fields.assignee
    const key = a?.emailAddress || a?.displayName || 'unassigned'
    if (!byKey.has(key)) seed(key, a ? shortName(a.displayName) : 'Unassigned', false)
    const row = byKey.get(key)
    if (a?.displayName) {
      row.name = shortName(a.displayName)
      row.filterName = a.displayName
    } else if (!a) {
      row.filterName = 'Unassigned'
    }
    const cat = iss.fields.status.statusCategory?.key || 'new'
    row.counts[cat] = (row.counts[cat] || 0) + 1
    row.total++
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total)
}

// Count per status name, tagged with its category for the color dot.
export function statusStats(issues) {
  const byName = new Map()
  for (const iss of issues) {
    const name = iss.fields.status.name
    const cat = iss.fields.status.statusCategory?.key || 'new'
    const row = byName.get(name) || { name, cat, count: 0 }
    row.count++
    byName.set(name, row)
  }
  return [...byName.values()].sort((a, b) => b.count - a.count)
}

// Count per work type (Epic / Story / Sub-task / …), ordered by hierarchy tier.
export function typeStats(issues) {
  const byName = new Map()
  for (const iss of issues) {
    const name = iss.fields.issuetype?.name || 'Other'
    const tier = iss.fields.issuetype?.hierarchyLevel ?? 0
    const row = byName.get(name) || { name, tier, count: 0 }
    row.count++
    byName.set(name, row)
  }
  return [...byName.values()].sort((a, b) => b.tier - a.tier || b.count - a.count)
}

export function summaryStats(teamIssues, myIssues) {
  const catCount = (issues, cat) =>
    (issues || []).filter((i) => (i.fields.status.statusCategory?.key || 'new') === cat).length
  const team = teamIssues || []
  return [
    { label: 'Team tasks', value: team.length, color: 'var(--color-violet)' },
    { label: 'To Do', value: catCount(team, 'new'), color: 'var(--color-slate)' },
    { label: 'In Progress', value: catCount(team, 'indeterminate'), color: 'var(--color-blue)' },
    { label: 'Done', value: catCount(team, 'done'), color: 'var(--color-success)' },
    {
      label: 'My open tasks',
      value: (myIssues || []).filter((i) => i.fields.status.statusCategory?.key !== 'done').length,
      color: 'var(--color-amber)',
    },
  ]
}
