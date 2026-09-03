import { useCallback, useEffect, useState } from 'react'
import { CFG } from '../config/appConfig.js'
import { fetchMyIssues, fetchTeamIssues, fetchStories } from '../services/jiraApi.js'

// Owns the Jira datasets: my issues load eagerly; team & stories lazily on first
// visit; everything already loaded auto-refreshes on CFG.refreshMs.
export function useJiraData(tab, onError) {
  const [myIssues, setMyIssues] = useState(null)
  const [teamIssues, setTeamIssues] = useState(null)
  const [storyIssues, setStoryIssues] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = (fetcher, setter) =>
    fetcher()
      .then((issues) => {
        setter(issues)
        setUpdatedAt(new Date())
        return true
      })
      .catch((err) => {
        onError(err)
        return false
      })

  const loadMy = useCallback(() => load(fetchMyIssues, setMyIssues), [onError])
  const loadTeam = useCallback(() => load(fetchTeamIssues, setTeamIssues), [onError])
  const loadStories = useCallback(() => load(fetchStories, setStoryIssues), [onError])

  useEffect(() => {
    loadMy()
  }, [loadMy])

  useEffect(() => {
    if ((tab === 'team' || tab === 'dashboard') && teamIssues === null) loadTeam()
    if (tab === 'delivery' && storyIssues === null) loadStories()
  }, [tab, teamIssues, storyIssues, loadTeam, loadStories])

  useEffect(() => {
    const id = setInterval(() => {
      loadMy()
      if (teamIssues !== null) loadTeam()
      if (storyIssues !== null) loadStories()
    }, CFG.refreshMs)
    return () => clearInterval(id)
  }, [teamIssues, storyIssues, loadMy, loadTeam, loadStories])

  // Manual refresh with UI feedback: resolves true only if every fetch worked.
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const jobs =
        tab === 'my'
          ? [loadMy()]
          : tab === 'team'
            ? [loadTeam()]
            : tab === 'delivery'
              ? [loadStories()]
              : [loadMy(), loadTeam()]
      const results = await Promise.all(jobs)
      return results.every(Boolean)
    } finally {
      setRefreshing(false)
    }
  }, [tab, loadMy, loadTeam, loadStories])

  const reloadIssueLists = useCallback(() => {
    loadMy()
    if (teamIssues !== null) loadTeam()
  }, [loadMy, loadTeam, teamIssues])

  return { myIssues, teamIssues, storyIssues, updatedAt, refreshing, refresh, reloadIssueLists }
}
