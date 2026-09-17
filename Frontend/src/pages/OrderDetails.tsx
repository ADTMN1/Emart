import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronRight,
  Package,
  PackageCheck,
  Truck,
  MapPinCheck,
  PackageOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Info,
  ShieldCheck,
  Download,
  MessageSquare,
  Store,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { cn, formatCurrency } from '@/lib/utils'
import type { Product } from '@/lib/types'
import { api } from '@/lib/api'
import { EmptyOrders } from '@/components/ui/States'
import { useNavigate } from 'react-router-dom'

interface OrderItem {
  product: Product
  pkg: string
  qty: number
  status: string
  vendor: string
}

interface OrderData {
  id: string
  number: string
  status: string
  date: string
  itemsCount: number
  packages: number
  items: OrderItem[]
  timelineSteps: Array<{
    id: number
    key: string
    title: string
    time: string
    done: boolean
    active?: boolean
  }>
  subtotal: number
  serviceFees: number
  domesticShipping: number
  internationalShipping: number
  insurance: number
  total: number
  trackingCode?: string
  shippingMethod?: string
  // Real payment status from the API (admin note is never included in customer responses).
  paymentStatus?: string
  paymentMethod?: string | null
  shipment?: {
    id: string
    trackingNumber: string
    carrier: string
    status: string
    estimatedDelivery?: string | null
    deliveredAt?: string | null
    shippedAt?: string | null
    events: Array<{
      status?: string
      location?: string
      message?: string
      occurredAt?: string
      createdAt?: string
    }>
  } | null
}

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
  }
  return map[status] || 'default'
}

const defaultTimelineSteps = [
  { id: 1, key: 'placed', title: 'Order Placed', time: '', icon: CheckCircle2, done: false, active: false },
  { id: 2, key: 'paid', title: 'Payment Confirmed', time: '', icon: ShieldCheck, done: false, active: false },
  { id: 3, key: 'purchasing', title: 'Purchasing from Sellers', time: '', icon: Store, done: false, active: false },
  { id: 4, key: 'warehouse', title: 'Arrives at Warehouse', time: '', icon: PackageOpen, done: false, active: false },
  { id: 5, key: 'inspection', title: 'Item Inspection', time: '', icon: PackageCheck, done: false, active: false },
  { id: 6, key: 'shipped', title: 'Shipped Internationally', time: '', icon: Truck, done: false, active: false },
  { id: 7, key: 'delivered', title: 'Delivered to You', time: '', icon: MapPinCheck, done: false, active: false },
]

const iconMap = {
  placed: CheckCircle2,
  paid: ShieldCheck,
  purchasing: Store,
  warehouse: PackageOpen,
  inspection: PackageCheck,
  shipped: Truck,
  delivered: MapPinCheck,
}

const OrderDetails: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(true)
  const [order, setOrder] = React.useState<OrderData | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!id) return
    const fetchOrder = async () => {
      try {
        setLoading(true)
        const data = await api.get<OrderData>(`/orders/${id}`).catch(() => null)
        if (data) {
          setOrder(data)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [id])

  if (loading) {
    return (
      <div className="container-page py-12 min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container-page py-12 min-h-[70vh]">
        <div className="max-w-xl mx-auto">
          <EmptyOrders onBrowse={() => navigate('/orders')} />
        </div>
      </div>
    )
  }

  const timelineSteps = order.timelineSteps?.length
    ? order.timelineSteps.map((t) => ({ ...t, icon: iconMap[t.key as keyof typeof iconMap] || CheckCircle2 }))
    : defaultTimelineSteps
  const items = order.items?.map((i) => i.product) || []
  const orderItems = order.items || []

  // Real shipment data from the API (server enforces ownership). Events are
  // sorted newest-first for display; no fake tracking info is ever shown.
  const shipment = order.shipment || null
  const shipmentEvents = (Array.isArray(shipment?.events) ? shipment!.events : [])
    .slice()
    .sort((a, b) => {
      const at = new Date(a.occurredAt || a.createdAt || 0).getTime()
      const bt = new Date(b.occurredAt || b.createdAt || 0).getTime()
      return bt - at
    })
  const shippingCarrierLabel = shipment?.carrier || order.shippingMethod || '—'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight">
              Order #{order.number}
            </h1>
            <Badge variant="info" size="md" className="gap-1.5">
              <Clock className="h-3 w-3" />
              {order.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed on {order.date} · {order.itemsCount} items · {order.packages || 1} packages
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="md">
            <MessageSquare className="h-4 w-4" />
            Contact Support
          </Button>
          <Button variant="primary" size="md">
            <Download className="h-4 w-4" />
            Invoice
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <Card>
            <CardContent className="p-5 lg:p-6">
              <h2 className="font-display text-lg font-bold mb-6">Order Timeline</h2>
              <div className="relative">
                <div className="hidden sm:block absolute left-6 top-6 bottom-6 w-0.5 bg-border" />
                <div className="space-y-5">
                  {timelineSteps.map((step, idx) => {
                    const Icon = step.icon
                    return (
                      <div key={step.key} className="relative flex gap-4">
                        <div className={cn(
                          'relative z-10 h-12 w-12 shrink-0 rounded-xl flex items-center justify-center border-2 transition-all',
                          step.done
                            ? 'bg-success text-white border-success'
                            : step.active
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 ring-4 ring-primary/15 animate-pulse'
                            : 'bg-white text-muted-foreground border-border',
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 pt-2 pb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={cn(
                              'font-bold text-base',
                              !step.done && !step.active && 'text-muted-foreground',
                            )}>
                              {step.title}
                            </h3>
                            {step.active && <Badge variant="primary" size="sm" dot>Current</Badge>}
                          </div>
                          <div className={cn(
                            'text-sm mt-0.5',
                            step.done || step.active ? 'text-muted-foreground' : 'text-muted-foreground/60',
                          )}>
                            {step.time}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="p-5 lg:p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg font-bold">Items ({order.itemsCount})</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/cart">Add More Items</Link>
                </Button>
              </div>

              <div className="space-y-4">
                {orderItems.length === 0 ? (
                  <div className="p-8 rounded-xl bg-muted/30 border border-dashed border-border text-center">
                    <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No items found for this order</p>
                  </div>
                ) : (
                  orderItems.map((row, idx) => (
                    <div key={row.product.id + idx} className="p-4 rounded-xl bg-muted/30 border border-border/60">
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-bold">{row.pkg}</span>
                          <Badge variant="outline" size="sm" className="gap-1">
                            {row.status === 'Purchasing' ? <Clock className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5 text-info" />}
                            {row.status}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Store className="h-3 w-3" />
                          {row.vendor}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Link to={`/product/${row.product.id}`} className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                          <img
                            src={row.product.image || row.product.images?.[0] || ''}
                            alt={row.product.name}
                            className="h-full w-full object-cover"
                          />
                        </Link>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <Link to={`/product/${row.product.id}`} className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                            {row.product.name}
                          </Link>
                          <div className="flex items-center justify-between pt-2">
                            <Badge variant="success" size="sm">{row.product.condition}</Badge>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-muted-foreground">Qty: {row.qty}</span>
                              <span className="font-bold">{formatCurrency(row.product.price * row.qty, 'USD')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipment & Tracking */}
          <Card>
            <CardContent className="p-5 lg:p-6">
              <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Shipment & Tracking
              </h2>

              {!shipment ? (
                <div className="p-8 rounded-xl border border-dashed border-border text-center">
                  <Truck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">Shipment information will appear here once your order has shipped.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll see the carrier, tracking number and delivery updates in this space.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Carrier</div>
                      <div className="font-semibold mt-0.5">{shipment.carrier}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Status</div>
                      <div className="mt-0.5">
                        <Badge variant={shipmentStatusVariant(shipment.status)} size="sm">
                          {shipment.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Est. Delivery</div>
                      <div className="font-semibold mt-0.5">
                        {shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Tracking Number</div>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span className="font-mono text-xs font-bold truncate">{shipment.trackingNumber}</span>
                        <button
                          className="text-primary hover:underline text-xs font-sans font-semibold shrink-0"
                          onClick={() => navigator.clipboard.writeText(shipment.trackingNumber)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  {shipmentEvents.length > 0 && (
                    <div className="border-t border-border/60 mt-5 pt-5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold mb-4">Tracking Timeline</p>
                      <ol className="relative border-l-2 border-border ml-2 space-y-5">
                        {shipmentEvents.map((event, index) => (
                          <li key={index} className="ml-5">
                            <span
                              className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-background ${
                                index === 0 ? 'bg-primary' : 'bg-muted-foreground/40'
                              }`}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={shipmentStatusVariant(String(event.status ?? ''))} size="xs">
                                {String(event.status ?? 'UPDATE').replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.occurredAt || event.createdAt || Date.now()).toLocaleString()}
                              </span>
                            </div>
                            {event.message && <p className="text-sm font-medium mt-1">{event.message}</p>}
                            {event.location && (
                              <p className="text-xs text-muted-foreground mt-0.5">{event.location}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-primary" />
                    Shipping Address
                  </h3>
                  <button className="text-xs font-bold text-primary hover:underline">Edit</button>
                </div>
                <div className="text-sm space-y-0.5">
                  <div className="font-bold">John Doe</div>
                  <div className="text-foreground/80 leading-relaxed">
                    123 Main Street, Apt 4B<br />
                    New York, NY 10001<br />
                    United States
                  </div>
                  <div className="pt-1 text-xs text-muted-foreground">+1 (555) 123-4567</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-secondary" />
                    Shipping Method
                  </h3>
                  <button className="text-xs font-bold text-primary hover:underline">Change</button>
                </div>
                <div className="text-sm">
                  <div className="font-bold mb-1">{shippingCarrierLabel}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.shipment?.estimatedDelivery
                      ? `Estimated delivery ${new Date(order.shipment.estimatedDelivery).toLocaleDateString()}`
                      : 'Fully tracked international delivery'}
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-secondary/5 border border-secondary/10 flex items-start gap-2 text-xs">
                    <Info className="h-3.5 w-3.5 text-secondary mt-0.5 shrink-0" />
                    <span>
                      Consolidation available when both packages arrive at our warehouse. This will combine into one shipment for savings.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 self-start">
          <Card>
            <CardContent className="p-5 lg:p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">Order Summary</h3>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">{order.itemsCount} items</span>
                  <span className="font-semibold">{formatCurrency(order.subtotal, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Service Fees (7%)</span>
                  <span className="font-semibold">{formatCurrency(order.serviceFees, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Domestic Shipping</span>
                  <span className="font-semibold">{formatCurrency(order.domesticShipping, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">DHL Express</span>
                  <span className="font-semibold">{formatCurrency(order.internationalShipping, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Insurance</span>
                  <span className="font-semibold">{formatCurrency(order.insurance, 'USD')}</span>
                </div>
              </div>

              <div className="h-px bg-border/70" />

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">Total Paid</span>
                <div className="font-display text-2xl font-extrabold">
                  {formatCurrency(order.total, 'USD')}
                </div>
              </div>

              {/* Real payment status (Phase 3) — no fabricated card/transaction data. */}
              <div
                className={`p-3 rounded-lg border text-xs ${
                  order.paymentStatus === 'PAID'
                    ? 'bg-success/5 border-success/15'
                    : order.paymentStatus === 'FAILED'
                    ? 'bg-destructive/5 border-destructive/15'
                    : 'bg-muted/40 border-border'
                }`}
              >
                <div className="flex items-start gap-2">
                  {order.paymentStatus === 'PAID' ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  ) : order.paymentStatus === 'FAILED' ? (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <Clock className={`h-4 w-4 shrink-0 mt-0.5 ${order.paymentStatus === 'PENDING' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  )}
                  <div>
                    <div className="font-bold text-foreground">
                      {order.paymentStatus === 'PAID'
                        ? 'Payment completed'
                        : order.paymentStatus === 'FAILED'
                        ? 'Payment could not be verified'
                        : order.paymentStatus === 'REFUNDED'
                        ? 'Payment refunded'
                        : 'Payment pending review'}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {order.paymentStatus === 'PAID'
                        ? `Paid via ${order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : 'crypto'}.`
                        : order.paymentStatus === 'FAILED'
                        ? 'Our team could not verify this payment. Please contact support.'
                        : order.paymentStatus === 'REFUNDED'
                        ? 'This payment has been refunded.'
                        : 'We are reviewing your payment proof. Status will update once verified.'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tracking</span>
                {shipment ? (
                  <Badge variant={shipmentStatusVariant(shipment.status)} size="sm">
                    {shipment.status.replace(/_/g, ' ')}
                  </Badge>
                ) : (
                  <Badge variant="info" size="sm">Not available yet</Badge>
                )}
              </div>
              {shipment ? (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs">
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono font-bold truncate">{shipment.trackingNumber}</span>
                    <button
                      className="ml-auto text-primary font-bold hover:underline shrink-0"
                      onClick={() => navigator.clipboard.writeText(shipment.trackingNumber)}
                    >
                      Copy
                    </button>
                  </div>
                  {shipment.deliveredAt && (
                    <p className="text-xs text-success font-semibold flex items-center gap-1">
                      <MapPinCheck className="h-3.5 w-3.5" />
                      Delivered {new Date(shipment.deliveredAt).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Tracking information will appear here once your package is shipped.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default OrderDetails
