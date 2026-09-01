import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import { ENVS } from './boardConstants.jsx'
import { avatarColor } from '../pr/prConstants.js'
import { searchStoriesByText } from '../../services/jiraApi.js'
import { CFG } from '../../config/appConfig.js'
import { emailUsername } from '../../utils/format.js'
import { cx } from '../../utils/ui.js'

const label = 'block text-xs font-medium text-muted mb-1.5'
const input =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted'
const MEMBERS = [CFG.email, ...CFG.teamEmails]

const pill = (active) =>
  cx(
    'rounded-full border px-3 py-1.5 text-[13px] transition-colors',
    active
      ? 'border-accent bg-accent-soft text-accent-bright'
      : 'border-line bg-field text-ink-soft hover:border-line-strong',
  )

export default function TaskForm({ task, labels, onClose, onSubmit }) {
  const [refOn, setRefOn] = useState(task ? !!task.refOn : true)
  const [refKey, setRefKey] = useState(task?.refKey || '')
  const [refSummary, setRefSummary] = useState(task?.refSummary || '')
  const [name, setName] = useState(task?.name || '')
  const [users, setUsers] = useState(task?.users || [])
  const [labelName, setLabelName] = useState(task?.label || '')
  const [env, setEnv] = useState(task?.env || '1')
  const [sprintStart, setSprintStart] = useState(task?.sprintStart || '')
  const [detail, setDetail] = useState(task?.detail || '')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const toggleUser = (email) =>
    setUsers((u) => (u.includes(email) ? u.filter((e) => e !== email) : [...u, email]))

  const doSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchStoriesByText(query))
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (refOn && !refKey) return setError('Search and pick a ref card, or switch to Internal.')
    if (!refOn && !name.trim()) return setError('Internal work needs a name.')
    if (!labelName) return setError('Pick a label — create one first if the list is empty.')
    setBusy(true)
    try {
      await onSubmit({
        refOn,
        refKey: refOn ? refKey : '',
        refSummary: refOn ? refSummary : '',
        name: refOn ? '' : name.trim(),
        users,
        label: labelName,
        env,
        sprintStart,
        detail: detail.trim(),
      })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={task ? 'Edit Task' : 'New Task'} subtitle="" onClose={onClose} wide>
      <form onSubmit={submit} className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
        {error && (
          <div className="rounded-xl border border-danger bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
            {error}
          </div>
        )}

        {/* ref card on/off */}
        <div>
          <span className={label}>Ref card</span>
          <div className="inline-flex rounded-xl border border-line bg-field p-1">
            <button type="button" className={cx('rounded-lg px-4 py-1.5 text-sm font-medium', refOn ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:text-ink')} onClick={() => setRefOn(true)}>
              On — link a story
            </button>
            <button type="button" className={cx('rounded-lg px-4 py-1.5 text-sm font-medium', !refOn ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:text-ink')} onClick={() => setRefOn(false)}>
              Off — internal work
            </button>
          </div>
        </div>

        {refOn ? (
          <div>
            <span className={label}>Ref card (story)</span>
            {refKey ? (
              <div className="flex items-center gap-2 rounded-xl border border-accent bg-accent-soft px-3.5 py-2 text-sm">
                <span className="font-semibold text-accent-bright">{refKey}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{refSummary}</span>
                <button type="button" className="text-muted hover:text-danger" onClick={() => { setRefKey(''); setRefSummary('') }} aria-label="Clear ref card">
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    className={input}
                    placeholder="Search story by key (DX-123) or title, press Enter…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doSearch(e)}
                  />
                  <button type="button" onClick={doSearch} disabled={searching} className="shrink-0 rounded-xl border border-line bg-field px-4 text-sm text-ink-soft hover:border-accent hover:text-accent-bright disabled:opacity-60">
                    {searching ? '…' : 'Search'}
                  </button>
                </div>
                {results && (
                  <div className="mt-2 grid max-h-52 gap-1.5 overflow-y-auto">
                    {results.length === 0 && <p className="text-[13px] text-muted">No stories found.</p>}
                    {results.map((iss) => (
                      <button
                        key={iss.key}
                        type="button"
                        className="flex items-center gap-2 rounded-xl border border-line bg-field px-3.5 py-2 text-left text-sm hover:border-accent"
                        onClick={() => { setRefKey(iss.key); setRefSummary(iss.fields.summary); setResults(null); setQuery('') }}
                      >
                        <span className="shrink-0 font-semibold text-accent-bright">{iss.key}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-soft">{iss.fields.summary}</span>
                        {iss.fields.status && <StatusBadge status={iss.fields.status} />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div>
            <span className={label}>Name (internal work)</span>
            <input className={input} placeholder="e.g. Cleanup staging database" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div>
          <span className={label}>Users (0 or more)</span>
          <div className="flex flex-wrap gap-2">
            {MEMBERS.map((email) => (
              <button type="button" key={email} className={pill(users.includes(email))} onClick={() => toggleUser(email)}>
                {emailUsername(email)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>Label</span>
          <div className="flex flex-wrap gap-2">
            {labels.length === 0 && (
              <span className="text-[13px] text-muted">No labels yet — create one with “+ New Label”.</span>
            )}
            {labels.map((l) => (
              <button type="button" key={l.id} className={pill(labelName === l.name)} onClick={() => setLabelName(l.name)}>
                <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: avatarColor(l.name) }} />
                {l.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={label}>Env</span>
            <div className="flex gap-2">
              {ENVS.map((e2) => (
                <button type="button" key={e2} className={pill(env === e2)} onClick={() => setEnv(e2)}>
                  ENV {e2}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>Sprint start</span>
            <input type="date" className={input} value={sprintStart} onChange={(e) => setSprintStart(e.target.value)} />
          </div>
        </div>

        <div>
          <span className={label}>Detail</span>
          <textarea className={`${input} min-h-24 resize-y`} placeholder="Describe the task…" value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-wait disabled:opacity-70">
            {busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
