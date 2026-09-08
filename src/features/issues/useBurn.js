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
// `finished: true` in options enables the post-dev stat (extra changelog
// fetches — Team Task opts in; Dashboard only tracks live burn).
export function useBurn(issues, { finished = false } = {}) {
  const [burn, setBurn] = useState({})

  useEffect(() => {
    const wanted = (issues || []).filter((i) => {
      const name = i.fields.status?.name
      return isBurnStatus(name) || (finished && isFinishedStatus(name))
    })
    if (!wanted.length) {
      setBurn({})
      return
    }
    let on = true
    ;(async () => {
      const missing = wanted.filter((i) => !cache.has(`${i.key}|${i.fields.status.name}`))
      for (let b = 0; b < missing.length; b += 5) {
        await Promise.all(
          missing.slice(b, b + 5).map(async (i) => {
            try {
              const log = await fetchChangelog(i.key)
              cache.set(`${i.key}|${i.fields.status.name}`, burnIntervals(log))
            } catch {
              // leave uncached — retried next visit
            }
          }),
        )
      }
      persist()
      if (!on) return
      const map = {}
      for (const i of wanted) {
        const intervals = cache.get(`${i.key}|${i.fields.status.name}`)
        if (!intervals || !intervals.length) continue // never entered dev → nothing to show
        map[i.key] = {
          mandays: intervalMandays(intervals),
          points: Number(i.fields[CFG.pointField]) || null,
          finished: !isBurnStatus(i.fields.status.name),
        }
      }
      setBurn(map)
    })()
    return () => {
      on = false
    }
  }, [issues, finished])

  return burn
}
