import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader2, AlertCircle, Package, Eye, Truck, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface SellerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: number;
    serviceFeeAtPurchase: number;
    product: {
      id: string;
      name: string;
      condition: string;
      productImages: Array<{ id: string; url: string; isPrimary: boolean }>;
    };
  }>;
  shippingAddress: {
    fullName: string;
    addressLine: string;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    phone: string;
  };
  shipment: {
    id: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    shippingCost: number | null;
    estimatedDelivery: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
}

interface SellerOrdersResponse {
  orders: SellerOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary' | 'primary' | 'accent'> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
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

const shipmentStatusVariant: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary' | 'primary' | 'accent'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'accent',
  IN_TRANSIT: 'accent',
  OUT_FOR_DELIVERY: 'accent',
  DELIVERED: 'success',
  FAILED: 'destructive',
  RETURNED: 'secondary',
};

const getProductImage = (product: any): string => {
  if (product?.productImages && Array.isArray(product.productImages)) {
    const validImages = product.productImages.filter((img: any) => img && img.url);
    if (validImages.length > 0) {
      return validImages[0].url;
    }
  }
  if (product?.image) {
    return product.image;
  }
  if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }
  return 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22800%22%20viewBox%3D%220%200%20800%20800%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22800%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22sans-serif%22%20font-size%3D%2232%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateShort = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const SellerConfirmedOrders: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState<SellerOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pagination, setPagination] = React.useState<SellerOrdersResponse['pagination'] | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const fetchOrders = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await api.get<SellerOrdersResponse>(`/seller/orders?${params.toString()}`);
      setOrders(res.orders || []);
      setPagination(res.pagination || null);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to load', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleViewOrder = (orderId: string) => {
    navigate(`/seller/orders/${orderId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SellerPageHeader
          title="Confirmed Orders"
          description="Orders you've accepted that are now being processed and shipped."
        />
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading confirmed orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Confirmed Orders"
        description="Orders you've accepted that are now being processed and shipped."
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter by status:</span>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'PENDING', 'CONFIRMED', 'PURCHASING', 'PURCHASED', 'IN_WAREHOUSE', 'CONSOLIDATED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No confirmed orders</h3>
            <p className="text-sm text-muted-foreground">
              When you accept an order request, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{order.orderNumber}</span>
                            <Badge variant={statusVariant[order.status] || 'secondary'} size="sm">
                              {order.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Placed {new Date(order.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {order.shipment && (
                          <Badge variant={shipmentStatusVariant[order.shipment.status] || 'secondary'} size="sm">
                            <Truck className="h-3 w-3 mr-1" />
                            {order.shipment.status.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Eye className="h-3.5 w-3.5" />}
                          onClick={() => handleViewOrder(order.id)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Items</p>
                      <div className="flex flex-wrap gap-2">
                        {order.items.slice(0, 3).map((item, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {item.product.name} ({item.product.condition}) &times; {item.quantity}
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setStatusFilter(statusFilter)} // This would need page state
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setStatusFilter(statusFilter)} // This would need page state
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SellerConfirmedOrders;