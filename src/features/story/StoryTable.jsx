import StatusBadge from '../../components/common/StatusBadge.jsx'
import { browseUrl } from '../../services/jiraApi.js'
import { CFG } from '../../config/appConfig.js'
import { shortName } from '../../utils/format.js'
import { card, emptyState, th, td } from '../../utils/ui.js'

// The Release field (CFG.releaseField) is usually a single option {value}, but
// handle array/{name} shapes too so it works across Jira configs.
export function releaseNames(iss) {
  const f = iss.fields[CFG.releaseField]
  if (!f) return []
  if (Array.isArray(f)) return f.map((v) => v.value || v.name).filter(Boolean)
  return f.value ? [f.value] : f.name ? [f.name] : []
}

export default function StoryTable({ stories, onOpen }) {
  if (!stories.length) {
    return (
      <div className={card}>
        <div className={emptyState}>No stories match the current filters.</div>
      </div>
    )
  }

  return (
    // overflow-x-auto: on narrow screens the table scrolls sideways instead of
    // clipping the Status column.
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th className={th}>Key</th>
            <th className={th}>Summary</th>
            <th className={th}>Status</th>
            <th className={th}>Release</th>
            <th className={th}>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {stories.map((iss) => (
            <tr key={iss.key} className="transition-colors last:*:border-b-0 hover:bg-panel-soft">
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
                <button
                  className="block max-w-[420px] cursor-pointer truncate text-left text-ink transition-colors hover:text-accent-bright hover:underline max-md:max-w-[180px]"
                  title={`${iss.fields.summary} — click for details`}
                  onClick={() => onOpen(iss.key)}
                >
                  {iss.fields.summary}
                </button>
              </td>
              <td className={td}>
                <StatusBadge status={iss.fields.status} />
              </td>
              <td className={td}>
                <div className="flex flex-wrap gap-1.5">
                  {releaseNames(iss).length ? (
                    releaseNames(iss).map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-violet/50 bg-violet-soft px-2.5 py-[2px] text-xs text-violet"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-muted">—</span>
                  )}
                </div>
              </td>
              <td className={`${td} text-[13px] whitespace-nowrap text-muted`}>
                {iss.fields.assignee ? shortName(iss.fields.assignee.displayName) : 'Unassigned'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
