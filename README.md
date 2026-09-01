# jiramage-ui

A web dashboard for Jira Cloud — the web rebuild of [jiramage](../jiramage), built with **React + Vite + Tailwind CSS**. Dark/light/system theming with a red accent, and optional team-only login via Firebase.

v0.1.0 · by MpLab

---

## Features

| Page | Key | What it does |
|------|-----|--------------|
| **1 · Dashboard** | `1` | Landing page — stat tiles, stacked tasks-per-member chart (you included), work-type & status breakdowns; click a member to drill into Team |
| **2 · My Tasks** | `2` | Issues assigned to you, grouped by work type — search, type & status filters |
| **3 · Team** | `3` | Team issues, grouped by work type — member, type & status filters, search |
| **4 · Settings** | `4` | Theme switch (light/dark/system) + account (change password); `.env` config is shown read-only |

- Auto-refreshes on configurable interval (default **5 minutes**)
- Paginated fetch — retrieves **all** matching issues, not just first 100
- Click an issue key to open it in Jira
- **Active only** toggle (or press `h`) hides done-category issues
- **move** / **assign** row actions — transition status or reassign without leaving the page
- Issues grouped by work type (Epic / Story / Sub-task …), color-coded
- Collapsible sidebar navigation — icon rail on desktop, off-canvas drawer on mobile
- Light / dark / system theme, saved per browser
- Fully responsive full-width layout (phone / tablet / desktop)
- Keyboard shortcuts `1–4` switch pages, like v1
- Optional Firebase login restricted to your team (see below)
- Works with any Jira Cloud org — just change `.env`

## Setup

```bash
npm install
cp .env.example .env   # then fill in your credentials
npm run dev            # open the printed localhost URL
```

`.env` uses the same variables as jiramage v1:

```env
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_TOKEN=your_api_token_here
TEAM_EMAILS=teammate1@company.com,teammate2@company.com
REFRESH_INTERVAL=5m
JIRA_PROJECT=APP,DX
JIRA_TEAM_FROM=2024-05-01
```

> Generate an API token at **id.atlassian.com → Security → API tokens**

## Project structure

Feature-based layout (per the [recommended React folder structure](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc)):

```
src/
├── components/
│   ├── common/          # Reusable UI: FilterMenu, ModalShell, StatusBadge, Toast, Spinner
│   └── layout/          # Sidebar (collapsible / drawer), TopBar
├── features/            # Domain modules
│   ├── issues/          # IssueTable, TransitionModal, ReassignModal
│   └── dashboard/       # aggregate.js, StatTiles, TeamChart (stacked), TypeBreakdown, StatusBreakdown
├── pages/               # One component per page: Dashboard, MyTasks, Team, Settings
├── hooks/               # useJiraData (fetch + auto-refresh), useToast, useKeyboardShortcuts
├── services/            # jiraApi.js — all Jira REST calls + JQL
├── utils/               # format.js — shortName, filterIssues; ui.js — shared Tailwind class recipes
├── config/              # appConfig.js — injected non-secret config
├── styles/              # global.css — Tailwind import + @theme tokens (dark monotone palette)
├── App.jsx              # State orchestration: tabs, modals, filters
└── main.jsx
```

## Testing

```bash
npm test          # run the unit test suite once (Vitest)
npm run test:watch  # watch mode while developing
```

Unit tests (Vitest + React Testing Library, jsdom) live **next to the code they test** as `*.test.js(x)` — e.g. `utils/format.test.js`, `components/common/FilterMenu.test.jsx`. Shared test setup is in `src/test/setup.js`.

The structure is ready for future automated testing:

- **Unit / component**: colocated `*.test.jsx` files, as above. External seams are mockable — all Jira calls go through `services/jiraApi.js`, config through `config/appConfig.js` (both mocked with `vi.mock` in existing tests).
- **Integration**: pages are prop-driven (no globals), so a page can be rendered with fake data without touching the network.
- **E2E (later)**: put Playwright/Cypress specs in a top-level `tests/e2e/` folder; the app is fully drivable headlessly (the dev workflow already uses headless Chrome against `npm run dev`). Stable hooks exist where needed (e.g. `[data-spinner]` for loading states) — add `data-testid` attributes as E2E grows.

## Authentication (Firebase, optional)

Email/password login restricted to your team. It activates only when a real
`VITE_FIREBASE_API_KEY` is present in `.env` — otherwise the app runs open.

- **Only team emails may sign in** — the allowlist is `JIRA_EMAIL` + `TEAM_EMAILS`.
- **First login** uses the “First time” tab to set a password (rules: ≥8 chars, 1 uppercase,
  1 number, 1 special character).
- **Change password** lives in Settings → Account.

Setup: create a Firebase project, paste its web config into the `VITE_FIREBASE_*` vars in
`.env`, and in the Firebase console enable **Authentication → Sign-in method → Email/Password**.

> Note: the allowlist is enforced client-side, which suits a trusted internal team. To make
> it airtight, add a Firebase `beforeCreate` blocking Cloud Function (see `plan/` for the
> broader v2 architecture).

## How auth works

The browser never sees your API token. The Vite dev server proxies `/jira/*` to your Jira Cloud instance, injecting the Basic-auth header server-side and stripping browser headers that would trip Atlassian's XSRF check. Non-secret config (team emails, projects, labels) is compiled in via `__APP_CONFIG__`.

> `npm run build` produces static files in `dist/`, but they need a host that provides the same `/jira` proxy — the dev server is the intended way to run this locally.
