import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../components/common/Spinner.jsx'
import StatusBadge from '../components/common/StatusBadge.jsx'
import {
  searchStoriesByText,
  fetchRemoteLinks,
  fetchPageSpaces,
  fetchIssueDetail,
  fetchSubtaskType,
  createSubtasks,
  resolveAccountIds,
  browseUrl,
} from '../services/jiraApi.js'
import { emailUsername } from '../utils/format.js'
import { claimedSpecUrls, stripBrackets } from '../features/issues/specMatch.js'
import { QA_CATEGORIES } from '../features/delivery/deliveryUtils.js'
import { CFG } from '../config/appConfig.js'
import { card, cx, emptyState, searchInput, toolbar } from '../utils/ui.js'

const input =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-accent'

let customSeq = 0
const pageIdOf = (url) => /pageId=(\d+)|\/pages\/(\d+)/.exec(url || '')?.slice(1).find(Boolean)

const MEMBERS = [CFG.email, ...CFG.teamEmails]

const ROLE_META = {
  BE: { color: 'var(--color-violet)', prefix: CFG.subtaskPrefixBe, hint: 'from Confluence specs' },
  FE: { color: 'var(--color-blue)', prefix: CFG.subtaskPrefixFe, hint: 'add what the story needs' },
  QA: { color: 'var(--color-amber)', prefix: CFG.subtaskPrefixQa, hint: 'standard QA checklist' },
}
const withPrefix = (role, name) =>
  `${ROLE_META[role].prefix ? ROLE_META[role].prefix + ' ' : ''}${name}`

// One compact row: dot · name · assignee · points · remove, spec link underneath.
function Row({ sug, onRename, onPatch, onRemove }) {
  return (
    <div className="border-b border-line px-5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: ROLE_META[sug.role].color }}
        />
        <input
          autoFocus={!!sug.custom}
          className={cx(input, 'min-w-[200px] flex-1')}
          placeholder={`${sug.role} subtask name…`}
          value={sug.name}
          onChange={(e) => onRename(sug.id, e.target.value)}
        />
        <select
          className="rounded-lg border border-line bg-field px-2 py-2 text-xs text-ink-soft focus:border-accent"
          value={sug.assignee || ''}
          onChange={(e) => onPatch(sug.id, { assignee: e.target.value })}
          title="Assignee"
        >
          <option value="">unassigned</option>
          {MEMBERS.map((email) => (
            <option key={email} value={email}>
              {emailUsername(email)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.5"
          className="w-16 rounded-lg border border-line bg-field px-2 py-2 text-xs text-ink-soft focus:border-accent"
          placeholder="pts"
          value={sug.points ?? ''}
          onChange={(e) => onPatch(sug.id, { points: e.target.value })}
          title="Story points"
        />
        <button
          aria-label={`Remove ${sug.name || 'row'}`}
          title="Remove"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          onClick={() => onRemove(sug.id)}
        >
          ✕
        </button>
      </div>
      {sug.url && (
        <a
          className="mt-1 block truncate pl-4 text-xs text-muted hover:text-blue hover:underline"
          href={sug.url}
          target="_blank"
          rel="noreferrer"
          title={sug.title}
        >
          from spec: {sug.title}
        </a>
      )}
    </div>
  )
}

export default function SubtaskGenPage({ onNotify }) {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedKey = location.pathname.startsWith('/subtask-gen/')
    ? decodeURIComponent(location.pathname.slice('/subtask-gen/'.length))
    : null

  // step 1: search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)

  // step 2: analysis of the selected story
  const [story, setStory] = useState(null) // fetched issue
  const [analysis, setAnalysis] = useState(null) // { suggestions, existing, skipped }
  const [subtaskType, setSubtaskType] = useState(undefined) // undefined=loading, null=unavailable
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null) // [{key}]
  const [accountIds, setAccountIds] = useState({}) // email -> accountId
  const [role, setRole] = useState('BE') // active role tab
  useEffect(() => {
    resolveAccountIds(MEMBERS).then(setAccountIds).catch(() => {})
  }, [])

  const doSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      setResults(await searchStoriesByText(query))
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setSearching(false)
    }
  }

  // Load story + mentioned pages + spaces, then build the suggestion list.
  useEffect(() => {
    if (!selectedKey) {
      setStory(null)
      setAnalysis(null)
      setCreated(null)
      return
    }
    let on = true
    setStory(null)
    setAnalysis(null)
    setCreated(null)
    setSubtaskType(undefined) // re-resolve per project — never reuse another project's type
    ;(async () => {
      try {
        const [iss, remote] = await Promise.all([
          fetchIssueDetail(selectedKey),
          fetchRemoteLinks(selectedKey),
        ])
        if (!on) return
        setStory(iss)
        fetchSubtaskType(iss.fields.project?.key || selectedKey.split('-')[0])
          .then((t) => on && setSubtaskType(t))
          .catch(() => on && setSubtaskType(null))

        const pages = []
        for (const r of remote || []) {
          const url = r.object?.url || ''
          const id = pageIdOf(url)
          if (id && url.includes('/wiki/')) pages.push({ id, url, title: r.object?.title || '' })
        }
        const spaces = await fetchPageSpaces(pages.map((p) => p.id))
        if (!on) return

        const subs = (iss.fields.subtasks || []).map((s) => s.fields.summary)
        const claimed = claimedSpecUrls(subs, pages)
        const wantSpace = CFG.specSpace
        const suggestions = []
        const existing = []
        const skipped = []
        for (const p of pages) {
          if (wantSpace && spaces[p.id] !== wantSpace) {
            skipped.push({ ...p, space: spaces[p.id] })
          } else if (claimed.has(p.url)) {
            existing.push(p)
          } else {
            suggestions.push({ ...p, role: 'BE', name: withPrefix('BE', stripBrackets(p.title)) })
          }
        }
        // QA: the standard 9-pattern checklist (QA Info categories) — categories
        // already covered by an existing subtask are listed, not re-suggested.
        const qaCovered = []
        for (const c of QA_CATEGORIES) {
          if (subs.some((sub) => c.re.test(sub))) qaCovered.push(c)
          else
            suggestions.push({
              id: `qa-${c.id}`,
              url: null,
              title: null,
              role: 'QA',
              name: withPrefix('QA', c.label),
            })
        }
        setAnalysis({ suggestions, existing, skipped, qaCovered, pageCount: pages.length })
      } catch (err) {
        if (on) onNotify(err.message, true)
      }
    })()
    return () => {
      on = false
    }
  }, [selectedKey])

  const rename = (id, name) =>
    setAnalysis((a) => ({
      ...a,
      suggestions: a.suggestions.map((s) => (s.id === id ? { ...s, name } : s)),
    }))
  const patch = (id, upd) =>
    setAnalysis((a) => ({
      ...a,
      suggestions: a.suggestions.map((s) => (s.id === id ? { ...s, ...upd } : s)),
    }))
  const remove = (id) =>
    setAnalysis((a) => ({ ...a, suggestions: a.suggestions.filter((s) => s.id !== id) }))
  const addCustom = (role) =>
    setAnalysis((a) => ({
      ...a,
      suggestions: [
        ...a.suggestions,
        {
          id: `custom-${++customSeq}`,
          url: null,
          title: null,
          role,
          custom: true,
          name: ROLE_META[role].prefix ? ROLE_META[role].prefix + ' ' : '',
        },
      ],
    }))

  // a row whose name is still just the role prefix doesn't count
  const prefixes = Object.values(ROLE_META).map((r) => r.prefix)
  const validRows = (analysis?.suggestions || [])
    .filter((s) => s.name.trim() && !prefixes.includes(s.name.trim()))
    .map((s) => ({
      id: s.id,
      role: s.role,
      summary: s.name.trim(),
      assigneeEmail: s.assignee || '',
      assigneeId: s.assignee ? accountIds[s.assignee] : null,
      points: s.points,
    }))
  const roleRows = validRows.filter((r) => r.role === role)

  // Creates ONLY the active role tab's rows; other tabs stay for later.
  const create = async () => {
    setCreating(true)
    try {
      const res = await createSubtasks({
        parentKey: story.key,
        projectKey: story.fields.project?.key || story.key.split('-')[0],
        typeId: subtaskType.id,
        rows: roleRows,
      })
      const made = res?.issues || []
      const errs = res?.errors || []
      const unresolved = roleRows.filter((r) => r.assigneeEmail && !r.assigneeId)
      if (unresolved.length)
        onNotify(
          `⚠ ${unresolved.length} row${unresolved.length === 1 ? '' : 's'} created UNASSIGNED — Jira account not found for the picked member`,
          true,
        )
      setCreated((c) => [...(c || []), ...made])
      // remove ONLY the rows that were actually created (bulk errors carry the
      // failed index) — failed rows stay in the tab for a safe retry.
      if (made.length) {
        const failedIdx = new Set(errs.map((e) => e.failedElementNumber))
        const createdIds = new Set(roleRows.filter((_, i) => !failedIdx.has(i)).map((r) => r.id))
        setAnalysis((a) => ({
          ...a,
          suggestions: a.suggestions.filter((x) => !createdIds.has(x.id)),
        }))
      }
      if (errs.length) onNotify(`${made.length} created, ${errs.length} failed — see Jira`, true)
      else onNotify(`✓ Created ${made.length} ${role} subtask${made.length === 1 ? '' : 's'} on ${story.key}`)
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setCreating(false)
    }
  }

  // ---------- step 1: search ----------
  if (!selectedKey) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-5 pt-6">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">
            Spec Wizard <span className="text-accent">(beta)</span>
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Pick a story — its mentioned Confluence specs
            {CFG.specSpace && (
              <>
                {' '}from the <span className="font-medium text-ink-soft">{CFG.specSpace}</span> space
              </>
            )}{' '}
            become a subtask checklist you can edit and create in one click.
          </p>
        </div>

        <form onSubmit={doSearch} className={toolbar}>
          <input
            autoFocus
            type="search"
            className={cx(searchInput, 'max-w-none py-2.5')}
            placeholder="Search story by key (DX-123) or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-full border border-accent bg-accent-soft px-5 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent hover:text-bg disabled:opacity-60"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results && (
          <div className={card}>
            {results.length === 0 ? (
              <div className={emptyState}>No stories found.</div>
            ) : (
              results.map((iss) => (
                <button
                  key={iss.key}
                  className="flex w-full items-center gap-3 border-b border-line px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-panel-soft"
                  onClick={() => navigate(`/subtask-gen/${iss.key}`)}
                >
                  <span className="shrink-0 font-semibold text-accent-bright">{iss.key}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{iss.fields.summary}</span>
                  {iss.fields.status && <StatusBadge status={iss.fields.status} />}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  // ---------- step 2: review & create ----------
  return (
    <div key={selectedKey} className="mx-auto grid w-full max-w-3xl animate-enter gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink"
          onClick={() => navigate('/subtask-gen')}
        >
          ← Search
        </button>
        <span className="flex-1" />
        {story && (
          <a
            className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright"
            href={browseUrl(story.key)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Jira ↗
          </a>
        )}
      </div>

      {!story || !analysis ? (
        <Spinner label="Reading story & mentioned Confluence specs…" />
      ) : (
        <>
          <div className={`${card} p-5`}>
            <span className="text-[13px] font-semibold text-accent-bright">{story.key}</span>
            <h2 className="text-lg font-semibold">{story.fields.summary}</h2>
            <p className="mt-1 text-xs text-muted">
              {analysis.pageCount} mentioned page{analysis.pageCount === 1 ? '' : 's'} ·{' '}
              {(story.fields.subtasks || []).length} existing subtask
              {(story.fields.subtasks || []).length === 1 ? '' : 's'}
              {CFG.specSpace && <> · spec space: {CFG.specSpace}</>}
            </p>
          </div>

          {created && created.length > 0 && (
            <div className={`${card} p-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-success-bright">
                  🎉 Created ({created.length})
                </span>
                {created.map((c) => (
                  <a
                    key={c.key}
                    href={browseUrl(c.key)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-success/50 bg-success-soft px-3 py-1 text-[13px] font-medium text-success-bright hover:underline"
                  >
                    {c.key} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

              <div className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="inline-flex rounded-xl border border-line bg-field p-1">
                    {['BE', 'FE', 'QA'].map((r) => {
                      const n = analysis.suggestions.filter((x) => x.role === r).length
                      return (
                        <button
                          key={r}
                          className={cx(
                            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors',
                            role === r ? 'bg-accent-soft text-accent-bright' : 'text-ink-soft hover:text-ink',
                          )}
                          onClick={() => setRole(r)}
                        >
                          <span className="size-2 rounded-full" style={{ background: ROLE_META[r].color }} />
                          {r}
                          <span className={role === r ? 'opacity-80' : 'text-muted'}>{n}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted max-sm:hidden">{ROLE_META[role].hint}</span>
                    <button
                      className="rounded-full border border-line bg-field px-3.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-accent hover:text-accent-bright"
                      onClick={() => addCustom(role)}
                    >
                      + Add {role}
                    </button>
                  </div>
                </div>
                {(() => {
                  const rows = analysis.suggestions.filter((x) => x.role === role)
                  if (!rows.length)
                    return (
                      <div className="px-5 py-5 text-[13px] text-muted">
                        {role === 'FE'
                          ? 'No FE rows yet — add the screens/UI work this story needs.'
                          : role === 'QA'
                            ? 'Full QA checklist already covered by existing subtasks. ✓'
                            : 'Every matching spec already has a subtask (or none were found).'}
                      </div>
                    )
                  return rows.map((sug) => (
                    <Row key={sug.id} sug={sug} onRename={rename} onPatch={patch} onRemove={remove} />
                  ))
                })()}
              </div>

              {(analysis.existing.length > 0 || analysis.qaCovered.length > 0) && (
                <div className={card}>
                  <div className="border-b border-line px-5 py-3.5">
                    <h3 className="text-sm font-semibold text-success-bright">
                      ✓ Already covered{' '}
                      <span className="text-muted">({analysis.existing.length + analysis.qaCovered.length})</span>
                    </h3>
                  </div>
                  {analysis.existing.map((p) => (
                    <div key={p.id} className="truncate border-b border-line px-5 py-2.5 text-[13px] text-muted last:border-b-0" title={p.title}>
                      <span className="mr-1.5 font-medium" style={{ color: ROLE_META.BE.color }}>BE</span>
                      {p.title}
                    </div>
                  ))}
                  {analysis.qaCovered.map((c) => (
                    <div key={c.id} className="truncate border-b border-line px-5 py-2.5 text-[13px] text-muted last:border-b-0">
                      <span className="mr-1.5 font-medium" style={{ color: ROLE_META.QA.color }}>QA</span>
                      {c.label}
                    </div>
                  ))}
                </div>
              )}

              {analysis.skipped.length > 0 && (
                <p className="px-1 text-xs text-muted">
                  {analysis.skipped.length} page{analysis.skipped.length === 1 ? '' : 's'} skipped —
                  not in the {CFG.specSpace} space (
                  {analysis.skipped.map((p) => p.space || '?').join(', ')})
                </p>
              )}

              <div className="sticky bottom-4 flex justify-end">
                <button
                  disabled={creating || !roleRows.length || !subtaskType}
                  onClick={create}
                  title={
                    subtaskType === null
                      ? 'No sub-task issue type available in this project'
                      : `Creates only the ${role} tab — other tabs stay for later`
                  }
                  className="rounded-full border border-accent bg-accent px-7 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating
                    ? 'Creating…'
                    : `Create ${roleRows.length} ${role} subtask${roleRows.length === 1 ? '' : 's'} on ${story.key}`}
                </button>
              </div>
        </>
      )}
    </div>
  )
}
