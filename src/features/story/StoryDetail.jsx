import { useEffect, useState } from 'react'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import Spinner from '../../components/common/Spinner.jsx'
import AdfContent from './AdfContent.jsx'
import { releaseNames } from './StoryTable.jsx'
import { avatarColor, initials } from '../pr/prConstants.js'
import { fetchIssueDetail, fetchSubtasks, browseUrl } from '../../services/jiraApi.js'
import { shortName } from '../../utils/format.js'
import { card, emptyState } from '../../utils/ui.js'

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : '—')

function Meta({ label, children }) {
  return (
    <div>
      <span className="block text-xs text-muted">{label}</span>
      <span className="mt-0.5 block text-sm text-ink">{children || '—'}</span>
    </div>
  )
}

function Person({ user }) {
  if (!user) return 'Unassigned'
  const name = shortName(user.displayName || '')
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-bg"
        style={{ background: avatarColor(user.emailAddress || user.displayName) }}
      >
        {initials(name)}
      </span>
      {name}
    </span>
  )
}

export default function StoryDetail({ storyKey, onBack, hideBack = false, backLabel = 'Story List' }) {
  const [issue, setIssue] = useState(null)
  const [subtaskRows, setSubtaskRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    setIssue(null)
    setSubtaskRows(null)
    setError(null)
    fetchIssueDetail(storyKey)
      .then((d) => {
        if (!mounted) return
        setIssue(d)
        // Enrich subtasks with assignees (parent response doesn't include them).
        if (d.fields.subtasks?.length) {
          fetchSubtasks(storyKey)
            .then((rows) => mounted && setSubtaskRows(rows))
            .catch(() => {})
        }
      })
      .catch((e) => mounted && setError(e.message))
    return () => {
      mounted = false
    }
  }, [storyKey])

  if (error) {
    return (
      <div className="grid gap-4">
        <button className="justify-self-start rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink" onClick={onBack}>
          ← {backLabel}
        </button>
        <div className={card}>
          <div className={emptyState}>Failed to load {storyKey}: {error}</div>
        </div>
      </div>
    )
  }
  if (!issue) return <Spinner label={`Loading ${storyKey}…`} />

  const f = issue.fields
  const comments = f.comment?.comments || []
  // Prefer the enriched rows (with assignee); fall back to the parent's list.
  const subtasks = subtaskRows || f.subtasks || []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {!hideBack && (
          <button className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink" onClick={onBack}>
            ← {backLabel}
          </button>
        )}
        <span className="flex-1" />
        <a
          className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright"
          href={browseUrl(issue.key)}
          target="_blank"
          rel="noreferrer"
        >
          Open in Jira ↗
        </a>
      </div>

      <div className={`${card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[13px] font-semibold text-accent-bright">{issue.key}</span>
            <h2 className="text-lg font-semibold">{f.summary}</h2>
          </div>
          <StatusBadge status={f.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Meta label="Type">{f.issuetype?.name}</Meta>
          <Meta label="Priority">{f.priority?.name}</Meta>
          <Meta label="Release">
            {releaseNames(issue).length ? (
              <span className="flex flex-wrap gap-1.5">
                {releaseNames(issue).map((r) => (
                  <span key={r} className="rounded-full border border-violet/50 bg-violet-soft px-2.5 py-[1px] text-xs text-violet">
                    {r}
                  </span>
                ))}
              </span>
            ) : null}
          </Meta>
          <Meta label="Labels">
            {f.labels?.length ? (
              <span className="flex flex-wrap gap-1.5">
                {f.labels.map((l) => (
                  <span key={l} className="rounded-full border border-line bg-panel-soft px-2.5 py-[1px] text-xs text-ink-soft">
                    {l}
                  </span>
                ))}
              </span>
            ) : null}
          </Meta>
          <Meta label="Assignee"><Person user={f.assignee} /></Meta>
          <Meta label="Reporter"><Person user={f.reporter} /></Meta>
          <Meta label="Created">{fmtDate(f.created)}</Meta>
          <Meta label="Updated">{fmtDate(f.updated)}</Meta>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-semibold">Description</h3>
          <AdfContent doc={f.description} />
        </div>
      </div>

      {subtasks.length > 0 && (
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold">
            Subtasks <span className="text-muted">({subtasks.length})</span>
          </h3>
          <div className="mt-3 grid gap-2">
            {subtasks.map((st) => (
              <a
                key={st.key}
                href={browseUrl(st.key)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-field px-4 py-2.5 transition-colors hover:border-accent"
              >
                <span className="min-w-0 flex items-baseline gap-2">
                  <span className="shrink-0 text-[13px] font-semibold text-accent-bright">{st.key}</span>
                  <span className="truncate text-sm text-ink-soft">{st.fields?.summary}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px] text-muted">
                    <Person user={st.fields?.assignee} />
                  </span>
                  {st.fields?.status && <StatusBadge status={st.fields.status} />}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className={`${card} p-5`}>
        <h3 className="text-sm font-semibold">
          Comments <span className="text-muted">({comments.length})</span>
        </h3>
        <div className="mt-4 grid gap-4">
          {comments.length === 0 && <p className="text-[13px] text-muted">No comments on this card.</p>}
          {comments.map((c) => {
            const who = shortName(c.author?.displayName || 'user')
            return (
              <div key={c.id} className="flex gap-3">
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-bg"
                  style={{ background: avatarColor(c.author?.emailAddress || who) }}
                >
                  {initials(who)}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-field px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{who}</span>
                    <span className="text-xs text-muted">{fmtDate(c.created)}</span>
                  </div>
                  <div className="mt-1 grid gap-1.5">
                    <AdfContent doc={c.body} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
