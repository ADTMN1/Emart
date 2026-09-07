import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Link as LinkIcon,
  ArrowRight,
  ChevronRight,
  Star,
  ShieldCheck,
  Globe2,
  Truck,
  Warehouse,
  PackageCheck,
  Package,
  Plane,
  MapPinCheck,
  CreditCard,
  Headphones,
  Receipt,
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  Shirt,
  Watch,
  Gamepad2,
  Home as HomeIcon,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Quote,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, SearchInput, UrlInput } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProductCard } from '@/components/ui/ProductCard'
import { Marquee } from '@/components/ui/Marquee'

import {
  categories,
  products,
  howItWorksSteps,
  trustFeatures,
  shippingCarriers,
  testimonials,
} from '@/data/mockData'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  search: Search,
  'shopping-cart': Package,
  'package-check': PackageCheck,
  plane: Plane,
  'map-pin-check': MapPinCheck,
  warehouse: Warehouse,
  'shield-check': ShieldCheck,
  camera: Camera,
  receipt: Receipt,
  'credit-card': CreditCard,
  headphones: Headphones,
  smartphone: Smartphone,
  shirt: Shirt,
  watch: Watch,
  star: Star,
  'gamepad-2': Gamepad2,
  sparkles: Sparkles,
  home: HomeIcon,
  dumbbell: Dumbbell,
}

const faqs = [
  {
    q: 'How does proxy shopping work?',
    a: 'EMART acts as your personal buyer. You find products, we purchase them on your behalf, inspect them at our warehouse, consolidate multiple orders, and ship internationally to your doorstep with full tracking.',
  },
  {
    q: 'Are there any hidden fees?',
    a: 'Not at all. Our pricing is 100% transparent. You see the exact breakdown at checkout: item price, domestic shipping, our service fee (7-10%), and your chosen international shipping. No surprises.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Delivery times depend on your chosen method: DHL/FedEx (3-5 days), EMS (5-8 days), SAL (10-14 days), or Sea Mail (25-40 days). All methods include full tracking.',
  },
  {
    q: 'What if my item is damaged or wrong?',
    a: 'Every item is photographed and inspected at our warehouse. If an issue is found before shipping, we contact you immediately. Our 100% Buyer Protection covers you for any verified issues.',
  },
  {
    q: 'Can I combine multiple orders?',
    a: 'Yes! This is one of our best features. Store up to 10 items for FREE for 45 days, then consolidate them all into a single international shipment. This saves you up to 70% on shipping costs.',
  },
]

const Home: React.FC = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [urlQuery, setUrlQuery] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'search' | 'url'>('search')
  const [openFaq, setOpenFaq] = React.useState<number | null>(0)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = (activeTab === 'search' ? searchQuery : urlQuery).trim()
    if (!q) return
    const params = new URLSearchParams()
    if (activeTab === 'url') params.set('url', q)
    else params.set('q', q)
    navigate(`/marketplace?${params.toString()}`)
  }

  return (
    <div className="bg-background">
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden min-h-[600px] lg:min-h-[700px]">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img 
            src="/images/1.jpg" 
            alt="E-commerce background" 
            className="w-full h-full object-cover"
          />
          {/* Light overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/40" />
          {/* Pattern overlay */}
          <div className="absolute inset-0 bg-hero-pattern opacity-5" />
        </div>
        
        {/* Decorative blurs */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-secondary-400/20 blur-3xl" />
        <div className="absolute top-1/2 -left-32 h-96 w-96 rounded-full bg-primary-400/20 blur-3xl" />

        <div className="container-page relative py-16 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6 animate-fade-in">
              <Sparkles className="h-3.5 w-3.5 text-secondary-300" />
              <span className="text-xs font-bold text-white tracking-wide">
                TRUSTED BY 250,000+ CUSTOMERS WORLDWIDE
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.05] text-balance animate-slide-up">
              Buy from Global Markets,
              <br />
              <span className="text-secondary-300"> delivered to you.</span>
            </h1>

            <p className="mt-6 text-lg lg:text-xl text-white/90 leading-relaxed max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: '80ms' }}>
              Shop millions of authentic products from global marketplaces — with complete transparency, buyer protection, and consolidated international shipping.
            </p>

            <form onSubmit={handleSearch} className="mt-8 animate-slide-up max-w-2xl mx-auto" style={{ animationDelay: '160ms' }}>
                <div className="inline-flex rounded-xl bg-muted p-1.5 mb-4 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all',
                      activeTab === 'search'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search Products
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('url')}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all',
                      activeTab === 'url'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Paste Product URL
                  </button>
                </div>

                <div className="relative flex flex-col sm:flex-row gap-3 items-stretch">
                  {activeTab === 'search' ? (
                    <SearchInput
                      placeholder="Search products: Rolex, Pokémon cards, Sony..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      wrapperClassName="flex-1"
                    />
                  ) : (
                    <UrlInput
                      placeholder="Paste product URL from any marketplace"
                      value={urlQuery}
                      onChange={(e) => setUrlQuery(e.target.value)}
                      wrapperClassName="flex-1"
                    />
                  )}
                  <Button type="submit" size="xl" className="sm:w-auto w-full shadow-lg shadow-primary/25">
                    {activeTab === 'search' ? 'Search Products' : 'Get Quote'}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/80">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-medium">100% Buyer Protection</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-medium">Transparent 7-10% Service Fee</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-medium">Free 45-Day Storage</span>
                  </div>
                </div>
              </form>
            </div>

            {/* Stats */}
            <div className="mt-16 lg:mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 max-w-4xl mx-auto">
              {[
                { v: '12M+', l: 'Products Available' },
                { v: '250K+', l: 'Happy Customers' },
                { v: '180+', l: 'Countries Shipped' },
                { v: '4.9/5', l: 'Average Rating' },
              ].map((s) => (
                <div key={s.l} className="bg-white/90 backdrop-blur-sm border border-white/50 rounded-2xl p-5 lg:p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
                  <div className="font-display text-2xl lg:text-3xl font-extrabold text-primary-700">
                    {s.v}
                  </div>
                  <div className="mt-1 text-xs lg:text-sm font-medium text-gray-600">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      {/* ===================== BREAKING NEWS MARQUEE ===================== */}
      <section className="border-y border-border bg-gradient-to-r from-primary-600 via-primary-700 to-primary-600 text-white overflow-hidden">
        <div className="py-3.5">
          <Marquee speed="normal">
            <div className="flex items-center gap-8 text-sm font-medium">
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary-500 text-white text-xs font-bold uppercase">
                  🔥 Hot
                </span>
                <span>Flash Sale: Up to 50% OFF on Electronics</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase">
                  ✈️ New
                </span>
                <span>Free Express Shipping on Orders $200+</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase">
                  🎁 Gift
                </span>
                <span>First-Time Buyers Get $20 Credit</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 text-white text-xs font-bold uppercase">
                  ⭐ Trending
                </span>
                <span>Limited Edition Pokémon Cards Available Now</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase">
                  💎 Premium
                </span>
                <span>Exclusive Japanese Watches from $1,500</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-600 text-white text-xs font-bold uppercase">
                  ✓ Verified
                </span>
                <span>All Sellers 100% Authenticated & Insured</span>
              </div>
            </div>
          </Marquee>
        </div>
      </section>

      {/* ===================== MARKETPLACE SOURCES BAR ===================== */}
      <section className="border-b border-border bg-muted/30">
        <div className="container-page py-6 flex flex-col md:flex-row items-center justify-center md:justify-between gap-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Shop directly from top global marketplaces
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {['Mercari', 'Yahoo Auctions', 'Rakuten', 'Amazon', 'eBay', 'AliExpress'].map((s) => (
              <span
                key={s}
                className="px-4 py-2 rounded-lg bg-background border border-border text-sm font-bold text-foreground/80 hover:text-primary hover:border-primary-300 transition-colors cursor-default"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== POPULAR CATEGORIES ===================== */}
      <section className="py-16 lg:py-20">
        <div className="container-page">
          <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
            <div>
              <Badge variant="secondary" size="sm" className="mb-3">
                Explore Categories
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
                Shop by Category
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                Discover the best products across our most popular categories, handpicked for international shoppers.
              </p>
            </div>
            <Link
              to="/categories"
              className="hidden md:inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-700 transition-colors group"
            >
              View all categories
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 lg:gap-4">
            {categories.map((cat) => {
              const Icon = iconMap[cat.icon] || Star
              return (
                <Link
                  key={cat.id}
                  to={`/categories?id=${cat.id}`}
                  className="group flex flex-col items-center p-4 lg:p-5 rounded-2xl bg-gray-50 border border-border hover:border-primary-300 hover:shadow-card-hover transition-all duration-300 text-center"
                >
                  <div
                    className={cn(
                      'h-12 w-12 lg:h-14 lg:w-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110',
                      cat.color,
                    )}
                  >
                    <Icon className="h-6 w-6 lg:h-7 lg:w-7" />
                  </div>
                  <div className="text-sm font-bold text-foreground leading-tight">
                    {cat.name}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {formatNumber(cat.count)} items
                  </div>
                </Link>
              )
            })}
          </div>

          <Link
            to="/categories"
            className="md:hidden mt-6 flex items-center justify-center gap-1.5 text-sm font-bold text-primary py-3 rounded-xl bg-primary-50 w-full"
          >
            View all categories
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ===================== FEATURED PRODUCTS ===================== */}
      <section className="py-16 lg:py-20 bg-muted/20">
        <div className="container-page">
          <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
            <div>
              <Badge variant="info" size="sm" className="mb-3" dot>
                Trending Now
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
                Featured Finds
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                Curated selection of authentic products from top sellers, updated daily with new arrivals.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="md" asChild>
                <Link to="/marketplace">
                  View All Products
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {products.slice(0, 8).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onFavorite={toggleFavorite}
                isFavorite={favorites.has(p.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="py-16 lg:py-24">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="primary" size="sm" className="mb-3">
              Simple Process
            </Badge>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
              How EMART Works
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Five simple steps from browsing products to receiving them at your doorstep.
            </p>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-5 lg:gap-4">
              {howItWorksSteps.map((step, idx) => {
                const Icon = iconMap[step.icon] || Star
                return (
                  <div
                    key={step.id}
                    className="relative group"
                  >
                    <div className="relative flex flex-col items-center text-center p-5 rounded-2xl bg-gray-50 border border-border hover:border-primary-300 hover:shadow-card-hover transition-all duration-300 h-full">
                      <div className="relative">
                        <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Icon className="h-8 w-8 lg:h-9 lg:w-9 text-primary" />
                        </div>
                        <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-secondary text-white text-xs font-bold flex items-center justify-center shadow-md ring-4 ring-gray-50">
                          {step.id}
                        </div>
                      </div>
                      <h3 className="text-base font-bold mb-1.5">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                    {idx < howItWorksSteps.length - 1 && (
                      <div className="hidden lg:flex absolute top-10 -right-2 z-10 h-6 w-6 rounded-full bg-gray-50 border border-border items-center justify-center shadow-sm">
                        <ChevronRight className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== TRUST & SECURITY ===================== */}
      <section id="trust" className="py-16 lg:py-24 bg-primary-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-pattern opacity-10" />
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-secondary-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />

        <div className="container-page relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="accent" size="sm" className="mb-3">
              Your Trust Matters
            </Badge>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
              Shop with Complete Confidence
            </h2>
            <p className="mt-3 text-primary-100/80 text-lg">
              Everything we do is designed to protect buyers and deliver a trustworthy international shopping experience.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trustFeatures.map((f) => {
              const Icon = iconMap[f.icon] || ShieldCheck
              return (
                <Card
                  key={f.title}
                  className="bg-white/5 border-white/10 backdrop-blur hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <CardContent className="p-6 lg:p-7">
                    <div className="h-12 w-12 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
                    <p className="text-sm text-primary-100/70 leading-relaxed">
                      {f.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===================== INTERNATIONAL SHIPPING ===================== */}
      <section id="shipping" className="py-16 lg:py-24">
        <div className="container-page">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative aspect-square max-w-lg mx-auto lg:mx-0">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-100 to-secondary-100" />
                <div className="absolute inset-4 rounded-2xl bg-gray-50 shadow-xl ring-1 ring-black/5 flex items-center justify-center overflow-hidden">
                  <img
                    src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=international%20shipping%20package%20boxes%20warehouse%20global%20logistics%20clean%20professional%20photo&image_size=square_hd"
                    alt="International shipping"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="absolute -left-2 bottom-10 bg-gray-50 rounded-xl p-3.5 shadow-xl ring-1 ring-black/5 flex items-center gap-3 animate-slide-up">
                  <div className="h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
                    <Globe2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">180+ Countries</div>
                    <div className="text-[10px] text-muted-foreground">Worldwide delivery</div>
                  </div>
                </div>

                <div className="absolute -right-2 top-10 bg-gray-50 rounded-xl p-3.5 shadow-xl ring-1 ring-black/5 flex items-center gap-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">In 3-40 Days</div>
                    <div className="text-[10px] text-muted-foreground">Flexible speeds</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <Badge variant="info" size="sm" className="mb-3">
                Global Shipping
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                International Shipping to <span className="text-primary">180+ Countries</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Choose from multiple trusted carriers to balance speed and cost. Store multiple items at our warehouse for FREE (up to 45 days) and combine them into one shipment for massive savings — up to 70% vs shipping individually.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Free package consolidation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Full end-to-end tracking on every shipment</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Professional packaging & damage protection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Insurance available for high-value items</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {shippingCarriers.map((c) => (
                  <div key={c.name} className="p-4 rounded-xl border border-border bg-card hover:border-primary-300 hover:shadow-card-hover transition-all">
                    <div className="font-bold text-foreground">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.days}</div>
                    <div className="text-sm font-bold text-primary mt-1">
                      from {formatCurrency(c.priceFrom, 'USD')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== TESTIMONIALS ===================== */}
      <section className="py-16 lg:py-20 bg-muted/20">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="accent" size="sm" className="mb-3">
              Real Customers
            </Badge>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
              Loved by Thousands of International Shoppers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <Card key={t.name} className="flex flex-col">
                <CardContent className="p-6 flex flex-col flex-1">
                  <Quote className="h-8 w-8 text-primary/20 mb-4 shrink-0" />
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed flex-1 mb-5">
                    "{t.text}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className="h-10 w-10 rounded-full bg-primary text-white font-bold flex items-center justify-center">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.location}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section id="faq" className="py-16 lg:py-20">
        <div className="container-page">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-16">
            <div className="lg:col-span-2">
              <Badge variant="primary" size="sm" className="mb-3">
                FAQ
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Have questions about using EMART? We've got answers. If you don't find what you need, our support team is here 24/7.
              </p>
              <Button variant="outline" size="md">
                <Headphones className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>

            <div className="lg:col-span-3 space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={faq.q}
                  className={cn(
                    'rounded-xl border transition-all overflow-hidden',
                    openFaq === i
                      ? 'border-primary-200 bg-primary-50/30 shadow-md'
                      : 'border-border bg-gray-50 hover:border-border/80',
                  )}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-start gap-3 text-left p-5 lg:p-6"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-base text-foreground leading-snug">
                        {faq.q}
                      </div>
                      {openFaq === i && (
                        <p className="mt-3 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                          {faq.a}
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors mt-0.5',
                      openFaq === i ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                    )}>
                      {openFaq === i ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="py-16 lg:py-20">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary to-primary-700 p-8 lg:p-16">
            <div className="relative max-w-3xl mx-auto text-center text-white">
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-foreground leading-[1.05] text-balance animate-slide-up">
                Ready to Shop Global Markets?
              </h2>
              <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                Join 250,000+ shoppers worldwide enjoying authentic products with transparent pricing and reliable delivery. Signing up takes 30 seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="xl"
                  variant="outline"
                  className="w-full sm:w-auto !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
                  asChild
                >
                  <Link to="/marketplace">
                    <Globe2 className="h-4 w-4 mr-1.5" />
                    Start Browsing
                  </Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-primary-200 flex items-center justify-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 24/7 support included
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
