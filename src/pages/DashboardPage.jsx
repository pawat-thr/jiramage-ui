import { useMemo } from 'react'
import RefreshButton from '../components/common/RefreshButton.jsx'
import Spinner from '../components/common/Spinner.jsx'
import StatTiles from '../features/dashboard/StatTiles.jsx'
import TeamChart from '../features/dashboard/TeamChart.jsx'
import StatusBreakdown from '../features/dashboard/StatusBreakdown.jsx'
import TypeBreakdown from '../features/dashboard/TypeBreakdown.jsx'
import SubtaskPoints from '../features/dashboard/SubtaskPoints.jsx'
import { memberStats, statusStats, typeStats, summaryStats, activeSubtaskPoints } from '../features/dashboard/aggregate.js'
import { chip, toolbar } from '../utils/ui.js'

export default function DashboardPage({ teamIssues, myIssues, onRefresh, refreshing, onPickMember }) {
  const members = useMemo(() => memberStats(teamIssues || []), [teamIssues])
  const statuses = useMemo(() => statusStats(teamIssues || []), [teamIssues])
  const types = useMemo(() => typeStats(teamIssues || []), [teamIssues])
  const subtaskRows = useMemo(() => activeSubtaskPoints(teamIssues || []), [teamIssues])
  const tiles = useMemo(() => summaryStats(teamIssues, myIssues), [teamIssues, myIssues])

  if (teamIssues === null) return <Spinner />

  return (
    <div className="grid gap-4">
      <div className={toolbar + ' mb-0'}>
        <span className="text-[13px] text-muted">
          Team overview · click a member to open their tasks
        </span>
        <span className="flex-1" />
        <RefreshButton refreshing={refreshing} onClick={onRefresh} />
      </div>

      <StatTiles stats={tiles} />

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="grid content-start gap-4">
          <TeamChart rows={members} onPickMember={onPickMember} />
          <SubtaskPoints rows={subtaskRows} />
        </div>
        <div className="grid content-start gap-4">
          <TypeBreakdown rows={types} />
          <StatusBreakdown rows={statuses} />
        </div>
      </div>
    </div>
  )
}
