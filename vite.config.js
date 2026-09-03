import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// Short git commit hash for the build code (Minecraft-snapshot style),
// e.g. v0.1.7-beta.2+a3f9c2d. Falls back to "dev" outside a git checkout.
function gitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// Parses Go-style durations like "5m", "30s", "1h" into milliseconds.
function parseInterval(raw) {
  const m = /^(\d+)([smh])$/.exec((raw || '').trim())
  if (!m) return 5 * 60 * 1000
  const n = Number(m[1])
  return n * { s: 1000, m: 60000, h: 3600000 }[m[2]]
}

const list = (raw, upper = false) =>
  (raw || '')
    .split(',')
    .map((s) => (upper ? s.trim().toUpperCase() : s.trim()))
    .filter(Boolean)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const auth =
    'Basic ' + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_TOKEN}`).toString('base64')

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __BUILD_HASH__: JSON.stringify(gitHash()),
      // Non-secret config only — the token stays inside the dev-server proxy.
      __APP_CONFIG__: JSON.stringify({
        jiraUrl: env.JIRA_URL || '',
        email: env.JIRA_EMAIL || '',
        teamEmails: list(env.TEAM_EMAILS),
        projects: list(env.JIRA_PROJECT, true),
        teamFrom: (env.JIRA_TEAM_FROM || '2024-05-01').trim(),
        refreshMs: parseInterval(env.REFRESH_INTERVAL),
        // Jira custom field id holding the "Release" on a card (option field).
        releaseField: (env.JIRA_RELEASE_FIELD || 'customfield_10127').trim(),
        // Jira custom field id holding story points (number field).
        pointField: (env.JIRA_POINT_FIELD || 'customfield_10016').trim(),
      }),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
    server: {
      proxy: {
        '/jira': {
          target: env.JIRA_URL,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/jira/, ''),
          headers: { Authorization: auth },
          configure: (proxy) => {
            // Jira rejects cross-origin browser requests (XSRF) — drop the
            // browser-identifying headers so it sees a plain API call.
            proxy.on('proxyReq', (proxyReq) => {
              for (const h of proxyReq.getHeaderNames()) {
                if (h === 'origin' || h === 'referer' || h === 'cookie' || h.startsWith('sec-')) {
                  proxyReq.removeHeader(h)
                }
              }
              proxyReq.setHeader('User-Agent', 'jiramage-ui/0.1.7-beta.2')
              proxyReq.setHeader('X-Atlassian-Token', 'no-check')
            })
          },
        },
      },
    },
  }
})
