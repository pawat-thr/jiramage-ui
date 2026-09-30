import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar.jsx'
import TopBar from './components/layout/TopBar.jsx'
import Toast from './components/common/Toast.jsx'
import TransitionModal from './features/issues/TransitionModal.jsx'
import ReassignModal from './features/issues/ReassignModal.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MyTasksPage from './pages/MyTasksPage.jsx'
import TeamPage from './pages/TeamPage.jsx'
import TeamBoardPage from './pages/TeamBoardPage.jsx'
import DeliveryPage from './pages/DeliveryPage.jsx'
import PrBoardPage from './pages/PrBoardPage.jsx'
import InboxPage from './pages/InboxPage.jsx'
import IntegrationPage from './pages/IntegrationPage.jsx'
import SubtaskGenPage from './pages/SubtaskGenPage.jsx'
import QaCapacityPage from './qa/QaCapacityPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Spinner from './components/common/Spinner.jsx'
import { useJiraData } from './hooks/useJiraData.js'
import { useToast } from './hooks/useToast.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useAuth } from './hooks/useAuth.js'
import { usePrefs } from './hooks/usePrefs.js'
import { firebaseEnabled } from './services/firebase.js'
import { fetchTeamIssues } from './services/jiraApi.js'
import {
  loadTeamConfig,
  applyTeamConfig,
  missingRequired,
  cachedTeamConfig,
  cacheTeamConfig,
  configDiffers,
} from './services/configApi.js'
import { CFG, teamMembers } from './config/appConfig.js'
import QaApp, { QA_BASE } from './qa/QaApp.jsx'

// Main-mode Capacity Planner plans for the whole dev team roster.
const TEAM_PLAN_EMAILS = teamMembers()

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
  const [cfgReady, setCfgReady] = useState(() => {
    if (!firebaseEnabled) return true
    const cached = cachedTeamConfig()
    if (!cached) return false
    applyTeamConfig(cached)
    appliedCfgRef.current = cached
    return true
  })
  const [cfgStale, setCfgStale] = useState(false) // fresh doc differs from what booted
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
      {location.pathname.startsWith(QA_BASE) ? (
        <QaApp user={auth.user} onLogout={auth.configured ? auth.logout : null} />
      ) : (
        <AppShell user={auth.user} onLogout={auth.configured ? auth.logout : null} />
      )}
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

function AppShell({ user, onLogout }) {
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
        items={NAV_ITEMS}
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
          mode="main"
          onSwitchMode={() => navigate(QA_BASE)}
        />

        <main className="flex-1 p-4 md:p-6">
          {/* key={tab} remounts the wrapper so the enter animation replays on page change */}
          <div key={tab} className="animate-enter">
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
          {tab === 'capacity' && (
            <QaCapacityPage
              onNotify={showToast}
              emails={TEAM_PLAN_EMAILS}
              fetchIssues={fetchTeamIssues}
              teamLabel="member"
              envVar="TEAM_EMAILS"
            />
          )}
          {tab === 'board' && <TeamBoardPage user={user} onNotify={showToast} />}
          {tab === 'pr' && <PrBoardPage user={user} onNotify={showToast} />}
          {tab === 'integration' && (
            <IntegrationPage defaultRelease={defaultRelease} onNotify={showToast} />
          )}
          {tab === 'inbox' && <InboxPage user={user} onNotify={showToast} />}
          {tab === 'settings' && <SettingsPage onNotify={showToast} user={user} />}
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
