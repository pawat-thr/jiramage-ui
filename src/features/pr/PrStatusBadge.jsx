import { statusMeta } from './prConstants.js'

export default function PrStatusBadge({ status }) {
  const s = statusMeta(status)
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-[3px] text-xs font-medium whitespace-nowrap ${s.cls}`}
    >
      {s.label}
    </span>
  )
}
