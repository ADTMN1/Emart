import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Home as HomeIcon,
  Truck,
  Plane,
  Ship,
  MapPinCheck,
  PackageCheck,
  ShieldCheck,
  Search,
  Globe2,
  Clock,
  ChevronDown,
  Info,
  CheckCircle2,
  ArrowLeft,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'

interface TrackingEvent {
  date: string
  time: string
  status: string
  location: string
  done: boolean
  current?: boolean
}

const trackings = [
  {
    id: 't1',
    code: 'DHL1234567890JP',
    carrier: 'DHL Express',
    eta: 'Sep 12, 2024',
    destination: 'New York, US',
    status: 'In Transit',
    progress: 65,
    icon: Plane,
    events: [
      { date: 'Sep 7', time: '14:22', status: 'Shipment picked up', location: 'Origin Hub', done: true },
      { date: 'Sep 7', time: '19:45', status: 'Departed origin facility', location: 'Transit Hub', done: true },
      { date: 'Sep 8', time: '08:30', status: 'In transit', location: 'Anchorage, US', done: true, current: true },
      { date: '—', time: '—', status: 'Arrived at destination', location: 'New York, US', done: false },
      { date: '—', time: '—', status: 'Out for delivery', location: 'New York, US', done: false },
      { date: 'Est. Sep 12', time: '—', status: 'Delivered', location: 'New York, US', done: false },
    ],
  },
  {
    id: 't2',
    code: 'EMS9876543210JP',
    carrier: 'EMS',
    eta: 'Aug 16, 2024',
    destination: 'London, UK',
    status: 'Delivered',
    progress: 100,
    icon: MapPinCheck,
    events: [],
  },
]

const methods = [
  { name: 'DHL Express', days: '3-5 days', priceFrom: 22, icon: Plane, speed: 5, coverage: 220, track: true },
  { name: 'FedEx', days: '4-7 days', priceFrom: 20, icon: Plane, speed: 4, coverage: 220, track: true },
  { name: 'EMS', days: '5-8 days', priceFrom: 15, icon: Truck, speed: 3.5, coverage: 120, track: true },
  { name: 'SAL', days: '10-14 days', priceFrom: 10, icon: Truck, speed: 2, coverage: 60, track: true },
  { name: 'ePacket', days: '12-20 days', priceFrom: 8, icon: Truck, speed: 1.5, coverage: 40, track: true },
  { name: 'Sea Mail', days: '25-40 days', priceFrom: 6, icon: Ship, speed: 1, coverage: 100, track: false },
]

const Shipping: React.FC = () => {
  const [trackQuery, setTrackQuery] = React.useState('')

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/account" className="hover:text-primary">My Account</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Shipping & Tracking</span>
        </div>
      </div>

      {/* Hero + Track */}
      <section className="container-page py-10">
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
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted-foreground font-semibold">Quick access:</span>
                  {trackings.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTrackQuery(t.code)}
                      className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-muted hover:bg-primary-50 hover:text-primary transition-colors font-bold"
                    >
                      {t.code.slice(0, 6)}…
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Active shipments */}
      <section className="container-page pb-10">
        <h2 className="font-display text-xl lg:text-2xl font-bold mb-5">Your Active Shipments</h2>
        <div className="space-y-6">
          {trackings.slice(0, 1).map((t) => {
            const Icon = t.icon
            return (
              <Card key={t.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-5 lg:p-6 grid lg:grid-cols-5 gap-5 items-start border-b border-border/60">
                    <div className="lg:col-span-2">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-bold">{t.carrier}</h3>
                            <Badge variant={t.status === 'Delivered' ? 'success' : 'accent'} size="sm" className="gap-1">
                              <Truck className="h-3 w-3" />
                              {t.status}
                            </Badge>
                          </div>
                          <div className="mt-1 font-mono text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                            {t.code}
                            <button className="text-primary hover:underline text-xs font-sans font-semibold">Copy</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:col-span-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Destination</div>
                        <div className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                          <Globe2 className="h-3.5 w-3.5 text-primary" />
                          {t.destination}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">ETA</div>
                        <div className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-secondary" />
                          {t.eta}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Progress</div>
                        <div className="mt-1.5">
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                t.progress === 100 ? 'bg-success' : 'bg-gradient-to-r from-primary to-secondary',
                              )}
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs font-bold">{t.progress}%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="p-5 lg:p-6 bg-muted/20">
                    <div className="relative">
                      <div className="hidden sm:block absolute left-5 top-5 bottom-5 w-0.5 bg-border" />
                      <div className="space-y-5">
                        {t.events.map((e, i) => (
                          <div key={i} className="relative flex gap-4">
                            <div className={cn(
                              'relative z-10 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border-2',
                              e.current
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 ring-4 ring-primary/15'
                                : e.done
                                ? 'bg-success text-white border-success'
                                : 'bg-white border-border text-muted-foreground',
                            )}>
                              {e.done || e.current ? (
                                e.current ? <Truck className="h-4 w-4 animate-pulse" /> : <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Clock className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 grid sm:grid-cols-5 gap-2 pt-0.5 pb-1">
                              <div className="sm:col-span-1 text-xs">
                                <div className="font-bold text-foreground">{e.date}</div>
                                <div className="text-muted-foreground">{e.time}</div>
                              </div>
                              <div className="sm:col-span-2">
                                <div className={cn('text-sm font-bold', !e.done && !e.current && 'text-muted-foreground')}>
                                  {e.status}
                                  {e.current && <Badge variant="primary" size="sm" className="ml-2">Current</Badge>}
                                </div>
                              </div>
                              <div className="sm:col-span-2 text-sm text-foreground/70">
                                <div className="flex items-center gap-1">
                                  <MapPinCheck className="h-3 w-3 opacity-70" />
                                  {e.location}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Shipping methods */}
      <section className="py-12 lg:py-16 bg-muted/20 border-y border-border">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="primary" size="sm" className="mb-3">Global Shipping</Badge>
            <h2 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight">
              Choose Your Shipping Method
            </h2>
            <p className="mt-2.5 text-muted-foreground">
              Balance speed and cost with our trusted carrier partners. Prices shown below are per 500g package.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((m) => {
              const Icon = m.icon
              return (
                <Card key={m.name} className="group hover:shadow-card-hover">
                  <CardContent className="p-5 lg:p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary flex items-center justify-center">
                        <Icon className="h-5.5 w-5.5" />
                      </div>
                      <Badge variant={m.speed >= 4 ? 'success' : m.speed >= 2 ? 'info' : 'warning'} size="sm" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {m.days}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{m.name}</h3>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />
                        Covers {m.coverage}+ countries {m.track ? '· Full tracking' : '· Limited tracking'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Speed</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                'h-1.5 w-4 rounded-full',
                                i < m.speed ? 'bg-gradient-to-r from-primary to-secondary' : 'bg-border',
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between pt-2 border-t border-border/60">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Price from</div>
                        <div className="font-display text-2xl font-extrabold">
                          {formatCurrency(m.priceFrom, 'USD')}
                        </div>
                      </div>
                      <Button size="md" variant="outline">
                        Calculator
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <Card className="bg-primary-900 text-white border-none overflow-hidden relative">
          <div className="absolute inset-0 bg-hero-pattern opacity-10" />
          <CardContent className="p-8 lg:p-10 grid md:grid-cols-2 gap-6 items-center relative">
            <div>
              <h3 className="font-display text-2xl lg:text-3xl font-extrabold mb-2">Not sure which method to choose?</h3>
              <p className="text-primary-100/80 leading-relaxed">
                Use our shipping calculator to compare exact rates, delivery times, and package insurance options for your country.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select className="!bg-white/10 !text-white !border-white/20 !placeholder:text-white/50">
                <option>Select Country</option>
                <option>🇺🇸 United States</option>
                <option>🇬🇧 United Kingdom</option>
                <option>🇨🇦 Canada</option>
                <option>🇦🇺 Australia</option>
              </Select>
              <Select className="!bg-white/10 !text-white !border-white/20">
                <option>Package Weight</option>
                <option>Up to 500g</option>
                <option>500g - 1kg</option>
                <option>1kg - 2kg</option>
                <option>2kg - 5kg</option>
              </Select>
              <Button size="xl" variant="secondary" className="col-span-2 shadow-lg shadow-secondary/25">
                Calculate Shipping Rates
                <ChevronDown className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default Shipping
