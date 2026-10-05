import { useEffect, useSyncExternalStore } from 'react'
import { avatarColor, initials } from '../../features/pr/prConstants.js'
import { photoOf, startProfiles, subscribeProfiles } from '../../services/profilesApi.js'
import { cx } from '../../utils/ui.js'

// The one avatar: profile photo when the member uploaded one (Settings →
// Profile), otherwise the classic initials-on-deterministic-color circle.
// `id` is the email (or any stable key — non-emails just never have a photo);
// `className` carries the size/text utilities each call site already used.
export default function Avatar({ id, name, className, title }) {
  useEffect(() => startProfiles(), [])
  const photo = useSyncExternalStore(subscribeProfiles, () => photoOf(id))
  if (photo)
    return (
      <img
        src={photo}
        alt={name || ''}
        title={title ?? name}
        className={cx('shrink-0 rounded-full object-cover', className)}
      />
    )
  return (
    <span className={cx('shrink-0', className)} style={{ background: avatarColor(id) }} title={title ?? name}>
      {initials(name || '')}
    </span>
  )
}
