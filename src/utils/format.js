export const emailUsername = (email) => email.split('@')[0]

// "Somchai P. (Golf)" -> "Golf", same as v1's shortName.
export function shortName(name) {
  const s = name.lastIndexOf('(')
  const e = name.lastIndexOf(')')
  if (s !== -1 && e > s) return name.slice(s + 1, e)
  return name
}

export const uniqueSorted = (arr) => [...new Set(arr)].sort()

export const assigneeName = (issue) =>
  issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned'

export const typeName = (iss) => iss.fields.issuetype?.name || 'Other'

// Jira hierarchy level: 1 = Epic, 0 = Story/Task/Bug, -1 = Sub-task.
export const typeTier = (iss) => iss.fields.issuetype?.hierarchyLevel ?? 0

// Groups issues by work type, ordered Epic -> standard types -> Sub-task.
export function groupByType(issues) {
  const map = new Map()
  for (const iss of issues) {
    const name = typeName(iss)
    const group = map.get(name) || { name, tier: typeTier(iss), issues: [] }
    group.issues.push(iss)
    map.set(name, group)
  }
  return [...map.values()].sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name))
}

export function filterIssues(issues, { hideDone, status, name, search, type } = {}) {
  return (issues || []).filter((iss) => {
    if (hideDone && iss.fields.status.statusCategory?.key === 'done') return false
    if (status && iss.fields.status.name !== status) return false
    if (name && assigneeName(iss) !== name) return false
    if (type && typeName(iss) !== type) return false
    if (search) {
      const hay = `${iss.key} ${iss.fields.summary}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })
}
