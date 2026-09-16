import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Package, User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  serviceFees: number;
  domesticShipping: number;
  internationalShipping: number;
  insurance: number;
  paymentStatus: string;
  shippingMethod: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: number;
    product: {
      id: string;
      name: string;
      condition: string;
    };
  }>;
  shippingAddress: {
    fullName: string;
    addressLine: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone: string;
  };
}

const orderStatusOptions = [
  'PENDING',
  'PAYMENT_RECEIVED',
  'PURCHASING',
  'PURCHASED',
  'IN_WAREHOUSE',
  'CONSOLIDATED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export const AdminOrderDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchOrder = React.useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.get<OrderDetail>(`/orders/${id}`);
      setOrder(res);
    } catch (err: any) {
      console.error('Failed to fetch order:', err);
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order || !id) return;

    try {
      setUpdating(true);
      await api.put(`/orders/${id}/status`, { status: newStatus });
      toast({
        variant: 'success',
        title: 'Status Updated',
        description: 'Order status has been updated successfully',
      });
      fetchOrder();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: err.message || 'Failed to update status',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold">Failed to Load Order</p>
        <p className="text-sm text-muted-foreground mt-2">{error || 'Order not found'}</p>
        <Button className="mt-4" onClick={() => navigate('/admin/orders')}>
          Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={order.status === 'DELIVERED' ? 'success' : 'info'} className="text-sm px-3 py-1">
          {order.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </h2>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Condition: {item.product.condition} • Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.priceAtPurchase, 'USD')}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </h2>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.shippingAddress.fullName}</p>
                <p className="text-muted-foreground">{order.shippingAddress.addressLine}</p>
                <p className="text-muted-foreground">
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                </p>
                <p className="text-muted-foreground">{order.shippingAddress.country}</p>
                <p className="text-muted-foreground mt-2">Phone: {order.shippingAddress.phone}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer
              </h2>
              <div className="text-sm space-y-2">
                <p className="font-medium">
                  {order.user.firstName || order.user.lastName
                    ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
                    : 'Customer'}
                </p>
                <p className="text-muted-foreground">{order.user.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Order Status */}
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-lg mb-4">Update Status</h2>
              <Select
                value={order.status}
                onChange={(e) => handleStatusUpdate(e.target.value)}
                disabled={updating}
              >
                {orderStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Fees</span>
                  <span>{formatCurrency(order.serviceFees, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Domestic Shipping</span>
                  <span>{formatCurrency(order.domesticShipping, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">International Shipping</span>
                  <span>{formatCurrency(order.internationalShipping, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Insurance</span>
                  <span>{formatCurrency(order.insurance, 'USD')}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(order.total, 'USD')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
