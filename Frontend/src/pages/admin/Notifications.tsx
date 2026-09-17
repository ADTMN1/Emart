import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, MessageSquare, ShoppingBag, CheckCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { notificationApi, type NotificationItem } from '@/lib/api';
import {
  notificationsChanged,
  formatRelativeTime,
} from '@/components/admin/AdminNotificationBell';
import { cn } from '@/lib/utils';

/** /admin/notifications — full listing with per-row read state + navigation. */
export const AdminNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [marking, setMarking] = React.useState<string | null>(null);

  const fetchPage = React.useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationApi.list({ page: p, limit: 10 });
      setItems(res.notifications || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPage(page);
  }, [fetchPage, page]);

  const openPath = (n: NotificationItem) => {
    if (n.conversationId && n.orderId) return `/admin/orders/${n.orderId}/messages`;
    if (n.orderId) return `/admin/orders/${n.orderId}`;
    return null;
  };

  const handleOpenItem = async (n: NotificationItem) => {
    setMarking(n.id);
    try {
      if (!n.readAt) {
        await notificationApi.markRead(n.id);
        notificationsChanged();
        setItems((prev) =>
          prev.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)),
        );
      }
      const to = openPath(n);
      if (to) navigate(to);
    } catch {
      // Keep the list stable; navigation is best-effort.
    } finally {
      setMarking(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead();
      notificationsChanged();
      setItems((prev) =>
        prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })),
      );
    } catch (err: any) {
      setError(err.message || 'Could not mark notifications as read');
    }
  };

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {total} notification{total === 1 ? '' : 's'}
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={unreadCount === 0} onClick={handleMarkAll}>
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-semibold">Failed to Load Notifications</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-semibold">No notifications</p>
              <p className="text-sm text-muted-foreground mt-1">
                New messages and order updates will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => {
                const Icon = n.type === 'MESSAGE' ? MessageSquare : ShoppingBag;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleOpenItem(n)}
                    disabled={marking === n.id}
                    className={cn(
                      'w-full text-left flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/50',
                      !n.readAt && 'bg-primary-50/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        n.type === 'MESSAGE'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {n.title}
                        </span>
                        {!n.readAt && (
                          <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                        )}
                      </span>
                      {n.body && (
                        <span className="block text-sm text-muted-foreground mt-0.5 truncate">
                          {n.body}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;