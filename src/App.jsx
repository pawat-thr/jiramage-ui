import { useCallback, useState } from 'react'
import Sidebar from './components/layout/Sidebar.jsx'
import TopBar from './components/layout/TopBar.jsx'
import Toast from './components/common/Toast.jsx'
import TransitionModal from './features/issues/TransitionModal.jsx'
import ReassignModal from './features/issues/ReassignModal.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MyTasksPage from './pages/MyTasksPage.jsx'
import TeamPage from './pages/TeamPage.jsx'
import PrBoardPage from './pages/PrBoardPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Spinner from './components/common/Spinner.jsx'
import { useJiraData } from './hooks/useJiraData.js'
import { useToast } from './hooks/useToast.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useAuth } from './hooks/useAuth.js'
import { firebaseEnabled } from './services/firebase.js'

// PR Review needs Firebase (multi-user Firestore); it only appears in team mode.
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'my', label: 'My Tasks' },
  { id: 'team', label: 'Team' },
  ...(firebaseEnabled ? [{ id: 'pr', label: 'PR Review' }] : []),
  { id: 'settings', label: 'Settings' },
].map((t, i) => ({ ...t, key: String(i + 1) }))
const NAV_KEYS = Object.fromEntries(NAV_ITEMS.map((t) => [t.key, t.id]))
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map((t) => [t.id, t.label]))

// Auth gate: when Firebase is configured, require a session before mounting
// the shell (so no Jira fetches happen while signed out).
export default function App() {
  const auth = useAuth()

  if (auth.configured && !auth.user) {
    if (!auth.ready) return <Spinner className="min-h-dvh" label="Loading…" />
    return <LoginPage auth={auth} />
  }
  return <AppShell user={auth.user} onLogout={auth.configured ? auth.logout : null} />
}

function AppShell({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [hideDone, setHideDone] = useState(true)
  const [teamNameFilter, setTeamNameFilter] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [modal, setModal] = useState(null) // { kind: 'transition'|'reassign', issue }

  const { toast, showToast, showError } = useToast()
  const { myIssues, teamIssues, updatedAt, refreshing, refresh, reloadIssueLists } =
    useJiraData(tab, showError)

  const handleRefresh = async () => {
    if (await refresh()) showToast('✓ Refreshed — data is up to date')
  }

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
    <div className="flex min-h-dvh">
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
          {tab === 'pr' && <PrBoardPage user={user} onNotify={showToast} />}
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
