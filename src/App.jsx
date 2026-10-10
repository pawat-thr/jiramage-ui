import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar.jsx'
import TopBar from './components/layout/TopBar.jsx'
import Toast from './components/common/Toast.jsx'
import TransitionModal from './features/issues/TransitionModal.jsx'
import ReassignModal from './features/issues/ReassignModal.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
// Every other page is its own lazy chunk: first paint ships only the shell +
// dashboard; a page's code downloads on first visit (and is then cached).
const MyTasksPage = lazy(() => import('./pages/MyTasksPage.jsx'))
const TeamPage = lazy(() => import('./pages/TeamPage.jsx'))
const TeamBoardPage = lazy(() => import('./pages/TeamBoardPage.jsx'))
const DeliveryPage = lazy(() => import('./pages/DeliveryPage.jsx'))
const PrBoardPage = lazy(() => import('./pages/PrBoardPage.jsx'))
const InboxPage = lazy(() => import('./pages/InboxPage.jsx'))
const IntegrationPage = lazy(() => import('./pages/IntegrationPage.jsx'))
const SubtaskGenPage = lazy(() => import('./pages/SubtaskGenPage.jsx'))
const CapacityPage = lazy(() => import('./pages/CapacityPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const TeamagePage = lazy(() => import('./pages/TeamagePage.jsx'))
import Spinner from './components/common/Spinner.jsx'
import { useJiraData } from './hooks/useJiraData.js'
import { useToast } from './hooks/useToast.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useAuth } from './hooks/useAuth.js'
import { usePrefs } from './hooks/usePrefs.js'
import { firebaseEnabled } from './services/firebase.js'
import {
  loadTeamConfig,
  applyTeamConfig,
  missingRequired,
  cachedTeamConfig,
  cacheTeamConfig,
  configDiffers,
} from './services/configApi.js'
import { CFG, teamMembers } from './config/appConfig.js'
import { ssoStatus } from './services/ssoClient.js'
import { teamsEnabled, resolveMembership, applyTeamRoster } from './services/teamsApi.js'

// PR Review needs Firebase (multi-user Firestore); it only appears in team mode.
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'my', label: 'My Tasks', path: '/my-tasks' },
  { id: 'team', label: 'Team Task', path: '/team-task' },
  { id: 'delivery', label: 'Delivery Tracking (beta)', path: '/delivery' },
  { id: 'gen', label: 'Spec Wizard (beta)', path: '/subtask-gen' },
  { id: 'capacity', label: 'Capacity Planner (beta)', path: '/capacity' },
  ...(firebaseEnabled
    ? [
        { id: 'board', label: 'Team Board', path: '/team-board' },
        { id: 'pr', label: 'PR Review', path: '/pr-review' },
        { id: 'integration', label: 'Integration Plan', path: '/integration' },
        { id: 'inbox', label: 'Inbox', path: '/inbox' },
      ]
    : []),
  ...(firebaseEnabled ? [{ id: 'teamage', label: 'Teamage', path: '/teamage' }] : []),
  { id: 'settings', label: 'Settings', path: '/settings' },
].map((t, i) => ({ ...t, key: String(i + 1) }))
const NAV_KEYS = Object.fromEntries(NAV_ITEMS.map((t) => [t.key, t.id]))
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map((t) => [t.id, t.label]))

// Auth gate: when Firebase is configured, require a session before mounting
// the shell (so no Jira fetches happen while signed out). /login is a real
// route: signed-out users land there, signed-in users get bounced to home.
export default function App() {
  const auth = useAuth()
  const location = useLocation()
  const atLogin = location.pathname === '/login'

  // Team config overlay: Firestore settings/config overwrites the movable
  // .env fields on CFG (per field: Firebase > .env > default) BEFORE any page
  // renders. Startup must never hang on a cold Firestore read, so:
  //  - cached copy (localStorage) applies INSTANTLY; the fresh doc is fetched
  //    in the background and cached for the next load
  //  - first run (no cache): gate on the fetch, capped at 4s → then proceed
  //    with .env values (the fetch still fills the cache when it lands)
  const appliedCfgRef = useRef(null) // the raw doc that was overlaid (null = .env only)
  const freshCfgRef = useRef(null) // the latest doc fetched from Firestore this session
  const [cfgReady, setCfgReady] = useState(() => {
    if (!firebaseEnabled) return true
    const cached = cachedTeamConfig()
    if (!cached) return false
    applyTeamConfig(cached)
    appliedCfgRef.current = cached
    return true
  })
  const [cfgStale, setCfgStale] = useState(false) // fresh doc differs from what booted
  // Jira access matrix: no Firebase → JIRA_TOKEN required (minimum app);
  // Firebase + SSO → tokenless (each user's own Jira permission). Neither
  // token nor SSO → nothing can reach Jira: block with a clear screen.
  const [jiraAccess, setJiraAccess] = useState(true)
  // Teamage membership: with TEAMS configured, a signed-in user must belong
  // to a team (lead via env, member via Firestore). Their team's member list
  // then BECOMES the roster (CFG.teamEmails overlay) — every page shows that
  // team's data. No team → landing page. Feature off → env roster as always.
  const [membership, setMembership] = useState(() => (teamsEnabled() ? null : { off: true }))
  useEffect(() => {
    ssoStatus().then((st) => setJiraAccess(st.sso || st.jiraToken !== false))
  }, [])
  useEffect(() => {
    if (!teamsEnabled() || !auth.user) return
    let on = true
    resolveMembership(auth.user.email)
      .then((m) => {
        if (!on) return
        if (m) {
          applyTeamRoster(m, auth.user.email)
          // team now active → second overlay pass so the PER-TEAM config
          // fields (JIRA_PROJECT__<team>, …) win over the shared values.
          // Pages haven't rendered yet (both gates below still closed), so
          // this never swaps CFG under a live tree. If the config doc lands
          // AFTER this, its own applyTeamConfig runs with the team already
          // active — either order ends with both layers applied.
          if (appliedCfgRef.current) applyTeamConfig(appliedCfgRef.current)
          // and re-run the staleness check: if the fetch landed BEFORE the
          // team was known, configDiffers compared only plain keys then —
          // compare again now that the team's own keys count.
          if (freshCfgRef.current && configDiffers(freshCfgRef.current, appliedCfgRef.current))
            setCfgStale(true)
        }
        setMembership(m || { none: true })
      })
      // a FAILED lookup is not "no team" — say what broke (usually: the
      // teams/ rules block not published yet)
      .catch((e) => on && setMembership({ none: true, error: e.message }))
    return () => {
      on = false
    }
  }, [auth.user])
  useEffect(() => {
    if (!firebaseEnabled || !auth.user) return
    let on = true
    // First run without cache: don't gate longer than 4s. Marking the .env
    // values as "applied" here means a later-arriving doc is cache-only (for
    // the next reload) — never a mid-session CFG swap on a rendered tree.
    const giveUp = setTimeout(() => {
      if (!on) return
      appliedCfgRef.current ??= {}
      setCfgReady(true)
    }, 4000)
    loadTeamConfig()
      .then((data) => {
        if (!on) return
        freshCfgRef.current = data
        cacheTeamConfig(data)
        if (appliedCfgRef.current == null) {
          // still gating (first run) → the fresh values apply right now
          applyTeamConfig(data)
          appliedCfgRef.current = data
        } else if (configDiffers(data, appliedCfgRef.current)) {
          // booted on a stale cache (or .env) — offer a reload, never swap live
          setCfgStale(true)
        }
        setCfgReady(true)
      })
      .catch(() => {
        // unreachable → the .env/cached values stand
        if (!on) return
        appliedCfgRef.current ??= {}
        setCfgReady(true)
      })
      .finally(() => clearTimeout(giveUp))
    return () => {
      on = false
      clearTimeout(giveUp)
    }
  }, [auth.user])

  if (auth.configured && !auth.ready) return <Spinner className="min-h-dvh" label="Loading…" />

  if (auth.configured && !auth.user) {
    if (!atLogin) return <Navigate to="/login" replace />
    return <LoginPage auth={auth} />
  }
  if (atLogin) return <Navigate to="/" replace />
  if (!cfgReady) return <Spinner className="min-h-dvh" label="Loading team config…" />
  if (teamsEnabled() && auth.user) {
    if (membership === null) return <Spinner className="min-h-dvh" label="Loading your team…" />
    if (membership.none)
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <div className="max-w-md rounded-2xl border border-line bg-panel p-6 text-center shadow-lift">
            <h1 className="text-lg font-semibold">No team yet</h1>
            <p className="mt-2 text-sm text-ink-soft">
              You're signed in as <strong>{auth.user.email}</strong>, but you're
              not in any team.
            </p>
            {membership.error ? (
              <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                Membership lookup FAILED (not a real "no team"): {String(membership.error)}.
                Most likely the <code>teams/</code> block in firestore.rules isn't published yet.
              </p>
            ) : (
              <p className="mt-3 text-[13px] text-muted">
                Ask your team lead to add you on the <strong>Teamage</strong> page —
                then reload and the team's workspace appears.
              </p>
            )}
            {auth.logout && (
              <button
                className="mt-5 rounded-full border border-line bg-field px-5 py-2 text-sm text-ink-soft hover:border-line-strong hover:text-ink"
                onClick={auth.logout}
              >
                Log out
              </button>
            )}
          </div>
        </div>
      )
  }
  if (!jiraAccess)
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-danger/40 bg-panel p-6 text-center shadow-lift">
          <h1 className="text-lg font-semibold text-danger">No way to reach Jira</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Neither a <code className="text-accent-bright">JIRA_TOKEN</code> nor Atlassian SSO is configured.
          </p>
          <p className="mt-3 text-[13px] text-muted">
            Minimum app: set <code>JIRA_TOKEN</code> in <code>.env</code>. Team mode with SSO:
            set <code>ATLASSIAN_CLIENT_ID/SECRET</code> + the Firebase service account
            (see docs/PLAN-ORG-SSO.md) — then no token is needed.
          </p>
        </div>
      </div>
    )
  {
    // Rule 4: a required field with no value from Firebase OR .env blocks the
    // app — better an explicit screen than every Jira query silently empty.
    const missing = missingRequired()
    if (missing.length)
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <div className="max-w-md rounded-2xl border border-danger/40 bg-panel p-6 text-center shadow-lift">
            <h1 className="text-lg font-semibold text-danger">Configuration missing</h1>
            <p className="mt-2 text-sm text-ink-soft">
              No value found for: <code className="text-accent-bright">{missing.join(', ')}</code>
            </p>
            <p className="mt-3 text-[13px] text-muted">
              Add {missing.length === 1 ? 'it' : 'them'} to your <code>.env</code> and restart
              {firebaseEnabled ? ', or set them in Settings → Team configuration (Firebase)' : ''}.
            </p>
          </div>
        </div>
      )
  }
  return (
    <>
      <AppShell user={auth.user} onLogout={auth.configured ? auth.logout : null} membership={membership} />
      {cfgStale && (
        <button
          className="zoom-normal fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-accent bg-accent-soft px-4 py-2 text-[13px] font-semibold text-accent-bright shadow-lift transition-colors hover:bg-accent hover:text-bg"
          onClick={() => window.location.reload()}
          title="A teammate changed the team configuration since this page loaded"
        >
          ⚙ Team config updated — reload to apply
        </button>
      )}
    </>
  )
}

function AppShell({ user, onLogout, membership }) {
  // Capacity Planner roster: AppShell mounts only after the membership gate,
  // so the team roster overlay is already on CFG — never computed at module
  // load, where it would freeze the pre-overlay env roster and leak every
  // team into the planner. Keyed on membership so identity stays stable.
  const planEmails = useMemo(() => teamMembers(), [membership]) // eslint-disable-line react-hooks/exhaustive-deps
  // The URL is the source of truth for the active page.
  const location = useLocation()
  const navigate = useNavigate()
  // Prefix match so detail routes (/delivery/DX-123, /team-board/<id>, …)
  // keep their parent page active.
  const matched = NAV_ITEMS.find(
    (t) =>
      t.path !== '/' &&
      (location.pathname === t.path || location.pathname.startsWith(t.path + '/')),
  )
  const tab = (matched || NAV_ITEMS[0]).id
  // Unknown URLs (e.g. /inbox in individual mode, typos) → clean redirect home
  // instead of showing the dashboard under a wrong address.
  const unknownPath = !matched && location.pathname !== '/'
  const setTab = useCallback(
    (id) => {
      const item = NAV_ITEMS.find((t) => t.id === id)
      if (item) navigate(item.path)
    },
    [navigate],
  )
  const [hideDone, setHideDone] = useState(true)
  const [teamNameFilter, setTeamNameFilter] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [modal, setModal] = useState(null) // { kind: 'transition'|'reassign', issue }

  const { toast, showToast, showError } = useToast()
  const { myIssues, teamIssues, storyIssues, updatedAt, refreshing, refresh, reloadIssueLists } =
    useJiraData(tab, showError)

  const handleRefresh = async () => {
    if (await refresh()) showToast('✓ Refreshed — data is up to date')
  }

  const { defaultRelease } = usePrefs(user)

  // Clear the Team member filter when navigating AWAY from Team Task, so the
  // page always opens fresh. (Dashboard→Team drill-through still works: it
  // sets the filter while entering, not leaving.)
  const prevTab = useRef(tab)
  useEffect(() => {
    if (prevTab.current === 'team' && tab !== 'team') setTeamNameFilter('')
    prevTab.current = tab
  }, [tab])

  const toggleHide = useCallback(() => setHideDone((v) => !v), [])
  useKeyboardShortcuts({
    enabled: !modal,
    tabKeys: NAV_KEYS,
    onTab: setTab,
    onToggleHide: toggleHide,
  })

  const afterAction = (msg) => {
    setModal(null)
    showToast(`✓ ${msg}`)
    reloadIssueLists()
  }

  const openTransition = (issue) => setModal({ kind: 'transition', issue })
  const openReassign = (issue) => setModal({ kind: 'reassign', issue })

  if (unknownPath) return <Navigate to="/" replace />

  return (
    <div className="app-zoom flex min-h-dvh">
      <Sidebar
        items={NAV_ITEMS.filter((t) => t.id !== 'teamage' || membership?.role === 'lead')}
        teamName={membership?.team || null}
        active={tab}
        onSelect={setTab}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={PAGE_TITLES[tab]}
          updatedAt={updatedAt}
          user={user}
          onLogout={onLogout}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onToggleMobile={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-4 md:p-6">
          {/* key={tab} remounts the wrapper so the enter animation replays on page change */}
          <div key={tab} className="animate-enter">
          <Suspense fallback={<Spinner label="Loading page…" />}>
          {tab === 'dashboard' && (
            <DashboardPage
              teamIssues={teamIssues}
              myIssues={myIssues}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onPickMember={(name) => {
                setTeamNameFilter(name)
                setTab('team')
              }}
            />
          )}
          {tab === 'my' && (
            <MyTasksPage
              issues={myIssues}
              hideDone={hideDone}
              onToggleHide={toggleHide}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onTransition={openTransition}
              onReassign={openReassign}
            />
          )}
          {tab === 'team' && (
            <TeamPage
              issues={teamIssues}
              hideDone={hideDone}
              nameFilter={teamNameFilter}
              onNameFilter={setTeamNameFilter}
              onToggleHide={toggleHide}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onTransition={openTransition}
              onReassign={openReassign}
            />
          )}
          {tab === 'delivery' && (
            <DeliveryPage
              stories={storyIssues}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              defaultRelease={defaultRelease}
              onNotify={showToast}
            />
          )}
          {tab === 'gen' && <SubtaskGenPage onNotify={showToast} />}
          {tab === 'capacity' && <CapacityPage onNotify={showToast} emails={planEmails} />}
          {tab === 'board' && <TeamBoardPage user={user} onNotify={showToast} />}
          {tab === 'pr' && <PrBoardPage user={user} onNotify={showToast} />}
          {tab === 'integration' && (
            <IntegrationPage defaultRelease={defaultRelease} onNotify={showToast} />
          )}
          {tab === 'inbox' && <InboxPage user={user} onNotify={showToast} />}
          {tab === 'teamage' && <TeamagePage user={user} onNotify={showToast} />}
          {tab === 'settings' && <SettingsPage onNotify={showToast} user={user} />}
          </Suspense>
          </div>
        </main>
      </div>

      {modal?.kind === 'transition' && (
        <TransitionModal
          issue={modal.issue}
          onClose={() => setModal(null)}
          onDone={afterAction}
          onError={showError}
        />
      )}
      {modal?.kind === 'reassign' && (
        <ReassignModal
          issue={modal.issue}
          onClose={() => setModal(null)}
          onDone={afterAction}
          onError={showError}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
