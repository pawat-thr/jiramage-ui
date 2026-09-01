import StatusBadge from '../../components/common/StatusBadge.jsx'
import { browseUrl } from '../../services/jiraApi.js'
import { shortName, groupByType } from '../../utils/format.js'
import { typeColor } from '../../utils/typeColors.js'
import { card, emptyState, miniBtn, th, td } from '../../utils/ui.js'

const PRIORITY_CLASSES = {
  Highest: 'text-coral font-medium',
  High: 'text-coral',
  Medium: 'text-amber',
  Low: 'text-blue',
  Lowest: 'text-blue',
}

export default function IssueTable({ issues, showAssignee, onTransition, onReassign }) {
  if (!issues.length) {
    return (
      <div className={card}>
        <div className={emptyState}>No issues match the current filters.</div>
      </div>
    )
  }

  const groups = groupByType(issues)

  return (
    <div className={card}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Key</th>
            <th className={th}>Summary</th>
            <th className={th}>Status</th>
            <th className={th}>{showAssignee ? 'Assignee' : 'Priority'}</th>
            <th className={th} aria-label="actions" />
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.name}>
            <tr className="bg-bg/40">
              <td colSpan={5} className="border-b border-line px-4 py-2">
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
                  </div>
                )}
              </td>
              <td className={td}>
                <StatusBadge status={iss.fields.status} />
              </td>
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
                <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
    </div>
  )
}
