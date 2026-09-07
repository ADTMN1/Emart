import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronRight,
  Home as HomeIcon,
  Package,
  PackageCheck,
  Truck,
  MapPinCheck,
  PackageOpen,
  CheckCircle2,
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
import { products } from '@/data/mockData'

const timelineSteps = [
  { id: 1, key: 'placed', title: 'Order Placed', time: 'Sep 7, 2024 · 10:32 AM', icon: CheckCircle2, done: true },
  { id: 2, key: 'paid', title: 'Payment Confirmed', time: 'Sep 7, 2024 · 10:34 AM', icon: ShieldCheck, done: true },
  { id: 3, key: 'purchasing', title: 'Purchasing from Sellers', time: 'In progress...', icon: Store, active: true },
  { id: 4, key: 'warehouse', title: 'Arrives at Warehouse', time: 'Est. Sep 9-10', icon: PackageOpen, done: false },
  { id: 5, key: 'inspection', title: 'Item Inspection', time: 'Est. Sep 10', icon: PackageCheck, done: false },
  { id: 6, key: 'shipped', title: 'Shipped Internationally', time: 'Est. Sep 11', icon: Truck, done: false },
  { id: 7, key: 'delivered', title: 'Delivered to You', time: 'Est. Sep 14-16', icon: MapPinCheck, done: false },
]

const OrderDetails: React.FC = () => {
  const { id } = useParams()
  const items = [products[0], products[2]]

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/orders" className="hover:text-primary">My Orders</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">#EMT-20240907-12345</span>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight">
                Order #EMT-20240907-12345
              </h1>
              <Badge variant="info" size="md" className="gap-1.5">
                <Clock className="h-3 w-3" />
                Processing
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Placed on Sep 7, 2024 · {items.length + 1} items · 2 packages
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="md">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Contact Support
            </Button>
            <Button variant="primary" size="md">
              <Download className="h-4 w-4 mr-1.5" />
              Invoice
            </Button>
          </div>
        </div>
      </div>

      <div className="container-page py-6 lg:py-8 grid lg:grid-cols-3 gap-6 lg:gap-8">
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
                <h2 className="font-display text-lg font-bold">Items ({items.length + 1})</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/cart">Add More Items</Link>
                </Button>
              </div>

              <div className="space-y-4">
                {[
                  { p: items[0], pkg: 'Package A', qty: 1, status: 'Purchasing', vendor: 'Mercari - Watch Collector' },
                  { p: items[1], pkg: 'Package B', qty: 1, status: 'Arriving tomorrow', vendor: 'Amazon - Ghibli Museum Store' },
                ].map((row, idx) => (
                  <div key={row.p.id + idx} className="p-4 rounded-xl bg-muted/30 border border-border/60">
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
                      <Link to={`/product/${row.p.id}`} className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                        <img src={row.p.image} alt="" className="h-full w-full object-cover" />
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <Link to={`/product/${row.p.id}`} className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                          {row.p.name}
                        </Link>
                        <div className="flex items-center justify-between pt-2">
                          <Badge variant="success" size="sm">{row.p.condition}</Badge>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground">Qty: {row.qty}</span>
                            <span className="font-bold">{formatCurrency(row.p.estimatedPriceUsd * row.qty, 'USD')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                  <div className="font-bold mb-1">DHL Express</div>
                  <div className="text-xs text-muted-foreground">3-5 business days · Fully tracked</div>
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
                  <span className="text-foreground/80 font-medium">3 items</span>
                  <span className="font-semibold">{formatCurrency(372, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Service Fees (7%)</span>
                  <span className="font-semibold">{formatCurrency(54, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Domestic Shipping</span>
                  <span className="font-semibold">{formatCurrency(10, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">DHL Express</span>
                  <span className="font-semibold">{formatCurrency(58, 'USD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/80 font-medium">Insurance</span>
                  <span className="font-semibold">{formatCurrency(8, 'USD')}</span>
                </div>
              </div>

              <div className="h-px bg-border/70" />

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">Total Paid</span>
                <div className="font-display text-2xl font-extrabold">
                  {formatCurrency(502, 'USD')}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-success/5 border border-success/15 text-xs">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-foreground">Payment completed</div>
                    <div className="text-muted-foreground mt-0.5">Visa •••• 4242 · Transaction #TXN-9A7F32B</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tracking</span>
                <Badge variant="info" size="sm">Not available yet</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Tracking information will appear here once your package is shipped.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono font-bold">EMT-20240907-12345</span>
                <button className="ml-auto text-primary font-bold">Copy</button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export default OrderDetails
