import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FilterMenu from '../components/common/FilterMenu.jsx'
import RefreshButton from '../components/common/RefreshButton.jsx'
import Spinner from '../components/common/Spinner.jsx'
import StatusBadge from '../components/common/StatusBadge.jsx'
import StoryDetail from '../features/story/StoryDetail.jsx'
import ReleaseSummary from '../features/delivery/ReleaseSummary.jsx'
import QASummary from '../features/delivery/QASummary.jsx'
import { releaseNames } from '../features/story/StoryTable.jsx'
import {
  ROLES,
  QA_CATEGORIES,
  deliveryStats,
  qaStats,
  qaRollup,
  releaseRollup,
  storyProgress,
  fmtPts,
} from '../features/delivery/deliveryUtils.js'
import { fetchSubtasksForParents, browseUrl } from '../services/jiraApi.js'
import { uniqueSorted } from '../utils/format.js'
import { card, cx, emptyState, searchInput, toolbar, th, td } from '../utils/ui.js'

const MAX_STORIES = 300 // safety cap on the bulk subtask fetch

function RoleCell({ id, r }) {
  if (!r.count) return <span className="text-muted">—</span>
  const w = (v) => `${(v / (r.total || 1)) * 100}%`
  return (
    <div
      className="min-w-[104px]"
      title={`${id} — total ${fmtPts(r.total)} pts · to do ${fmtPts(r.todo)} · in progress ${fmtPts(r.inprog)} · done ${fmtPts(r.done)} · subtasks ${r.doneCount}/${r.count} done`}
    >
      <span className="text-[13px] text-ink tabular-nums">
        {fmtPts(r.done)}/{fmtPts(r.total)}
        <span className="ml-1.5 text-xs text-muted">{r.doneCount}/{r.count}</span>
      </span>
      <div className="mt-1 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-field">
        {r.done > 0 && <span style={{ width: w(r.done), background: 'var(--color-success)' }} />}
        {r.inprog > 0 && <span style={{ width: w(r.inprog), background: 'var(--color-blue)' }} />}
        {r.todo > 0 && <span style={{ width: w(r.todo), background: 'var(--color-slate)' }} />}
      </div>
    </div>
  )
}

function QACell({ label, b }) {
  if (!b.count) return <span className="text-muted">—</span>
  const state =
    b.doneCount === b.count
      ? { label: 'Done', cls: 'bg-success-soft text-success-bright border-success/50' }
      : b.inprogCount > 0
        ? { label: 'In Progress', cls: 'bg-blue-soft text-blue border-blue/50' }
        : { label: 'To Do', cls: 'bg-slate-soft text-slate border-line-strong' }
  return (
    <div
      className="whitespace-nowrap"
      title={`${label} · ${b.doneCount}/${b.count} done · ${fmtPts(b.donePts)}/${fmtPts(b.pts)} pts`}
    >
      <span className={`inline-block rounded-full border px-2 py-[2px] text-[11px] font-medium ${state.cls}`}>
        {state.label}
      </span>
      <span className="ml-1.5 text-[13px] text-ink tabular-nums">
        {fmtPts(b.donePts)}/{fmtPts(b.pts)}
      </span>
      {b.count > 1 && <span className="ml-1 text-xs text-muted">{b.doneCount}/{b.count}</span>}
    </div>
  )
}

// Frozen-pane cell classes (Excel-style): Key/Name/Status stay while the rest slides.
const stickyBase = 'sticky z-10 bg-panel group-hover:bg-panel-soft'
const STICKY = {
  key: `${stickyBase} left-0 min-w-[110px]`,
  name: `${stickyBase} left-[110px] min-w-[280px] max-w-[280px]`,
  status: `${stickyBase} left-[390px] min-w-[150px] border-r border-line`,
}
const stickyTh = 'sticky z-20 bg-panel'
const STICKY_TH = {
  key: `${stickyTh} left-0 min-w-[110px]`,
  name: `${stickyTh} left-[110px] min-w-[280px]`,
  status: `${stickyTh} left-[390px] min-w-[150px] border-r border-line`,
}

export default function DeliveryPage({ stories, onRefresh, refreshing, defaultRelease = '', onNotify }) {
  // Adopt the async-loaded default release until the user picks manually.
  const [release, setReleaseState] = useState(defaultRelease)
  const [releaseTouched, setReleaseTouched] = useState(false)
  useEffect(() => {
    if (!releaseTouched) setReleaseState(defaultRelease)
  }, [defaultRelease, releaseTouched])
  const setRelease = (v) => {
    setReleaseTouched(true)
    setReleaseState(v)
  }
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('delivery') // 'delivery' | 'qa'
  // QA pair filter — applies only when BOTH type and state are chosen.
  const [qaType, setQaType] = useState('')
  const [qaState, setQaState] = useState('')
  const [subMap, setSubMap] = useState(null) // parentKey -> subtasks[]

  // Detail view is URL-driven: /delivery/<KEY> (reuses the story detail).
  const location = useLocation()
  const navigate = useNavigate()
  const selectedKey = location.pathname.startsWith('/delivery/')
    ? decodeURIComponent(location.pathname.slice('/delivery/'.length))
    : null

  const releaseOptions = useMemo(
    () => uniqueSorted((stories || []).flatMap(releaseNames)),
    [stories],
  )

  const inRelease = useMemo(
    () => (release ? (stories || []).filter((s) => releaseNames(s).includes(release)) : []),
    [stories, release],
  )

  const statusOptions = useMemo(
    () => uniqueSorted(inRelease.map((s) => s.fields.status.name)),
    [inRelease],
  )

  // Bulk-load subtasks for the release's stories.
  useEffect(() => {
    if (!release || !stories) {
      setSubMap(null)
      return
    }
    const keys = inRelease.slice(0, MAX_STORIES).map((s) => s.key)
    if (!keys.length) {
      setSubMap({})
      return
    }
    let on = true
    setSubMap(null)
    fetchSubtasksForParents(keys)
      .then((subs) => {
        if (!on) return
        const map = {}
        for (const st of subs) {
          const p = st.fields.parent?.key
          if (p) (map[p] ||= []).push(st)
        }
        setSubMap(map)
      })
      .catch((err) => {
        if (!on) return // ignore stale/unmounted fetches
        onNotify(err.message, true)
        setSubMap({})
      })
    return () => {
      on = false
    }
  }, [stories, release])

  const rollup = useMemo(
    () => (subMap ? releaseRollup(inRelease.slice(0, MAX_STORIES), subMap) : null),
    [inRelease, subMap],
  )
  const qaAgg = useMemo(
    () => (subMap ? qaRollup(inRelease.slice(0, MAX_STORIES), subMap) : null),
    [inRelease, subMap],
  )

  const QA_TYPE_OPTIONS = ['QA Total', ...QA_CATEGORIES.map((c) => c.label)]
  const QA_STATE_OPTIONS = ['To Do', 'In Progress', 'Done']
  const bucketState = (b) =>
    !b.count ? null : b.doneCount === b.count ? 'Done' : b.inprogCount > 0 ? 'In Progress' : 'To Do'

  // Search filter + sort least-complete stories first (done sinks to bottom).
  const rows = useMemo(() => {
    return inRelease
      .filter((s) => {
        if (status && s.fields.status.name !== status) return false
        if (search && !`${s.key} ${s.fields.summary}`.toLowerCase().includes(search.toLowerCase()))
          return false
        return true
      })
      .map((s) => ({ s, stats: deliveryStats(subMap?.[s.key]) }))
      .sort((a, b) => storyProgress(a.s, a.stats) - storyProgress(b.s, b.stats))
  }, [inRelease, status, search, subMap])

  // QA view rows: apply the Type+State pair filter (both fields required).
  const qaRows = useMemo(() => {
    if (view !== 'qa' || !qaType || !qaState || !subMap) return rows
    const catId = QA_CATEGORIES.find((c) => c.label === qaType)?.id
    return rows.filter(({ s }) => {
      const qa = qaStats(subMap[s.key])
      const bucket = qaType === 'QA Total' ? qa.total : qa.cats[catId]
      return bucketState(bucket) === qaState
    })
  }, [rows, view, qaType, qaState, subMap])

  if (selectedKey) {
    return (
      <div key={selectedKey} className="animate-enter">
        <StoryDetail
          storyKey={selectedKey}
          backLabel="Delivery Tracking"
          onBack={() => navigate('/delivery')}
        />
      </div>
    )
  }

  return (
    <div key="delivery" className="animate-enter">
      <div className={toolbar}>
        <input
          type="search"
          className={searchInput}
          placeholder="Search by key or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterMenu label="Release" value={release} options={releaseOptions} onPick={setRelease} />
        <FilterMenu label="Status" value={status} options={statusOptions} onPick={setStatus} />
        <div className="inline-flex rounded-xl border border-line bg-field p-1">
          {[
            ['delivery', 'Delivery'],
            ['qa', 'QA Info'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={cx(
                'rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors',
                view === id ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:text-ink',
              )}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'qa' && (
          <>
            <FilterMenu label="QA Type" value={qaType} options={QA_TYPE_OPTIONS} onPick={setQaType} />
            <FilterMenu label="QA State" value={qaState} options={QA_STATE_OPTIONS} onPick={setQaState} />
          </>
        )}
        <RefreshButton refreshing={refreshing} onClick={onRefresh} />
        <span className="flex-1" />
        <span className="text-[13px] text-muted">
          {release
            ? `${(view === 'qa' ? qaRows : rows).length} stor${(view === 'qa' ? qaRows : rows).length === 1 ? 'y' : 'ies'} · least done first`
            : 'pick a release'}
        </span>
      </div>

      {stories === null ? (
        <Spinner label="Loading stories…" />
      ) : !release ? (
        <div className={card}>
          <div className={emptyState}>Pick a Release to track its delivery.</div>
        </div>
      ) : subMap === null ? (
        <Spinner label="Loading subtasks & points…" />
      ) : (
        <div className="grid gap-4">
          {view === 'delivery'
            ? rollup && <ReleaseSummary release={release} rollup={rollup} />
            : qaAgg && <QASummary release={release} rollup={qaAgg} />}

          {inRelease.length > MAX_STORIES && (
            <p className="text-xs text-muted">
              Showing delivery data for the first {MAX_STORIES} stories of this release.
            </p>
          )}

          {!rows.length ? (
            <div className={card}>
              <div className={emptyState}>No stories in this release match.</div>
            </div>
          ) : view === 'delivery' ? (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[1060px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Key</th>
                    <th className={th}>Name</th>
                    <th className={th}>Status</th>
                    <th className={th}>Progress</th>
                    {ROLES.map(({ id, color }) => (
                      <th key={id} className={th}>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: color }} />
                          {id}
                        </span>
                      </th>
                    ))}

                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ s, stats }) => {
                    const donePts =
                      stats.roles.FE.done + stats.roles.BE.done + stats.roles.QA.done
                    const pct = stats.deliveryPoints
                      ? Math.round((donePts / stats.deliveryPoints) * 100)
                      : null
                    return (
                      <tr
                        key={s.key}
                        onClick={() => navigate(`/delivery/${s.key}`)}
                        className="cursor-pointer transition-colors last:*:border-b-0 hover:bg-panel-soft"
                        title="Click for story detail"
                      >
                        <td className={td}>
                          <a
                            className="font-semibold whitespace-nowrap text-accent-bright hover:underline"
                            href={browseUrl(s.key)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in Jira"
                          >
                            {s.key}
                          </a>
                        </td>
                        <td className={td}>
                          <div
                            className="max-w-[340px] truncate text-ink max-md:max-w-[180px]"
                            title={s.fields.summary}
                          >
                            {s.fields.summary}
                          </div>
                        </td>
                        <td className={td}>
                          <StatusBadge status={s.fields.status} />
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {pct === null ? (
                            <span className="text-[13px] text-muted italic">no estimates</span>
                          ) : (
                            <span className="text-[13px] tabular-nums">
                              <span className={`font-semibold ${pct === 100 ? 'text-success-bright' : 'text-ink'}`}>
                                {pct}%
                              </span>
                              <span className="ml-1.5 text-muted">
                                {fmtPts(donePts)}/{fmtPts(stats.deliveryPoints)}
                              </span>
                            </span>
                          )}
                        </td>
                        {ROLES.map(({ id }) => (
                          <td key={id} className={td}>
                            <RoleCell id={id} r={stats.roles[id]} />
                          </td>
                        ))}

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full min-w-[1900px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} ${STICKY_TH.key}`}>Key</th>
                    <th className={`${th} ${STICKY_TH.name}`}>Name</th>
                    <th className={`${th} ${STICKY_TH.status}`}>Status</th>
                    <th className={`${th} whitespace-nowrap`}>QA Total</th>
                    {QA_CATEGORIES.map((c) => (
                      <th key={c.id} className={`${th} whitespace-nowrap`}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qaRows.map(({ s }) => {
                    const qa = qaStats(subMap?.[s.key])
                    return (
                      <tr
                        key={s.key}
                        onClick={() => navigate(`/delivery/${s.key}`)}
                        className="group cursor-pointer transition-colors last:*:border-b-0 hover:bg-panel-soft"
                        title="Click for story detail"
                      >
                        <td className={`${td} ${STICKY.key}`}>
                          <a
                            className="font-semibold whitespace-nowrap text-accent-bright hover:underline"
                            href={browseUrl(s.key)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in Jira"
                          >
                            {s.key}
                          </a>
                        </td>
                        <td className={`${td} ${STICKY.name}`}>
                          <div className="truncate text-ink" title={s.fields.summary}>
                            {s.fields.summary}
                          </div>
                        </td>
                        <td className={`${td} ${STICKY.status}`}>
                          <StatusBadge status={s.fields.status} />
                        </td>
                        <td className={td}>
                          <QACell label="QA Total" b={qa.total} />
                        </td>
                        {QA_CATEGORIES.map((c) => (
                          <td key={c.id} className={td}>
                            <QACell label={c.label} b={qa.cats[c.id]} />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
