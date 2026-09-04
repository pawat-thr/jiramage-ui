import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FilterMenu from '../components/common/FilterMenu.jsx'
import Spinner from '../components/common/Spinner.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import StoryDetail from '../features/story/StoryDetail.jsx'
import { releaseNames } from '../features/story/releaseNames.js'
import { fetchStories } from '../services/jiraApi.js'
import { fetchPlan, syncPlan, savePlanRows, deletePlanRow } from '../services/integrationApi.js'
import { CFG } from '../config/appConfig.js'
import { uniqueSorted } from '../utils/format.js'
import { card, cx, emptyState, toolbar, th, td } from '../utils/ui.js'

const ROLES = CFG.integrationRoles

const cellInput =
  'w-full rounded-lg border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink placeholder:text-muted focus:border-accent'

// Frozen-pane classes (same pattern as the Delivery QA table).
const stickyBase = 'sticky z-10 bg-panel group-hover:bg-panel-soft'
const STICKY = {
  key: `${stickyBase} left-0 min-w-[110px]`,
  name: `${stickyBase} left-[110px] min-w-[260px] max-w-[260px]`,
  status: `${stickyBase} left-[370px] min-w-[140px] border-r border-line`,
}
const stickyTh = 'sticky z-20 bg-panel'
const STICKY_TH = {
  key: `${stickyTh} left-0 min-w-[110px]`,
  name: `${stickyTh} left-[110px] min-w-[260px]`,
  status: `${stickyTh} left-[370px] min-w-[140px] border-r border-line`,
}

// Editable cell — commits to LOCAL state on blur/Enter; nothing is written to
// Firestore until the Save button is pushed.
function EditCell({ row, field, type = 'text', placeholder, onSave, className }) {
  const stored = field.startsWith('targetDates.')
    ? row.targetDates?.[field.split('.')[1]] || ''
    : row[field] || ''
  const [value, setValue] = useState(stored)
  useEffect(() => setValue(stored), [stored])

  const save = () => {
    if (value === stored) return
    const patch = field.startsWith('targetDates.')
      ? { targetDates: { ...(row.targetDates || {}), [field.split('.')[1]]: value } }
      : { [field]: value }
    onSave(row.id, patch)
  }
  return (
    <input
      type={type}
      className={cx(cellInput, className)}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
    />
  )
}

export default function IntegrationPage({ defaultRelease = '', onNotify }) {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedKey = location.pathname.startsWith('/integration/')
    ? decodeURIComponent(location.pathname.slice('/integration/'.length))
    : null

  const [stories, setStories] = useState(null) // Jira stories (for options + sync)
  const [release, setReleaseState] = useState(defaultRelease)
  const [releaseTouched, setReleaseTouched] = useState(false)
  useEffect(() => {
    if (!releaseTouched) setReleaseState(defaultRelease)
  }, [defaultRelease, releaseTouched])
  const setRelease = (v) => {
    // switching release replaces the table — don't silently discard edits
    if (changedRowsRef.current > 0 && !window.confirm('You have unsaved changes — discard them and switch release?'))
      return
    setReleaseTouched(true)
    setReleaseState(v)
  }

  const [rows, setRows] = useState(null) // editable copy
  const [original, setOriginal] = useState({}) // id -> snapshot of saved editable fields
  const [saving, setSaving] = useState(false)
  const [confirmRow, setConfirmRow] = useState(null) // row pending delete
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const releaseRef = useRef(release)
  const changedRowsRef = useRef(0)
  useEffect(() => {
    releaseRef.current = release
  }, [release])

  const snapshot = (list) =>
    Object.fromEntries(
      (list || []).map((r) => [
        r.id,
        JSON.stringify({ env: r.env || '', targetDates: r.targetDates || {}, remark: r.remark || '' }),
      ]),
    )

  // Jira stories once (release options + the sync source).
  useEffect(() => {
    let on = true
    fetchStories()
      .then((s) => on && setStories(s))
      .catch((err) => on && onNotify(err.message, true))
    return () => {
      on = false
    }
  }, [])

  const releaseOptions = useMemo(
    () => uniqueSorted((stories || []).flatMap(releaseNames)),
    [stories],
  )

  // Load the stored plan whenever the release changes.
  useEffect(() => {
    if (!release) {
      setRows(null)
      return
    }
    let on = true
    setLoading(true)
    fetchPlan(release)
      .then((r) => {
        if (!on) return
        setRows(r)
        setOriginal(snapshot(r))
      })
      .catch((err) => on && onNotify(err.message, true))
      .finally(() => on && setLoading(false))
    return () => {
      on = false
    }
  }, [release])

  const sync = async () => {
    if (rows === null || loading) return // plan not loaded yet — syncing now would treat everything as new
    const forRelease = release // guard against switching release mid-sync
    setSyncing(true)
    try {
      const inRelease = (stories || []).filter((s) => releaseNames(s).includes(forRelease))
      const { added, removed } = await syncPlan(forRelease, inRelease, rows)
      const fresh = await fetchPlan(forRelease)
      if (releaseRef.current !== forRelease) return // user moved on — don't clobber the new release's view
      setRows(fresh)
      setOriginal(snapshot(fresh))
      onNotify(
        added || removed
          ? `✓ Synced — ${added} added, ${removed} removed`
          : '✓ Synced — already up to date',
      )
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setSyncing(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deletePlanRow(confirmRow.id)
      setRows((r) => r.filter((row) => row.id !== confirmRow.id))
      setOriginal((o) => {
        const { [confirmRow.id]: _gone, ...rest } = o
        return rest
      })
      onNotify(`✓ Removed ${confirmRow.key} from the plan`)
      setConfirmRow(null)
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setDeleting(false)
    }
  }

  // local edit only — Firestore is touched by the Save button
  const saveCell = (id, patch) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const changedRows = (rows || []).filter((r) => snapshot([r])[r.id] !== original[r.id])
  changedRowsRef.current = changedRows.length

  const saveAll = async () => {
    setSaving(true)
    try {
      await savePlanRows(changedRows)
      setOriginal(snapshot(rows))
      onNotify(`✓ Saved ${changedRows.length} change${changedRows.length === 1 ? '' : 's'}`)
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setSaving(false)
    }
  }

  // don't lose unsaved edits to a tab close / reload
  useEffect(() => {
    if (!changedRows.length) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changedRows.length])

  if (selectedKey) {
    return (
      <div key={selectedKey} className="animate-enter">
        <StoryDetail
          storyKey={selectedKey}
          backLabel="Integration Plan"
          onBack={() => navigate('/integration')}
        />
      </div>
    )
  }

  return (
    <div key="integration" className="animate-enter">
      <div className={toolbar}>
        <FilterMenu label="Release" value={release} options={releaseOptions} onPick={setRelease} />
        <button
          disabled={!release || syncing || stories === null || loading || rows === null || changedRows.length > 0}
          onClick={sync}
          title={
            changedRows.length
              ? 'Save your changes first — sync reloads the table'
              : "Fetch this release's stories from Jira: new ones are added, removed ones are cleaned up, your inputs are kept"
          }
          className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : '⟳ Sync from Jira'}
        </button>
        <span className="flex-1" />
        {rows && (
          <span className="text-[13px] text-muted">
            {rows.length} stor{rows.length === 1 ? 'y' : 'ies'} in plan
          </span>
        )}
      </div>

      {stories === null ? (
        <Spinner label="Loading stories…" />
      ) : !release ? (
        <div className={card}>
          <div className={emptyState}>Pick a Release to open its integration plan.</div>
        </div>
      ) : loading || rows === null ? (
        <Spinner label="Loading plan…" />
      ) : rows.length === 0 ? (
        <div className={card}>
          <div className={emptyState}>
            No stories in this plan yet — press <strong>⟳ Sync from Jira</strong> to pull the
            release's stories in.
          </div>
        </div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr>
                <th className={`${th} ${STICKY_TH.key}`}>Key</th>
                <th className={`${th} ${STICKY_TH.name}`}>Name</th>
                <th className={`${th} ${STICKY_TH.status}`}>Status</th>
                <th className={th}>Env</th>
                {ROLES.map((r) => (
                  <th key={r} className={`${th} whitespace-nowrap`}>
                    Target · {r}
                  </th>
                ))}
                <th className={`${th} min-w-[220px]`}>Remark</th>
                <th className={th} aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="group transition-colors last:*:border-b-0 hover:bg-panel-soft">
                  <td className={`${td} ${STICKY.key}`}>
                    <button
                      className="font-semibold whitespace-nowrap text-accent-bright hover:underline"
                      onClick={() => navigate(`/integration/${row.key}`)}
                      title="Open story detail"
                    >
                      {row.key}
                    </button>
                  </td>
                  <td className={`${td} ${STICKY.name}`}>
                    <button
                      className="block max-w-full truncate text-left text-ink hover:text-accent-bright"
                      onClick={() => navigate(`/integration/${row.key}`)}
                      title={row.name}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className={`${td} ${STICKY.status}`}>
                    <span className="inline-block rounded-full border border-line bg-field px-2.5 py-[3px] text-[11px] font-medium whitespace-nowrap text-ink-soft">
                      {row.status || '—'}
                    </span>
                  </td>
                  <td className={`${td} min-w-[110px]`}>
                    <EditCell row={row} field="env" placeholder="env…" onSave={saveCell} />
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className={`${td} min-w-[150px]`}>
                      <EditCell row={row} field={`targetDates.${r}`} type="date" onSave={saveCell} />
                    </td>
                  ))}
                  <td className={`${td} min-w-[220px]`}>
                    <EditCell row={row} field="remark" placeholder="remark…" onSave={saveCell} />
                  </td>
                  <td className={td}>
                    <button
                      aria-label={`Remove ${row.key} from plan`}
                      title="Remove from plan"
                      className="grid size-8 place-items-center rounded-full text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger-soft hover:text-danger max-md:opacity-100"
                      onClick={() => setConfirmRow(row)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {changedRows.length > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-end gap-3">
          <span className="rounded-full bg-panel/90 px-3 py-1 text-xs text-muted backdrop-blur">
            {changedRows.length} unsaved change{changedRows.length === 1 ? '' : 's'}
          </span>
          <button
            disabled={saving}
            onClick={saveAll}
            className="rounded-full border border-accent bg-accent px-7 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-accent-bright disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Saving…' : `💾 Save ${changedRows.length} change${changedRows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {confirmRow && (
        <ConfirmDialog
          title={`Remove ${confirmRow.key} from the plan?`}
          message={`Its env, target dates, and remark will be deleted. Note: if the story is still in this release, the next “Sync from Jira” will add it back with empty fields.`}
          busy={deleting}
          onClose={() => setConfirmRow(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
