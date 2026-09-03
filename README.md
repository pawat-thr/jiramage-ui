# jiramage-ui

A web dashboard & team hub for Jira Cloud — the web rebuild of [jiramage](../jiramage), built with **React + Vite + Tailwind CSS**. Dark/light/system theming with a red accent, real URL routing, and two modes: **individual** (Jira only, zero setup beyond `.env`) and **team** (adds Firebase login + collaboration boards, notifications, and shared settings).

v0.1.7-beta.2 · by MpLab · MIT License · versions read `v0.1.7-beta.N+<git hash>` — the hash pins the exact commit a build came from

---

## Pages

| Page | Route | Mode | What it does |
|------|-------|------|--------------|
| **Dashboard** | `/` | both | Stat tiles, stacked tasks-per-member chart, active-subtask points with workload heat gradient, work-type & status breakdowns; click a member to drill into Team Task |
| **My Tasks** | `/my-tasks` | both | Your issues, grouped by work type — search, type & status filters; subtasks show their parent story, a **Spec ↗** chip to the matching Confluence page, and a **⚡ Prompt** generator |
| **Team Task** | `/team-task` | both | Team issues — member/type/status filters, search, transition & reassign actions, same Spec/Prompt chips |
| **Delivery Tracking (beta)** | `/delivery` | both | PM view of a Release: overall & per-role (FE/BE/QA) point progress, **QA Info view** (10 QA categories, frozen columns, type×state filter), Excel-style table sorted least-done-first, **.xlsx export** (Delivery + QA sheets), full story detail at `/delivery/DX-123` |
| **Team Board** | `/team-board` | team | Label-grouped task board — link a ref story or internal work, assign users (scales to 20+), ENV, sprint start, target date (overdue in red); owner edits, anyone moves status |
| **PR Review** | `/pr-review` | team | Post GitHub PRs, assign reviewers, **"Waiting for your review"** section on top, status changes, comments with **@mentions** — live via Firestore |
| **Inbox** | `/inbox` | team | Notification history (review assignments, status changes on your PRs, comments, mentions) — All/Unread tabs, mark read, delete |
| **Settings** | `/settings` | both | Editable zone (theme, notification sound, team-shared **Dev Prompt template**, account/password in team mode) vs read-only "Fixed · .env" zone |

Detail views have URLs too (`/delivery/DX-123`, `/team-board/<id>`, `/pr-review/<id>`) — deep-linkable, browser back/forward works. Unknown URLs redirect home; `/login` bounces signed-in users to the dashboard.

## Highlights

- **In-app notifications** (team mode): bell with live unread badge, Messenger-style ping (mutable in Settings), tab-title badge `(3) jiramage`, softer reminder every `REFRESH_INTERVAL`, 30-day retention sweep for read items
- **Subtask → Confluence spec matching**: token-based (camelCase-aware) matching of subtask names against pages mentioned on the parent story; 24h localStorage cache
- **Dev Prompt templates**: team-shared template with a required `{link}` param — one click turns any spec'd subtask into a ready-to-paste AI prompt
- Auto-refresh (default **5 min**), paginated fetch of **all** matching issues
- Collapsible sidebar (icon rail / mobile drawer), fully responsive (tables scroll sideways on phones), 80% UI density (popups full-size)
- Keyboard shortcuts `1–8` switch pages; `h` toggles active-only (suppressed while a popup is open)
- Release/story-point custom fields auto-configured (overridable via env)
- **101 unit tests** + a 13-check **headless-Chrome e2e smoke suite**

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

Individual mode hides everything Firebase-backed (Team Board, PR Review, Inbox, login, notification sound) and stores preferences (default Release, Dev Prompt template) in the browser instead.

## Team mode (Firebase, optional)

Add your Firebase web config (`VITE_FIREBASE_*` vars — see `.env.example`) and the app switches to team mode: email/password login restricted to `JIRA_EMAIL` + `TEAM_EMAILS`, first-login password setup with a live rule checklist (≥8 chars, 1 uppercase, 1 number, 1 special), change-password in Settings, and the Team Board / PR Review / Inbox pages backed by Firestore. Per-user preferences and the team-wide Dev Prompt template sync via Firestore too.

Firebase console setup: enable **Authentication → Email/Password**, create a **Firestore** database, and publish **`firestore.rules`** (the file in this repo is the source of truth — paste it in Build → Firestore → Rules whenever it changes). Collections used: `prs` (+comments), `tasks`, `labels`, `notifications`, `userPrefs`, `settings`.

> The team allowlist is enforced client-side, which suits a trusted internal team; a `beforeCreate` blocking Cloud Function would make it airtight.

## Project structure

```
src/
├── components/
│   ├── common/     # FilterMenu, ModalShell, ConfirmDialog, StatusBadge, PasswordField, MemberPicker, Toast, Spinner, RefreshButton
│   └── layout/     # Sidebar (collapsible/drawer), TopBar, NotificationBell
├── features/
│   ├── issues/     # IssueTable, specMatch + useSpecLinks (Confluence spec chips), PromptModal, Transition/ReassignModal
│   ├── dashboard/  # aggregate.js, StatTiles, TeamChart, SubtaskPoints (heat gradient), Type/StatusBreakdown
│   ├── story/      # StoryDetail, AdfContent (Jira rich-text renderer), releaseNames
│   ├── delivery/   # deliveryUtils, ReleaseSummary, QASummary, exportXlsx (lazy SheetJS)
│   ├── board/      # TaskForm, LabelForm, TaskDetail, boardConstants
│   ├── pr/         # PrForm, PrDetail, mentions (@autocomplete), PrStatusBadge, prConstants
│   └── inbox/      # notifText (shared notification row)
├── pages/          # One component per page (see table above) + LoginPage
├── hooks/          # useJiraData, useAuth, usePrefs, useTheme, useToast, useKeyboardShortcuts
├── services/       # jiraApi (REST+JQL), firebase, firebaseAuth, prApi, teamBoardApi, prefsApi, notificationsApi, settingsApi
├── utils/          # format, ui (Tailwind recipes), password, prefs, theme, typeColors, notifSound (Web Audio ping)
├── config/         # appConfig — injected non-secret config + version/build hash
└── styles/         # global.css — Tailwind @theme tokens, light/dark (gradient), zoom density
e2e/                # smoke.mjs — headless-Chrome UI automation (npm run test:e2e)
```

## Testing

```bash
npm test            # 101 unit tests (Vitest + React Testing Library), ~2s, fully offline
npm run test:watch  # watch mode
npm run test:e2e    # 13-check UI smoke: boots a dev server (individual mode) + headless Chrome
```

Unit tests are colocated (`*.test.js(x)`); Jira/Firebase seams are mocked with `vi.mock`. The e2e suite exercises every page against real Jira data, verifies routing guards and phone-width responsiveness, and exits non-zero on failure (CI-ready). It needs Google Chrome (`CHROME_PATH` overrides the binary) and a valid `.env`.

## How auth to Jira works

The browser never sees your API token. The Vite dev server proxies `/jira/*` to Jira Cloud, injecting the Basic-auth header server-side. Non-secret config is compiled in via `__APP_CONFIG__`; the short git hash is compiled in as `__BUILD_HASH__`.

> `npm run build` outputs static files to `dist/`, but they need a host providing the same `/jira` proxy — for local use, `npm run dev` is the intended way to run.

## Docs

Per-version changelogs live in [`docs/`](docs/) — one file per version (`v0.1.0` → `v0.1.7`).
