import { TASK_STATUSES, taskStatusMeta } from './boardConstants.jsx'
import StoryDetail from '../story/StoryDetail.jsx'
import { setTaskStatus } from '../../services/teamBoardApi.js'
import { avatarColor, initials, fmtTime } from '../pr/prConstants.js'
import { emailUsername } from '../../utils/format.js'
import { cx, card } from '../../utils/ui.js'

function Meta({ label, children }) {
  return (
    <div>
      <span className="block text-xs text-muted">{label}</span>
      <span className="mt-0.5 block text-sm text-ink">{children || '—'}</span>
    </div>
  )
}

export default function TaskDetail({ task, user, onBack, onEdit, onDelete, onNotify }) {
  const isOwner = task.authorEmail === user.email

  const changeStatus = async (id) => {
    try {
      await setTaskStatus(task.id, id)
    } catch (err) {
      onNotify(err.message, true)
    }
  }

  const title = task.refOn ? task.refSummary : task.name

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink" onClick={onBack}>
          ← Team Board
        </button>
        <span className="flex-1" />
        {isOwner && (
          <>
            <button className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-accent hover:text-accent-bright" onClick={onEdit}>
              Edit
            </button>
            <button className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-danger hover:text-danger" onClick={onDelete}>
              Delete
            </button>
          </>
        )}
      </div>

      <div
        className={`${card} p-5 pl-6`}
        style={{ borderLeftColor: taskStatusMeta(task.status).color, borderLeftWidth: '4px' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[13px] font-semibold text-accent-bright">
              {task.refOn ? task.refKey : 'INTERNAL'}
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Meta label="Label">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: avatarColor(task.label) }} />
              {task.label}
            </span>
          </Meta>
          <Meta label="Env">ENV {task.env}</Meta>
          <Meta label="Sprint start">{task.sprintStart || '—'}</Meta>
          <Meta label="Owner">{emailUsername(task.authorEmail || '')}</Meta>
          <Meta label="Users">
            {task.users?.length ? (
              <span className="flex flex-wrap gap-1.5">
                {task.users.map((email) => (
                  <span key={email} className="flex items-center gap-1.5 rounded-full border border-line bg-field py-0.5 pr-2.5 pl-1 text-[13px] text-ink-soft">
                    <span className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-bg" style={{ background: avatarColor(email) }}>
                      {initials(emailUsername(email))}
                    </span>
                    {emailUsername(email)}
                  </span>
                ))}
              </span>
            ) : (
              'Nobody yet'
            )}
          </Meta>
          <Meta label="Created">{fmtTime(task.createdAt)}</Meta>
          <Meta label="Updated">{fmtTime(task.updatedAt)}</Meta>
        </div>

        {task.detail && (
          <div className="mt-4">
            <span className="text-xs text-muted">Detail</span>
            <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{task.detail}</p>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <span className="text-xs text-muted">Set status</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {TASK_STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => changeStatus(s.id)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  task.status === s.id ? s.cls : 'border-line bg-panel text-ink-soft hover:border-line-strong',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {task.refOn && task.refKey && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted">Ref card · {task.refKey}</h3>
          <StoryDetail storyKey={task.refKey} hideBack />
        </div>
      )}
    </div>
  )
}
