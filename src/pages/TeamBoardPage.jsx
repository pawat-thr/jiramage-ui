import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Spinner from '../components/common/Spinner.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import TaskForm from '../features/board/TaskForm.jsx'
import LabelForm from '../features/board/LabelForm.jsx'
import TaskDetail from '../features/board/TaskDetail.jsx'
import { TaskStatusBadge } from '../features/board/boardConstants.jsx'
import { avatarColor, initials } from '../features/pr/prConstants.js'
import {
  watchLabels,
  watchTasks,
  createLabel,
  renameLabel,
  deleteLabel,
  createTask,
  updateTask,
  deleteTask,
} from '../services/teamBoardApi.js'
import { firebaseEnabled } from '../services/firebase.js'
import { emailUsername, todayLocalISO } from '../utils/format.js'
import { card, chip, cx, toolbar, emptyState } from '../utils/ui.js'

export default function TeamBoardPage({ user, onNotify }) {
  const [labels, setLabels] = useState(null)
  const [tasks, setTasks] = useState(null)
  // Detail view is URL-driven: /team-board/<id>
  const location = useLocation()
  const navigate = useNavigate()
  const selectedId = location.pathname.startsWith('/team-board/')
    ? location.pathname.slice('/team-board/'.length)
    : null
  const [taskForm, setTaskForm] = useState(null) // null | { task } (task undefined = create)
  const [labelForm, setLabelForm] = useState(false)
  const [confirmTask, setConfirmTask] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!firebaseEnabled || !user) return
    const un1 = watchLabels(setLabels, (err) => {
      onNotify(err.message, true)
      setLabels([])
    })
    const un2 = watchTasks(setTasks, (err) => {
      onNotify(err.message, true)
      setTasks([])
    })
    return () => {
      un1()
      un2()
    }
  }, [user])

  // If the open task disappears (deleted elsewhere), fall back to the board.
  useEffect(() => {
    if (selectedId && tasks && !tasks.some((t) => t.id === selectedId))
      navigate('/team-board', { replace: true })
  }, [selectedId, tasks, navigate])

  // Group tasks by label, groups sorted by label name.
  const groups = useMemo(() => {
    const byLabel = new Map()
    for (const t of tasks || []) {
      const key = t.label || '(no label)'
      if (!byLabel.has(key)) byLabel.set(key, [])
      byLabel.get(key).push(t)
    }
    return [...byLabel.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tasks])

  const selected = selectedId ? (tasks || []).find((t) => t.id === selectedId) : null

  if (!firebaseEnabled || !user) {
    return (
      <div className={card}>
        <div className={emptyState}>Sign in with your team account to use the Team Board.</div>
      </div>
    )
  }

  const submitTask = async (data) => {
    if (taskForm?.task) {
      await updateTask(taskForm.task.id, data)
      onNotify('✓ Task updated')
    } else {
      await createTask({ ...data, authorEmail: user.email, authorName: user.name })
      onNotify('✓ Task created')
    }
    setTaskForm(null)
  }

  const handleCreateLabel = async (name) => {
    await createLabel({ name, authorEmail: user.email })
    onNotify(`✓ Label “${name}” created`)
  }

  const handleRenameLabel = async (labelObj, newName) => {
    const ids = (tasks || []).filter((t) => t.label === labelObj.name).map((t) => t.id)
    await renameLabel(labelObj.id, newName, ids)
    onNotify(`✓ Label renamed to “${newName}” (${ids.length} task${ids.length === 1 ? '' : 's'} updated)`)
  }

  const handleDeleteLabel = async (labelObj) => {
    await deleteLabel(labelObj.id)
    onNotify(`✓ Label “${labelObj.name}” deleted`)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteTask(confirmTask.id)
      onNotify('✓ Task deleted')
      setConfirmTask(null)
      navigate('/team-board')
    } catch (err) {
      onNotify(err.message, true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {selected ? (
        <div key={selected.id} className="animate-enter">
          <TaskDetail
            task={selected}
            user={user}
            onBack={() => navigate('/team-board')}
            onEdit={() => setTaskForm({ task: selected })}
            onDelete={() => setConfirmTask(selected)}
            onNotify={onNotify}
          />
        </div>
      ) : (
        <div key="board" className="animate-enter">
          <div className={toolbar}>
            <span className="text-[13px] text-muted">
              {(tasks || []).length} task{(tasks || []).length === 1 ? '' : 's'} · grouped by label
            </span>
            <span className="flex-1" />
            <button className={chip} onClick={() => setLabelForm(true)}>
              + New Label
            </button>
            <button
              className={cx(chip, 'border-accent! bg-accent-soft! text-accent-bright!')}
              onClick={() => setTaskForm({})}
            >
              + New Task
            </button>
          </div>

          {tasks === null || labels === null ? (
            <Spinner label="Loading board…" />
          ) : groups.length === 0 ? (
            <div className={card}>
              <div className={emptyState}>
                No tasks yet — create a label, then add your first task.
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              {groups.map(([labelName, items]) => (
                <section key={labelName}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: avatarColor(labelName) }} />
                    <h2 className="text-sm font-semibold">{labelName}</h2>
                    <span className="text-xs text-muted tabular-nums">{items.length}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => navigate(`/team-board/${t.id}`)}
                        className={`${card} p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cx('text-[13px] font-semibold', t.refOn ? 'text-accent-bright' : 'text-muted')}>
                            {t.refOn ? t.refKey : 'INTERNAL'}
                          </span>
                          <TaskStatusBadge status={t.status} />
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-ink" title={t.refOn ? t.refSummary : t.name}>
                          {t.refOn ? t.refSummary : t.name}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="flex -space-x-1.5">
                            {(t.users || []).map((email) => (
                              <span
                                key={email}
                                title={emailUsername(email)}
                                className="grid size-6 place-items-center rounded-full border-2 border-panel text-[10px] font-bold text-bg"
                                style={{ background: avatarColor(email) }}
                              >
                                {initials(emailUsername(email))}
                              </span>
                            ))}
                            {!(t.users || []).length && <span className="text-xs text-muted">no users</span>}
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            ENV {t.env}
                            {t.sprintStart ? ` · ${t.sprintStart}` : ''}
                            {t.targetDate && (
                              <span
                                className={
                                  t.status !== 'done' && t.targetDate < todayLocalISO()
                                    ? 'font-semibold text-danger'
                                    : undefined
                                }
                              >
                                {' · ⇥ '}
                                {t.targetDate}
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {taskForm && (
        <TaskForm task={taskForm.task} labels={labels || []} onClose={() => setTaskForm(null)} onSubmit={submitTask} />
      )}
      {labelForm && (
        <LabelForm
          labels={labels || []}
          tasks={tasks || []}
          onClose={() => setLabelForm(false)}
          onCreate={handleCreateLabel}
          onRename={handleRenameLabel}
          onDelete={handleDeleteLabel}
        />
      )}
      {confirmTask && (
        <ConfirmDialog
          title="Delete this task?"
          message={`“${confirmTask.refOn ? confirmTask.refKey : confirmTask.name}” will be permanently removed.`}
          busy={deleting}
          onClose={() => setConfirmTask(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
