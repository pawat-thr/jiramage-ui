import { useEffect, useMemo, useState } from 'react'
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
import { CFG } from '../config/appConfig.js'
import { card, cx, emptyState, searchInput, toolbar } from '../utils/ui.js'

const input =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-accent'

const pageIdOf = (url) => /pageId=(\d+)|\/pages\/(\d+)/.exec(url || '')?.slice(1).find(Boolean)

const MEMBERS = [CFG.email, ...CFG.teamEmails]

// Compact per-row controls: assignee (team env) + story points.
function RowControls({ sug, onPatch }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <select
        className="rounded-lg border border-line bg-field px-2 py-1 text-xs text-ink-soft focus:border-accent"
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
        className="w-20 rounded-lg border border-line bg-field px-2 py-1 text-xs text-ink-soft focus:border-accent"
        placeholder="points"
        value={sug.points ?? ''}
        onChange={(e) => onPatch(sug.id, { points: e.target.value })}
        title="Story points"
      />
    </div>
  )
}

// One suggestion row: editable name + assignee/points + the source spec underneath.
function SuggestionRow({ sug, onRename, onPatch, onRemove }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
      <span className="mt-2.5 size-2 shrink-0 rounded-full bg-accent" />
      <div className="min-w-0 flex-1">
        <input
          className={input}
          value={sug.name}
          onChange={(e) => onRename(sug.id, e.target.value)}
        />
        <RowControls sug={sug} onPatch={onPatch} />
        <a
          className="mt-1 block truncate text-xs text-muted hover:text-blue hover:underline"
          href={sug.url}
          target="_blank"
          rel="noreferrer"
          title={sug.title}
        >
          from spec: {sug.title}
        </a>
      </div>
      <button
        aria-label={`Remove ${sug.name}`}
        title="Remove from the list"
        className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        onClick={() => onRemove(sug.id)}
      >
        ✕
      </button>
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
            suggestions.push({
              ...p,
              name: `${CFG.subtaskPrefix ? CFG.subtaskPrefix + ' ' : ''}${stripBrackets(p.title)}`,
            })
          }
        }
        setAnalysis({ suggestions, existing, skipped, pageCount: pages.length })
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
  const addCustom = () =>
    setAnalysis((a) => ({
      ...a,
      suggestions: [
        ...a.suggestions,
        {
          id: `custom-${Date.now()}`,
          url: null,
          title: null,
          name: CFG.subtaskPrefix ? CFG.subtaskPrefix + ' ' : '',
        },
      ],
    }))

  const validRows = (analysis?.suggestions || [])
    .filter((s) => s.name.trim())
    .map((s) => ({
      summary: s.name.trim(),
      assigneeId: s.assignee ? accountIds[s.assignee] : null,
      points: s.points,
    }))

  const create = async () => {
    setCreating(true)
    try {
      const res = await createSubtasks({
        parentKey: story.key,
        projectKey: story.fields.project?.key || story.key.split('-')[0],
        typeId: subtaskType.id,
        rows: validRows,
      })
      const made = res?.issues || []
      const errs = res?.errors || []
      setCreated(made)
      if (errs.length) onNotify(`${made.length} created, ${errs.length} failed — see Jira`, true)
      else onNotify(`✓ Created ${made.length} subtask${made.length === 1 ? '' : 's'} on ${story.key}`)
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

          {created ? (
            <div className={`${card} p-6 text-center`}>
              <div className="text-3xl">🎉</div>
              <h3 className="mt-2 text-base font-semibold">
                Created {created.length} subtask{created.length === 1 ? '' : 's'} on {story.key}
              </h3>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
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
              <button
                className="mt-5 rounded-full border border-line bg-panel px-5 py-2 text-sm text-ink-soft hover:border-line-strong hover:text-ink"
                onClick={() => navigate('/subtask-gen')}
              >
                Generate for another story
              </button>
            </div>
          ) : (
            <>
              <div className={card}>
                <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                  <h3 className="text-sm font-semibold">
                    Suggested subtasks{' '}
                    <span className="text-muted">({analysis.suggestions.length})</span>
                  </h3>
                  <button
                    className="rounded-full border border-line bg-field px-3.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-accent hover:text-accent-bright"
                    onClick={addCustom}
                  >
                    + Add custom
                  </button>
                </div>
                {analysis.suggestions.length === 0 ? (
                  <div className={emptyState}>
                    Nothing to suggest — every matching spec already has a subtask, or none were
                    found. Add a custom row if you still need one.
                  </div>
                ) : (
                  analysis.suggestions.map((sug) =>
                    sug.url ? (
                      <SuggestionRow key={sug.id} sug={sug} onRename={rename} onPatch={patch} onRemove={remove} />
                    ) : (
                      <div key={sug.id} className="flex items-start gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
                        <span className="mt-2.5 size-2 shrink-0 rounded-full bg-violet" />
                        <div className="min-w-0 flex-1">
                          <input
                            autoFocus
                            className={input}
                            placeholder="Custom subtask name…"
                            value={sug.name}
                            onChange={(e) => rename(sug.id, e.target.value)}
                          />
                          <RowControls sug={sug} onPatch={patch} />
                          <span className="mt-1 block text-xs text-muted">custom — not from a spec</span>
                        </div>
                        <button
                          aria-label="Remove custom subtask"
                          className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                          onClick={() => remove(sug.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ),
                  )
                )}
              </div>

              {analysis.existing.length > 0 && (
                <div className={card}>
                  <div className="border-b border-line px-5 py-3.5">
                    <h3 className="text-sm font-semibold text-success-bright">
                      ✓ Already covered <span className="text-muted">({analysis.existing.length})</span>
                    </h3>
                  </div>
                  {analysis.existing.map((p) => (
                    <div key={p.id} className="truncate border-b border-line px-5 py-2.5 text-[13px] text-muted last:border-b-0" title={p.title}>
                      {p.title}
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
                  disabled={creating || !validRows.length || !subtaskType}
                  onClick={create}
                  title={
                    subtaskType === null
                      ? 'No sub-task issue type available in this project'
                      : undefined
                  }
                  className="rounded-full border border-accent bg-accent px-7 py-3 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating
                    ? 'Creating…'
                    : `Create ${validRows.length} subtask${validRows.length === 1 ? '' : 's'} on ${story.key}`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
