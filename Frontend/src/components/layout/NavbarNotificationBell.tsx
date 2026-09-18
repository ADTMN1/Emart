import * as React from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { notificationApi } from '@/lib/api'

const REFRESH_MS = 30000

/**
 * Bell for the public navbar. Rendered ONLY for signed-in users, sitting right
 * next to the account controls. Shows a red badge with the real unread count
 * (notificationApi.unreadCount) and navigates to /account/notifications.
 *
 * No blink / no layout shift: the badge is absolutely positioned and we keep
 * the last known count on failure instead of flashing zero.
 */
export const NavbarNotificationBell: React.FC = () => {
  const [unread, setUnread] = React.useState(0)

  const refreshUnread = React.useCallback(async () => {
    try {
      setUnread(await notificationApi.unreadCount())
    } catch {
      // Best-effort badge — keep the last known count on network errors.
    }
  }, [])

  React.useEffect(() => {
    refreshUnread()
    const timer = setInterval(refreshUnread, REFRESH_MS)
    const onFocus = () => refreshUnread()
    const onChange = () => refreshUnread()
    window.addEventListener('focus', onFocus)
    window.addEventListener('emart:notifications-changed', onChange)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('emart:notifications-changed', onChange)
    }
  }, [refreshUnread])

  return (
    <Link
      to="/account/notifications"
      aria-label="Notifications"
      className="relative p-2.5 rounded-lg hover:bg-muted text-foreground transition-colors"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-white flex items-center justify-center ring-2 ring-background">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export default NavbarNotificationBell