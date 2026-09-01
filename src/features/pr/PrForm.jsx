import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { CFG } from '../../config/appConfig.js'
import { emailUsername } from '../../utils/format.js'
import { cx } from '../../utils/ui.js'

const label = 'block text-xs font-medium text-muted mb-1.5'
const input =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted'

const MEMBERS = [CFG.email, ...CFG.teamEmails]

// Create or edit a PR. `pr` present = edit mode.
export default function PrForm({ pr, onClose, onSubmit }) {
  const [title, setTitle] = useState(pr?.title || '')
  const [mainUrl, setMainUrl] = useState(pr?.mainUrl || '')
  const [extraPrs, setExtraPrs] = useState(
    pr?.extraPrs?.length ? pr.extraPrs : pr?.secondUrl ? [pr.secondUrl] : [],
  )
  const [jiraSpec, setJiraSpec] = useState(pr?.jiraSpec || '')
  const [detail, setDetail] = useState(pr?.detail || '')
  const [reviewers, setReviewers] = useState(pr?.reviewers || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const toggleReviewer = (email) =>
    setReviewers((r) => (r.includes(email) ? r.filter((e) => e !== email) : [...r, email]))

  const setExtra = (i, v) => setExtraPrs((a) => a.map((x, idx) => (idx === i ? v : x)))
  const addExtra = () => setExtraPrs((a) => [...a, ''])
  const removeExtra = (i) => setExtraPrs((a) => a.filter((_, idx) => idx !== i))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) return setError('Please enter a name/title.')
    if (!mainUrl.trim()) return setError('Please enter the main GitHub PR link.')
    if (reviewers.length < 1) return setError('Assign at least one reviewer.')
    setBusy(true)
    try {
      await onSubmit({
        title: title.trim(),
        mainUrl: mainUrl.trim(),
        extraPrs: extraPrs.map((u) => u.trim()).filter(Boolean),
        jiraSpec: jiraSpec.trim(),
        detail: detail.trim(),
        reviewers,
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={pr ? 'Edit PR' : 'New PR'} subtitle="" onClose={onClose} wide>
      <form onSubmit={submit} className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
        {error && (
          <div className="rounded-xl border border-danger bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
            {error}
          </div>
        )}
        <div>
          <span className={label}>Name</span>
          <input
            className={input}
            placeholder="e.g. Fix checkout race condition"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <span className={label}>Main GitHub PR link</span>
          <input
            type="url"
            className={input}
            placeholder="https://github.com/org/repo/pull/123"
            value={mainUrl}
            onChange={(e) => setMainUrl(e.target.value)}
            required
          />
        </div>
        <div>
          <span className={label}>
            Additional PR links <span className="text-muted">(optional)</span>
          </span>
          <div className="grid gap-2">
            {extraPrs.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  className={input}
                  placeholder="https://github.com/org/repo/pull/124"
                  value={url}
                  onChange={(e) => setExtra(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeExtra(i)}
                  aria-label="Remove link"
                  className="shrink-0 rounded-xl border border-line px-3 text-muted hover:border-danger hover:text-danger"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addExtra}
              className="justify-self-start rounded-full border border-line bg-field px-3.5 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright"
            >
              + Add another PR link
            </button>
          </div>
        </div>
        <div>
          <span className={label}>
            Jira spec link <span className="text-muted">(optional)</span>
          </span>
          <input
            type="url"
            className={input}
            placeholder="https://yourcompany.atlassian.net/browse/DX-1234"
            value={jiraSpec}
            onChange={(e) => setJiraSpec(e.target.value)}
          />
        </div>
        <div>
          <span className={label}>Reviewers (at least 1)</span>
          <div className="flex flex-wrap gap-2">
            {MEMBERS.map((email) => (
              <button
                type="button"
                key={email}
                onClick={() => toggleReviewer(email)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                  reviewers.includes(email)
                    ? 'border-accent bg-accent-soft text-accent-bright'
                    : 'border-line bg-field text-ink-soft hover:border-line-strong',
                )}
              >
                {emailUsername(email)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={label}>Detail</span>
          <textarea
            className={`${input} min-h-24 resize-y`}
            placeholder="Describe what to review…"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? 'Saving…' : pr ? 'Save changes' : 'Create PR'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
