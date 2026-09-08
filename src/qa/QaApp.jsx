import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar.jsx'
import TopBar from '../components/layout/TopBar.jsx'
import Toast from '../components/common/Toast.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import TeamPage from '../pages/TeamPage.jsx'
import TransitionModal from '../features/issues/TransitionModal.jsx'
import ReassignModal from '../features/issues/ReassignModal.jsx'
import { fetchQaIssues } from '../services/jiraApi.js'
import { useToast } from '../hooks/useToast.js'
import { CFG } from '../config/appConfig.js'
import { card, emptyState } from '../utils/ui.js'

export const QA_BASE = '/jiramage/qa'

// QA Mode nav — more pages land here as they're built. (No Settings: the
// main site's Settings applies everywhere.)
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: QA_BASE },
  { id: 'team', label: 'Team Task', path: `${QA_BASE}/team-task` },
].map((t, i) => ({ ...t, key: String(i + 1) }))
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map((t) => [t.id, t.label]))

// The QA sub-site: same shell as the main app, blue accent, QA-team data.
export default function QaApp({ user, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Blue accent while (and only while) the QA sub-site is mounted.
  useEffect(() => {
    document.documentElement.setAttribute('data-mode', 'qa')
    return () => document.documentElement.removeAttribute('data-mode')
  }, [])

  // Exact match first; prefix match only for non-base items (the Dashboard's
  // path IS the base, so a naive prefix rule would swallow every sub-path).
  const matched =
    NAV_ITEMS.find((t) => location.pathname === t.path) ||
    NAV_ITEMS.find((t) => t.path !== QA_BASE && location.pathname.startsWith(t.path + '/'))
  const tab = (matched || NAV_ITEMS[0]).id
  const unknown = !matched

  const setTab = useCallback(
    (id) => {
      const item = NAV_ITEMS.find((t) => t.id === id)
      if (item) navigate(item.path)
    },
    [navigate],
  )

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hideDone, setHideDone] = useState(true)
  const [nameFilter, setNameFilter] = useState('')
  const [modal, setModal] = useState(null) // { kind: 'transition'|'reassign', issue }
  const { toast, showToast, showError } = useToast()

  // QA issues: fetched here (no auto-refresh yet — QA Mode is init-stage).
  const [issues, setIssues] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setIssues(await fetchQaIssues())
    } catch (err) {
      showError(err.message)
      setIssues([])
    } finally {
      setRefreshing(false)
    }
  }, [showError])
  useEffect(() => {
    load()
  }, [load])

  const afterAction = (msg) => {
    setModal(null)
    showToast(`✓ ${msg}`)
    load()
  }

  if (unknown) return <Navigate to={QA_BASE} replace />

  return (
    <div className="app-zoom flex min-h-dvh">
      <Sidebar
        items={NAV_ITEMS}
        active={tab}
        onSelect={setTab}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        brand="QA-mage"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={PAGE_TITLES[tab]}
          user={user}
          onLogout={onLogout}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onToggleMobile={() => setMobileOpen(true)}
          mode="qa"
          onSwitchMode={() => navigate('/')}
        />

        <main className="flex-1 p-4 md:p-6">
          <div key={tab} className="animate-enter">
            {tab === 'dashboard' &&
              (CFG.qaEmails.length === 0 ? (
                <div className={card}>
                  <div className={emptyState}>
                    No QA team configured — add <code className="text-accent-bright">QA_EMAILS</code>{' '}
                    to your .env and restart.
                  </div>
                </div>
              ) : (
                <DashboardPage
                  teamIssues={issues}
                  myIssues={[]}
                  onRefresh={async () => {
                    await load()
                    showToast('✓ Refreshed — QA data is up to date')
                  }}
                  refreshing={refreshing}
                  onPickMember={(name) => {
                    setNameFilter(name)
                    navigate(`${QA_BASE}/team-task`)
                  }}
                  memberEmails={CFG.qaEmails}
                  burnStatuses={CFG.qaBurnStatuses}
                />
              ))}
            {tab === 'team' && (
              <TeamPage
                issues={issues}
                hideDone={hideDone}
                nameFilter={nameFilter}
                onNameFilter={setNameFilter}
                onToggleHide={() => setHideDone((v) => !v)}
                onRefresh={async () => {
                  await load()
                  showToast('✓ Refreshed — QA data is up to date')
                }}
                refreshing={refreshing}
                onTransition={(issue) => setModal({ kind: 'transition', issue })}
                onReassign={(issue) => setModal({ kind: 'reassign', issue })}
                burnStatuses={CFG.qaBurnStatuses}
                burnFinishedStatuses={CFG.qaBurnFinishedStatuses}
              />
            )}
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
