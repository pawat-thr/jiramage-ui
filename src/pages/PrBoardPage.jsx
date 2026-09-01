import { useEffect, useMemo, useState } from 'react'
import Spinner from '../components/common/Spinner.jsx'
import FilterMenu from '../components/common/FilterMenu.jsx'
import PrStatusBadge from '../features/pr/PrStatusBadge.jsx'
import PrForm from '../features/pr/PrForm.jsx'
import PrDetail from '../features/pr/PrDetail.jsx'
import { PR_STATUSES, statusMeta, fmtTime } from '../features/pr/prConstants.js'
import { watchPRs, createPR, updatePR, deletePR } from '../services/prApi.js'
import { firebaseEnabled } from '../services/firebase.js'
import { CFG } from '../config/appConfig.js'
import { emailUsername, uniqueSorted } from '../utils/format.js'
import { card, chip, cx, toolbar, emptyState } from '../utils/ui.js'

const MEMBERS = [CFG.email, ...CFG.teamEmails]

export default function PrBoardPage({ user, onNotify }) {
  const [prs, setPrs] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(null) // null | { pr } (pr undefined = create)
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

  if (!firebaseEnabled || !user) {
    return (
      <div className={card}>
        <div className={emptyState}>Sign in with your team account to use the PR review board.</div>
      </div>
    )
  }

  if (selectedId) {
    const pr = (prs || []).find((p) => p.id === selectedId)
    if (!pr) {
      setSelectedId(null)
      return null
    }
    return (
      <PrDetail
        pr={pr}
        user={user}
        onBack={() => setSelectedId(null)}
        onEdit={() => setForm({ pr })}
        onNotify={onNotify}
        onDelete={async () => {
          if (!window.confirm(`Delete “${pr.title}”?`)) return
          try {
            await deletePR(pr.id)
            onNotify('✓ PR deleted')
            setSelectedId(null)
          } catch (err) {
            onNotify(err.message, true)
          }
        }}
      />
    )
  }

  const submitForm = async (data) => {
    if (form?.pr) {
      await updatePR(form.pr.id, data)
      onNotify('✓ PR updated')
    } else {
      await createPR({ ...data, authorEmail: user.email, authorName: user.name })
      onNotify('✓ PR created')
    }
    setForm(null)
  }

  return (
    <>
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
      ) : !visible.length ? (
        <div className={card}>
          <div className={emptyState}>
            {prs.length ? 'No PRs match the filters.' : 'No PRs yet — create the first one.'}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((pr) => (
            <button
              key={pr.id}
              onClick={() => setSelectedId(pr.id)}
              className={`${card} p-4 text-left transition-colors hover:border-accent`}
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
              {pr.detail && (
                <p className="mt-2 line-clamp-2 text-[13px] text-ink-soft">{pr.detail}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {form && <PrForm pr={form.pr} onClose={() => setForm(null)} onSubmit={submitForm} />}
    </>
  )
}
