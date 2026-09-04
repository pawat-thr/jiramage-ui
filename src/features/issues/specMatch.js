// Map a subtask name like "[BE][MP] mp-merchant/pre-order/orders/get-order-detail"
// to a Confluence spec page mentioned on its parent story, by matching the
// subtask's token sequence against each page title.

// Collect Confluence links out of an ADF document (smart links render as
// inlineCard nodes; plain links carry a `link` mark).
export function extractAdfLinks(adf, out = []) {
  if (!adf || typeof adf !== 'object') return out
  if (adf.type === 'inlineCard' && adf.attrs?.url) out.push({ url: adf.attrs.url })
  for (const mark of adf.marks || []) {
    if (mark.type === 'link' && mark.attrs?.href) out.push({ url: mark.attrs.href })
  }
  for (const child of adf.content || []) extractAdfLinks(child, out)
  return out
}

// "…/wiki/spaces/X/pages/123/R6.1+5+S12+POST+campaigns+v1+mp-merchant+…" → title text
export function titleFromUrl(url) {
  const m = /\/pages\/\d+\/([^/?#]+)/.exec(url || '')
  if (!m) return ''
  try {
    return decodeURIComponent(m[1]).replace(/\+/g, ' ')
  } catch {
    return m[1].replace(/\+/g, ' ')
  }
}

// Both Confluence URL forms: /wiki/spaces/X/pages/<id>/<slug> and the older
// /wiki/pages/viewpage.action?pageId=<id> (what Jira remote links use).
const isConfluence = (url) => /\/wiki\//.test(url || '')

// Lowercase alphanumeric tokens; "[BE][MP]" prefixes are dropped by the caller.
// CamelCase splits into words ("ValidatePreOrderCart" → validate pre order cart)
// so GRPC-style names compare the same as slash-style endpoint paths.
const tokenize = (s) =>
  (s || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

const stripPrefixes = (summary) => (summary || '').replace(/^(\s*\[[^\]]*\])+/g, '')

// Longest run of consecutive `needle` tokens appearing consecutively in `hay`.
function longestRun(needle, hay) {
  let best = 0
  for (let i = 0; i < hay.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      let k = 0
      while (j + k < needle.length && i + k < hay.length && needle[j + k] === hay[i + k]) k++
      if (k > best) best = k
    }
  }
  return best
}

// Pick the best-matching Confluence link for one subtask summary, or null.
// links: [{ url, title? }] — title falls back to the URL slug.
// Returns { url, title } so the UI can show the page name.
export function bestSpecLink(summary, links) {
  const needle = tokenize(stripPrefixes(summary))
  // Too short to match confidently ("[QA] Test case" → 2 tokens): skip.
  if (needle.length < 3) return null
  const minRun = Math.max(3, Math.ceil(needle.length * 0.7))

  let best = null
  let bestRun = 0
  for (const l of links || []) {
    if (!isConfluence(l.url)) continue
    const title = l.title || titleFromUrl(l.url)
    const run = longestRun(needle, tokenize(title))
    if (run >= minRun && run > bestRun) {
      best = { url: l.url, title }
      bestRun = run
    }
  }
  return best
}


// Reverse direction (Subtask Gen): which spec pages are already covered by an
// existing subtask? Each subtask claims its single BEST-scoring page, so
// sibling endpoints (get-order-detail vs list-orders) can't shadow each other.
export function claimedSpecUrls(subtaskSummaries, links) {
  const claimed = new Set()
  for (const summary of subtaskSummaries || []) {
    const best = bestSpecLink(summary, links)
    if (best) claimed.add(best.url)
  }
  return claimed
}

// Bracket prefixes stripped from a page title → the raw spec name
// ("[R6.1#5][S12] GRPC Foo" → "GRPC Foo").
export const stripBrackets = (s) => (s || '').replace(/^(\s*\[[^\]]*\])+\s*/g, '').trim()
