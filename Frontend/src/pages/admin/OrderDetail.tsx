import * as React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Package,
  User,
  MapPin,
  Truck,
  CreditCard,
  ImageIcon,
  Plus,
  Pencil,
  History,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface TrackingEvent {
  status: string;
  location?: string;
  message: string;
  occurredAt: string;
  createdAt: string;
  createdBy?: string;
}

interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  shippingCost?: number | null;
  weight?: number | null;
  dimensions?: string | null;
  shippedAt?: string | null;
  estimatedDelivery?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  events: TrackingEvent[];
}

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
  paymentMethod?: string | null;
  paymentProofUrl?: string | null;
  // Admin-only payment-management metadata (Phase 3).
  paidAt?: string | null;
  paymentNote?: string | null;
  trackingNumber?: string | null;
  shippingMethod: string;
  shippingCarrier?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: number;
    serviceFeeAtPurchase: number;
    productSnapshot?: Record<string, unknown> | null;
    product: {
      id: string;
      name: string;
      condition: string;
      source: string;
      category?: { id: string; name: string } | null;
      productImages?: Array<{ url: string }>;
    };
  }>;
  billingAddress?: {
    fullName: string;
    addressLine: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone: string;
  } | null;
  shippingAddress: {
    fullName: string;
    addressLine: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  shipment?: Shipment | null;
  // Distinct APPROVED sellers whose products appear in this order (Phase 7).
  sellers?: Array<{ id: string; storeName: string }>;
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

const SHIPMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
] as const;

/** Mirrors the server-side transition rules (shipment.service.ts). */
const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'SHIPPED', 'FAILED', 'RETURNED'],
  PROCESSING: ['SHIPPED', 'PENDING', 'FAILED', 'RETURNED'],
  SHIPPED: ['IN_TRANSIT', 'FAILED', 'RETURNED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'SHIPPED', 'FAILED', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'IN_TRANSIT', 'FAILED', 'RETURNED'],
  DELIVERED: [],
  FAILED: [],
  RETURNED: [],
};

/** Mirrors the server-side transition rules (payment.service.ts). */
const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PAID', 'FAILED'],
  PAID: ['PENDING'],
  FAILED: ['PENDING', 'PAID'],
  REFUNDED: [],
};

const paymentStatusVariant = (status: string): 'warning' | 'success' | 'destructive' | 'default' => {
  const map: Record<string, any> = {
    PENDING: 'warning',
    PAID: 'success',
    FAILED: 'destructive',
    REFUNDED: 'default',
  };
  return map[status] || 'default';
};

const shipmentStatusVariant = (status: string): 'warning' | 'info' | 'primary' | 'accent' | 'success' | 'destructive' | 'default' => {
  const map: Record<string, any> = {
    PENDING: 'warning',
    PROCESSING: 'info',
    SHIPPED: 'primary',
    IN_TRANSIT: 'accent',
    OUT_FOR_DELIVERY: 'info',
    DELIVERED: 'success',
    FAILED: 'destructive',
    RETURNED: 'default',
  };
  return map[status] || 'default';
};

const emptyShipmentForm = {
  carrier: '',
  trackingNumber: '',
  shippingCost: '',
  estimatedDelivery: '',
  status: 'PENDING',
};

export const AdminOrderDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Shipment modals: which one is open + shared busy flag.
  const [shipmentModal, setShipmentModal] = React.useState<'create' | 'edit' | 'status' | 'event' | null>(null);
  const [submittingShipment, setSubmittingShipment] = React.useState(false);
  const [shipmentForm, setShipmentForm] = React.useState(emptyShipmentForm);
  const [statusForm, setStatusForm] = React.useState({ status: '', message: '', location: '' });
  const [eventForm, setEventForm] = React.useState({ status: '', location: '', message: '', occurredAt: '' });

  // Payment management modals: 'verify' | 'reject' | 'note' | null.
  const [paymentModal, setPaymentModal] = React.useState<'verify' | 'reject' | 'note' | null>(null);
  const [submittingPayment, setSubmittingPayment] = React.useState(false);
  const [paymentNote, setPaymentNote] = React.useState('');
  const [proofModalOpen, setProofModalOpen] = React.useState(false);

  const fetchOrder = React.useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.get<OrderDetail>(`/admin/orders/${id}`);
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

  // --- Shipment management -------------------------------------------------

  const openCreateModal = () => {
    setShipmentForm(emptyShipmentForm);
    setShipmentModal('create');
  };

  const openEditModal = () => {
    if (!order?.shipment) return;
    const s = order.shipment;
    setShipmentForm({
      carrier: s.carrier,
      trackingNumber: s.trackingNumber,
      shippingCost: s.shippingCost != null ? String(s.shippingCost) : '',
      estimatedDelivery: s.estimatedDelivery ? new Date(s.estimatedDelivery).toISOString().slice(0, 10) : '',
      status: s.status,
    });
    setShipmentModal('edit');
  };

  const openStatusModal = () => {
    if (!order?.shipment) return;
    setStatusForm({ status: '', message: '', location: '' });
    setShipmentModal('status');
  };

  const openEventModal = () => {
    if (!order?.shipment) return;
    setEventForm({ status: '', location: '', message: '', occurredAt: '' });
    setShipmentModal('event');
  };

  const closeShipmentModal = () => {
    if (!submittingShipment) setShipmentModal(null);
  };

  const runShipmentAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      setSubmittingShipment(true);
      await action();
      toast({ variant: 'success', title: successMessage });
      setShipmentModal(null);
      await fetchOrder();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Shipment Update Failed',
        description: err.message || 'Please try again.',
      });
    } finally {
      setSubmittingShipment(false);
    }
  };

  const handleShipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !order) return;

    const payload: Record<string, unknown> = {
      carrier: shipmentForm.carrier.trim(),
      trackingNumber: shipmentForm.trackingNumber.trim(),
      shippingCost: shipmentForm.shippingCost === '' ? 0 : Number(shipmentForm.shippingCost),
      estimatedDelivery: shipmentForm.estimatedDelivery || null,
    };

    if (shipmentModal === 'create') {
      payload.status = shipmentForm.status;
      await runShipmentAction(
        () => api.post(`/admin/orders/${id}/shipment`, payload),
        'Shipment created'
      );
    } else if (shipmentModal === 'edit') {
      await runShipmentAction(
        () => api.patch(`/admin/orders/${id}/shipment`, payload),
        'Shipment updated'
      );
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !statusForm.status) return;
    await runShipmentAction(
      () =>
        api.post(`/admin/orders/${id}/shipment/status`, {
          status: statusForm.status,
          message: statusForm.message.trim() || undefined,
          location: statusForm.location.trim() || undefined,
        }),
      'Shipment status updated'
    );
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !eventForm.message.trim()) return;
    await runShipmentAction(
      () =>
        api.post(`/admin/orders/${id}/shipment/events`, {
          message: eventForm.message.trim(),
          status: eventForm.status || undefined,
          location: eventForm.location.trim() || undefined,
          occurredAt: eventForm.occurredAt ? new Date(eventForm.occurredAt).toISOString() : undefined,
        }),
      'Tracking event added'
    );
  };

  // --- Payment management ---------------------------------------------------

  const openPaymentModal = (mode: 'verify' | 'reject' | 'note', prefillNote = '') => {
    setPaymentNote(prefillNote);
    setPaymentModal(mode);
  };

  const closePaymentModal = () => {
    if (!submittingPayment) setPaymentModal(null);
  };

  const runPaymentAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      setSubmittingPayment(true);
      await action();
      toast({ variant: 'success', title: successMessage });
      setPaymentModal(null);
      await fetchOrder();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Payment Update Failed',
        description: err.message || 'Please try again.',
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await runPaymentAction(
      () => api.post(`/admin/orders/${id}/payment/verify`, { note: paymentNote.trim() || undefined }),
      'Payment verified'
    );
  };

  const handleRejectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || paymentNote.trim().length < 3) return;
    await runPaymentAction(
      () => api.post(`/admin/orders/${id}/payment/reject`, { reason: paymentNote.trim() }),
      'Payment rejected'
    );
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await runPaymentAction(
      () => api.patch(`/admin/orders/${id}/payment`, { paymentNote: paymentNote.trim() || null }),
      'Payment note saved'
    );
  };

  const handleRevertPayment = async () => {
    if (!id) return;
    await runPaymentAction(
      () => api.patch(`/admin/orders/${id}/payment`, { paymentStatus: 'PENDING' }),
      'Payment moved back to pending'
    );
  };

  // -------------------------------------------------------------------------

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

  const shipment = order.shipment;
  const shipmentEvents = Array.isArray(shipment?.events) ? shipment!.events : [];
  const allowedTransitions = shipment ? SHIPMENT_TRANSITIONS[shipment.status] || [] : [];

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
            {order.trackingNumber ? ` · Tracking ${order.trackingNumber}` : ''}
          </p>
        </div>
        <Badge variant={order.status === 'DELIVERED' ? 'success' : 'info'} className="text-sm px-3 py-1">
          {order.status.replace(/_/g, ' ')}
        </Badge>
        {(order.sellers?.length ?? 0) >= 1 && (
          <Link
            to={`/admin/orders/${order.id}/messages`}
            aria-label={order.sellers!.length === 1 ? `Message ${order.sellers![0].storeName}` : 'Message sellers'}
          >
            <Button variant="destructive" size="sm" leftIcon={<MessageSquare className="h-4 w-4" />}>
              Message Seller{order.sellers!.length > 1 ? 's' : ''}
            </Button>
          </Link>
        )}
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

          {/* Shipment Management */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipment
                </h2>
                {shipment ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={openEditModal}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={openStatusModal} disabled={allowedTransitions.length === 0}>
                      Update Status
                    </Button>
                    <Button variant="outline" size="sm" onClick={openEventModal}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Event
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={openCreateModal}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Shipment
                  </Button>
                )}
              </div>

              {!shipment ? (
                <div className="p-8 rounded-xl border border-dashed border-border text-center">
                  <Truck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">No shipment created</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a shipment to start tracking this order's delivery.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Carrier</p>
                      <p className="font-medium mt-0.5">{shipment.carrier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Tracking #</p>
                      <p className="font-mono text-xs mt-0.5 break-all">{shipment.trackingNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                      <div className="mt-0.5">
                        <Badge variant={shipmentStatusVariant(shipment.status)} size="sm">
                          {shipment.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Est. Delivery</p>
                      <p className="font-medium mt-0.5">
                        {shipment.estimatedDelivery
                          ? new Date(shipment.estimatedDelivery).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t border-border/60 pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Shipping Cost</p>
                      <p className="font-medium mt-0.5">
                        {shipment.shippingCost != null ? formatCurrency(shipment.shippingCost, 'USD') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Shipped At</p>
                      <p className="font-medium mt-0.5">
                        {shipment.shippedAt ? new Date(shipment.shippedAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Delivered At</p>
                      <p className="font-medium mt-0.5">
                        {shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Tracking Timeline (newest first) */}
                  <div className="border-t border-border mt-4 pt-4">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-3 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Tracking Timeline
                    </p>
                    {shipmentEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                    ) : (
                      <ol className="relative border-l-2 border-border ml-2 space-y-4">
                        {shipmentEvents.map((event, index) => (
                          <li key={index} className="ml-5">
                            <span
                              className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-background ${
                                index === 0 ? 'bg-primary' : 'bg-muted-foreground/40'
                              }`}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={shipmentStatusVariant(event.status)} size="xs">
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
                    )}
                  </div>
                </div>
              )}
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
                {order.user.phone ? (
                  <p className="text-muted-foreground">{order.user.phone}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Payment Management (Phase 3) */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                </h2>
                <Badge variant={paymentStatusVariant(order.paymentStatus)} size="sm">
                  {order.paymentStatus}
                </Badge>
              </div>

              <div className="text-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium capitalize">
                    {order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="font-medium">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                {order.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Verified / Paid</span>
                    <span className="font-medium">{new Date(order.paidAt).toLocaleString()}</span>
                  </div>
                )}
                {order.paymentNote && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Note</p>
                    <p className="whitespace-pre-wrap">{order.paymentNote}</p>
                  </div>
                )}

                <div className="pt-1">
                  <p className="text-muted-foreground text-xs uppercase font-semibold mb-2 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Payment Proof
                  </p>
                  {order.paymentProofUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setProofModalOpen(true)}
                        className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
                        aria-label="View payment proof enlarged"
                      >
                        <img
                          src={order.paymentProofUrl}
                          alt="Customer payment proof"
                          className="max-h-44 rounded-lg border border-border object-contain"
                        />
                      </button>
                      <p className="text-xs text-muted-foreground mt-1.5">Click the image to enlarge.</p>
                    </>
                  ) : (
                    <div className="p-4 rounded-lg border border-dashed border-border text-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                      <p className="text-xs text-muted-foreground">No payment proof submitted.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions — only valid transitions are offered. */}
              <div className="border-t border-border mt-4 pt-4">
                {(() => {
                  const transitions = PAYMENT_TRANSITIONS[order.paymentStatus] || [];
                  if (transitions.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        This payment is in a terminal state ({order.paymentStatus}).
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {transitions.includes('PAID') && (
                        <Button size="sm" onClick={() => openPaymentModal('verify')}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Verify Payment
                        </Button>
                      )}
                      {transitions.includes('FAILED') && (
                        <Button size="sm" variant="destructive" onClick={() => openPaymentModal('reject')}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject Payment
                        </Button>
                      )}
                      {transitions.includes('PENDING') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRevertPayment}
                          disabled={submittingPayment}
                        >
                          Back to Pending
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPaymentModal('note', order.paymentNote ?? '')}
                      >
                        {order.paymentNote ? 'Edit note' : 'Add note'}
                      </Button>
                    </div>
                  );
                })()}
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
                <p className="text-xs text-muted-foreground pt-1">
                  Last updated {new Date(order.updatedAt).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit Shipment Modal */}
      <Modal
        isOpen={shipmentModal === 'create' || shipmentModal === 'edit'}
        onClose={closeShipmentModal}
        title={shipmentModal === 'create' ? 'Create Shipment' : 'Edit Shipment'}
        description={`Order ${order.orderNumber}`}
      >
        <form onSubmit={handleShipmentSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Carrier <span className="text-destructive">*</span>
            </label>
            <Input
              value={shipmentForm.carrier}
              onChange={(e) => setShipmentForm({ ...shipmentForm, carrier: e.target.value })}
              placeholder="e.g. DHL Express"
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Tracking Number <span className="text-destructive">*</span>
            </label>
            <Input
              value={shipmentForm.trackingNumber}
              onChange={(e) => setShipmentForm({ ...shipmentForm, trackingNumber: e.target.value })}
              placeholder="e.g. DHL1234567890"
              required
              minLength={4}
              maxLength={100}
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Shipping Cost (USD) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={shipmentForm.shippingCost}
                onChange={(e) => setShipmentForm({ ...shipmentForm, shippingCost: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated Delivery</label>
              <Input
                type="date"
                value={shipmentForm.estimatedDelivery}
                onChange={(e) => setShipmentForm({ ...shipmentForm, estimatedDelivery: e.target.value })}
              />
            </div>
          </div>
          {shipmentModal === 'create' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Initial Status</label>
              <Select
                value={shipmentForm.status}
                onChange={(e) => setShipmentForm({ ...shipmentForm, status: e.target.value })}
              >
                {SHIPMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeShipmentModal} disabled={submittingShipment}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submittingShipment}>
              {shipmentModal === 'create' ? 'Create Shipment' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Shipment Status Modal */}
      <Modal
        isOpen={shipmentModal === 'status'}
        onClose={closeShipmentModal}
        title="Update Shipment Status"
        description={`Current status: ${shipment?.status?.replace(/_/g, ' ') ?? '—'} · a tracking event is added automatically`}
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              New Status <span className="text-destructive">*</span>
            </label>
            <Select
              value={statusForm.status}
              onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              required
            >
              <option value="">Select new status…</option>
              {allowedTransitions.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
            {allowedTransitions.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                This shipment is in a terminal state and can no longer change status.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Message (optional)</label>
            <Input
              value={statusForm.message}
              onChange={(e) => setStatusForm({ ...statusForm, message: e.target.value })}
              placeholder="Defaults to a standard message for the new status"
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Location (optional)</label>
            <Input
              value={statusForm.location}
              onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })}
              placeholder="e.g. Addis Ababa"
              maxLength={120}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeShipmentModal} disabled={submittingShipment}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submittingShipment} disabled={!statusForm.status}>
              Update Status
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Tracking Event Modal */}
      <Modal
        isOpen={shipmentModal === 'event'}
        onClose={closeShipmentModal}
        title="Add Tracking Event"
        description="Adds a timeline entry without changing the current shipment status"
      >
        <form onSubmit={handleEventSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Message <span className="text-destructive">*</span>
            </label>
            <Input
              value={eventForm.message}
              onChange={(e) => setEventForm({ ...eventForm, message: e.target.value })}
              placeholder="e.g. Package departed sorting facility"
              required
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <Input
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="e.g. Addis Ababa"
                maxLength={120}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Timestamp</label>
              <Input
                type="datetime-local"
                value={eventForm.occurredAt}
                onChange={(e) => setEventForm({ ...eventForm, occurredAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Event Status</label>
            <Select
              value={eventForm.status}
              onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
            >
              <option value="">Current status ({shipment?.status?.replace(/_/g, ' ')})</option>
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closeShipmentModal} disabled={submittingShipment}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submittingShipment}>
              Add Event
            </Button>
          </div>
        </form>
      </Modal>

      {/* Payment Proof Enlarged View */}
      <Modal
        isOpen={proofModalOpen}
        onClose={() => setProofModalOpen(false)}
        title="Payment Proof"
        description={`Order ${order.orderNumber}`}
      >
        {order.paymentProofUrl ? (
          <img
            src={order.paymentProofUrl}
            alt="Customer payment proof, enlarged"
            className="w-full max-h-[70vh] rounded-lg border border-border object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No payment proof submitted.</p>
        )}
      </Modal>

      {/* Verify / Reject / Note Modal */}
      <Modal
        isOpen={paymentModal === 'verify' || paymentModal === 'reject' || paymentModal === 'note'}
        onClose={closePaymentModal}
        title={
          paymentModal === 'verify'
            ? 'Verify Payment'
            : paymentModal === 'reject'
            ? 'Reject Payment'
            : 'Payment Note'
        }
        description={`Order ${order.orderNumber}`}
      >
        <form
          onSubmit={
            paymentModal === 'reject'
              ? handleRejectPayment
              : paymentModal === 'note'
              ? handleNoteSubmit
              : handleVerifyPayment
          }
          className="space-y-4"
        >
          {paymentModal === 'verify' && (
            <p className="text-sm text-muted-foreground">
              Marks this payment as PAID and records the verification time. The submitted proof and order
              totals are not modified.
            </p>
          )}
          {paymentModal === 'reject' && (
            <p className="text-sm text-muted-foreground">
              Marks this payment as FAILED and records your reason. The customer's submitted proof is
              preserved.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {paymentModal === 'reject' ? 'Rejection Reason' : 'Note'}
              {paymentModal === 'reject' && <span className="text-destructive"> *</span>}
            </label>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder={
                paymentModal === 'reject'
                  ? 'e.g. Payment proof is unclear.'
                  : 'Optional note about this payment…'
              }
              required={paymentModal === 'reject'}
              minLength={paymentModal === 'reject' ? 3 : undefined}
              maxLength={1000}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={closePaymentModal} disabled={submittingPayment}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submittingPayment}
              variant={paymentModal === 'reject' ? 'destructive' : 'primary'}
            >
              {paymentModal === 'verify'
                ? 'Verify Payment'
                : paymentModal === 'reject'
                ? 'Reject Payment'
                : 'Save Note'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
