import { useMemo, useState } from 'react'
import FilterMenu from '../components/common/FilterMenu.jsx'
import RefreshButton from '../components/common/RefreshButton.jsx'
import Spinner from '../components/common/Spinner.jsx'
import IssueTable from '../features/issues/IssueTable.jsx'
import { filterIssues, uniqueSorted, typeName } from '../utils/format.js'
import { cx, chip, chipOn, searchInput, toolbar } from '../utils/ui.js'

export default function MyTasksPage({ issues, hideDone, onToggleHide, onRefresh, refreshing, onTransition, onReassign }) {
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')

  const visible = useMemo(
    () => filterIssues(issues, { hideDone, status, search, type }),
    [issues, hideDone, status, search, type],
  )
  const statusOptions = useMemo(
    () => uniqueSorted((issues || []).map((i) => i.fields.status.name)),
    [issues],
  )
  const typeOptions = useMemo(() => uniqueSorted((issues || []).map(typeName)), [issues])

  return (
    <>
      <div className={toolbar}>
        <input
          type="search"
          className={searchInput}
          placeholder="Search by key or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterMenu label="Type" value={type} options={typeOptions} onPick={setType} />
        <FilterMenu label="Status" value={status} options={statusOptions} onPick={setStatus} />
        <button className={cx(chip, hideDone && chipOn)} onClick={onToggleHide}>
          {hideDone ? 'Active only' : 'Showing all'}
        </button>
        <RefreshButton refreshing={refreshing} onClick={onRefresh} />
        <span className="flex-1" />
        <span className="text-[13px] text-muted">
          {visible.length} issue{visible.length === 1 ? '' : 's'}
        </span>
      </div>
      {issues === null ? (
        <Spinner />
      ) : (
        <IssueTable
          issues={visible}
          showAssignee={false}
          onTransition={onTransition}
          onReassign={onReassign}
        />
      )}
    </>
  )
}
