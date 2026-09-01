import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import Spinner from '../../components/common/Spinner.jsx'
import { searchUsers, assignIssue } from '../../services/jiraApi.js'
import { emptyState } from '../../utils/ui.js'

const optionBtn =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-left text-sm text-ink-soft hover:border-accent hover:text-accent-bright'

export default function ReassignModal({ issue, onClose, onDone, onError }) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState(null)
  const [searching, setSearching] = useState(false)

  const search = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      setUsers(await searchUsers(query.trim()))
    } catch (err) {
      onError(err)
    } finally {
      setSearching(false)
    }
  }

  const pick = async (u) => {
    try {
      await assignIssue(issue.key, u.accountId)
      onDone(`${issue.key} reassigned to ${u.displayName}`)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <ModalShell title={`Reassign ${issue.key}`} subtitle={issue.fields.summary} onClose={onClose}>
      <form onSubmit={search}>
        <input
          type="text"
          autoFocus
          className="mb-3 w-full rounded-xl border border-line bg-field px-3.5 py-2 text-ink placeholder:text-muted"
          placeholder="Type name or email, press Enter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      {searching && <Spinner label="" className="py-4" />}
      {users && !searching && (
        <div className="grid max-h-[300px] gap-1.5 overflow-y-auto">
          {users.map((u) => (
            <button key={u.accountId} className={optionBtn} onClick={() => pick(u)}>
              {u.displayName}
              {u.emailAddress && <span className="block text-xs text-muted">{u.emailAddress}</span>}
            </button>
          ))}
          {!users.length && <div className={emptyState}>No users found.</div>}
        </div>
      )}
    </ModalShell>
  )
}
