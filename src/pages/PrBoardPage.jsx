import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../components/common/Spinner.jsx'
import FilterMenu from '../components/common/FilterMenu.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import PrStatusBadge from '../features/pr/PrStatusBadge.jsx'
import PrForm from '../features/pr/PrForm.jsx'
import PrDetail from '../features/pr/PrDetail.jsx'
import { PR_STATUSES, statusMeta, fmtTime } from '../features/pr/prConstants.js'
import { watchPRs, createPR, updatePR, deletePR } from '../services/prApi.js'
import { sendNotifications } from '../services/notificationsApi.js'
import { firebaseEnabled } from '../services/firebase.js'
import { CFG } from '../config/appConfig.js'
import { emailUsername, uniqueSorted } from '../utils/format.js'
import { card, chip, cx, toolbar, emptyState } from '../utils/ui.js'

const MEMBERS = [CFG.email, ...CFG.teamEmails]

function PrCard({ pr, onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{ borderLeftColor: statusMeta(pr.status).color, borderLeftWidth: '4px' }}
      className={`${card} p-4 pl-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink">{pr.title}</h3>
          <p className="mt-0.5 text-xs text-muted">
            by {emailUsername(pr.authorEmail || '')} · {(pr.reviewers || []).length} reviewer
            {(pr.reviewers || []).length === 1 ? '' : 's'} · updated {fmtTime(pr.updatedAt)}
          </p>
        </div>
        <PrStatusBadge status={pr.status} />
      </div>
      {pr.detail && <p className="mt-2 line-clamp-2 text-[13px] text-ink-soft">{pr.detail}</p>}
    </button>
  )
}

export default function PrBoardPage({ user, onNotify }) {
  const [prs, setPrs] = useState(null)
  // Detail view is URL-driven: /pr-review/<id>
  const location = useLocation()
  const navigate = useNavigate()
  const selectedId = location.pathname.startsWith('/pr-review/')
    ? location.pathname.slice('/pr-review/'.length)
    : null
  const [form, setForm] = useState(null) // null | { pr } (pr undefined = create)
  const [confirmPr, setConfirmPr] = useState(null) // PR pending delete
  const [deleting, setDeleting] = useState(false)
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState('')
  const [reviewer, setReviewer] = useState('')

  useEffect(() => {
    if (!firebaseEnabled || !user) return
    return watchPRs(setPrs, (err) => {
      onNotify(err.message, true)
      setPrs([])
    })
  }, [user])

  const visible = useMemo(() => {
    return (prs || []).filter((pr) => {
      if (owner && emailUsername(pr.authorEmail || '') !== owner) return false
      if (status && statusMeta(pr.status).label !== status) return false
      if (reviewer && !(pr.reviewers || []).some((e) => emailUsername(e) === reviewer)) return false
      return true
    })
  }, [prs, owner, status, reviewer])

  const ownerOptions = useMemo(
    () => uniqueSorted((prs || []).map((p) => emailUsername(p.authorEmail || ''))),
    [prs],
  )
  const reviewerOptions = MEMBERS.map(emailUsername)
  const statusOptions = PR_STATUSES.map((s) => s.label)

  const submitForm = async (data) => {
    let prId
    let newReviewers
    if (form?.pr) {
      await updatePR(form.pr.id, data)
      prId = form.pr.id
      // Only people added by this edit get an inbox entry — no re-notifying.
      const before = form.pr.reviewers || []
      newReviewers = (data.reviewers || []).filter((e) => !before.includes(e))
      onNotify('✓ PR updated')
    } else {
      const ref = await createPR({ ...data, authorEmail: user.email, authorName: user.name })
      prId = ref.id
      newReviewers = data.reviewers || []
      onNotify('✓ PR created')
    }
    setForm(null)
    // Inbox entries are best-effort: a failure here must not undo the PR save.
    sendNotifications({
      type: 'pr_review_assigned',
      toEmails: newReviewers,
      from: user,
      refId: prId,
      title: data.title,
    }).catch((err) => console.warn('[notify] reviewer inbox write failed:', err.message))
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deletePR(confirmPr.id)
      onNotify('✓ PR deleted')
      setConfirmPr(null)
      navigate('/pr-review')
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setDeleting(false)
    }
  }

  // PRs waiting on ME: I'm a reviewer and it isn't approved/merged yet.
  // Independent of the filters below — it's an attention list.
  const needsMyReview = useMemo(
    () =>
      (prs || []).filter(
        (pr) =>
          (pr.reviewers || []).includes(user.email) &&
          pr.status !== 'approved' &&
          pr.status !== 'merged',
      ),
    [prs, user.email],
  )

  const selected = selectedId ? (prs || []).find((p) => p.id === selectedId) : null

  // If the open PR disappears (deleted elsewhere), fall back to the board.
  useEffect(() => {
    if (selectedId && prs && !prs.some((p) => p.id === selectedId))
      navigate('/pr-review', { replace: true })
  }, [selectedId, prs, navigate])

  if (!firebaseEnabled || !user) {
    return (
      <div className={card}>
        <div className={emptyState}>Sign in with your team account to use the PR review board.</div>
      </div>
    )
  }

  return (
    <>
      {selected ? (
        <div key={selected.id} className="animate-enter">
        <PrDetail
          pr={selected}
          user={user}
          onBack={() => navigate('/pr-review')}
          onEdit={() => setForm({ pr: selected })}
          onNotify={onNotify}
          onDelete={() => setConfirmPr(selected)}
        />
        </div>
      ) : (
        <div key="pr-board" className="animate-enter">
          <div className={toolbar}>
            <FilterMenu label="Owner" value={owner} options={ownerOptions} onPick={setOwner} />
            <FilterMenu label="Status" value={status} options={statusOptions} onPick={setStatus} />
            <FilterMenu label="Reviewer" value={reviewer} options={reviewerOptions} onPick={setReviewer} />
            <span className="flex-1" />
            <button
              className={cx(chip, 'border-accent! bg-accent-soft! text-accent-bright!')}
              onClick={() => setForm({})}
            >
              + New PR
            </button>
          </div>

          {prs === null ? (
            <Spinner label="Loading PRs…" />
          ) : (
            <div className="grid gap-4">
              {needsMyReview.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
                      {needsMyReview.length}
                    </span>
                    Waiting for your review
                  </h2>
                  <div className="grid gap-3">
                    {needsMyReview.map((pr) => (
                      <PrCard key={pr.id} pr={pr} onOpen={() => navigate(`/pr-review/${pr.id}`)} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                {needsMyReview.length > 0 && (
                  <h2 className="mb-3 text-sm font-semibold text-muted">All PRs</h2>
                )}
                {!visible.length ? (
                  <div className={card}>
                    <div className={emptyState}>
                      {prs.length ? 'No PRs match the filters.' : 'No PRs yet — create the first one.'}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {visible.map((pr) => (
                      <PrCard key={pr.id} pr={pr} onOpen={() => navigate(`/pr-review/${pr.id}`)} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {form && <PrForm pr={form.pr} onClose={() => setForm(null)} onSubmit={submitForm} />}
      {confirmPr && (
        <ConfirmDialog
          title="Delete this PR?"
          message={`“${confirmPr.title}” and its comments will be permanently removed. This can’t be undone.`}
          busy={deleting}
          onClose={() => setConfirmPr(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
