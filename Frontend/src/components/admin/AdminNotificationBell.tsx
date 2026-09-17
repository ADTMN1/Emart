import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, ShoppingBag, CheckCheck, Inbox } from 'lucide-react';
import { notificationApi, type NotificationItem } from '@/lib/api';
import { cn } from '@/lib/utils';

const REFRESH_MS = 30000;

/** Broadcast event used by pages after sending a message / marking notifications. */
export const notificationsChanged = () =>
  window.dispatchEvent(new CustomEvent('emart:notifications-changed'));

export function formatRelativeTime(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const AdminNotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [unread, setUnread] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const refreshUnread = React.useCallback(async () => {
    try {
      setUnread(await notificationApi.unreadCount());
    } catch {
      // Keep the last known count — the badge is best-effort UI.
    }
  }, []);

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
  }, []);

  React.useEffect(() => {
    refreshUnread();
    const timer = setInterval(refreshUnread, REFRESH_MS);
    const onFocus = () => refreshUnread();
    const onChange = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    window.addEventListener('emart:notifications-changed', onChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('emart:notifications-changed', onChange);
    };
  }, [refreshUnread]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadRecent();
  };

  const openPath = (n: NotificationItem) => {
    if (n.conversationId && n.orderId) return `/admin/orders/${n.orderId}/messages`;
    if (n.orderId) return `/admin/orders/${n.orderId}`;
    return null;
  };

  const handleOpenItem = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.readAt) {
      try {
        await notificationApi.markRead(n.id);
        notificationsChanged();
      } catch {
        // Continue navigating regardless.
      }
    }
    const to = openPath(n);
    if (to) navigate(to);
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
        className="relative p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[26rem] overflow-hidden bg-card border border-border rounded-xl shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Notifications</p>
            <button
              onClick={handleMarkAll}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-10 flex flex-col items-center text-center">
                <Inbox className="h-7 w-7 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = n.type === 'MESSAGE' ? MessageSquare : ShoppingBag;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleOpenItem(n)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        n.type === 'MESSAGE' ? 'bg-secondary/15 text-destructive' : 'bg-primary/10 text-primary'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn('font-semibold text-sm truncate', !n.readAt && 'text-foreground')}>
                          {n.title}
                        </span>
                        {!n.readAt && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                        {n.body || '—'}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
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
                navigate('/admin/notifications');
              }}
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-muted/50 text-center transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};