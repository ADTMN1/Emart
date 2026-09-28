import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { notificationApi, type NotificationItem } from '@/lib/api';
import { formatRelativeTime } from '@/components/admin/AdminNotificationBell';
import { cn } from '@/lib/utils';
import {
  marksReadOnOpen,
  sellerNotificationIcon,
  sellerNotificationIconClass,
  sellerNotificationTargetPath,
  sellerNotificationTypeLabel,
} from '@/lib/sellerNotifications';

const PAGE_SIZE = 20;

/** Badge variant for the order-request decision state, or null for other types. */
const requestStatusVariant: Record<string, any> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'secondary',
};

/**
 * /seller/notifications — the full seller notification history.
 *
 * Read-only with respect to the backend contract: it consumes the existing
 * `notificationApi` endpoints and never creates notifications. It shares
 * `sellerNotificationTargetPath` with the navbar bell so both resolve the same
 * destination, and it re-reads on `emart:notifications-changed` so acting on an
 * item in one surface immediately updates the other.
 */
export const SellerNotifications: React.FC = () => {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await notificationApi.list({ page: targetPage, limit: PAGE_SIZE });
        setItems(res.notifications || []);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setTotal(res.pagination?.total ?? (res.notifications || []).length);
      } catch (err: any) {
        setError(err.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    load(page);
  }, [load, page]);

  // Keep in sync with the bell (and with accept/decline actions elsewhere).
  React.useEffect(() => {
    const onChange = () => load(page);
    window.addEventListener('emart:notifications-changed', onChange);
    return () => window.removeEventListener('emart:notifications-changed', onChange);
  }, [load, page]);

  const handleOpen = async (n: NotificationItem) => {
    // ORDER_REQUEST rows are the request record; opening one must not mark the
    // request handled. See marksReadOnOpen.
    if (!n.readAt && marksReadOnOpen(n)) {
      try {
        await notificationApi.markRead(n.id);
        setItems((prev) =>
          prev.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)),
        );
        window.dispatchEvent(new CustomEvent('emart:notifications-changed'));
      } catch {
        // Navigating still works even if the read-receipt fails.
      }
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
      window.dispatchEvent(new CustomEvent('emart:notifications-changed'));
    } catch (err: any) {
      setError(err.message || 'Failed to mark all as read');
    }
  };

  const anyUnread = items.some((i) => !i.readAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Order requests and messages from EMART
            {total > 0 ? ` · ${total} total` : ''}
          </p>
        </div>
        <button
          onClick={handleMarkAll}
          disabled={!anyUnread}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2',
            'text-xs font-semibold text-primary transition-colors hover:bg-muted/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-semibold">Failed to Load Notifications</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-semibold">No notifications yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Order requests and messages from EMART will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => {
                const Icon = sellerNotificationIcon(n);
                const target = sellerNotificationTargetPath(n);
                return (
                  <Link
                    key={n.id}
                    to={target}
                    onClick={() => handleOpen(n)}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        sellerNotificationIconClass(n),
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'text-sm',
                            n.readAt ? 'text-foreground' : 'font-semibold text-foreground',
                          )}
                        >
                          {n.title}
                        </span>
                        <Badge variant="info" size="xs">
                          {sellerNotificationTypeLabel(n.type)}
                        </Badge>
                        {n.requestStatus && (
                          <Badge
                            variant={requestStatusVariant[n.requestStatus] || 'info'}
                            size="xs"
                          >
                            {n.requestStatus}
                          </Badge>
                        )}
                        {!n.readAt && <span className="h-2 w-2 rounded-full bg-destructive" />}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1">
                        {n.body || '—'}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap hidden sm:block">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default SellerNotifications;
