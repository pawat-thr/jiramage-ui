# Org System + Atlassian SSO — THE key feature of v0.1.9

> Design document (agreed 2026-10-08). Nothing here is implemented yet.
> Status legend: ⬜ not started · 🔶 in progress · ✅ done
>
> **Scope split**: all four phases are BUILT AND DEMOED in v0.1.9, running
> locally — SSO via the dev server (vite middleware does /auth/* + the
> token-attaching proxy; client_secret stays in local .env), subdomains via
> `mp.localhost` / `aoa.localhost` (browsers resolve *.localhost to
> 127.0.0.1, no DNS needed). v0.2.0 then only moves the SAME code to real
> hosting: wildcard DNS + TLS, the standalone server, production secrets.

## The goal

Deploy jiramage for real, with:

- **No Jira API token in .env** — users sign in with their Atlassian account
  (SSO) and act as THEMSELVES in Jira
- **Multi-team orgs by subdomain**: `mp.{host}` = MP team, `aoa.{host}` = AOA
  team — one deployment, one codebase, per-team data isolation
- **No team data in .env** — teams, members, and roles are created in-app
  (admin creates team → head logs in → head invites members)

---

## Phase 0 — Server + Atlassian SSO ✅ (live — real consent→login verified 2026-10-08)

Kills the shared env token. Must land FIRST (everything else leans on it).

### OAuth 2.0 (3LO) flow

1. Register an OAuth app at developer.atlassian.com → `client_id` +
   `client_secret`, callback URL. Scopes: `read:jira-work`, `write:jira-work`,
   `read:jira-user`, `offline_access`.
2. Login: "Continue with Atlassian" → auth.atlassian.com consent →
   callback with code → SERVER exchanges code+secret → access token (1h) +
   refresh token.
3. Jira calls: `api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...` with the
   USER's Bearer token (cloudId from accessible-resources, cached).

### The backend (new, small — Cloud Run / company node box)

```
/auth/login     → redirect to Atlassian
/auth/callback  → exchange code; store tokens server-side (sessions/{sid},
                  encrypted); mint a FIREBASE CUSTOM TOKEN for the browser
/jira/*         → proxy: attach the session user's Bearer token;
                  refresh on 401; tokens NEVER reach the browser
static          → serves the built app for all subdomains
```

**Firebase custom token** = one login for both systems: Atlassian proves
identity → server tells Firebase who it is → browser signs into Firebase
silently → all existing Firestore rules/collections keep working.
Email/password login + change-password UI get DELETED (Atlassian owns auth).

### What this wins

- Comments / point edits / assigns post as the REAL person (the
  "acts as token user" caveat disappears)
- Per-user Jira permissions (the app stops being a permission bypass)
- Verified login email = the identity key Phases A–C need

### Sharp edges (handle from day one)

- Atlassian ROTATES refresh tokens on every refresh — store the new one
  atomically or users get random logouts
- Access tokens live 1h → the proxy's refresh-on-401 path is core, not a TODO
- OAuth app starts workspace-limited; flip the "distribution" toggle when
  needed (free, needs a privacy-policy URL)
- Everyone needs a real Jira account (no token-powered "guests" anymore)
- ❓ OPEN: confirm the Atlassian org allows member consent to custom OAuth
  apps (some orgs require admin approval) — ask the org admin EARLY

---

## Phase A — Firestore tree per team ⬜

Pure restructure, no new UX. App keeps working exactly as today on `mp.`.

### Tenant resolution

- Subdomain = team slug: `location.hostname.split('.')[0]`
- Wildcard DNS `*.{host}` + wildcard TLS + ONE deployment
- Local dev: `TEAM_SLUG=mp` in .env (dev pointer, not team data)

### Data model

```
teams/{slug}                     { name, head, createdAt }
teams/{slug}/members/{email}     { role: head|member, tags: [dev|qa],
                                   status: invited|active, invitedBy, joinedAt }
teams/{slug}/settings/config     ← the existing 15-field team config
teams/{slug}/settings/config/history
teams/{slug}/prs|tasks|labels|notifications|userPrefs|integration|qaPlan|profiles
```

### Rules (real isolation — server-side, not UI)

```
function isMember(team) {
  return exists(.../teams/$(team)/members/$(request.auth.token.email))
         && get(...).data.status == 'active';
}
match /teams/{team}/{doc=**}     → read/write: isMember(team)
members + settings/config writes → head only
```

Cost: one extra read per op (fine). Also finally fixes the
"allowlist is client-side" known issue.

### Migration (one-time script)

Create `teams/mp` → copy flat collections under it → mint member docs from
TEAM_EMAILS (role dev) + QA_EMAILS (tag qa), pawat.t = head → copy
settings/config. Old flat collections stay as frozen backup, delete later.

---

## Phase B — Members replace env rosters 🔶 (Teamage draft shipped: env team↔lead mapping, Firestore members, no-team landing, roster overlay)

- `members` collection replaces THREE things: login allowlist, TEAM_EMAILS,
  QA_EMAILS. `teamMembers()` reads members instead of env (one function body;
  all 11 call sites untouched). QA Mode = members tagged `qa`.
- New **Team Members page** (head-only): add email + tags → member doc with
  status `invited`; remove = delete doc (rules lock them out instantly).
- Invites WITHOUT email-sending (no mailer in v1): invite = allowlist entry;
  head tells the person "open mp.{host} and sign in with Atlassian" — if
  their email matches an invited/active member doc, they're in, doc flips
  to active. (SSO makes this trivial: no registration/password flow at all.)

---

## Phase C — Team creation (the second tenant) ⬜

- `ADMIN_EMAILS` in env (platform-level root, OK in env).
- Admin opens a fresh subdomain (`aoa.{host}`) → no team doc → admin-only
  "Create team" screen: name + head email → team doc + head as invited member.
- Head signs in with Atlassian → becomes active head → invites members →
  sets AOA's own Settings → Team configuration (their JIRA_PROJECT, statuses,
  prefixes, work schedule).
- Why not first-visitor-claims-team: anyone guessing a subdomain would own it.

---

## What stays in .env after all phases

| Stays (platform) | Leaves |
|---|---|
| Firebase keys | JIRA_TOKEN / JIRA_EMAIL (→ SSO) |
| ADMIN_EMAILS | TEAM_EMAILS / QA_EMAILS (→ members) |
| TEAM_SLUG (dev pointer) | per-team config fields (already in Firestore; now per team) |
| server port/secrets | |

## Decisions taken

- Same Jira site + (until Phase 0 lands) same service token for all teams
- ~~Subdomain tenancy~~ **CHANGED (2026-10-08): single URL for all teams** —
  membership (Teamage) decides which team a user sees; the sidebar brand
  shows "for team {X}". No wildcard DNS/TLS needed; Phase A's data tree
  (teams/{slug}/...) is unchanged, only the resolution source moved from
  hostname to membership
- Admin-only team creation
- One person in two teams = member doc in both trees; each subdomain is its
  own world. ❓ OPEN: profile photo is per-team in this model — decide if a
  global profile tree is wanted BEFORE Phase A (annoying to move later)
- Per-user Jira OAuth = Phase 0; per-team different Jira SITES = not planned
  (leave a seam in the proxy: team → cloudId mapping, default single site)

## Open questions

1. Atlassian org policy on custom OAuth app consent (ask admin now)
2. Hosting pick: Firebase Hosting + Cloud Run proxy vs company nginx/node box
   (decides where client_secret + sessions live)
3. Global vs per-team profile photos (see above)

## What stays for 0.2.0 (hosting only)

- real wildcard DNS + TLS for `*.{host}`
- the standalone backend (same /auth + /jira code, out of vite)
- production secret storage for client_secret / sessions
- OAuth app callback URL updated from localhost to the real host

## Order of work

```
Phase 0  server + SSO + custom tokens        ← biggest risk, do first
Phase A  teams/{slug} tree + rules + migration
Phase B  members + Team Members page + invites
Phase C  admin create-team + AOA onboarding
```

Each phase ships + verifies independently. Carried-over known issues
(last-write-wins on Integration Plan / Team Board / qaPlan) get fixed during
Phase A while touching those services anyway — the append-only `history`
pattern from the config audit log is the template.
