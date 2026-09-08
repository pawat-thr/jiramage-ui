import { useEffect, useState } from 'react'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import PromptModal from './PromptModal.jsx'
import { browseUrl } from '../../services/jiraApi.js'
import { watchPromptTemplate, DEFAULT_PROMPT_TEMPLATE } from '../../services/settingsApi.js'
import { shortName, groupByType } from '../../utils/format.js'
import { CFG } from '../../config/appConfig.js'
import { typeColor } from '../../utils/typeColors.js'
import { card, emptyState, miniBtn, th, td } from '../../utils/ui.js'

function SpecIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 4a2 2 0 0 1 2-2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M13 2v6h6M9 13h6M9 17h4" />
    </svg>
  )
}

// Compact burn meter (Jira time-tracking style): bar fills burned/estimate,
// blue while on track, amber when ≥75% of the estimate, red when over.
function BurnMeter({ mandays, points }) {
  const burned = mandays * 8 // 1 manday = 8 points
  if (!points)
    return (
      <div
        className="text-[11px] whitespace-nowrap text-amber tabular-nums"
        title={`${mandays.toFixed(1)} manday(s) in dev (Mon–Fri 9:30–18:30) — no estimate to compare, add points in Jira`}
      >
        {burned.toFixed(1)} pt · no estimate
      </div>
    )
  const ratio = burned / points
  const color =
    ratio > 1 ? 'var(--color-danger)' : ratio >= 0.75 ? 'var(--color-amber)' : 'var(--color-blue)'
  return (
    <div
      className="mt-1.5 w-[104px]"
      title={`In dev ${mandays.toFixed(1)} manday(s) (Mon–Fri 9:30–18:30, 1d = 8pt): ${burned.toFixed(1)} of ${points} estimated points${ratio > 1 ? ' — OVER estimate' : ''}`}
    >
      <div className="flex items-baseline justify-between text-[11px] tabular-nums">
        <span className="font-semibold" style={{ color }}>
          {burned.toFixed(1)}
        </span>
        <span className="text-muted">/ {points} pt</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-field">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, background: color }}
        />
      </div>
    </div>
  )
}

const PRIORITY_CLASSES = {
  Highest: 'text-coral font-medium',
  High: 'text-coral',
  Medium: 'text-amber',
  Low: 'text-blue',
  Lowest: 'text-blue',
}

export default function IssueTable({ issues, showAssignee, onTransition, onReassign, specLinks = {}, burn = null }) {
  const showBurn = burn !== null
  const cols = showBurn ? 6 : 5
  // Default template as fallback: if the Firestore watch fails (e.g. rules not
  // republished yet) the ⚡ Prompt popup still generates a usable prompt.
  const [template, setTemplate] = useState(DEFAULT_PROMPT_TEMPLATE)
  const [promptUrl, setPromptUrl] = useState(null) // spec url for the open popup
  useEffect(() => watchPromptTemplate(setTemplate), [])

  if (!issues.length) {
    return (
      <div className={card}>
        <div className={emptyState}>No issues match the current filters.</div>
      </div>
    )
  }

  const groups = groupByType(issues)

  return (
    // overflow-x-auto: on narrow screens the table scrolls sideways instead of
    // clipping the Status/Priority/actions columns.
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            <th className={th}>Key</th>
            <th className={th}>Summary</th>
            <th className={th}>Status</th>
            {showBurn && <th className={th}>Burn</th>}
            <th className={th}>{showAssignee ? 'Assignee' : 'Priority'}</th>
            <th className={th} aria-label="actions" />
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.name}>
            <tr className="bg-bg/40">
              <td colSpan={cols} className="border-b border-line px-4 py-2">
                <span
                  className="inline-block rounded-full border px-2.5 py-[2px] text-[11px] font-semibold tracking-[0.05em] uppercase"
                  style={{
                    color: typeColor(group.name).fg,
                    background: typeColor(group.name).fg + '1f',
                    borderColor: typeColor(group.name).fg + '55',
                  }}
                >
                  {group.name}
                </span>
                <span className="ml-2 text-xs text-muted tabular-nums">{group.issues.length}</span>
              </td>
            </tr>
            {group.issues.map((iss) => (
            <tr
              key={iss.key}
              className="group transition-colors last:*:border-b-0 hover:bg-panel-soft"
            >
              <td className={td}>
                <a
                  className="font-semibold whitespace-nowrap text-accent-bright hover:underline"
                  href={browseUrl(iss.key)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {iss.key}
                </a>
              </td>
              <td className={td}>
                <div
                  className="max-w-[480px] truncate text-ink max-md:max-w-[200px]"
                  title={iss.fields.summary}
                >
                  {iss.fields.summary}
                </div>
                {iss.fields.parent && (
                  <div className="mt-0.5 flex max-w-[480px] items-center gap-1.5 text-xs text-muted max-md:max-w-[200px]">
                    <span className="shrink-0">↳</span>
                    <a
                      className="shrink-0 font-medium text-violet hover:underline"
                      href={browseUrl(iss.fields.parent.key)}
                      target="_blank"
                      rel="noreferrer"
                      title="Parent story"
                    >
                      {iss.fields.parent.key}
                    </a>
                    <span className="truncate" title={iss.fields.parent.fields?.summary}>
                      {iss.fields.parent.fields?.summary}
                    </span>
                    {specLinks[iss.key] && (
                      <a
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue/40 bg-blue-soft px-2 py-[2px] text-[11px] font-medium text-blue transition-colors hover:border-blue hover:bg-blue hover:text-bg"
                        href={specLinks[iss.key].url}
                        target="_blank"
                        rel="noreferrer"
                        title={`Spec: ${specLinks[iss.key].title}`}
                      >
                        <SpecIcon />
                        Spec
                        <span aria-hidden className="text-[10px] opacity-70">↗</span>
                      </a>
                    )}
                    {specLinks[iss.key] && (
                      <button
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet/40 bg-violet-soft px-2 py-[2px] text-[11px] font-medium text-violet transition-colors hover:border-violet hover:bg-violet hover:text-bg"
                        onClick={() => setPromptUrl(specLinks[iss.key].url)}
                        title="Generate a dev prompt from the team template with this spec link"
                      >
                        ⚡ Prompt
                      </button>
                    )}
                  </div>
                )}
              </td>
              <td className={td}>
                <StatusBadge status={iss.fields.status} />
              </td>
              {showBurn && (
                <td className={td}>
                  {burn[iss.key] ? (
                    <BurnMeter mandays={burn[iss.key].mandays} points={burn[iss.key].points} />
                  ) : iss.fields.parent && !Number(iss.fields[CFG.pointField]) ? (
                    <span
                      className="inline-block rounded-full border border-amber/40 bg-amber-soft px-2 py-[2px] text-[11px] font-medium whitespace-nowrap text-amber"
                      title="This subtask has no story-point estimate — add points in Jira so burn can be tracked"
                    >
                      no estimate
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              )}
              <td className={`${td} text-[13px] whitespace-nowrap`}>
                {showAssignee ? (
                  <span className="text-muted">
                    {iss.fields.assignee
                      ? shortName(iss.fields.assignee.displayName)
                      : 'Unassigned'}
                  </span>
                ) : (
                  <span className={PRIORITY_CLASSES[iss.fields.priority?.name] || 'text-muted'}>
                    {iss.fields.priority?.name || '—'}
                  </span>
                )}
              </td>
              <td className={td}>
                {/* hover-reveal on desktop; always visible on touch screens */}
                <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
                  <button className={miniBtn} onClick={() => onTransition(iss)}>
                    move
                  </button>
                  <button className={miniBtn} onClick={() => onReassign(iss)}>
                    assign
                  </button>
                </div>
              </td>
            </tr>
            ))}
          </tbody>
        ))}
      </table>
      {promptUrl && (
        <PromptModal template={template} url={promptUrl} onClose={() => setPromptUrl(null)} />
      )}
    </div>
  )
}
