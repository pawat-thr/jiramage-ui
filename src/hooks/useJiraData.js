import { useCallback, useEffect, useState } from 'react'
import { CFG } from '../config/appConfig.js'
import { fetchMyIssues, fetchTeamIssues } from '../services/jiraApi.js'

// Owns the two datasets: my issues load eagerly, team issues lazily on first
// visit, and everything already loaded auto-refreshes on CFG.refreshMs.
export function useJiraData(tab, onError) {
  const [myIssues, setMyIssues] = useState(null)
  const [teamIssues, setTeamIssues] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadMy = useCallback(
    () =>
      fetchMyIssues()
        .then((issues) => {
          setMyIssues(issues)
          setUpdatedAt(new Date())
          return true
        })
        .catch((err) => {
          onError(err)
          return false
        }),
    [onError],
  )

  const loadTeam = useCallback(
    () =>
      fetchTeamIssues()
        .then((issues) => {
          setTeamIssues(issues)
          setUpdatedAt(new Date())
          return true
        })
        .catch((err) => {
          onError(err)
          return false
        }),
    [onError],
  )

  useEffect(() => {
    loadMy()
  }, [loadMy])

  useEffect(() => {
    if ((tab === 'team' || tab === 'dashboard') && teamIssues === null) loadTeam()
  }, [tab, teamIssues, loadTeam])

  useEffect(() => {
    const id = setInterval(() => {
      loadMy()
      if (teamIssues !== null) loadTeam()
    }, CFG.refreshMs)
    return () => clearInterval(id)
  }, [teamIssues, loadMy, loadTeam])

  // Manual refresh with UI feedback: resolves true only if every fetch worked.
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const jobs = tab === 'my' ? [loadMy()] : tab === 'team' ? [loadTeam()] : [loadMy(), loadTeam()]
      const results = await Promise.all(jobs)
      return results.every(Boolean)
    } finally {
      setRefreshing(false)
    }
  }, [tab, loadMy, loadTeam])

  const reloadIssueLists = useCallback(() => {
    loadMy()
    if (teamIssues !== null) loadTeam()
  }, [loadMy, loadTeam, teamIssues])

  return { myIssues, teamIssues, updatedAt, refreshing, refresh, reloadIssueLists }
}
