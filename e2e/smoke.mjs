/**
 * E2E smoke suite — real browser, real Jira data, individual mode.
 *
 *   npm run test:e2e
 *
 * Starts its own Vite dev server (Firebase forced OFF so no login is needed),
 * drives headless Chrome through every page and the key interactions, and
 * exits non-zero if anything fails. Requires Google Chrome; override the
 * binary with CHROME_PATH. Needs a valid JIRA_* config in .env.
 */
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const PORT = 5199
const BASE = `http://localhost:${PORT}`
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let failures = 0
const ok = (name, cond) => {
  console.log(`${cond ? '  ✓' : '✗ FAIL'}  ${name}`)
  if (!cond) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- boot vite (individual mode) ----
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  env: { ...process.env, VITE_FIREBASE_API_KEY: 'REPLACE-disabled' },
  stdio: 'ignore',
  cwd: new URL('..', import.meta.url).pathname,
})
process.on('exit', () => vite.kill())
for (let i = 0; i < 40; i++) {
  try {
    await fetch(BASE)
    break
  } catch {
    await sleep(500)
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

try {
  // ---- dashboard ----
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
  await page
    .waitForFunction(() => document.body.textContent.includes('Team tasks'), { timeout: 90000 })
    .catch(async () => {
      console.log('  [debug] body:', (await page.evaluate(() => document.body.textContent)).slice(0, 200))
      throw new Error('dashboard data never appeared')
    })
  ok('dashboard loads with data', true)
  const nav = await page.evaluate(() => [...document.querySelectorAll('nav button')].map((b) => b.textContent.trim()))
  ok('individual nav: no firebase pages', !nav.some((t) => /Team Board|PR Review|Inbox/.test(t)))

  // ---- my tasks / team task ----
  for (const path of ['/my-tasks', '/team-task']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => document.querySelectorAll('table tr').length > 2, { timeout: 60000 })
    ok(`${path} table renders`, true)
  }

  // spec chip + prompt popup (needs at least one matching subtask)
  await page.waitForFunction(
    () => [...document.querySelectorAll('a')].some((a) => a.textContent.includes('Spec')),
    { timeout: 30000 },
  ).catch(() => {})
  const hasSpec = await page.evaluate(() => [...document.querySelectorAll('a')].some((a) => a.textContent.includes('Spec')))
  ok('spec chips resolve', hasSpec)
  if (hasSpec) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Prompt'))?.click())
    await sleep(400)
    ok('prompt popup opens with generated text', await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]')
      return !!dlg && dlg.textContent.includes('http') && !dlg.textContent.includes('{link}')
    }))
    await page.keyboard.press('Escape')
    await sleep(200)
  }

  // ---- delivery: summary, qa view, export button ----
  await page.evaluateOnNewDocument(() => localStorage.setItem('jiramage-default-release', ''))
  await page.goto(BASE + '/delivery', { waitUntil: 'networkidle0' })
  await sleep(800)
  // pick the first release from the dropdown if none is defaulted
  const hasRelease = await page.evaluate(() => !document.body.textContent.includes('Pick a Release'))
  if (!hasRelease) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Release'))?.click())
    await sleep(300)
    await page.evaluate(() => {
      const opts = [...document.querySelectorAll('button')].filter((b) => /\d/.test(b.textContent) && b.closest('[class*=absolute]'))
      opts[opts.length - 1]?.click()
    })
  }
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Export .xlsx')),
    { timeout: 90000 },
  )
  ok('delivery rollup + export ready', true)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'QA Info')?.click())
  await sleep(600)
  ok('QA view renders', await page.evaluate(() => document.body.textContent.includes('QA Total')))

  // ---- settings ----
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle0' })
  await sleep(400)
  const s = await page.evaluate(() => document.body.textContent)
  ok('settings zones render', s.includes('Fixed configuration') && s.includes('Dev Prompt'))

  // ---- routing guards ----
  await page.goto(BASE + '/inbox', { waitUntil: 'networkidle0' })
  await sleep(500)
  ok('hidden route redirects home', new URL(page.url()).pathname === '/')

  // ---- responsive: table scrolls sideways on phone ----
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/team-task', { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => document.querySelectorAll('table tr').length > 2, { timeout: 60000 })
  ok('phone: no body-level horizontal overflow', await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth === 0,
  ))
  ok('phone: task table scrolls sideways', await page.evaluate(() => {
    const el = document.querySelector('.overflow-x-auto')
    return !!el && el.scrollWidth > el.clientWidth
  }))

  ok('no page errors anywhere', pageErrors.length === 0)
  if (pageErrors.length) console.log('  errors:', pageErrors.slice(0, 5))
} finally {
  await browser.close()
  vite.kill()
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll smoke checks passed.')
process.exit(failures ? 1 : 0)
