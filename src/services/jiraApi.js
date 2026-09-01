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
    ['summary', 'status', 'priority', 'assignee', 'issuetype'],
  )
}

export function fetchTeamIssues() {
  const emails = [CFG.email, ...CFG.teamEmails]
  const jql =
    projectFilter() +
    `assignee in (${quote(emails)}) AND created >= "${CFG.teamFrom}" ORDER BY key DESC`
  return searchAll(jql, ['summary', 'status', 'priority', 'assignee', 'issuetype'])
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
