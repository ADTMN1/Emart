import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Home as HomeIcon,
  Package,
  PackageCheck,
  Truck,
  Box,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Upload,
  Camera,
  Info,
  Sparkles,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'

interface WarehouseItem {
  id: string
  packageNumber: string
  status: string
  weight?: number
  dimensions?: string
  photos?: string[]
  receivedAt?: string
  order?: {
    id: string
    orderNumber: string
    items?: Array<{
      id: string
      quantity: number
      productSnapshot?: any
    }>
  }
}

const Warehouse: React.FC = () => {
  const [packages, setPackages] = React.useState<WarehouseItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true)
        const res = await api.get<{ packages: WarehouseItem[] }>('/admin/warehouse-packages').catch(() => ({ packages: [] }))
        setPackages(res.packages || [])
      } catch {
        setPackages([])
      } finally {
        setLoading(false)
      }
    }
    fetchPackages()
  }, [])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === packages.length) setSelected(new Set())
    else setSelected(new Set(packages.map((p) => p.id)))
  }

  const totalWeight = packages.reduce((s, p) => s + (p.weight || 0.3), 0)
  const itemsValue = 0

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/account" className="hover:text-primary">My Account</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">My Warehouse</span>
        </div>
      </div>

      <div className="container-page py-6">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <Box className="h-7 w-7 text-primary" />
              My Warehouse
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Items ready for international shipment. Free storage up to 45 days.
            </p>
          </div>
          <Badge variant="primary" size="md" className="gap-1.5 py-1.5 px-3">
            <Sparkles className="h-3.5 w-3.5" />
            45 FREE days storage
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Items in Warehouse', v: packages.length.toString(), sub: `${packages.length} total packages`, icon: Box, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Packages', v: packages.length.toString(), sub: 'Ready to consolidate', icon: Package, color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Est. Weight', v: `${totalWeight.toFixed(2)}kg`, sub: 'Total weight', icon: PackageCheck, color: 'text-info', bg: 'bg-info/10' },
            { label: 'Status', v: packages.length > 0 ? 'Active' : 'Empty', sub: 'Warehouse storage', icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <s.icon className={cn('h-5 w-5', s.color)} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-xl font-extrabold truncate">{s.v}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground/80">{s.sub}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info banner */}
        <Card className="mb-8 bg-primary-50/40 border-primary-200">
          <CardContent className="p-5 flex items-start gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold mb-1">Save up to 70% on shipping — Consolidate your packages!</h3>
              <p className="text-sm text-foreground/70 leading-relaxed">
                Combine multiple items into one international shipment and dramatically reduce shipping costs.
                Select the items below and request consolidation and shipping.
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading warehouse packages...</p>
          </div>
        ) : packages.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Box className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="font-display text-lg font-bold mb-2">Your Warehouse is Empty</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Items purchased through EMART will arrive at our Tokyo warehouse and show up here ready for consolidation or international forwarding.
              </p>
              <Button onClick={() => (window.location.href = '/marketplace')}>
                Explore Marketplace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {selected.size > 0 && (
              <div className="sticky top-16 z-20 mb-5 p-3.5 rounded-xl bg-primary-900 text-white shadow-xl flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                  <div className="text-sm truncate">
                    <span className="font-bold">{selected.size}</span> of {packages.length} items selected
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => (window.location.href = '/shipping')}
                  >
                    <Truck className="h-4 w-4 mr-1.5" />
                    Request Shipping
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {packages.map((item) => {
                const isSel = selected.has(item.id)
                return (
                  <Card key={item.id} className={cn('overflow-hidden transition-all', isSel && 'ring-2 ring-primary border-primary/40')}>
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between px-5 py-2.5 bg-muted/40 border-b border-border/60">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" size="sm" className="font-mono">{item.packageNumber}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            Received {item.receivedAt ? new Date(item.receivedAt).toLocaleDateString() : 'Recently'}
                          </span>
                        </div>
                        <Badge variant="success" size="sm" className="gap-1">
                          <PackageCheck className="h-3 w-3" /> {item.status}
                        </Badge>
                      </div>

                      <div className="p-5 flex gap-4 lg:gap-5 flex-col md:flex-row md:items-start">
                        <input
                          type="checkbox"
                          className="hidden md:block h-4 w-4 rounded mt-1.5"
                          checked={isSel}
                          onChange={() => toggle(item.id)}
                        />
                        <div className="flex gap-4 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm leading-snug">
                              Package #{item.packageNumber} {item.order ? `(Order ${item.order.orderNumber})` : ''}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs max-w-md">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Weight</div>
                                <div className="font-semibold mt-0.5">{item.weight ? `${item.weight}kg` : 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Status</div>
                                <div className="font-semibold mt-0.5">{item.status}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Warehouse
