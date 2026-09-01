import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { avatarColor } from '../pr/prConstants.js'

const inputCls =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted'

export default function LabelForm({ labels, tasks, onClose, onCreate, onRename, onDelete }) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const countFor = (label) => (tasks || []).filter((t) => t.label === label.name).length
  const isDuplicate = (n, exceptId = null) =>
    labels.some((l) => l.id !== exceptId && l.name.toLowerCase() === n.toLowerCase())

  const run = async (fn) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const create = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Enter a label name.')
    if (isDuplicate(n)) return setError('That label already exists.')
    run(async () => {
      await onCreate(n)
      setName('')
    })
  }

  const saveRename = (label) => {
    const n = editName.trim()
    if (!n) return setError('Label name cannot be empty.')
    if (isDuplicate(n, label.id)) return setError('That label name already exists.')
    if (n === label.name) return setEditingId(null)
    run(async () => {
      await onRename(label, n)
      setEditingId(null)
    })
  }

  const remove = (label) => {
    if (countFor(label) > 0) return
    run(() => onDelete(label))
  }

  return (
    <ModalShell title="Labels" subtitle="Create, rename, or remove board labels." onClose={onClose}>
      <div className="grid gap-4">
        {error && (
          <div className="rounded-xl border border-danger bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
            {error}
          </div>
        )}

        <form onSubmit={create} className="flex gap-2">
          <input
            autoFocus
            className={inputCls}
            placeholder="New label name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-xl border border-accent bg-accent-soft px-4 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:opacity-60"
          >
            Create
          </button>
        </form>

        {labels.length > 0 && (
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {labels.map((l) => {
              const count = countFor(l)
              const editing = editingId === l.id
              return (
                <div key={l.id} className="flex items-center gap-2 rounded-xl border border-line bg-field px-3 py-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: avatarColor(l.name) }} />
                  {editing ? (
                    <>
                      <input
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-accent bg-panel px-2.5 py-1 text-sm text-ink"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(l)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <button
                        className="shrink-0 rounded-lg border border-accent bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-bright disabled:opacity-60"
                        disabled={busy}
                        onClick={() => saveRename(l)}
                      >
                        Save
                      </button>
                      <button
                        className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{l.name}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {count} task{count === 1 ? '' : 's'}
                      </span>
                      <button
                        title="Rename label (tasks update too)"
                        className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent-bright"
                        onClick={() => {
                          setEditingId(l.id)
                          setEditName(l.name)
                          setError(null)
                        }}
                      >
                        ✎ Rename
                      </button>
                      <button
                        title={count > 0 ? 'Cannot delete — tasks still use this label' : 'Delete label'}
                        disabled={count > 0 || busy}
                        className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => remove(l)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {labels.length === 0 && <p className="text-[13px] text-muted">No labels yet.</p>}
      </div>
    </ModalShell>
  )
}
