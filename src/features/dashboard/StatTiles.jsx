export default function StatTiles({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="relative overflow-hidden rounded-[18px] border border-line bg-panel p-4"
        >
          <span
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: s.color, opacity: 0.85 }}
          />
          <span className="block text-xs text-muted">{s.label}</span>
          <span
            className="mt-1 block text-[28px] font-bold tracking-tight tabular-nums"
            style={{ color: s.color }}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}
