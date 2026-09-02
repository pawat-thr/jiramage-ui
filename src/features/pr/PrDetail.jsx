import { useEffect, useState } from 'react'
import PrStatusBadge from './PrStatusBadge.jsx'
import { PR_STATUSES, statusMeta, fmtTime, avatarColor, initials } from './prConstants.js'
import { watchComments, addComment, setStatus } from '../../services/prApi.js'
import { sendNotifications } from '../../services/notificationsApi.js'
import { emailUsername } from '../../utils/format.js'
import { cx, card } from '../../utils/ui.js'

const linkRow = (label, url) =>
  url ? (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-24 shrink-0 text-xs text-muted">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="truncate text-accent-bright hover:underline"
      >
        {url}
      </a>
    </div>
  ) : null

export default function PrDetail({ pr, user, onBack, onEdit, onDelete, onNotify }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  const isOwner = pr.authorEmail === user.email
  const canStatus = isOwner || (pr.reviewers || []).includes(user.email)

  useEffect(() => {
    return watchComments(
      pr.id,
      setComments,
      (err) => onNotify(err.message, true),
    )
  }, [pr.id])

  const changeStatus = async (id) => {
    try {
      await setStatus(pr.id, id)
      // Tell the PR owner their post changed status (skipped when the owner
      // did it themselves — sendNotifications filters out self).
      sendNotifications({
        type: 'pr_status_changed',
        toEmails: [pr.authorEmail],
        from: user,
        refId: pr.id,
        title: pr.title,
        extra: { statusLabel: statusMeta(id).label },
      }).catch((err) => console.warn('[notify] status-change inbox write failed:', err.message))
    } catch (err) {
      onNotify(err.message, true)
    }
  }

  const postComment = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setPosting(true)
    try {
      await addComment(pr.id, {
        authorEmail: user.email,
        authorName: user.name,
        body: body.trim(),
      })
      setBody('')
      // Tell the PR owner someone commented on their post (self filtered out).
      sendNotifications({
        type: 'pr_comment',
        toEmails: [pr.authorEmail],
        from: user,
        refId: pr.id,
        title: pr.title,
      }).catch((err) => console.warn('[notify] comment inbox write failed:', err.message))
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink"
          onClick={onBack}
        >
          ← Board
        </button>
        <span className="flex-1" />
        {isOwner && (
          <>
            <button
              className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright"
              onClick={onEdit}
            >
              Edit
            </button>
            <button
              className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-danger hover:text-danger"
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        )}
      </div>

      <div
        className={`${card} p-5 pl-6`}
        style={{ borderLeftColor: statusMeta(pr.status).color, borderLeftWidth: '4px' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{pr.title}</h2>
          <PrStatusBadge status={pr.status} />
        </div>
        <p className="mt-1 text-xs text-muted">
          by {emailUsername(pr.authorEmail || '')} · updated {fmtTime(pr.updatedAt)}
        </p>

        <div className="mt-4 grid gap-2">
          {linkRow('Main PR', pr.mainUrl)}
          {(pr.extraPrs || (pr.secondUrl ? [pr.secondUrl] : [])).map((u, i) =>
            u ? <div key={i}>{linkRow(`PR #${i + 2}`, u)}</div> : null,
          )}
          {linkRow('Jira spec', pr.jiraSpec)}
        </div>

        <div className="mt-4">
          <span className="text-xs text-muted">Reviewers</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(pr.reviewers || []).map((email) => (
              <span
                key={email}
                className="flex items-center gap-1.5 rounded-full border border-line bg-field py-1 pr-3 pl-1 text-[13px] text-ink-soft"
              >
                <span
                  className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-bg"
                  style={{ background: avatarColor(email) }}
                >
                  {initials(emailUsername(email))}
                </span>
                {emailUsername(email)}
              </span>
            ))}
          </div>
        </div>

        {pr.detail && (
          <div className="mt-4">
            <span className="text-xs text-muted">Detail</span>
            <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{pr.detail}</p>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <span className="text-xs text-muted">
            {canStatus ? 'Set status' : 'Status (reviewers/owner can change)'}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PR_STATUSES.map((s) => (
              <button
                key={s.id}
                disabled={!canStatus}
                onClick={() => changeStatus(s.id)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  pr.status === s.id
                    ? s.cls
                    : 'border-line bg-panel text-ink-soft hover:border-line-strong',
                  !canStatus && 'cursor-not-allowed opacity-50',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h3 className="text-sm font-semibold">
          Comments <span className="text-muted">({comments.length})</span>
        </h3>
        <div className="mt-4 grid gap-4">
          {comments.length === 0 && (
            <p className="text-[13px] text-muted">No comments yet — start the discussion.</p>
          )}
          {comments.map((c) => {
            const who = emailUsername(c.authorEmail || c.authorName || '')
            return (
              <div key={c.id} className="flex gap-3">
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-bg"
                  style={{ background: avatarColor(c.authorEmail || who) }}
                >
                  {initials(who)}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-field px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{who}</span>
                    <span className="text-xs text-muted">{fmtTime(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{c.body}</p>
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={postComment} className="mt-5 flex gap-3">
          <span
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-bg"
            style={{ background: avatarColor(user.email) }}
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <textarea
              className="min-h-20 w-full resize-y rounded-2xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-muted focus:border-accent"
              placeholder="Write a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(e)
              }}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">⌘/Ctrl + Enter to post</span>
              <button
                type="submit"
                disabled={posting || !body.trim()}
                className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
