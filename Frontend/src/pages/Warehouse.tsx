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
import { products } from '@/data/mockData'

interface WarehouseItem {
  id: string
  packageId: string
  product: typeof products[0]
  quantity: number
  arrived: string
  storageDaysLeft: number
  condition: 'verified' | 'pending'
  photos: number
  weight: string
  dimensions: string
}

const items: WarehouseItem[] = [
  {
    id: 'w1',
    packageId: 'PKG-A-09251',
    product: products[6],
    quantity: 1,
    arrived: 'Sep 5, 2024',
    storageDaysLeft: 42,
    condition: 'verified',
    photos: 6,
    weight: '380g',
    dimensions: '30×20×12cm',
  },
  {
    id: 'w2',
    packageId: 'PKG-B-09240',
    product: products[3],
    quantity: 2,
    arrived: 'Sep 4, 2024',
    storageDaysLeft: 41,
    condition: 'verified',
    photos: 4,
    weight: '220g',
    dimensions: '18×12×8cm',
  },
]

const Warehouse: React.FC = () => {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(items.map((i) => i.id)))
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map((i) => i.id)))
  }

  const totalWeight = items.reduce((s) => s + 0.38 + 0.22, 0)
  const itemsValue = items.reduce((s, i) => s + i.product.estimatedPriceUsd * i.quantity, 0)

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
            42 FREE days left
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Items in Warehouse', v: items.length.toString(), sub: `${items.reduce((s, i) => s + i.quantity, 0)} total units`, icon: Box, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Packages', v: '2', sub: 'Ready to consolidate', icon: Package, color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Est. Weight', v: '600g', sub: `Combined ${totalWeight.toFixed(2)}kg`, icon: PackageCheck, color: 'text-info', bg: 'bg-info/10' },
            { label: 'Items Value', v: formatCurrency(itemsValue, 'USD'), sub: 'Declared value', icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
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

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="sticky top-16 z-20 mb-5 p-3.5 rounded-xl bg-primary-900 text-white shadow-xl flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
              <div className="text-sm truncate">
                <span className="font-bold">{selected.size}</span> of {items.length} items selected
                <span className="ml-2 text-primary-200">· {selected.size === items.length ? 'Full consolidation' : 'Partial shipment'}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="md"
                className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
              >
                <Camera className="h-4 w-4 mr-1.5" />
                Request Photos
              </Button>
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

        {/* Items */}
        <div className="flex items-center justify-between mb-3 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={selected.size === items.length && items.length > 0}
              onChange={toggleAll}
            />
            <span className="text-sm font-semibold">Select all items</span>
          </label>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            All storage expires in ~42 days
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const isSel = selected.has(item.id)
            return (
              <Card key={item.id} className={cn('overflow-hidden transition-all', isSel && 'ring-2 ring-primary border-primary/40')}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-5 py-2.5 bg-muted/40 border-b border-border/60">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" size="sm" className="font-mono">{item.packageId}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Arrived {item.arrived}
                      </span>
                      <span className="text-xs text-primary font-semibold flex items-center gap-1">
                        <Box className="h-3 w-3" />
                        {item.storageDaysLeft} days free storage left
                      </span>
                    </div>
                    <Badge variant={item.condition === 'verified' ? 'success' : 'warning'} size="sm" className="gap-1">
                      {item.condition === 'verified' ? (
                        <><PackageCheck className="h-3 w-3" /> Verified</>
                      ) : (
                        <><Upload className="h-3 w-3" /> Processing</>
                      )}
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
                      <label className="md:hidden flex items-center gap-2 cursor-pointer shrink-0">
                        <input type="checkbox" className="h-4 w-4 rounded" checked={isSel} onChange={() => toggle(item.id)} />
                      </label>
                      <div className="w-20 h-20 lg:w-24 lg:h-24 shrink-0 rounded-xl overflow-hidden bg-muted border border-border relative group cursor-pointer">
                        <img src={item.product.image} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 text-white text-[10px] font-bold flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="h-3 w-3" />
                          {item.photos} photos
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${item.product.id}`} className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                          {item.product.name}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline" size="sm">{item.product.source}</Badge>
                          <Badge variant="success" size="sm">{item.product.condition}</Badge>
                          <Badge variant="info" size="sm">Qty: {item.quantity}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-xs max-w-md">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Weight</div>
                            <div className="font-semibold mt-0.5">{item.weight}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Size</div>
                            <div className="font-semibold mt-0.5">{item.dimensions}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Value</div>
                            <div className="font-semibold mt-0.5">{formatCurrency(item.product.estimatedPriceUsd, 'USD')}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end gap-2 md:gap-3">
                      <Button variant="outline" size="sm">
                        <Camera className="h-3.5 w-3.5 mr-1" />
                        Photos ({item.photos})
                      </Button>
                      <Button variant="ghost" size="sm">Remove</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Warehouse
