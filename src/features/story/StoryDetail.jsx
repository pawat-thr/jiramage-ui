import { useEffect, useRef, useState } from 'react'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import Spinner from '../../components/common/Spinner.jsx'
import AdfContent from './AdfContent.jsx'
import { releaseNames } from './releaseNames.js'
import { fetchIssueDetail, fetchSubtasks, addComment, setPoints, uploadAttachments, resolveAccountIds, browseUrl, MENTION_RE } from '../../services/jiraApi.js'
import { MentionTextarea } from '../pr/mentions.jsx'
import { ssoFlags } from '../../services/ssoClient.js'
import { shortName, emailUsername } from '../../utils/format.js'
import { CFG, teamMembers } from '../../config/appConfig.js'
import { card, emptyState } from '../../utils/ui.js'
import Avatar from '../../components/common/Avatar.jsx'

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
      <Avatar id={user.emailAddress || user.displayName} name={name} className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-bg" />
      {name}
    </span>
  )
}

// Renders full detail for ANY issue (story or subtask). `onOpenIssue(key)`
// makes parent/subtask references navigate in-app instead of out to Jira.
export default function StoryDetail({ storyKey, onBack, hideBack = false, backLabel = 'Story List', onOpenIssue = null }) {
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

  // Silent refetch after a write (comment / points) — keeps the view in
  // place instead of flashing the loading spinner.
  const reload = () =>
    fetchIssueDetail(storyKey)
      .then(setIssue)
      .catch(() => {})

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
          {f.issuetype?.subtask ? (
            <Meta label="Points">
              <PointsEditor issueKey={issue.key} value={f[CFG.pointField]} onSaved={reload} />
            </Meta>
          ) : (
            f[CFG.pointField] != null && (
              <Meta label="Points">
                <span className="tabular-nums">{Number(f[CFG.pointField])}</span>
              </Meta>
            )
          )}
          {f.parent && (
            <Meta label="Parent story">
              {onOpenIssue ? (
                <button
                  className="text-left font-semibold text-violet hover:underline"
                  onClick={() => onOpenIssue(f.parent.key)}
                  title={f.parent.fields?.summary}
                >
                  {f.parent.key}
                </button>
              ) : (
                <a
                  className="font-semibold text-violet hover:underline"
                  href={browseUrl(f.parent.key)}
                  target="_blank"
                  rel="noreferrer"
                  title={f.parent.fields?.summary}
                >
                  {f.parent.key}
                </a>
              )}
            </Meta>
          )}
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
          <AdfContent doc={f.description} attachments={f.attachment} />
        </div>
      </div>

      {subtasks.length > 0 && (
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-semibold">
            Subtasks <span className="text-muted">({subtasks.length})</span>
          </h3>
          <div className="mt-3 grid gap-2">
            {subtasks.map((st) => {
              const Row = onOpenIssue ? 'div' : 'a'
              const rowProps = onOpenIssue
                ? {
                    onClick: () => onOpenIssue(st.key),
                    role: 'button',
                    tabIndex: 0,
                    onKeyDown: (e) => e.key === 'Enter' && onOpenIssue(st.key),
                    title: 'View subtask details',
                  }
                : { href: browseUrl(st.key), target: '_blank', rel: 'noreferrer' }
              return (
                <Row
                  key={st.key}
                  {...rowProps}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-field px-4 py-2.5 text-left transition-colors hover:border-accent"
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
                    {onOpenIssue && (
                      <a
                        className="text-xs text-muted hover:text-accent-bright"
                        href={browseUrl(st.key)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open in Jira"
                      >
                        ↗
                      </a>
                    )}
                  </span>
                </Row>
              )
            })}
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
                <Avatar id={c.author?.emailAddress || who} name={who} className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-bg" />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-field px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{who}</span>
                    <span className="text-xs text-muted">{fmtDate(c.created)}</span>
                  </div>
                  <div className="mt-1 grid gap-1.5">
                    <AdfContent doc={c.body} attachments={f.attachment} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <CommentBox issueKey={issue.key} onPosted={reload} />
      </div>
    </div>
  )
}

// Inline story-point editor for subtasks — writes as the API-token user.
function PointsEditor({ issueKey, value, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const save = async () => {
    if (busy) return // Enter can repeat — never fire parallel PUTs
    setBusy(true)
    setErr(null)
    try {
      await setPoints(issueKey, val)
      await onSaved()
      setEditing(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!editing)
    return (
      <span className="flex items-center gap-2">
        <span className="tabular-nums">{value != null ? Number(value) : '—'}</span>
        <button
          className="rounded-full border border-line bg-field px-2.5 py-[1px] text-xs text-ink-soft hover:border-accent hover:text-accent-bright"
          title="Change the story-point estimate in Jira (as the API-token user)"
          onClick={() => {
            setVal(value ?? '')
            setEditing(true)
          }}
        >
          edit
        </button>
      </span>
    )
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        step="0.5"
        autoFocus
        className="w-20 rounded-lg border border-line bg-field px-2 py-1 text-sm text-ink focus:border-accent"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
      />
      <button
        disabled={busy}
        className="rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-bright hover:bg-accent hover:text-bg disabled:opacity-50"
        onClick={save}
      >
        {busy ? '…' : 'Save'}
      </button>
      <button className="text-xs text-muted hover:text-ink" onClick={() => setEditing(false)}>
        cancel
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  )
}

// Everyone @mentionable in a Jira comment: the team roster (with Teamage
// active this is the signed-in user's whole team, QA folks included).
const mentionCandidates = () => {
  const seen = new Set()
  return [...teamMembers()]
    .filter((e) => !seen.has(e.toLowerCase()) && seen.add(e.toLowerCase()))
    .map((email) => ({ email, name: emailUsername(email) }))
}

// Comment composer — works on EVERY issue type; posts as the API-token user.
// @names become real Jira mentions (the person gets notified by Jira);
// pictures (file picker or paste) upload as issue attachments and embed in
// the comment, falling back to a "📎 name" reference if Jira rejects the embed.
function CommentBox({ issueKey, onPosted }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const fileRef = useRef(null)
  const candidates = mentionCandidates()

  const addFiles = (list) => {
    const imgs = [...list].filter((f) => f.type.startsWith('image/'))
    if (imgs.length) setFiles((cur) => [...cur, ...imgs])
  }

  const post = async () => {
    if ((!text.trim() && !files.length) || busy) return
    setBusy(true)
    setErr(null)
    try {
      // 1) pictures → issue attachments
      let images = []
      if (files.length) {
        const uploaded = await uploadAttachments(issueKey, files)
        images = uploaded.map((a) => ({ filename: a.filename, url: a.content }))
      }
      // 2) @names → accountIds (only names that match a known member)
      const names = [...new Set([...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase()))]
      const hit = candidates.filter((c) => names.includes(c.name.toLowerCase()))
      const ids = hit.length ? await resolveAccountIds(hit.map((c) => c.email)) : {}
      const mentions = Object.fromEntries(
        hit.filter((c) => ids[c.email]).map((c) => [c.name.toLowerCase(), { id: ids[c.email] }]),
      )
      // 3) post — if Jira rejects the embedded media, repost with 📎 references
      try {
        await addComment(issueKey, text.trim(), { mentions, images })
      } catch (e) {
        if (!images.length || !/HTTP 400/.test(e.message)) throw e
        const refs = images.map((i) => `📎 ${i.filename}`).join('\n')
        await addComment(issueKey, `${text.trim()}\n${refs}`.trim(), { mentions })
      }
      setText('')
      setFiles([])
      await onPosted()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <MentionTextarea
        className="min-h-16 w-full resize-y rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-accent"
        placeholder={`Comment on ${issueKey}… @name to mention · paste a screenshot to attach · Ctrl/⌘+Enter posts`}
        value={text}
        setValue={setText}
        onPost={post}
        disabled={busy}
        candidates={candidates}
        onPaste={(e) => addFiles(e.clipboardData?.files || [])}
      />
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-field px-2.5 py-1 text-xs text-ink-soft">
              🖼 {f.name}
              <button className="text-muted hover:text-danger" title="Remove" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted">
          <button
            className="rounded-full border border-line bg-field px-2.5 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent-bright"
            title="Attach picture(s) — uploaded to the Jira card with the comment"
            onClick={() => fileRef.current?.click()}
          >
            🖼 Add picture
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          {err ? <span className="text-danger">{err}</span> : <>Posts to Jira as <strong>{CFG.email}</strong>{ssoFlags.sso ? ' (your Atlassian login).' : ' (the API-token user).'}</>}
        </span>
        <button
          disabled={(!text.trim() && !files.length) || busy}
          className="rounded-full border border-accent bg-accent-soft px-4 py-1.5 text-[13px] font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
          onClick={post}
        >
          {busy ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </div>
  )
}
