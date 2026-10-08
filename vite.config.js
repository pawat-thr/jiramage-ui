import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseInterval, list, DEFAULT_WORK_TIME, DEFAULT_WORK_DAYS } from './src/config/configFields.js'
import ssoPlugin from './server/ssoPlugin.js'

// Short git commit hash for the build code (Minecraft-snapshot style),
// e.g. v0.1.7+a3f9c2d. Falls back to "dev" outside a git checkout.
function gitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// parseInterval/list come from src/config/configFields.js — the SAME parsers
// the runtime Firebase overlay uses, so .env and Firebase can't disagree.

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Version comes from package.json. Pre-releases (0.1.8-beta.1) carry the git
  // hash so testers can pin the exact build; FULL versions show clean (v0.1.7).
  const version = JSON.parse(readFileSync('./package.json', 'utf8')).version
  const appVersion = 'v' + version + (version.includes('-') ? '+' + gitHash() : '')
  // Tokenless (SSO-only) mode: with no JIRA_TOKEN the legacy proxy sends no
  // auth at all — signed-in traffic never reaches it (the SSO plugin proxies
  // with the user's own Bearer token first).
  // Basic auth is a PAIR — a token without its email is useless to Jira.
  // SSO deployments set neither (tokenless; users act as themselves).
  const auth =
    env.JIRA_TOKEN && env.JIRA_EMAIL
      ? 'Basic ' + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_TOKEN}`).toString('base64')
      : null

  return {
    plugins: [react(), tailwindcss(), ssoPlugin(env)],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      // Non-secret config only — the token stays inside the dev-server proxy.
      __APP_CONFIG__: JSON.stringify({
        jiraUrl: env.JIRA_URL || '',
        email: env.JIRA_EMAIL || '',
        teamEmails: list(env.TEAM_EMAILS),
        // Teamage: parallel lists — TEAMS[i]'s lead is TEAM_LEADS[i].
        // Members live in Firestore (teams/{slug}/members); empty TEAMS = off.
        teams: list(env.TEAMS),
        teamLeads: list(env.TEAM_LEADS).map((e) => e.toLowerCase()),
        projects: list(env.JIRA_PROJECT, true),
        teamFrom: (env.JIRA_TEAM_FROM || '2024-05-01').trim(),
        refreshMs: parseInterval(env.REFRESH_INTERVAL) ?? 5 * 60 * 1000,
        // Burn working windows (Mon\u2013Fri); invalid values fall back at parse time.
        workTime: (env.WORK_TIME || DEFAULT_WORK_TIME).trim(),
        workDays: (env.WORK_DAYS || DEFAULT_WORK_DAYS).trim(),
        // Jira custom field id holding the "Release" on a card (option field).
        releaseField: (env.JIRA_RELEASE_FIELD || 'customfield_10127').trim(),
        // Jira custom field id holding story points (number field).
        pointField: (env.JIRA_POINT_FIELD || 'customfield_10016').trim(),
        // Spec Wizard: only Confluence pages from this space become suggestions
        // (empty = all mentioned pages), plus per-role subtask name prefixes.
        specSpace: (env.CONFLUENCE_SPEC_SPACE || '').trim(),
        subtaskPrefixBe: (env.SUBTASK_PREFIX_BE || env.SUBTASK_PREFIX || '').trim(),
        subtaskPrefixFe: (env.SUBTASK_PREFIX_FE || '[FE]').trim(),
        subtaskPrefixQa: (env.SUBTASK_PREFIX_QA || '[QA]').trim(),
        // Burn: statuses AFTER dev where the final burn stat is shown frozen.
        burnFinishedStatuses: list(env.BURN_FINISHED_STATUSES).length
          ? list(env.BURN_FINISHED_STATUSES)
          : ['PR Review', 'Waiting for deployment', 'Done'],
        // Team Task burn tracking: statuses that count as "in development".
        burnStatuses: list(env.BURN_STATUSES).length
          ? list(env.BURN_STATUSES)
          : ['In Dev', 'In Dev Testing'],
        // Integration Plan: one target-date column per role.
        integrationRoles: list(env.INTEGRATION_ROLES).length
          ? list(env.INTEGRATION_ROLES)
          : ['BE', 'WEB', 'MOB'],
      }),
    },
    build: {
      rollupOptions: {
        output: {
          // stable vendor chunks: app updates don't re-download React/Firebase
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
    server: {
      proxy: {
        // ^/jira/ (regex): only real API calls — NOT the /jiramage/qa sub-site,
        // whose path also happens to start with "/jira".
        '^/jira/': {
          target: env.JIRA_URL,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/jira/, ''),
          headers: auth ? { Authorization: auth } : {},
          configure: (proxy) => {
            // Jira rejects cross-origin browser requests (XSRF) — drop the
            // browser-identifying headers so it sees a plain API call.
            proxy.on('proxyReq', (proxyReq) => {
              for (const h of proxyReq.getHeaderNames()) {
                if (h === 'origin' || h === 'referer' || h === 'cookie' || h.startsWith('sec-')) {
                  proxyReq.removeHeader(h)
                }
              }
              proxyReq.setHeader('User-Agent', 'jiramage-ui/0.1.7')
              proxyReq.setHeader('X-Atlassian-Token', 'no-check')
            })
          },
        },
      },
    },
  }
})
