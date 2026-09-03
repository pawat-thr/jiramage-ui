import { CFG } from '../../config/appConfig.js'

// Names of the Release(s) tagged on a story (the CFG.releaseField custom
// field — a single option or an array of options).
export function releaseNames(iss) {
  const f = iss.fields[CFG.releaseField]
  if (!f) return []
  if (Array.isArray(f)) return f.map((v) => v.value || v.name).filter(Boolean)
  return f.value ? [f.value] : f.name ? [f.name] : []
}
