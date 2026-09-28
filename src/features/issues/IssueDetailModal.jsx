import { useEffect, useState } from 'react'
import StoryDetail from '../story/StoryDetail.jsx'

// Full issue detail (the same page as the story view) in an overlay — used
// everywhere a subtask row can be clicked, so people never leave the page
// they're working on. Clicking the parent story or a sibling subtask inside
// navigates within the modal; ← Back walks the trail.
export default function IssueDetailModal({ issueKey, onClose }) {
  const [stack, setStack] = useState([issueKey])
  const current = stack[stack.length - 1]

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="zoom-normal fixed inset-0 z-50 animate-fade overflow-y-auto bg-backdrop p-4 md:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="mx-auto w-full max-w-4xl animate-pop rounded-[18px] border border-line bg-bg p-4 shadow-lift md:p-5"
        role="dialog"
        aria-label={`${current} details`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          {stack.length > 1 ? (
            <button
              className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink"
              onClick={() => setStack((s) => s.slice(0, -1))}
            >
              ← {stack[stack.length - 2]}
            </button>
          ) : (
            <span />
          )}
          <button
            className="rounded-full border border-line bg-panel px-4 py-1.5 text-[13px] text-ink-soft hover:border-line-strong hover:text-ink"
            onClick={onClose}
          >
            ✕ Close (Esc)
          </button>
        </div>
        <StoryDetail
          key={current}
          storyKey={current}
          hideBack
          onOpenIssue={(k) => setStack((s) => (s[s.length - 1] === k ? s : [...s, k]))}
        />
      </div>
    </div>
  )
}
