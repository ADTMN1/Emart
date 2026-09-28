import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  PackageCheck,
  ShieldCheck,
  Clock as ClockIcon,
  DollarSign,
  ShieldCheck as ShieldCheckIcon,
  User,
  ChevronRight,
  MapPin as MapPinIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  total: number;
  shippingMethod: string;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: number;
    serviceFeeAtPurchase: number;
    product: {
      id: string;
      name: string;
      condition: string;
      source: string;
      category: { id: string; name: string } | null;
      productImages: Array<{ id: string; url: string; isPrimary: boolean }>;
    };
  }>;
  billingAddress: {
    fullName: string;
    addressLine: string;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
  } | null;
  shippingAddress: {
    fullName: string;
    addressLine: string;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
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
    createdAt: string;
    events: Array<{
      status: string;
      message: string;
      location: string | null;
      occurredAt: string;
      createdAt: string;
    }>;
  } | null;
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

export const SellerOrderDetail: React.FC = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ order: OrderDetail }>(`/seller/orders/${id}`);
        setOrder(res.order);
      } catch (err: any) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/seller/orders/requests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Order Detail</h1>
            <p className="text-muted-foreground mt-1">Loading order details...</p>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/seller/orders/requests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Order Detail</h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="font-semibold text-lg mb-1">Failed to Load Order</p>
          <p className="text-sm text-muted-foreground mt-1">{error || 'Order not found'}</p>
          <Link to="/seller/orders/requests">
            <Button className="mt-4">Back to Order Requests</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    return statusVariant[status] || 'secondary';
  };

  const shipmentStatusBadge = (status: string) => {
    return shipmentStatusVariant[status] || 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/seller/orders/requests">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-muted-foreground mt-1">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getStatusBadge(order.status)} size="sm">{order.status.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                          <OptimizedImage
                            src={getProductImage(item.product)}
                            alt={item.product.name}
                            size="thumb"
                            context="thumbnail"
                            lazy
                            showShimmer
                            aspectRatio="aspect-square"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-snug line-clamp-2">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Condition: {item.product.condition} &bull; Qty: {item.quantity}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.priceAtPurchase)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
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

          {/* Shipment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {order.shipment ? (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Carrier</p>
                      <p className="font-medium mt-0.5">{order.shipment.carrier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Tracking #</p>
                      <p className="font-mono text-xs mt-0.5 break-all">{order.shipment.trackingNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                      <div className="mt-0.5">
                        <Badge variant={shipmentStatusBadge(order.shipment.status)} size="sm">
                          {order.shipment.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Est. Delivery</p>
                      <p className="font-medium mt-0.5">
                        {order.shipment.estimatedDelivery ? formatDateShort(order.shipment.estimatedDelivery) : '--'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t border-border/60 pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Shipping Cost</p>
                      <p className="font-medium mt-0.5">
                        {order.shipment.shippingCost != null ? formatCurrency(order.shipment.shippingCost) : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Shipped At</p>
                      <p className="font-medium mt-0.5">
                        {order.shipment.shippedAt ? formatDate(order.shipment.shippedAt) : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Delivered At</p>
                      <p className="font-medium mt-0.5">
                        {order.shipment.deliveredAt ? formatDate(order.shipment.deliveredAt) : '--'}
                      </p>
                    </div>
                  </div>

                  {/* Tracking Timeline */}
                  <div className="border-t border-border mt-4 pt-4">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-3 flex items-center gap-1.5">
                      <PackageCheck className="h-3.5 w-3.5" />
                      Tracking Timeline
                    </p>
                    {order.shipment.events && order.shipment.events.length > 0 ? (
                      <ol className="relative border-l-2 border-border ml-2 space-y-4">
                        {order.shipment.events.map((event, index) => (
                          <li key={index} className="ml-5">
                            <span
                              className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-background ${
                                index === 0 ? 'bg-primary' : 'bg-muted-foreground/40'
                              }`}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={shipmentStatusBadge(event.status) || 'secondary'} size="xs">
                                {String(event.status ?? 'UPDATE').replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.occurredAt || event.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium mt-1">{event.message}</p>
                            {event.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-border text-center">
                  <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No shipment created</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The admin will create a shipment when the order is ready to ship.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-sm space-y-2">
                <p className="font-medium">{order.billingAddress?.fullName || 'Customer'}</p>
                <p className="text-muted-foreground">{order.shippingAddress?.email || '--'}</p>
                {order.billingAddress?.phone && (
                  <p className="text-muted-foreground">{order.billingAddress.phone}</p>
                )}
              </div>
            </CardContent>
</Card>
        
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 lg:p-6 space-y-5">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Subtotal ({order.items.length} items)</span>
                  <span className="font-semibold">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Service & Protection
                  </span>
                  <span className="font-semibold">{formatCurrency(order.total - order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" /> Shipping to {order.shippingAddress.country}
                  </span>
                  <span className="font-semibold">{order.shipment?.shippingCost != null ? formatCurrency(order.shipment.shippingCost) : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Insurance</span>
                  <span className="font-semibold">{formatCurrency(order.total - order.subtotal - (order.shipment?.shippingCost || 0))}</span>
                </div>
              </div>

              <div className="h-px bg-border/70" />

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">Total</span>
                <div>
                  <div className="font-display text-2xl font-extrabold">{formatCurrency(order.total)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};