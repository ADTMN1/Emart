import * as React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, MessageSquare, Package, Inbox, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { messageApi, type PaginationInfo, type SellerConversationSummary } from '@/lib/api';
import { formatRelativeTime } from '@/components/admin/AdminNotificationBell';
import { cn } from '@/lib/utils';

const orderBadgeVariant: Record<string, any> = {
  CANCELLED: 'default',
  DELIVERED: 'success',
  REFUNDED: 'default',
  SHIPPED: 'primary',
  IN_TRANSIT: 'primary',
  PENDING: 'warning',
};

/** /seller/messages — the store's own conversations, ordered by last activity. */
export const SellerMessages: React.FC = () => {
  const [items, setItems] = React.useState<SellerConversationSummary[]>([]);
  const [pagination, setPagination] = React.useState<PaginationInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    messageApi
      .sellerConversations({ page: 1, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.conversations || []);
        setPagination(res.pagination || null);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Failed to load conversations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Order conversations with EMART management
        </p>
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
              <p className="text-lg font-semibold">Failed to Load Conversations</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-semibold">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                When EMART staff start a conversation about one of your orders, it will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((conv) => {
                const last = conv.lastMessage;
                return (
                  <Link
                    key={conv.id}
                    to={`/seller/messages/${conv.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                        conv.unreadCount > 0
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {<Package className="h-5 w-5" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          Order {conv.orderNumber}
                        </span>
                        <Badge
                          variant={orderBadgeVariant[conv.orderStatus] || 'info'}
                          size="xs"
                        >
                          {conv.orderStatus.replace(/_/g, ' ')}
                        </Badge>
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1 truncate">
                        {last
                          ? `${last.fromSeller ? 'You' : 'EMART Admin'}: ${last.body}`
                          : 'No messages yet'}
                      </span>
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <p className="text-sm text-muted-foreground">
          Showing page 1 of {pagination.totalPages} ({pagination.total} total)
        </p>
      )}
    </div>
  );
};

export default SellerMessages;