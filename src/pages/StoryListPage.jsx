import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FilterMenu from '../components/common/FilterMenu.jsx'
import RefreshButton from '../components/common/RefreshButton.jsx'
import Spinner from '../components/common/Spinner.jsx'
import StoryTable, { releaseNames } from '../features/story/StoryTable.jsx'
import StoryDetail from '../features/story/StoryDetail.jsx'
import { uniqueSorted } from '../utils/format.js'
import { cx, chip, chipOn, searchInput, toolbar } from '../utils/ui.js'

// Pseudo status option: everything except finished/cancelled stories.
const ACTIVE = 'Active'
const ACTIVE_EXCLUDES = ['done', 'dropped / cancelled']
const isActiveStory = (iss) =>
  !ACTIVE_EXCLUDES.includes((iss.fields.status.name || '').toLowerCase().trim())

export default function StoryListPage({
  stories,
  onRefresh,
  refreshing,
  defaultRelease = '',
  onSetDefault,
  onNotify,
}) {
  // Open pre-filtered to the saved default Release (if any). In team mode the
  // saved value arrives async from Firestore, so keep adopting it until the
  // user picks a release manually.
  const [release, setReleaseState] = useState(defaultRelease)
  const [releaseTouched, setReleaseTouched] = useState(false)
  useEffect(() => {
    if (!releaseTouched) setReleaseState(defaultRelease)
  }, [defaultRelease, releaseTouched])
  const setRelease = (v) => {
    setReleaseTouched(true)
    setReleaseState(v)
  }
  // Default status view hides finished/cancelled stories.
  const [status, setStatus] = useState(ACTIVE)
  const [search, setSearch] = useState('')
  // Detail view is URL-driven: /story-list/<KEY>
  const location = useLocation()
  const navigate = useNavigate()
  const selectedKey = location.pathname.startsWith('/story-list/')
    ? decodeURIComponent(location.pathname.slice('/story-list/'.length))
    : null

  const isDefault = release === defaultRelease
  const saveDefault = () => {
    onSetDefault(release)
    onNotify(release ? `✓ Default release set to “${release}”` : '✓ Default cleared — showing all')
  }

  const releaseOptions = useMemo(
    () => uniqueSorted((stories || []).flatMap(releaseNames)),
    [stories],
  )
  const statusOptions = useMemo(
    () => [ACTIVE, ...uniqueSorted((stories || []).map((i) => i.fields.status.name)).filter((n) => n.toLowerCase() !== 'active')],
    [stories],
  )

  const visible = useMemo(() => {
    return (stories || []).filter((iss) => {
      if (release && !releaseNames(iss).includes(release)) return false
      if (status === ACTIVE) {
        if (!isActiveStory(iss)) return false
      } else if (status && iss.fields.status.name !== status) return false
      if (search) {
        const hay = `${iss.key} ${iss.fields.summary}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [stories, release, status, search])

  if (selectedKey) {
    return (
      <div key={selectedKey} className="animate-enter">
        <StoryDetail storyKey={selectedKey} onBack={() => navigate('/story-list')} />
      </div>
    )
  }

  return (
    <div key="story-list" className="animate-enter">
      <div className={toolbar}>
        <input
          type="search"
          className={searchInput}
          placeholder="Search stories by key or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterMenu label="Release" value={release} options={releaseOptions} onPick={setRelease} />
        <FilterMenu label="Status" value={status} options={statusOptions} onPick={setStatus} />
        <button
          className={cx(chip, isDefault && chipOn)}
          onClick={saveDefault}
          disabled={isDefault}
          title="Open Story List on this release next time"
        >
          {isDefault ? '★ Default' : '☆ Set as default'}
        </button>
        <RefreshButton refreshing={refreshing} onClick={onRefresh} />
        <span className="flex-1" />
        <span className="text-[13px] text-muted">
          {visible.length} stor{visible.length === 1 ? 'y' : 'ies'}
        </span>
      </div>
      {stories === null ? (
        <Spinner label="Loading stories…" />
      ) : (
        <StoryTable stories={visible} onOpen={(k) => navigate(`/story-list/${k}`)} />
      )}
    </div>
  )
}
