import * as React from 'react'
import {
  ChevronRight,
  Truck,
  Plane,
  Ship,
  MapPinCheck,
  PackageCheck,
  Search,
  Globe2,
  Clock,
  Info,
  CheckCircle2,
  ArrowLeft,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'

import { api } from '@/lib/api'

interface TrackingEvent {
  date: string
  time: string
  status: string
  location: string
  done: boolean
  current?: boolean
}

interface ShipmentItem {
  id: string
  trackingNumber: string
  carrier: string
  status: string
  shippingCost: number
  shippedAt?: string
  estimatedDelivery?: string
  order?: {
    orderNumber: string
    user?: {
      email: string
    }
  }
}

const Shipping: React.FC = () => {
  const [trackQuery, setTrackQuery] = React.useState('')
  const [shipments, setShipments] = React.useState<ShipmentItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true)
        const res = await api.get<{ shipments: ShipmentItem[] }>('/orders/shipments').catch(() => ({ shipments: [] }))
        setShipments(res.shipments || [])
      } catch {
        setShipments([])
      } finally {
        setLoading(false)
      }
    }
    fetchShipments()
  }, [])

  return (
    <div className="space-y-6">
      {/* Hero + Track */}
      <section className="container-page py-6">
        <div className="grid lg:grid-cols-5 gap-8 items-center">
          <div className="lg:col-span-2 space-y-5">
            <h1 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              Track & Manage Your Shipments
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Full end-to-end tracking on every international package. From our warehouse straight to your doorstep worldwide.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: '180+', l: 'Countries' },
                { v: '6', l: 'Carriers' },
                { v: '100%', l: 'Tracked' },
              ].map((s) => (
                <div key={s.l} className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-center">
                  <div className="font-display text-xl font-extrabold text-primary">{s.v}</div>
                  <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-2 border-primary/15 shadow-lg overflow-hidden">
              <CardContent className="p-5 lg:p-7">
                <h2 className="font-bold mb-4 flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5 text-primary" />
                  Track a Shipment
                </h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Enter tracking code (e.g. DHL1234567890JP)"
                    leftIcon={<PackageCheck className="h-4 w-4" />}
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                    className="!h-12 text-sm flex-1"
                  />
                  <Button size="xl" variant="primary" className="sm:w-auto w-full">
                    Track Package
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Active shipments */}
      <section className="container-page pb-10">
        <h2 className="font-display text-xl lg:text-2xl font-bold mb-5">Your Active Shipments</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading active shipments...</p>
          </div>
        ) : shipments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="font-display text-lg font-bold mb-2">No Active Shipments</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                When your warehouse packages are prepared for international delivery, active shipments will appear here with live tracking updates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {shipments.map((t) => {
              return (
                <Card key={t.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-5 lg:p-6 grid lg:grid-cols-5 gap-5 items-start border-b border-border/60">
                      <div className="lg:col-span-2">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Truck className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display text-lg font-bold">{t.carrier}</h3>
                              <Badge variant={t.status === 'DELIVERED' ? 'success' : 'accent'} size="sm" className="gap-1">
                                <Truck className="h-3 w-3" />
                                {t.status}
                              </Badge>
                            </div>
                            <div className="mt-1 font-mono text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                              {t.trackingNumber}
                              <button
                                className="text-primary hover:underline text-xs font-sans font-semibold"
                                onClick={() => navigator.clipboard.writeText(t.trackingNumber)}
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:col-span-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Cost</div>
                          <div className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                            {formatCurrency(t.shippingCost || 0, 'USD')}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Shipped At</div>
                          <div className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-secondary" />
                            {t.shippedAt ? new Date(t.shippedAt).toLocaleDateString() : 'Pending'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Status</div>
                          <div className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                            {t.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default Shipping
