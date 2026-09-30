// Non-secret app config injected at build time by vite.config.js from .env.
// The Jira API token never reaches the browser — it lives in the dev-server proxy.
export const CFG = __APP_CONFIG__

// The full team roster. TEAM_EMAILS is the master list and SHOULD include your
// own email; JIRA_EMAIL is the current user (deduped here, so old .env files
// without yourself in TEAM_EMAILS keep working). Deploy plan (next version):
// JIRA_EMAIL gets overwritten by whoever logs in — the roster must stand alone.
// Deduped case-insensitively (JIRA_EMAIL may differ in case/whitespace from
// the TEAM_EMAILS entry) but original casing is kept — issue matching
// elsewhere compares against Jira's emailAddress as-is.
export const teamMembers = () => {
  const seen = new Set()
  const out = []
  for (const e of [CFG.email, ...CFG.teamEmails]) {
    const t = (e || '').trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

export const APP_NAME = 'jiramage'
// From package.json via vite: full versions show clean ("v0.1.7"); pre-release
// versions carry the build hash ("v0.1.8-beta.1+a3f9c2d").
export const APP_VERSION = __APP_VERSION__
export const APP_CREDIT = 'by MpLab'
export const APP_COPYRIGHT = `© ${new Date().getFullYear()} MpLab`
