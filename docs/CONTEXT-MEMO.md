# CONTEXT MEMO — read this first in a new Claude session

> Purpose: full working context for Jiramage development. If you (Claude) are
> reading this in a fresh session, this file + the docs/ changelogs + the code
> are everything you need. Last updated: 2026-10-01, at v0.1.8 FINAL (tagged);
> next up: v0.1.9-beta — the LAST demo version before 0.2.0.

## Who / what

- User: **pawat.t** (MpLab, orbitdigital, Thai dev team). Communicates in short
  informal English; "Capa page" = Capacity Planner, "manu" = menu, etc.
- Project: **jiramage-ui** — React 18 + Vite 5 + Tailwind v4 internal Jira
  dashboard. Two modes:
  - **individual mode**: Jira only, zero Firebase (env `VITE_FIREBASE_API_KEY`
    missing/REPLACE → firebase pages hidden, everything else works)
  - **team mode**: + Firebase (auth, Firestore: team board, PR review, inbox,
    integration plan, settings, qaPlan)
- **QA Mode: RETIRED in v0.1.9** (was `/jiramage/qa`) — superseded by
  Teamage teams; a QA team is just a team now. Planner lives at
  src/pages/CapacityPage.jsx + src/features/capacity/capacity.js.

## Hard rules (user-set — do not violate)

1. **The beta-era unit-test freeze is OVER** (lifted at the 0.1.8 release):
   new features should come with tests again. Suite now: 200 unit tests /
   32 files + 16 e2e smoke checks.
2. **User commits themselves.** Never commit/push unless explicitly asked.
3. **.env edits: only append complete lines at the END of the file.** A splice
   once corrupted the user's QA_EMAILS line — never edit mid-file.
4. Deployment is deferred to **0.2.0**; until then everything is local-only
   (dev proxy holds the Jira token, that's accepted for now).
5. Per-version changelog lives in `docs/v0.1.8.md` (one file per version);
   known issues in `docs/KNOWN-ISSUES.md`. Update the changelog with every
   feature/fix.
6. Version format: pre-release shows git hash (`v0.1.8-beta.2+<hash>` via
   `__APP_VERSION__` in vite.config.js); full releases show clean.

## How to verify work (established pattern)

- `npm run build` then `npm test -- --run` (**200 tests / 32 files** must stay
  green) then `npm run test:e2e` (16-check headless-Chrome smoke suite;
  data-dependent checks auto-skip with `[skip]` when the team has zero active
  subtasks).
- Manual browser verification: start
  `KEYCLOAK_ISSUER= VITE_FIREBASE_API_KEY=REPLACE-disabled npx vite --port 5198 --strictPort`
  (individual mode, no login), then drive puppeteer-core via
  `await import('file:///<repo>/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')`
  with Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
  Screenshot, LOOK at the screenshot, iterate. Kill the server when done.
- When testing writes (e.g. Jira assign PUT), intercept the request in
  puppeteer — never write to real Jira from tests.
- Synthetic DragEvents need tick separation (dragstart → wait → dragover →
  wait → drop) or React state hasn't flushed — that's a test artifact, not an
  app bug.
- Python .replace() edits MUST assert the old string exists + is unique before
  writing (silent no-ops caused stale-UI bugs before).

## Architecture map (key files)

- `src/App.jsx` — main shell; NAV_ITEMS; URL = source of truth; unknown paths
  redirect home. Main-mode Capacity Planner is wired here with
  `TEAM_PLAN_EMAILS` (CFG.email + CFG.teamEmails), `fetchTeamIssues`,
  labels "member"/"TEAM_EMAILS".
- `src/qa/QaApp.jsx` — QA shell (own NAV: dashboard/team-task/capacity),
  exact-match-first routing (base path must not swallow sub-paths).
- `src/qa/QaCapacityPage.jsx` (~830 lines) — **the Capacity Planner, shared by
  both modes** via props: `emails`, `fetchIssues`, `teamLabel`, `envVar`
  (defaults = QA mode). Layout: toolbar (month nav, member select, Release
  FilterMenu, story-aware search, legend) → one table (capacity strip rows on
  top, then task rows grouped by story, frozen 280px left column) → sticky
  bottom dock of unplanned subtasks grouped by story.
  - SUBTASKS ONLY (`fields.parent` required) — stories must never be plannable.
  - assignee mapping: `emailAddress` OR accountId→email fallback via
    `resolveAccountIds` (Atlassian privacy can hide emails!).
  - grooming flow: also fetches `fetchUnassignedIssues()`; unassigned subtasks
    show amber tag, hidden by default behind "unassigned (n)" toggle;
    **dropping one on a member's capacity row assigns it in Jira AND plans it**.
  - Release filter: stories fetched for `releaseNames()`; storyKey→releases map
    filters calendar + dock.
- `src/qa/capacity.js` — pure engine: `autoPlace` (fills free capacity
  day-by-day), `reflowFrom` (re-lays from a day; `pin` keeps an "actual" chunk
  in place; later-landing chunks marked `delayed`), `capacityOf` (override
  wins, weekends 0, default 8), month-clamped via `untilDay`. 1 point = 1 hour,
  8 pt/day.
- `src/services/qaPlanApi.js` — Firestore `qaPlan` collection, doc id
  `encodeURIComponent(email|YYYY-MM)`, whole-doc save (last-write-wins — known
  issue, fix before 0.2).
- `src/services/jiraApi.js` — all Jira calls through `/jira` dev proxy (regex
  key `'^/jira/'` in vite.config.js — do NOT change to a plain prefix, it broke
  `/jiramage/*` sub-site paths). Notable: `fetchTeamIssues`, `fetchQaIssues`,
  `fetchUnassignedIssues` (assignee is EMPTY), `fetchStories`, `fetchChangelog`
  (paginated), `assignIssue`, `resolveAccountIds` (cached).
- `src/features/issues/IssueTable.jsx` — shared task table: type-grouped, each
  group renders ≤50 rows + "Show 50 more"/"Show all", header click collapses
  group (fixed 3,000-row endless scroll). BurnMeter lives here.
- `src/features/issues/useBurn.js` + `burn.js` — burn tracking from Jira
  changelogs: interval-based (status ping-pong safe), working schedule from
  `WORK_TIME` + `WORK_DAYS` config (default Mon–Fri 9:30–12:00 + 13:00–18:30;
  WORK_DAYS also drives planner day-off capacity via isDayOff), 1 manday =
  8 pt; finished stats subtask-only, 150-fetch cap, progressive render;
  localStorage cache `jiramage-burn-intervals-v2`. Status sets from env:
  `BURN_STATUSES`, `BURN_FINISHED_STATUSES`, `QA_BURN_STATUSES=In Progress`,
  `QA_BURN_FINISHED_STATUSES=Done`.
- Spec chips: token-run matching of subtask names vs Confluence links;
  cache key is version-stamped; failed fetches never persisted.
- `firestore.rules` — blocks incl. `qaPlan` and the append-only
  `settings/config/history` (both published). Any NEW block needs a republish
  reminder to the user.
- `e2e/smoke.mjs` — the 16-check suite; spawns its own vite on port 5199.
- Pages are LAZY chunks (React.lazy in App.jsx/QaApp.jsx) + manualChunks for
  react/firebase vendors — keep new pages lazy; planner hover uses imperative
  `traceTask` (data-task-trace + .task-hover class), never hover state.

## Current state (v0.1.8 FINAL tagged, all verified green)

- beta.2 committed content: task-first planner layout (4 UX rounds), planner in
  main mode (`/capacity`, "Capacity Planner (beta)" nav), grooming flow,
  release filter, story-aware search (matches story key/name too), unassigned
  hidden by default, long-list paging/collapse, e2e data-dependent skips,
  version bump.
- Planner UX history (why it looks like it does): user found QA-rows layout
  hard → pivoted to task-rows-grouped-by-story with capacity strip + bottom
  dock → text too small → sized up (92px day cols, 13px text) → dock chip soup
  → grouped rows → user plans story-first → dock regrouped BY STORY with
  per-story "⚡ Plan all" (plans each subtask for its own assignee).
- Known issues (user will fix before 0.2): Integration Plan / Team Board /
  qaPlan are whole-doc last-write-wins; concurrent edits lose data silently.
- 0.2.0 roadmap (agreed in product review): deployment + server-side Jira
  token (+ login-user-overwrites-JIRA_EMAIL) → concurrency fixes → remaining
  runtime settings (work-time). Unit tests: DONE at 0.1.8.
- Next: **v0.1.9-beta.1 — the LAST demo version before 0.2.0** (docs/v0.1.9.md).

## Env vars (in user's real .env — never splice!)

`JIRA_*` (base/email/token/projects APP,DX), `TEAM_EMAILS` (3 devs),
`QA_EMAILS` (16 QAs), `BURN_STATUSES=In Dev,In Dev Testing`,
`BURN_FINISHED_STATUSES=PR Review,Waiting for deployment,Done`,
`QA_BURN_STATUSES=In Progress`, `QA_BURN_FINISHED_STATUSES=Done`,
`INTEGRATION_ROLES=BE,WEB,MOB`, `REFRESH_INTERVAL`, Firebase keys,
`POINT_FIELD`/`RELEASE_FIELD` custom field ids. All parsed in vite.config.js
into `CFG` (src/config/appConfig.js re-exports).

## THE v0.1.9 KEY FEATURE — docs/PLAN-ORG-SSO.md (read before working on it)

Phases: 0) server + Atlassian SSO (OAuth 3LO, Firebase custom tokens, kills
the env Jira token) → A) Firestore tree under teams/{slug} + membership
rules + MP migration → B) members collection replaces TEAM_EMAILS/QA_EMAILS
+ invites → C) admin create-team, subdomain tenancy (mp.{host}, aoa.{host}).
ALL FOUR PHASES ship in v0.1.9, demoed locally (vite-middleware SSO,
*.localhost subdomains); 0.2.0 = real hosting only. Read that file first;
it has the decisions and open questions.

## Added between beta.2 and the 0.1.8 final (all in docs/v0.1.8.md)

- Subtask detail overlay (`IssueDetailModal` wrapping the generic StoryDetail)
  from every subtask row; Delivery routes nest `/delivery/{story}/{subtask}`
- Firebase **team config** (13 movable env fields, precedence Firebase > .env >
  default, rule-4 blocking screen) + Settings editor with per-field validation
  (`src/config/configFields.js` is THE shared field spec for vite + runtime) +
  append-only audit log (`settings/config/history`) + localStorage-cached boot
  with a "reload to apply" pill when stale
- `teamMembers()` roster (TEAM_EMAILS includes self, case-insensitive dedupe)
- Delivery: configured-prefix filter (list only; summary stays release-wide)
- An 8-finding adversarial review round was fixed pre-release — notably: Spec
  Wizard's ROLE_META uses live getters (module-level CFG captures BREAK the
  config overlay — always read moved CFG fields at render/call time!)

## Working style that fits this user

- Ship fast, verify with real screenshots, iterate until good — user says
  "check until you think is good" and means it.
- Lead with what changed + proof (screenshot, measured numbers). Short toasts
  of detail after.
- When user reports a bug, find root cause with live data before patching
  (e.g. "no QA" rows turned out to be Atlassian email privacy, not a mapping
  bug).
- Always update `docs/v0.1.8.md` (or the current version's file) per change.
- Always end with reminders if something needs user action (e.g. republish
  firestore.rules).
