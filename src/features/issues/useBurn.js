import { useEffect, useState } from 'react'
import { fetchChangelog } from '../../services/jiraApi.js'
import { firstBurnStart, isBurnStatus, workingMandays } from './burn.js'
import { CFG } from '../../config/appConfig.js'

// issueKey|status -> dev-start ISO (or '' when no transition found). The first
// entry into a burn status never changes, so this caches hard (per status, so
// re-entering a status after Done→reopen re-resolves).
const startCache = new Map()
const LS_KEY = 'jiramage-burn-start-v1'
try {
  for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(LS_KEY) || '{}'))) {
    startCache.set(k, v)
  }
} catch {
  // corrupt cache → refetch
}
const persist = () => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries([...startCache].slice(-500))))
  } catch {
    // storage full — in-memory still fine
  }
}

// For issues currently in a burn status: { [key]: { mandays, points } }
export function useBurn(issues) {
  const [burn, setBurn] = useState({})

  useEffect(() => {
    const targets = (issues || []).filter((i) => isBurnStatus(i.fields.status?.name))
    if (!targets.length) {
      setBurn({})
      return
    }
    let on = true
    ;(async () => {
      const missing = targets.filter(
        (i) => !startCache.has(`${i.key}|${i.fields.status.name}`),
      )
      for (let b = 0; b < missing.length; b += 5) {
        await Promise.all(
          missing.slice(b, b + 5).map(async (i) => {
            try {
              const log = await fetchChangelog(i.key)
              startCache.set(`${i.key}|${i.fields.status.name}`, firstBurnStart(log) || '')
            } catch {
              // leave uncached — retried next visit
            }
          }),
        )
      }
      persist()
      if (!on) return
      const map = {}
      for (const i of targets) {
        const start = startCache.get(`${i.key}|${i.fields.status.name}`)
        if (!start) continue
        map[i.key] = {
          mandays: workingMandays(start),
          points: Number(i.fields[CFG.pointField]) || null,
        }
      }
      setBurn(map)
    })()
    return () => {
      on = false
    }
  }, [issues])

  return burn
}
