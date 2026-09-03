import { CFG } from '../config/appConfig.js'

// All requests go through the Vite dev-server proxy at /jira, which injects
// the Basic-auth header from .env — the token never reaches the browser.
async function jira(path, { method = 'GET', body } = {}) {
  const res = await fetch('/jira' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Paginated search over /rest/api/3/search/jql — fetches ALL pages.
async function searchAll(jql, fields) {
  const all = []
  let nextPageToken
  for (;;) {
    const payload = { jql, maxResults: 100, fields }
    if (nextPageToken) payload.nextPageToken = nextPageToken
    const result = await jira('/rest/api/3/search/jql', { method: 'POST', body: payload })
    all.push(...(result.issues || []))
    if (!result.nextPageToken || !(result.issues || []).length) break
    nextPageToken = result.nextPageToken
  }
  return all
}

const quote = (arr) => arr.map((s) => `"${s}"`).join(',')

function projectFilter() {
  if (!CFG.projects.length) return ''
  return `project in (${quote(CFG.projects)}) AND `
}

export function fetchMyIssues() {
  return searchAll(
    projectFilter() + 'assignee = currentUser() ORDER BY key DESC',
    ['summary', 'status', 'priority', 'assignee', 'issuetype', 'parent', CFG.pointField],
  )
}

// Story-type cards across the configured projects, including the Release field.
export function fetchStories() {
  return searchAll(
    projectFilter() + 'issuetype = Story ORDER BY key DESC',
    ['summary', 'status', 'assignee', 'priority', 'issuetype', CFG.releaseField],
  )
}

export function fetchTeamIssues() {
  const emails = [CFG.email, ...CFG.teamEmails]
  const jql =
    projectFilter() +
    `assignee in (${quote(emails)}) AND created >= "${CFG.teamFrom}" ORDER BY key DESC`
  return searchAll(jql, ['summary', 'status', 'priority', 'assignee', 'issuetype', 'parent', CFG.pointField])
}

// Full detail for one issue: description, people, dates, labels, subtasks, comments.
export function fetchIssueDetail(key) {
  const fields = [
    'summary',
    'description',
    'status',
    'priority',
    'assignee',
    'reporter',
    'created',
    'updated',
    'labels',
    'issuetype',
    'subtasks',
    'comment',
    'attachment',
    CFG.releaseField,
  ].join(',')
  return jira(`/rest/api/3/issue/${key}?fields=${fields}`)
}

// Quick story search for picking a ref card: exact key match first, then a
// small summary-text search (single page, max 8).
export async function searchStoriesByText(q) {
  const query = q.trim()
  const results = []
  if (/^[A-Za-z]+-\d+$/.test(query)) {
    try {
      const iss = await jira(
        `/rest/api/3/issue/${query.toUpperCase()}?fields=summary,status,issuetype`,
      )
      results.push(iss)
    } catch {
      // not a real key — fall through to text search
    }
  }
  const esc = query.replace(/["\\]/g, '')
  try {
    const r = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: {
        jql: projectFilter() + `issuetype = Story AND summary ~ "${esc}*" ORDER BY key DESC`,
        maxResults: 8,
        fields: ['summary', 'status'],
      },
    })
    for (const iss of r.issues || []) {
      if (!results.find((x) => x.key === iss.key)) results.push(iss)
    }
  } catch {
    // ignore text-search failure; key result (if any) still returned
  }
  return results
}

// Subtasks of one issue, with assignee (the parent's `subtasks` field omits it).
export function fetchSubtasks(parentKey) {
  return searchAll(`parent = ${parentKey} ORDER BY key ASC`, ['summary', 'status', 'assignee'])
}

// Subtasks for MANY parents at once (Delivery Tracking) — chunked JQL queries.
export async function fetchSubtasksForParents(parentKeys) {
  const out = []
  for (let i = 0; i < parentKeys.length; i += 50) {
    const chunk = parentKeys.slice(i, i + 50)
    const res = await searchAll(`parent in (${chunk.join(',')})`, [
      'summary',
      'status',
      'parent',
      CFG.pointField,
    ])
    out.push(...res)
  }
  return out
}

export function searchUsers(query) {
  return jira(`/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=10`)
}

export function assignIssue(issueKey, accountId) {
  return jira(`/rest/api/3/issue/${issueKey}/assignee`, {
    method: 'PUT',
    body: { accountId },
  })
}

export async function fetchTransitions(issueKey) {
  const result = await jira(`/rest/api/3/issue/${issueKey}/transitions`)
  return result.transitions || []
}

export function doTransition(issueKey, transitionId) {
  return jira(`/rest/api/3/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: { transition: { id: transitionId } },
  })
}

export const browseUrl = (key) => `${CFG.jiraUrl}/browse/${key}`

// Remote links on an issue (e.g. Confluence pages "mentioned on" the story).
export function fetchRemoteLinks(key) {
  return jira(`/rest/api/3/issue/${key}/remotelink`)
}

// Bulk-fetch descriptions for a set of issue keys (for spec-link extraction).
export async function fetchDescriptionsForKeys(keys) {
  const out = []
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50)
    out.push(...(await searchAll(`key in (${quote(chunk)})`, ['description'])))
  }
  return out
}
