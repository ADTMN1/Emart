import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  ChevronRight,
  Home as HomeIcon,
  Search,
  Filter,
  PackageCheck,
  Truck,
  CircleDollarSign,
  Clock,
  ChevronDown,
  PackageOpen,
  MapPinCheck,
  Wallet as WalletIcon,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyOrders } from '@/components/ui/States'
import { cn, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'

type OrderStatus =
  | 'awaiting_payment'
  | 'processing'
  | 'purchasing'
  | 'in_warehouse'
  | 'shipping'
  | 'delivered'
  | 'cancelled'

interface Order {
  id: string
  number: string
  date: string
  status: OrderStatus
  itemsCount: number
  totalUsd: number
  thumbnail?: string
  trackingCode?: string
}

const statusConfig: Record<OrderStatus, { label: string; variant: any; icon: React.FC<any>; color: string }> = {
  awaiting_payment: { label: 'Awaiting Payment', variant: 'warning', icon: CircleDollarSign, color: 'text-warning' },
  processing: { label: 'Processing', variant: 'info', icon: Clock, color: 'text-info' },
  purchasing: { label: 'Purchasing', variant: 'info', icon: Package, color: 'text-primary' },
  in_warehouse: { label: 'In Warehouse', variant: 'primary', icon: PackageOpen, color: 'text-primary' },
  shipping: { label: 'In Transit', variant: 'accent', icon: Truck, color: 'text-secondary' },
  delivered: { label: 'Delivered', variant: 'success', icon: MapPinCheck, color: 'text-success' },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: Package, color: 'text-destructive' },
}

const statuses = ['All', 'Processing', 'Purchasing', 'In Warehouse', 'Shipping', 'Delivered', 'Cancelled']

const MyOrders: React.FC = () => {
  const [tab, setTab] = React.useState('All')
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const data = await api.get<Order[]>('/orders').catch(() => [])
        setOrders(Array.isArray(data) ? data : [])
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const filteredOrders = tab === 'All'
    ? orders
    : tab === 'Processing'
      ? orders.filter((o) => ['processing', 'purchasing'].includes(o.status))
      : tab === 'In Warehouse'
        ? orders.filter((o) => o.status === 'in_warehouse')
        : tab === 'Shipping'
          ? orders.filter((o) => o.status === 'shipping')
          : tab === 'Delivered'
            ? orders.filter((o) => o.status === 'delivered')
            : tab === 'Cancelled'
              ? orders.filter((o) => o.status === 'cancelled')
              : orders

  if (loading) {
    return (
      <div className="container-page py-12 min-h-[70vh]">
        <div className="max-w-xl mx-auto text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your orders...</p>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container-page py-12 min-h-[70vh]">
        <div className="max-w-xl mx-auto">
          <EmptyOrders onBrowse={() => (window.location.href = '/marketplace')} />
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'All', count: orders.length },
    { key: 'Processing', count: orders.filter((o) => ['processing', 'purchasing'].includes(o.status)).length },
    { key: 'In Warehouse', count: orders.filter((o) => o.status === 'in_warehouse').length },
    { key: 'Shipping', count: orders.filter((o) => o.status === 'shipping').length },
    { key: 'Delivered', count: orders.filter((o) => o.status === 'delivered').length },
  ]

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/account" className="hover:text-primary">My Account</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">My Orders</span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <Package className="h-7 w-7 text-primary" />
              My Orders
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track and manage all your proxy purchases
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search orders..."
              leftIcon={<Search className="h-4 w-4" />}
              wrapperClassName="w-56"
            />
            <Button variant="outline" size="md">
              <Filter className="h-4 w-4 mr-1.5" />
              Filter
              <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container-page py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Awaiting Payment', v: '$0', icon: CircleDollarSign, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Processing', v: '2', icon: Clock, color: 'text-info', bg: 'bg-info/10' },
            { label: 'In Warehouse', v: '1', icon: PackageOpen, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'In Transit', v: '1', icon: Truck, color: 'text-secondary', bg: 'bg-secondary/10' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', s.bg)}>
                  <s.icon className={cn('h-5 w-5', s.color)} />
                </div>
                <div>
                  <div className="font-display text-xl font-extrabold">{s.v}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-border mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'shrink-0 flex items-center gap-2 px-4 py-3.5 text-sm font-bold border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground',
              )}
            >
              {t.key}
              <span className={cn(
                'h-5 px-1.5 text-[10px] font-bold rounded-md flex items-center justify-center',
                tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Orders */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-muted-foreground">No orders in this category</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">Try a different filter</p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => {
            const cfg = statusConfig[order.status]
            const Icon = cfg.icon
            return (
              <Card key={order.id} className="overflow-hidden transition-all hover:shadow-card-hover">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center gap-3 justify-between px-5 py-3.5 bg-muted/40 border-b border-border/60">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Order</div>
                        <div className="font-bold text-sm">{order.number}</div>
                      </div>
                      <div className="hidden sm:block h-8 w-px bg-border" />
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Placed</div>
                        <div className="text-sm font-medium">{order.date}</div>
                      </div>
                      <div className="hidden sm:block h-8 w-px bg-border" />
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Items</div>
                        <div className="text-sm font-medium">{order.itemsCount}</div>
                      </div>
                    </div>
                    <Badge variant={cfg.variant} size="md" className="gap-1.5">
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Link to={`/orders/${order.id}`} className="shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-muted border border-border">
                        <img src={order.thumbnail} alt="" className="h-full w-full object-cover" />
                      </Link>
                      <div className="min-w-0">
                        <div className="text-sm font-bold mb-1">
                          {order.itemsCount} {order.itemsCount === 1 ? 'item' : 'items'}
                          {order.trackingCode && <> · <span className="text-muted-foreground font-normal">{order.trackingCode}</span></>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {order.status === 'shipping' && (
                            <div className="flex items-center gap-1 text-info font-semibold">
                              <Truck className="h-3 w-3" />
                              ETA: Sep 12, 2024
                            </div>
                          )}
                          {order.status === 'in_warehouse' && (
                            <div className="flex items-center gap-1 text-primary font-semibold">
                              <PackageCheck className="h-3 w-3" />
                              Ready for shipping request
                            </div>
                          )}
                          {order.status === 'delivered' && (
                            <div className="flex items-center gap-1 text-success font-semibold">
                              <MapPinCheck className="h-3 w-3" />
                              Delivered on Aug 16, 2024
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end gap-4 w-full sm:w-auto">
                      <div className="sm:text-right flex-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Total</div>
                        <div className="font-display text-xl font-extrabold">{formatCurrency(order.totalUsd, 'USD')}</div>
                      </div>
                      <div className="flex gap-2">
                        {order.status === 'in_warehouse' && (
                          <Button variant="secondary" size="md">
                            Request Shipping
                          </Button>
                        )}
                        <Button variant="outline" size="md" asChild>
                          <Link to={`/orders/${order.id}`}>
                            Details
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }))}
        </div>
      </div>
    </div>
  )
}

export default MyOrders
