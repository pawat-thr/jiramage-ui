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
import StoryListPage from './pages/StoryListPage.jsx'
import TeamBoardPage from './pages/TeamBoardPage.jsx'
import DeliveryPage from './pages/DeliveryPage.jsx'
import PrBoardPage from './pages/PrBoardPage.jsx'
import InboxPage from './pages/InboxPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Spinner from './components/common/Spinner.jsx'
import { useJiraData } from './hooks/useJiraData.js'
import { useToast } from './hooks/useToast.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useAuth } from './hooks/useAuth.js'
import { usePrefs } from './hooks/usePrefs.js'
import { firebaseEnabled } from './services/firebase.js'

// PR Review needs Firebase (multi-user Firestore); it only appears in team mode.
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'my', label: 'My Tasks', path: '/my-tasks' },
  { id: 'team', label: 'Team Task', path: '/team-task' },
  { id: 'story', label: 'Story List', path: '/story-list' },
  { id: 'delivery', label: 'Delivery Tracking (beta)', path: '/delivery' },
  ...(firebaseEnabled
    ? [
        { id: 'board', label: 'Team Board', path: '/team-board' },
        { id: 'pr', label: 'PR Review', path: '/pr-review' },
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

  if (auth.configured && !auth.ready) return <Spinner className="min-h-dvh" label="Loading…" />

  if (auth.configured && !auth.user) {
    if (!atLogin) return <Navigate to="/login" replace />
    return <LoginPage auth={auth} />
  }
  if (atLogin) return <Navigate to="/" replace />
  return <AppShell user={auth.user} onLogout={auth.configured ? auth.logout : null} />
}

function AppShell({ user, onLogout }) {
  // The URL is the source of truth for the active page.
  const location = useLocation()
  const navigate = useNavigate()
  // Prefix match so detail routes (/story-list/DX-123, /team-board/<id>, …)
  // keep their parent page active.
  const tab = (
    NAV_ITEMS.find(
      (t) =>
        t.path !== '/' &&
        (location.pathname === t.path || location.pathname.startsWith(t.path + '/')),
    ) || NAV_ITEMS[0]
  ).id
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

  const { defaultRelease, setDefaultRelease } = usePrefs(user)

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
          {tab === 'story' && (
            <StoryListPage
              stories={storyIssues}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              defaultRelease={defaultRelease}
              onSetDefault={setDefaultRelease}
              onNotify={showToast}
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
          {tab === 'board' && <TeamBoardPage user={user} onNotify={showToast} />}
          {tab === 'pr' && <PrBoardPage user={user} onNotify={showToast} />}
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
