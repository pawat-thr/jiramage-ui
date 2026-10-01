# jiramage-ui

A web dashboard & team hub for Jira Cloud — the web rebuild of [jiramage](../jiramage), built with **React + Vite + Tailwind CSS**. Dark/light/system theming with a red accent, real URL routing, and two modes: **individual** (Jira only, zero setup beyond `.env`) and **team** (adds Firebase login + collaboration boards, notifications, shared settings, and planning tools). Plus **QA Mode** — a blue-accent sub-site of the same app for the QA team.

v0.1.8 · by MpLab · MIT License · full versions display clean (`v0.1.8`); pre-releases append the git build hash (`v0.1.9-beta.1+<hash>`)

---

## Pages

| Page | Route | Mode | What it does |
|------|-------|------|--------------|
| **Dashboard** | `/` | both | Stat tiles, stacked tasks-per-member chart, active-subtask points with **LOAD** (workload heat) and **BURN** (burn vs estimate) bars per member, work-type & status breakdowns; click a member to drill into Team Task |
| **My Tasks** | `/my-tasks` | both | Your issues, grouped by work type — search, type & status filters; subtasks show their parent story, a **Spec ↗** chip to the matching Confluence page, and a **⚡ Prompt** generator |
| **Team Task** | `/team-task` | both | Team issues — member/type/status filters, search, transition & reassign actions, Spec/Prompt chips, and a **Burn column**: live burned-vs-estimate meter while a card is in dev, frozen "used X/Y pt" stat after |
| **Delivery Tracking (beta)** | `/delivery` | both | PM view of a Release: overall & per-role (FE/BE/QA) point progress, **Prefix filter** (configured subtask prefixes — narrows the list, summary stays release-wide), **QA Info view** (10 QA categories, frozen columns, type×state filter), Excel-style table sorted least-done-first, **.xlsx export** (Delivery + QA sheets), story detail at `/delivery/DX-123` and nested subtask detail at `/delivery/DX-123/DX-456` |
| **Spec Wizard (beta)** | `/subtask-gen` | both | Search a story → its mentioned Confluence specs become a subtask checklist in **BE / FE / QA role tabs** (QA = the standard 9-pattern checklist), with dedupe against existing subtasks, per-row assignee + points, and per-role bulk create |
| **Capacity Planner (beta)** | `/capacity` | both* | Monthly planning calendar for the team (1 pt = 1 hour, 8 pt/day): per-member **capacity strip** (leave/half/full days, overload in red), task rows **grouped by story** with a frozen task card, drag-and-drop scheduling, **⚡ auto-place** (fills free capacity day by day), **Save + Reflow** for delays (actual stays pinned, moved work marked ⚠ delayed), a frozen **unplanned dock** grouped by story with per-story "Plan all", **grooming flow** (unassigned subtasks shown amber — dropping one on a member's row assigns it in Jira AND plans it), member/release filters + story-aware search. *Plans persist via Firebase (`qaPlan`); works unsaved without it |
| **Integration Plan** | `/integration` | team | Per-release planning grid synced from Jira on demand — frozen Key/Name/Status + editable Env, per-role target dates (roles configurable), Remark; local edits with an explicit batch **Save** button |
| **Team Board** | `/team-board` | team | Label-grouped task board — link a ref story or internal work, assign users (scales to 20+), ENV, sprint start, target date (overdue in red); owner edits, anyone moves status |
| **PR Review** | `/pr-review` | team | Post GitHub PRs, assign reviewers, **"Waiting for your review"** section on top, status changes, comments with **@mentions** — live via Firestore |
| **Inbox** | `/inbox` | team | Notification history (review assignments, status changes on your PRs, comments, mentions) — All/Unread tabs, mark read, delete |
| **Settings** | `/settings` | both | Your settings (theme, notification sound, team-shared **Dev Prompt template**, account/password), **Team configuration** (see below), and the read-only "Fixed · .env" zone |

**QA Mode** (`/jiramage/qa`): the same app re-skinned blue ("QA-mage.") for the QA team (`QA_EMAILS`) — its own Dashboard, Team Task (QA burn statuses), and Capacity Planner. Entered via the **QA Mode** button in the top bar.

Detail views have URLs too (`/delivery/DX-123[/DX-456]`, `/subtask-gen/DX-123`, `/integration/DX-123`, `/team-board/<id>`, `/pr-review/<id>`) — deep-linkable, browser back/forward works. Everywhere a subtask appears (task tables, planner, story details), clicking its name opens a **full detail overlay** (status, points, parent story, rich description, comments) with in-overlay navigation to the parent/siblings. Unknown URLs redirect home; `/login` bounces signed-in users to the dashboard.

## Highlights

- **Burn tracking**: computed from Jira changelogs as working-time intervals (status ping-pong safe) — Mon–Fri 9:30–12:00 + 13:00–18:30, 1 manday = 8 pt; live meter (blue → amber ≥75% → red over), frozen "used" stat on finished cards (subtasks only, capped + progressively rendered); burn statuses configurable per mode
- **Team configuration in Firebase** (team mode): 13 `.env` fields (projects, burn statuses, QA emails, subtask prefixes, refresh interval, …) editable in Settings with per-field validation and **Firebase / .env source badges**. Precedence per field: Firebase > .env > default; missing required config shows a blocking error screen. Changes are **audit-logged** (append-only `settings/config/history`: who, when, old → new) and boot is instant via a localStorage cache — a "⚙ reload to apply" pill appears when a teammate changed something
- **In-app notifications** (team mode): bell with live unread badge, Messenger-style ping (mutable in Settings), tab-title badge `(3) jiramage`, softer reminder every `REFRESH_INTERVAL`, 30-day retention sweep for read items
- **Subtask → Confluence spec matching**: token-based (camelCase-aware) matching of subtask names against pages mentioned on the parent story; version-stamped localStorage cache
- **Dev Prompt templates**: team-shared template with a required `{link}` param — one click turns any spec'd subtask into a ready-to-paste AI prompt
- **Long lists stay short**: issue tables render 50 rows per type group ("Show 50 more" / "Show all"), group headers fold on click — a 3,000-row view stays a one-screen page
- Auto-refresh (default **5 min**), paginated fetch of **all** matching issues
- Collapsible sidebar (icon rail / mobile drawer), fully responsive (tables scroll sideways on phones), 80% UI density (popups full-size)
- Keyboard shortcuts `1–9` switch pages; `h` toggles active-only (suppressed while a popup is open)
- Release/story-point custom fields auto-configured (overridable via env)
- **180 unit tests** + a 16-check **headless-Chrome e2e smoke suite**

## Setup

```bash
npm install
cp .env.example .env   # then fill in your credentials
npm run dev            # open the printed localhost URL
```

Minimum `.env` (individual mode — no Firebase needed):

```env
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_TOKEN=your_api_token_here
# Full team roster — INCLUDE YOURSELF (deduped against JIRA_EMAIL automatically)
TEAM_EMAILS=you@company.com,teammate1@company.com,teammate2@company.com
REFRESH_INTERVAL=5m
JIRA_PROJECT=APP,DX
JIRA_TEAM_FROM=2024-05-01
# optional — Jira custom field ids (defaults fit this org):
#JIRA_RELEASE_FIELD=customfield_10127
#JIRA_POINT_FIELD=customfield_10016
# optional — QA Mode + burn + wizard tuning (all also editable via team config):
#QA_EMAILS=qa1@company.com,qa2@company.com
#BURN_STATUSES=In Dev,In Dev Testing
#BURN_FINISHED_STATUSES=PR Review,Waiting for deployment,Done
#QA_BURN_STATUSES=In Progress
#QA_BURN_FINISHED_STATUSES=Done
#CONFLUENCE_SPEC_SPACE=YourSpace
#SUBTASK_PREFIX_BE=[BE]
#SUBTASK_PREFIX_FE=[FE]
#SUBTASK_PREFIX_QA=[QA]
#INTEGRATION_ROLES=BE,WEB,MOB
```

> Generate an API token at **id.atlassian.com → Security → API tokens**

Individual mode hides everything Firebase-backed (Team Board, PR Review, Inbox, login, notification sound) and stores preferences (default Release, Dev Prompt template) in the browser instead; the Capacity Planner works but doesn't persist plans.

## Team mode (Firebase, optional)

Add your Firebase web config (`VITE_FIREBASE_*` vars — see `.env.example`) and the app switches to team mode: email/password login restricted to the `TEAM_EMAILS` roster, first-login password setup with a live rule checklist (≥8 chars, 1 uppercase, 1 number, 1 special), change-password in Settings, and the Team Board / PR Review / Inbox pages backed by Firestore. Per-user preferences, the team-wide Dev Prompt template, the **Team configuration** overrides (+ audit log), and **Capacity Planner plans** sync via Firestore too.

Firebase console setup: enable **Authentication → Email/Password**, create a **Firestore** database, and publish **`firestore.rules`** (the file in this repo is the source of truth — paste it in Build → Firestore → Rules whenever it changes). Collections used: `prs` (+comments), `tasks`, `labels`, `notifications`, `userPrefs`, `settings` (incl. `settings/config` + append-only `settings/config/history`), `integration`, `qaPlan`.

> The team allowlist is enforced client-side, which suits a trusted internal team; a `beforeCreate` blocking Cloud Function would make it airtight. Moving to a hosted deployment (server-side Jira token, login-user identity) is the 0.2.0 plan.

## Project structure

```
src/
├── components/
│   ├── common/     # FilterMenu, ModalShell, ConfirmDialog, StatusBadge, PasswordField, MemberPicker, Toast, Spinner, RefreshButton
│   └── layout/     # Sidebar (collapsible/drawer), TopBar, NotificationBell
├── features/
│   ├── issues/     # IssueTable (grouping/paging/burn), IssueDetailModal, specMatch + useSpecLinks, useBurn + burn.js, PromptModal, Transition/ReassignModal
│   ├── dashboard/  # aggregate.js, StatTiles, TeamChart, SubtaskPoints (LOAD/BURN bars), Type/StatusBreakdown
│   ├── story/      # StoryDetail (any issue, reused by the detail overlay), AdfContent (Jira rich-text renderer), releaseNames
│   ├── delivery/   # deliveryUtils, ReleaseSummary, QASummary, exportXlsx (lazy SheetJS)
│   ├── board/      # TaskForm, LabelForm, TaskDetail, boardConstants
│   ├── pr/         # PrForm, PrDetail, mentions (@autocomplete), PrStatusBadge, prConstants
│   └── inbox/      # notifText (shared notification row)
├── qa/             # QA Mode: QaApp shell, QaCapacityPage (planner, shared by both modes), capacity.js (pure planning engine)
├── pages/          # One component per page (see table above) + LoginPage, SubtaskGenPage, IntegrationPage
├── hooks/          # useJiraData, useAuth, usePrefs, useTheme, useToast, useKeyboardShortcuts
├── services/       # jiraApi (REST+JQL), firebase, firebaseAuth, configApi (team config + audit log), qaPlanApi, prApi, teamBoardApi, prefsApi, notificationsApi, settingsApi, integrationApi
├── utils/          # format, ui (Tailwind recipes), password, prefs, theme, typeColors, notifSound (Web Audio ping)
├── config/         # appConfig (injected config + teamMembers roster), configFields (shared field spec: vite + runtime)
└── styles/         # global.css — Tailwind @theme tokens, light/dark (gradient), red/blue mode accents, zoom density
e2e/                # smoke.mjs — headless-Chrome UI automation (npm run test:e2e)
```

## Testing

```bash
npm test            # 180 unit tests / 29 files (Vitest + React Testing Library), fully offline
npm run test:watch  # watch mode
npm run test:e2e    # 16-check UI smoke: boots a dev server (individual mode) + headless Chrome
```

Unit tests are colocated (`*.test.js(x)`); Jira/Firebase seams are mocked with `vi.mock`. Coverage includes the capacity planning engine (auto-place, reflow/pin/delay semantics), the team-config precedence rules + validators, the team roster, burn math, spec matching, delivery rollups, and table paging/collapse. The e2e suite exercises every page against real Jira data (planner, detail overlay, and team-config section included), verifies routing guards and phone-width responsiveness, self-skips data-dependent checks when the team has no active subtasks, and exits non-zero on failure (CI-ready). It needs Google Chrome (`CHROME_PATH` overrides the binary) and a valid `.env`.

## How auth to Jira works

The browser never sees your API token. The Vite dev server proxies `/jira/*` to Jira Cloud, injecting the Basic-auth header server-side. Non-secret config is compiled in via `__APP_CONFIG__` (team mode can override the movable fields at runtime from Firestore); the display version is compiled in as `__APP_VERSION__` (from package.json, + git hash for pre-releases).

> `npm run build` outputs static files to `dist/`, but they need a host providing the same `/jira` proxy — for local use, `npm run dev` is the intended way to run.

## Docs

Per-version changelogs live in [`docs/`](docs/) — one file per version (`v0.1.0` → `v0.1.9`). Accepted limitations are tracked in [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md); [`docs/CONTEXT-MEMO.md`](docs/CONTEXT-MEMO.md) is the development-context handoff.
