import { useEffect, useState } from 'react'
import { fetchRemoteLinks, fetchDescriptionsForKeys } from '../../services/jiraApi.js'
import { extractAdfLinks, bestSpecLink } from './specMatch.js'

// parentKey -> [{url, title?}] — cached for the whole session so switching
// between My Tasks and Team Task doesn't refetch.
const parentLinksCache = new Map()

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
