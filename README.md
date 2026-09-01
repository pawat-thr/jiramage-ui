# jiramage-ui

A web dashboard & team hub for Jira Cloud — the web rebuild of [jiramage](../jiramage), built with **React + Vite + Tailwind CSS**. Dark/light/system theming with a red accent, real URL routing, and two modes: **individual** (Jira only, zero setup beyond `.env`) and **team** (adds Firebase login + collaboration boards).

v0.1.5 · by MpLab · MIT License

---

## Pages

| Page | Route | Mode | What it does |
|------|-------|------|--------------|
| **Dashboard** | `/` | both | Stat tiles, stacked tasks-per-member chart, active-subtask points per user, work-type & status breakdowns; click a member to drill into Team Task |
| **My Tasks** | `/my-tasks` | both | Your issues, grouped by work type — search, type & status filters; subtasks show their parent story |
| **Team Task** | `/team-task` | both | Team issues — member/type/status filters, search, transition & reassign actions |
| **Story List** | `/story-list` | both | All Story cards — Release & Status filters, saved default Release, full story detail (description, subtasks + owners, comments) |
| **Delivery Tracking (beta)** | `/delivery` | both | PM view of a Release: overall & per-role (FE/BE/QA) point progress, Test-case design tracking, Excel-style story table sorted least-done-first |
| **Team Board** | `/team-board` | team | Label-grouped task board — link a ref story or internal work, assign users, ENV, sprint start; owner edits, anyone moves status |
| **PR Review** | `/pr-review` | team | Post GitHub PRs, assign reviewers, reviewer/owner set status, comments — live via Firestore |
| **Settings** | `/settings` | both | Light/dark/system theme, account & change password (team mode), read-only `.env` view |

Detail views have URLs too (`/story-list/DX-123`, `/delivery/DX-123`, `/team-board/<id>`, `/pr-review/<id>`) — deep-linkable, browser back/forward works.

## Highlights

- Auto-refresh (default **5 min**), paginated fetch of **all** matching issues
- Work-type grouping with color-coded chips; Jira-convention status colors
- Collapsible sidebar (icon rail / mobile drawer), fully responsive, 80% UI density (popups full-size)
- Keyboard shortcuts `1–8` switch pages; `h` toggles active-only
- Release/story-point custom fields auto-configured (overridable via env)
- 43 unit tests (Vitest + React Testing Library)

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
TEAM_EMAILS=teammate1@company.com,teammate2@company.com
REFRESH_INTERVAL=5m
JIRA_PROJECT=APP,DX
JIRA_TEAM_FROM=2024-05-01
# optional — Jira custom field ids (defaults fit this org):
#JIRA_RELEASE_FIELD=customfield_10127
#JIRA_POINT_FIELD=customfield_10016
```

> Generate an API token at **id.atlassian.com → Security → API tokens**

## Team mode (Firebase, optional)

Add your Firebase web config (`VITE_FIREBASE_*` vars — see `.env.example`) and the app switches to team mode: email/password login restricted to `JIRA_EMAIL` + `TEAM_EMAILS`, first-login password setup (≥8 chars, 1 uppercase, 1 number, 1 special), change-password in Settings, and the Team Board + PR Review pages backed by Firestore. Per-user preferences (default Release) sync via Firestore too.

Firebase console setup: enable **Authentication → Email/Password**, create a **Firestore** database, and publish **`firestore.rules`** (the file in this repo is the source of truth — paste it in Build → Firestore → Rules whenever it changes).

> The team allowlist is enforced client-side, which suits a trusted internal team; a `beforeCreate` blocking Cloud Function would make it airtight.

## Project structure

```
src/
├── components/
│   ├── common/     # FilterMenu, ModalShell, ConfirmDialog, StatusBadge, PasswordField, Toast, Spinner, RefreshButton
│   └── layout/     # Sidebar (collapsible/drawer), TopBar
├── features/
│   ├── issues/     # IssueTable (grouped by type), TransitionModal, ReassignModal
│   ├── dashboard/  # aggregate.js, StatTiles, TeamChart, SubtaskPoints, Type/StatusBreakdown
│   ├── story/      # StoryTable, StoryDetail, AdfContent (Jira rich-text renderer)
│   ├── delivery/   # deliveryUtils, ReleaseSummary (PM rollup)
│   ├── board/      # TaskForm, LabelForm, TaskDetail, boardConstants
│   └── pr/         # PrForm, PrDetail, PrStatusBadge, prConstants
├── pages/          # One component per page (see table above) + LoginPage
├── hooks/          # useJiraData, useAuth, usePrefs, useTheme, useToast, useKeyboardShortcuts
├── services/       # jiraApi (REST+JQL), firebase, firebaseAuth, prApi, teamBoardApi, prefsApi
├── utils/          # format, ui (Tailwind recipes), password, prefs, theme, typeColors
├── config/         # appConfig — injected non-secret config
└── styles/         # global.css — Tailwind @theme tokens, light/dark, zoom density
```

## Testing

```bash
npm test            # run the unit suite once (Vitest)
npm run test:watch  # watch mode
```

Tests are colocated (`*.test.js(x)`); Jira/Firebase seams are mocked with `vi.mock`. For future E2E, put Playwright/Cypress specs in `tests/e2e/` — the app is fully drivable headlessly and exposes stable hooks like `[data-spinner]`.

## How auth to Jira works

The browser never sees your API token. The Vite dev server proxies `/jira/*` to Jira Cloud, injecting the Basic-auth header server-side. Non-secret config is compiled in via `__APP_CONFIG__`.

> `npm run build` outputs static files to `dist/`, but they need a host providing the same `/jira` proxy — for local use, `npm run dev` is the intended way to run.
