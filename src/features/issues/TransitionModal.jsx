import { useEffect, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import Spinner from '../../components/common/Spinner.jsx'
import { fetchTransitions, doTransition } from '../../services/jiraApi.js'
import { emptyState } from '../../utils/ui.js'

const optionBtn =
  'w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-left text-sm text-ink-soft hover:border-accent hover:text-accent-bright'

export default function TransitionModal({ issue, onClose, onDone, onError }) {
  const [transitions, setTransitions] = useState(null)

  useEffect(() => {
    fetchTransitions(issue.key).then(setTransitions).catch(onError)
  }, [issue.key])

  const pick = async (t) => {
    try {
      await doTransition(issue.key, t.id)
      onDone(`${issue.key} moved to ${t.name}`)
    } catch (err) {
      onError(err)
    }
  }

  return (
    <ModalShell title={`Move ${issue.key}`} subtitle={issue.fields.summary} onClose={onClose}>
      {transitions === null ? (
        <Spinner label="" className="py-6" />
      ) : (
        <div className="grid max-h-[300px] gap-1.5 overflow-y-auto">
          {transitions.map((t) => (
            <button key={t.id} className={optionBtn} onClick={() => pick(t)}>
              {t.name}
            </button>
          ))}
          {!transitions.length && <div className={emptyState}>No transitions available.</div>}
        </div>
      )}
    </ModalShell>
  )
}
