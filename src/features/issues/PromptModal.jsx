import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { buildPrompt } from '../../services/settingsApi.js'

// "Gen prompt" popup: the team's template with {link} replaced by the card's
// spec URL, ready to copy into an AI assistant.
export default function PromptModal({ template, url, onClose }) {
  const [copied, setCopied] = useState(false)
  const prompt = buildPrompt(template, url)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard blocked — the text is selectable, user can copy manually
    }
  }

  return (
    <ModalShell
      title="⚡ Dev Prompt"
      subtitle="Generated from the team template — paste it into your AI assistant."
      onClose={onClose}
      wide
      hideFooter
    >
      <div className="grid gap-4">
        {/* which spec this prompt points at */}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-2 rounded-xl border border-blue/40 bg-blue-soft px-3.5 py-2 text-[13px] text-blue hover:underline"
          title={url}
        >
          <span className="shrink-0 font-semibold">Spec</span>
          <span className="min-w-0 flex-1 truncate">{url}</span>
          <span aria-hidden className="shrink-0 text-xs opacity-70">↗</span>
        </a>

        {/* the prompt itself — grows with content, scrolls when very long */}
        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line bg-field px-4 py-3.5 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-ink select-all">
          {prompt}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4 max-sm:grid max-sm:grid-cols-2">
          <button
            className="rounded-full border border-line bg-panel px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            onClick={onClose}
          >
            Close
          </button>
          <button
            onClick={copy}
            className={`rounded-full border px-6 py-2.5 text-sm font-semibold transition-colors ${
              copied
                ? 'border-success bg-success-soft text-success-bright'
                : 'border-accent bg-accent-soft text-accent-bright hover:bg-accent hover:text-bg'
            }`}
          >
            {copied ? '✓ Copied to clipboard' : 'Copy prompt'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
