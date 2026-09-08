import { useEffect, useState } from 'react'
import { fetchChangelog } from '../../services/jiraApi.js'
import { burnIntervals, intervalMandays, isBurnStatus, isFinishedStatus } from './burn.js'
import { CFG } from '../../config/appConfig.js'

// issueKey|currentStatus -> burn intervals. Keyed per status, so any status
// change re-reads the changelog; while the status is unchanged the intervals
// can't change either (closed ones are history, the open one is recomputed
// against "now" at render). v2: interval semantics replaced the old start-only cache.
const cache = new Map()
const LS_KEY = 'jiramage-burn-intervals-v2'
try {
  localStorage.removeItem('jiramage-burn-start-v1') // old-format cache
  for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(LS_KEY) || '{}'))) {
    cache.set(k, v)
  }
} catch {
  // corrupt cache → refetch
}
const persist = () => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries([...cache].slice(-500))))
  } catch {
    // storage full — in-memory still fine
  }
}

// Burn data for the given issues:
//   in a burn status              → { mandays (live), points, finished: false }
//   in a finished status (opt-in) → { mandays (frozen), points, finished: true }
// `finished: true` enables the post-dev stat. Cost controls: finished stats
// only for SUBTASKS, at most FINISHED_FETCH_CAP uncached changelog fetches per
// view (newest first — the issue list arrives key-desc), and results render
// progressively per batch instead of after the whole sweep.
const FINISHED_FETCH_CAP = 150
export function useBurn(issues, { finished = false, statuses = CFG.burnStatuses, finishedStatuses = CFG.burnFinishedStatuses } = {}) {
  const [burn, setBurn] = useState({})

  useEffect(() => {
    const setKey = statuses.join('+')
    const wanted = (issues || []).filter((i) => {
      const name = i.fields.status?.name
      if (isBurnStatus(name, statuses)) return true
      // finished stats only for subtasks (bug/incident tickets aren't burn-tracked)
      return finished && isFinishedStatus(name, finishedStatuses) && !!i.fields.parent
    })
    if (!wanted.length) {
      setBurn({})
      return
    }
    let on = true
    const rebuild = () => {
      const map = {}
      for (const i of wanted) {
        const intervals = cache.get(`${i.key}|${i.fields.status.name}|${setKey}`)
        if (!intervals || !intervals.length) continue // never entered a burn status
        map[i.key] = {
          mandays: intervalMandays(intervals),
          points: Number(i.fields[CFG.pointField]) || null,
          finished: !isBurnStatus(i.fields.status.name, statuses),
        }
      }
      return map
    }
    ;(async () => {
      setBurn(rebuild()) // cached results show immediately
      const uncached = wanted.filter((i) => !cache.has(`${i.key}|${i.fields.status.name}|${setKey}`))
      // live-burn cards always fetch; finished ones are capped per view
      const live = uncached.filter((i) => isBurnStatus(i.fields.status.name, statuses))
      const done = uncached.filter((i) => !isBurnStatus(i.fields.status.name, statuses))
      const missing = [...live, ...done.slice(0, FINISHED_FETCH_CAP)]
      for (let b = 0; b < missing.length; b += 5) {
        await Promise.all(
          missing.slice(b, b + 5).map(async (i) => {
            try {
              const log = await fetchChangelog(i.key)
              cache.set(`${i.key}|${i.fields.status.name}|${setKey}`, burnIntervals(log, statuses))
            } catch {
              // leave uncached — retried next visit
            }
          }),
        )
        if (!on) return
        setBurn(rebuild()) // progressive: meters appear batch by batch
      }
      persist()
    })()
    return () => {
      on = false
    }
  }, [issues, finished, statuses, finishedStatuses])

  return burn
}
