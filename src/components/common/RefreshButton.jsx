import { cx, chip } from '../../utils/ui.js'

export default function RefreshButton({ refreshing, onClick }) {
  return (
    <button
      className={cx(chip, 'flex items-center gap-1.5', refreshing && 'cursor-wait opacity-70')}
      disabled={refreshing}
      onClick={onClick}
    >
      <span className={cx('inline-block', refreshing && 'animate-spin')}>↻</span>
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}
