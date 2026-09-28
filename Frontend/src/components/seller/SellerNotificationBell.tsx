import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { notificationApi, type NotificationItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/components/admin/AdminNotificationBell';
import {
  SELLER_ALL_NOTIFICATIONS_PATH,
  marksReadOnOpen,
  sellerNotificationIcon,
  sellerNotificationIconClass,
  sellerNotificationTargetPath,
} from '@/lib/sellerNotifications';
import { useNotificationPolling } from '@/lib/useNotificationPolling';

const REFRESH_MS = 30000;

export const notificationsChanged = () =>
  window.dispatchEvent(new CustomEvent('emart:notifications-changed'));

export interface SellerNotificationBellProps {
  /**
   * Unread count owned by the Seller Center layout. When supplied, the bell
   * reports its count upward so sibling pages (e.g. the overview) can render the
   * same value without issuing a second `unread-count` request.
   */
  unread?: number;
  onUnreadChange?: (count: number) => void;
}

/**
 * Notification bell for the Seller Center header. Sellers only receive order /
 * message notifications. Destinations and icons come from the shared helper in
 * `@/lib/sellerNotifications` so the dropdown always agrees with the full
 * notifications page.
 */
export const SellerNotificationBell: React.FC<SellerNotificationBellProps> = ({
  unread: unreadProp,
  onUnreadChange,
}) => {
  const navigate = useNavigate();
  const [localUnread, setLocalUnread] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Controlled when the layout provides a count, self-managed otherwise.
  const isControlled = unreadProp !== undefined;
  const unread = isControlled ? unreadProp : localUnread;

  const setUnread = React.useCallback(
    (count: number) => {
      if (!isControlled) setLocalUnread(count);
      onUnreadChange?.(count);
    },
    [isControlled, onUnreadChange],
  );

  const refreshUnread = React.useCallback(async () => {
    try {
      setUnread(await notificationApi.unreadCount());
    } catch {
      // Keep the last known count — the badge is best-effort UI.
    }
  }, [setUnread]);

  const loadRecent = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list({ limit: 5 });
      setItems(res.notifications || []);
      setUnread(res.unreadCount ?? 0);
    } catch {
      // Dropdown just stays empty on network errors.
    } finally {
      setLoading(false);
    }
  }, [setUnread]);

  useNotificationPolling(refreshUnread, REFRESH_MS);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadRecent();
  };

  const handleOpenItem = async (n: NotificationItem) => {
    setOpen(false);
    // ORDER_REQUEST rows are the request record, so opening one must not retire
    // it — see marksReadOnOpen.
    if (!n.readAt && marksReadOnOpen(n)) {
      try {
        await notificationApi.markRead(n.id);
        notificationsChanged();
      } catch {
        // Continue navigating regardless.
      }
    }
    navigate(sellerNotificationTargetPath(n));
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
      notificationsChanged();
    } catch {
      // Nothing to do on failure.
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-foreground transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[26rem] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              onClick={handleMarkAll}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Inbox className="mb-2 h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = sellerNotificationIcon(n);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleOpenItem(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        sellerNotificationIconClass(n),
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn('truncate text-sm', !n.readAt ? 'font-semibold text-foreground' : '')}>
                          {n.title}
                        </span>
                        {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body || '—'}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-2">
            <button
              onClick={() => {
                setOpen(false);
                navigate(SELLER_ALL_NOTIFICATIONS_PATH);
              }}
              className="w-full rounded-lg px-3 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-muted/50"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerNotificationBell;