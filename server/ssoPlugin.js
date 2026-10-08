import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'

// Atlassian SSO (OAuth 2.0 3LO) as a Vite dev-server plugin — Phase 0 of
// docs/PLAN-ORG-SSO.md. In 0.2.0 this same logic moves into the standalone
// server; the routes and semantics stay identical.
//
//   /auth/status    → { sso, email }  (is SSO configured / who is signed in)
//   /auth/login     → redirect to Atlassian's consent screen
//   /auth/callback  → code→token exchange, WHITELIST check (the email must
//                     already exist as a Firebase Auth user — no passwords
//                     involved), mint a Firebase custom token, set session
//   /auth/session   → { customToken, email } for the silent Firebase sign-in
//   /auth/logout    → drop the server session
//   /jira/*         → proxied with the SESSION USER's Bearer token via
//                     api.atlassian.com (refresh-on-401 with token rotation);
//                     requests without a session fall through to the legacy
//                     env-token proxy (individual mode / e2e keep working)
//
// Tokens NEVER reach the browser. Sessions are in-memory (dev server
// restart = re-login, acceptable until the 0.2.0 server).

const SCOPES = [
  'offline_access',
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'read:confluence-content.all',
  'read:confluence-content.summary',
  'search:confluence',
].join(' ')

export default function ssoPlugin(env) {
  const clientId = env.ATLASSIAN_CLIENT_ID
  const clientSecret = env.ATLASSIAN_CLIENT_SECRET
  const enabled = Boolean(clientId && clientSecret)
  const sessions = new Map() // sid -> { email, accessToken, refreshToken, cloudId, customToken }
  const pendingStates = new Map() // state -> issuedAt (10-min TTL, swept on login)
  const STATE_TTL = 10 * 60 * 1000
  const takeState = (state) => {
    const at = pendingStates.get(state)
    pendingStates.delete(state)
    return at != null && Date.now() - at < STATE_TTL
  }

  // No firebase-admin: the two operations we need (lookup user by email +
  // mint a custom token) are plain Google REST + an RS256 JWT signed with
  // the service-account key — zero dependencies, zero interop problems.
  let credCache = null
  const serviceCred = () => {
    if (!credCache) {
      const path = env.FIREBASE_SERVICE_ACCOUNT
      if (!path) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in .env')
      credCache = JSON.parse(readFileSync(path, 'utf8'))
    }
    return credCache
  }
  const b64url = (s) => Buffer.from(s).toString('base64url')
  const signRS256 = (data, key) =>
    crypto.createSign('RSA-SHA256').update(data).end().sign(key).toString('base64url')
  const signedJwt = (claims, cred) => {
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const body = b64url(JSON.stringify(claims))
    return `${header}.${body}.${signRS256(`${header}.${body}`, cred.private_key)}`
  }

  // Google OAuth token for the Identity Toolkit API (cached ~55min).
  let gTok = null
  async function googleAccessToken() {
    if (gTok && gTok.exp > Date.now() / 1000 + 60) return gTok.token
    const cred = serviceCred()
    const now = Math.floor(Date.now() / 1000)
    const assertion = signedJwt(
      {
        iss: cred.client_email,
        scope: 'https://www.googleapis.com/auth/identitytoolkit',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      cred,
    )
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    if (!r.ok) throw new Error(`google token failed: HTTP ${r.status}`)
    const j = await r.json()
    gTok = { token: j.access_token, exp: now + (j.expires_in || 3600) - 300 }
    return gTok.token
  }

  // WHITELIST lookup: does this email exist as a Firebase Auth user?
  async function firebaseUserByEmail(email) {
    const cred = serviceCred()
    const token = await googleAccessToken()
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${cred.project_id}/accounts:lookup`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [email] }),
      },
    )
    if (!r.ok) throw new Error(`firebase lookup failed: HTTP ${r.status}`)
    return (await r.json()).users?.[0] || null
  }

  // Firebase custom token = a documented RS256 JWT shape; the client
  // exchanges it via signInWithCustomToken.
  function mintCustomToken(uid) {
    const cred = serviceCred()
    const now = Math.floor(Date.now() / 1000)
    return signedJwt(
      {
        iss: cred.client_email,
        sub: cred.client_email,
        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
        iat: now,
        exp: now + 3600,
        uid,
      },
      cred,
    )
  }

  const cookieSid = (req) => /(?:^|;\s*)jm_sid=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1]
  const sessionOf = (req) => sessions.get(cookieSid(req) || '')
  const json = (res, status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(obj))
  }
  const redirect = (res, to) => {
    res.writeHead(302, { Location: to })
    res.end()
  }
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })

  const callbackUrl = (req) =>
    env.ATLASSIAN_CALLBACK_URL || `http://${req.headers.host}/auth/callback`

  async function tokenRequest(body) {
    const r = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
    })
    if (!r.ok) throw new Error(`token exchange failed: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`)
    return r.json()
  }

  // Atlassian ROTATES refresh tokens (single-use): concurrent 401s must share
  // ONE in-flight refresh — a second attempt with the consumed token would
  // fail and could nuke a perfectly valid session.
  function refreshSession(sess) {
    sess.refreshPromise ||= (async () => {
      try {
        const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: sess.refreshToken })
        sess.accessToken = t.access_token
        sess.refreshToken = t.refresh_token || sess.refreshToken
      } finally {
        sess.refreshPromise = null
      }
    })()
    return sess.refreshPromise
  }

  async function handleCallback(req, res, url) {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !takeState(state)) return redirect(res, '/login?sso_error=bad_state')
    try {
      const t = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(req),
      })
      // which Jira cloud? prefer the site configured in JIRA_URL, else first
      const resources = await (
        await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
          headers: { Authorization: `Bearer ${t.access_token}` },
        })
      ).json()
      const host = (env.JIRA_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      const site = resources.find((r) => r.url?.includes(host)) || resources[0]
      if (!site) throw new Error('no accessible Jira site for this account')
      // who signed in? (own profile always exposes the email)
      const me = await (
        await fetch(`https://api.atlassian.com/ex/jira/${site.id}/rest/api/3/myself`, {
          headers: { Authorization: `Bearer ${t.access_token}` },
        })
      ).json()
      const email = (me.emailAddress || '').toLowerCase()
      if (!email) throw new Error('Atlassian profile has no visible email')
      // WHITELIST: the email must already exist as a Firebase Auth user.
      // Nobody is auto-created; remove the user in Firebase Console to revoke.
      const fbUser = await firebaseUserByEmail(email)
      if (!fbUser)
        return redirect(res, `/login?sso_error=${encodeURIComponent(`${email} is not invited (no Firebase user)`)}`)
      const sid = crypto.randomBytes(24).toString('hex')
      sessions.set(sid, {
        email,
        uid: fbUser.localId,
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        cloudId: site.id,
      })
      res.writeHead(302, {
        Location: '/',
        'Set-Cookie': `jm_sid=${sid}; Path=/; HttpOnly; SameSite=Lax`,
      })
      res.end()
    } catch (e) {
      redirect(res, `/login?sso_error=${encodeURIComponent(e.message.slice(0, 180))}`)
    }
  }

  // /jira/<path> → api.atlassian.com/ex/jira/<cloudId>/<path> (Bearer).
  // Confluence calls arrive as /jira/wiki/<path> → ex/confluence/<cloudId>/<path>.
  async function proxyJira(req, res, sess, next) {
    const path = req.url.replace(/^\/jira/, '')
    const upstream = path.startsWith('/wiki/')
      ? `https://api.atlassian.com/ex/confluence/${sess.cloudId}${path.replace(/^\/wiki/, '')}`
      : `https://api.atlassian.com/ex/jira/${sess.cloudId}${path}`
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req)
    const fwdHeaders = (token) => {
      const h = { Authorization: `Bearer ${token}` }
      for (const k of ['content-type', 'x-atlassian-token', 'accept', 'range', 'if-none-match', 'if-modified-since']) {
        if (req.headers[k]) h[k] = req.headers[k]
      }
      return h
    }
    let r = await fetch(upstream, { method: req.method, headers: fwdHeaders(sess.accessToken), body })
    if (r.status === 401) {
      // access token expired (1h) → refresh (rotating) and retry once
      try {
        await refreshSession(sess)
        r = await fetch(upstream, { method: req.method, headers: fwdHeaders(sess.accessToken), body })
      } catch {
        sessions.delete(cookieSid(req) || '')
        return json(res, 401, { error: 'session expired — sign in again' })
      }
    }
    if ([401, 403, 404].includes(r.status) && path.startsWith('/wiki/') && env.JIRA_TOKEN) {
      // Confluence scopes can lag behind the OAuth app config — fall back to
      // the legacy env token for WIKI reads only, so spec chips keep working.
      return next()
    }
    // replay the headers media/download rendering depends on, and STREAM the
    // body (attachments can be large — never double-buffer them)
    const hdrs = {}
    for (const k of ['content-type', 'content-disposition', 'content-length', 'accept-ranges', 'content-range', 'etag', 'cache-control']) {
      const v = r.headers.get(k)
      if (v) hdrs[k] = v
    }
    res.writeHead(r.status, hdrs)
    if (!r.body) return res.end()
    Readable.fromWeb(r.body).pipe(res)
  }

  return {
    name: 'jiramage-sso',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`)
        try {
          if (url.pathname === '/auth/status') {
            return json(res, 200, {
              sso: enabled,
              email: sessionOf(req)?.email || null,
              jiraToken: Boolean(env.JIRA_TOKEN),
            })
          }
          if (!enabled) return next()
          if (url.pathname === '/auth/login') {
            for (const [st, at] of pendingStates) {
              if (Date.now() - at > STATE_TTL) pendingStates.delete(st) // sweep abandoned logins
            }
            const state = crypto.randomBytes(16).toString('hex')
            pendingStates.set(state, Date.now())
            const q = new URLSearchParams({
              audience: 'api.atlassian.com',
              client_id: clientId,
              scope: SCOPES,
              redirect_uri: callbackUrl(req),
              state,
              response_type: 'code',
              prompt: 'consent',
            })
            return redirect(res, `https://auth.atlassian.com/authorize?${q}`)
          }
          if (url.pathname === '/auth/callback') return await handleCallback(req, res, url)
          if (url.pathname === '/auth/session') {
            const sess = sessionOf(req)
            if (!sess) return json(res, 401, { error: 'no session' })
            // mint FRESH each call (sub-ms local signing) — a token stored at
            // callback time would be dead after its 1h exp
            return json(res, 200, { customToken: mintCustomToken(sess.uid), email: sess.email })
          }
          if (url.pathname === '/auth/logout' && req.method === 'POST') {
            sessions.delete(cookieSid(req) || '')
            res.writeHead(200, { 'Set-Cookie': 'jm_sid=; Path=/; Max-Age=0' })
            return res.end('{}')
          }
          if (url.pathname.startsWith('/jira/')) {
            const sess = sessionOf(req)
            if (sess) return await proxyJira(req, res, sess, next)
            if (cookieSid(req)) {
              // STALE SSO cookie (server restarted / session evicted): never
              // fall through to the env token — that would silently attribute
              // this user's writes to JIRA_EMAIL. Clear the cookie + 401 so
              // the client re-authenticates; cookieless requests (individual
              // mode, e2e) still use the legacy proxy below.
              res.writeHead(401, {
                'Content-Type': 'application/json',
                'Set-Cookie': 'jm_sid=; Path=/; Max-Age=0',
              })
              return res.end(JSON.stringify({ error: 'session expired — reload to sign in again' }))
            }
            return next() // no SSO cookie → legacy env-token proxy
          }
          return next()
        } catch (e) {
          return json(res, 500, { error: String(e.message || e).slice(0, 300) })
        }
      })
    },
  }
}
