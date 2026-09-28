import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, AlertCircle, Package, Eye, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface OrderRequest {
  notification: {
    id: string;
    title: string;
    body: string;
    orderId: string | null;
    readAt: string | null;
    createdAt: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    total: number;
    items: Array<{ product: { name: string; condition: string } }>;
  } | null;
}

interface OrderRequestsResponse {
  requests: Array<{
    notification: {
      id: string;
      title: string;
      body: string;
      orderId: string | null;
      readAt: string | null;
      createdAt: string;
    };
    order: {
      id: string;
      orderNumber: string;
      status: string;
      createdAt: string;
      total: number;
      items: Array<{ product: { name: string; condition: string } }>;
    } | null;
  }> | null;
}

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary' | 'primary' | 'accent'> = {
  PENDING: 'warning',
  PAYMENT_RECEIVED: 'info',
  PURCHASING: 'info',
  PURCHASED: 'info',
  IN_WAREHOUSE: 'primary',
  CONSOLIDATED: 'secondary',
  SHIPPED: 'accent',
  IN_TRANSIT: 'accent',
  OUT_FOR_DELIVERY: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
  REFUNDED: 'secondary',
};

const statusBadge = (status: string) => {
  const variant = statusVariant[status] || 'secondary';
  return <Badge variant={variant} size="sm">{status.replace(/_/g, ' ')}</Badge>;
};

const renderOrderDetails = (order: { id: string; orderNumber: string; status: string; createdAt: string; total: number; items: Array<{ product: { name: string; condition: string } }> } | null) => {
  if (!order) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Items</p>
      <div className="flex flex-wrap gap-2">
        {order.items.slice(0, 3).map((item, i) => (
          <Badge key={i} variant="outline" className="text-xs">
            {item.product.name} ({item.product.condition})
          </Badge>
        ))}
        {order.items.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{order.items.length - 3} more
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-semibold">{formatCurrency(order.total, 'USD')}</span>
      </div>
    </div>
  );
};

interface OrderRequestCardProps {
  notification: {
    id: string;
    title: string;
    body: string;
    orderId: string | null;
    readAt: string | null;
    createdAt: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    total: number;
    items: Array<{ product: { name: string; condition: string } }>;
  } | null;
  onConfirm: (notificationId: string) => Promise<void>;
  onDecline: (notificationId: string) => Promise<void>;
  onViewOrder: (orderId: string) => void;
  confirmingId: string | null;
  decliningId: string | null;
}

const OrderRequestCard: React.FC<OrderRequestCardProps> = ({
  notification,
  order,
  onConfirm,
  onDecline,
  onViewOrder,
  confirmingId,
  decliningId,
}) => {
  const isConfirming = confirmingId === notification.id;
  const isDeclining = decliningId === notification.id;
  const busy = isConfirming || isDeclining;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{order?.orderNumber || 'Order #' + notification.orderId}</span>
                <Badge variant="warning" size="xs">Awaiting response</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Received {new Date(notification.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {order && <Badge variant={statusVariant[order.status] || 'secondary'} size="sm">{order.status.replace(/_/g, ' ')}</Badge>}
            <Button
              variant="primary"
              size="sm"
              leftIcon={isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={() => onConfirm(notification.id)}
              disabled={busy}
            >
              {isConfirming ? 'Confirming...' : 'Accept'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={isDeclining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              onClick={() => onDecline(notification.id)}
              disabled={busy}
            >
              {isDeclining ? 'Declining...' : 'Decline'}
            </Button>
            {order && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Eye className="h-3.5 w-3.5" />}
                onClick={() => onViewOrder(order.id)}
              >
                View Order
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Items</p>
          <div className="flex flex-wrap gap-2">
            {order?.items.slice(0, 3).map((item, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {item.product.name} ({item.product.condition})
              </Badge>
            ))}
            {order && order.items.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{order.items.length - 3} more
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-semibold">{order ? formatCurrency(order.total, 'USD') : '$0.00'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface OrderRequest {
  notification: {
    id: string;
    title: string;
    body: string;
    orderId: string | null;
    readAt: string | null;
    createdAt: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    total: number;
    items: Array<{ product: { name: string; condition: string } }>;
  } | null;
}

interface OrderRequestsResponse {
  requests: Array<{
    notification: {
      id: string;
      title: string;
      body: string;
      orderId: string | null;
      readAt: string | null;
      createdAt: string;
    };
    order: {
      id: string;
      orderNumber: string;
      status: string;
      createdAt: string;
      total: number;
      items: Array<{ product: { name: string; condition: string } }>;
    } | null;
  }> | null;
}

export const SellerOrderRequests: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = React.useState<OrderRequestsResponse['requests']>([]);
  const [loading, setLoading] = React.useState(true);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [decliningId, setDecliningId] = React.useState<string | null>(null);

  const fetchRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<OrderRequestsResponse>('/seller/order-requests');
      setRequests(res.requests || []);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to load', description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleConfirm = async (notificationId: string) => {
    setConfirmingId(notificationId);
    try {
      await api.post(`/seller/order-requests/${notificationId}/confirm`);
      setRequests((prev) => (prev || []).filter((r) => r.notification.id !== notificationId));
      toast({ variant: 'success', title: 'Order accepted', description: 'The order has been moved to confirmed orders.' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to accept', description: err.message });
      // A 409 means someone else already decided this request — resync.
      if (err.status === 409) fetchRequests();
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDecline = async (notificationId: string) => {
    setDecliningId(notificationId);
    try {
      await api.post(`/seller/order-requests/${notificationId}/decline`);
      setRequests((prev) => (prev || []).filter((r) => r.notification.id !== notificationId));
      toast({ variant: 'success', title: 'Request declined', description: 'The order request has been closed.' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to decline', description: err.message });
      if (err.status === 409) fetchRequests();
    } finally {
      setDecliningId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SellerPageHeader
          title="Order Requests"
          description="Incoming purchase requests for your products that are pending your confirmation."
        />
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading order requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Order Requests"
        description="Incoming purchase requests for your products that are pending your confirmation."
      />

      {!requests || requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No order requests</h3>
            <p className="text-sm text-muted-foreground">
              When an admin sends an order to you for fulfillment, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(requests || []).map(({ notification, order }) => (
            <OrderRequestCard
              key={notification.id}
              notification={notification}
              order={order}
              onConfirm={handleConfirm}
              onDecline={handleDecline}
              onViewOrder={(orderId) => navigate(`/seller/orders/${orderId}`)}
              confirmingId={confirmingId}
              decliningId={decliningId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerOrderRequests;