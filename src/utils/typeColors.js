// Colors for work types: well-known Jira types get canonical hues (so Epic is
// always violet, Bug always coral, everywhere in the app); unknown types get a
// stable hash-assigned hue from the same validated palette.
const PALETTE = [
  { fg: '#a78bfa', soft: '#251d3d' }, // violet
  { fg: '#6cb0f0', soft: '#14293d' }, // blue
  { fg: '#3fb98a', soft: '#163329' }, // mint
  { fg: '#e6b856', soft: '#3a3320' }, // amber
  { fg: '#ff8a7a', soft: '#3a2622' }, // coral
  { fg: '#8494ab', soft: '#232c39' }, // slate
]

const CANONICAL = {
  epic: 0,
  story: 1,
  task: 2,
  incident: 3,
  bug: 4,
  bugsit: 4,
  'sub-task': 5,
  subtask: 5,
}

export function typeColor(name) {
  const key = (name || '').toLowerCase()
  if (key in CANONICAL) return PALETTE[CANONICAL[key]]
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
