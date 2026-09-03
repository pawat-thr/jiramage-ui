import { useEffect, useState } from 'react'
import { fetchRemoteLinks, fetchDescriptionsForKeys } from '../../services/jiraApi.js'
import { extractAdfLinks, bestSpecLink } from './specMatch.js'

// parentKey -> [{url, title?}] — cached in memory for the session AND in
// localStorage for 24h, so reloads don't redo one remote-link request per
// parent story (the expensive part of spec matching).
const CACHE_KEY = 'jiramage-spec-links-v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_PARENTS = 400

const parentLinksCache = new Map()

function loadPersisted() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const fresh = Date.now() - CACHE_TTL_MS
    for (const [key, entry] of Object.entries(raw)) {
      if (entry.at > fresh) parentLinksCache.set(key, entry.links)
    }
  } catch {
    // corrupt cache → start clean
  }
}
loadPersisted()

function persist() {
  try {
    const entries = [...parentLinksCache.entries()].slice(-CACHE_MAX_PARENTS)
    const at = Date.now()
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(Object.fromEntries(entries.map(([k, links]) => [k, { links, at }]))),
    )
  } catch {
    // storage full/blocked — in-memory cache still works
  }
}

async function linksForParents(keys) {
  const missing = keys.filter((k) => !parentLinksCache.has(k))
  if (missing.length) {
    // Descriptions in bulk (smart links inside the story text)…
    const descIssues = await fetchDescriptionsForKeys(missing).catch(() => [])
    const descMap = Object.fromEntries(descIssues.map((i) => [i.key, i.fields?.description]))
    // …plus remote links ("mentioned on" Confluence pages), 5 at a time.
    for (let i = 0; i < missing.length; i += 5) {
      await Promise.all(
        missing.slice(i, i + 5).map(async (key) => {
          const links = extractAdfLinks(descMap[key])
          try {
            const remote = await fetchRemoteLinks(key)
            for (const r of remote || []) {
              if (r.object?.url) links.push({ url: r.object.url, title: r.object.title })
            }
          } catch {
            // remote links are optional — description links may still match
          }
          parentLinksCache.set(key, links)
        }),
      )
    }
    persist()
  }
  return Object.fromEntries(keys.map((k) => [k, parentLinksCache.get(k) || []]))
}

// For each subtask in `issues`, find a Confluence spec page mentioned on its
// parent story whose title matches the subtask name. → { [issueKey]: url }
export function useSpecLinks(issues) {
  const [specLinks, setSpecLinks] = useState({})

  useEffect(() => {
    const withParent = (issues || []).filter((i) => i.fields?.parent?.key)
    const parents = [...new Set(withParent.map((i) => i.fields.parent.key))]
    if (!parents.length) {
      setSpecLinks({})
      return
    }
    let on = true
    linksForParents(parents).then((byParent) => {
      if (!on) return
      const map = {}
      for (const iss of withParent) {
        const link = bestSpecLink(iss.fields.summary, byParent[iss.fields.parent.key])
        if (link) map[iss.key] = link
      }
      setSpecLinks(map)
    })
    return () => {
      on = false
    }
  }, [issues])

  return specLinks
}
