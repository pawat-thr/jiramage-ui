export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div
      className={`zoom-normal fixed right-6 bottom-6 z-60 animate-rise rounded-xl border px-[18px] py-3 text-sm shadow-lift ${
        toast.error
          ? 'border-danger bg-danger-soft text-danger'
          : 'border-success bg-success-soft text-success-bright'
      }`}
    >
      {toast.text}
    </div>
  )
}
