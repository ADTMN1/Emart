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
import { CategorySkeleton, ProductListSkeleton } from '@/components/ui/Skeleton'
import { useLanguage } from '@/contexts/LanguageContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import type { Category, Product } from '@/lib/types'
import { cachedApi, invalidateCache } from '@/lib/api'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { useProgressiveImage } from '@/hooks/useProgressiveImage'
import { useInView } from '@/hooks/useInView'

// Lazy load Three.js hero rails (saves 789 KB until needed)
const LazyHeroProductRail = React.lazy(() =>
  import('@/components/3d/HeroProductRail').then((module) => ({
    default: module.HeroProductRail,
  })),
)

const howItWorksSteps = [
  { id: 1, icon: 'search' },
  { id: 2, icon: 'shopping-cart' },
  { id: 3, icon: 'package-check' },
  { id: 4, icon: 'plane' },
  { id: 5, icon: 'map-pin-check' },
]

const trustFeatures = [
  { icon: 'warehouse' },
  { icon: 'shield-check' },
  { icon: 'camera' },
  { icon: 'receipt' },
  { icon: 'credit-card' },
  { icon: 'headphones' },
]

const shippingCarriers = [
  { name: 'EMS', days: '5-8 days', priceFrom: 15 },
  { name: 'DHL', days: '3-5 days', priceFrom: 22 },
  { name: 'FedEx', days: '4-7 days', priceFrom: 20 },
  { name: 'SAL', days: '10-14 days', priceFrom: 10 },
  { name: 'Sea Mail', days: '25-40 days', priceFrom: 8 },
]

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

const Home: React.FC = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { toggleFavorite, isFavorite } = useFavorites()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [urlQuery, setUrlQuery] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'search' | 'url'>('search')
  const [openFaq, setOpenFaq] = React.useState<number | null>(0)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [products, setProducts] = React.useState<Product[]>([])
  const [productsLoading, setProductsLoading] = React.useState(false)
  const [categoriesLoading, setCategoriesLoading] = React.useState(false)
  const [show3dRails, setShow3dRails] = React.useState(false)
  const [productsError, setProductsError] = React.useState(false)
  const [categoriesError, setCategoriesError] = React.useState(false)

  // Progressive image loading for hero
  const heroImage = useProgressiveImage('/images/1-placeholder.jpg', '/images/1.jpg')
  
  // Lazy load below-the-fold sections
  const [howItWorksRef, howItWorksInView] = useInView({ rootMargin: '200px' })
  const [trustRef, trustInView] = useInView({ rootMargin: '200px' })
  const [shippingRef, shippingInView] = useInView({ rootMargin: '200px' })

  // Defer 3D hero rails and heavy components
  React.useEffect(() => {
    const scheduleIdleLoad = () => {
      if ('requestIdleCallback' in window) {
        const idleWindow = window as typeof window & {
          requestIdleCallback?: (cb: IdleRequestCallback) => number
        }

        idleWindow.requestIdleCallback?.(() => setShow3dRails(true), { timeout: 2000 })
        return undefined
      }

      const timer = setTimeout(() => setShow3dRails(true), 1000)
      return () => clearTimeout(timer)
    }

    const cleanup = scheduleIdleLoad()
    return cleanup
  }, [])

  // Fetch categories (cached) - non-blocking
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        setCategoriesError(false)
        const catData = await cachedApi.getCategories()
        if (Array.isArray(catData) && catData.length > 0) {
          setCategories(catData.map((c) => ({
            ...c,
            color: c.color || '',
            icon: c.icon || '',
            count: c.count || 0,
          })))
        }
      } catch (error) {
        console.error('Failed to load categories:', error)
        setCategoriesError(true)
      } finally {
        setCategoriesLoading(false)
      }
    }

    // Defer categories fetch slightly
    const timer = setTimeout(fetchCategories, 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch products (cached) - non-blocking
  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true)
        setProductsError(false)
        const data = await cachedApi.getProducts({ limit: '8' })
        setProducts(data?.products || [])
      } catch (error) {
        console.error('Failed to load products:', error)
        setProductsError(true)
        setProducts([])
      } finally {
        setProductsLoading(false)
      }
    }

    // Defer products fetch
    const timer = setTimeout(fetchProducts, 200)
    return () => clearTimeout(timer)
  }, [])

  const testimonials = [
    {
      name: t('testimonials.testimonial1Name'),
      location: t('testimonials.testimonial1Location'),
      avatar: 'S',
      rating: 5,
      text: t('testimonials.testimonial1Text'),
    },
    {
      name: t('testimonials.testimonial2Name'),
      location: t('testimonials.testimonial2Location'),
      avatar: 'J',
      rating: 5,
      text: t('testimonials.testimonial2Text'),
    },
    {
      name: t('testimonials.testimonial3Name'),
      location: t('testimonials.testimonial3Location'),
      avatar: 'A',
      rating: 5,
      text: t('testimonials.testimonial3Text'),
    },
  ]

  const faqs = [
    {
      q: t('home.faq1q'),
      a: t('home.faq1a'),
    },
    {
      q: t('home.faq2q'),
      a: t('home.faq2a'),
    },
    {
      q: t('home.faq3q'),
      a: t('home.faq3a'),
    },
    {
      q: t('home.faq4q'),
      a: t('home.faq4a'),
    },
    {
      q: t('home.faq5q'),
      a: t('home.faq5a'),
    },
  ]

  const railAccents = ['#f59e0b', '#6366f1', '#38bdf8', '#f43f5e', '#a855f7', '#f97316', '#22c55e', '#eab308']

  const railProducts = React.useMemo(() =>
    products.slice(0, 8).map((p, idx) => ({
      name: p.name,
      image: p.productImages?.[0]?.url || p.image || p.images?.[0] || '',
      images: p.images,
      accent: railAccents[idx % railAccents.length],
    })),
    [products]
  )

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
        <div className="absolute inset-0 bg-gray-900">
          <img 
            src={heroImage.src}
            alt="E-commerce background" 
            className={cn(
              "w-full h-full object-cover transition-opacity duration-700",
              heroImage.loading ? "opacity-50 blur-sm" : "opacity-100 blur-0"
            )}
            loading="eager"
            decoding="async"
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
          {/* Decorative 3D side rails - desktop only */}
          {show3dRails && railProducts.length >= 4 && (
            <>
              <div className="pointer-events-none absolute inset-y-10 left-0 hidden w-[26%] opacity-55 lg:block xl:opacity-80 2xl:w-[30%]">
                <div className="pointer-events-auto h-full origin-left scale-75 xl:scale-90 2xl:scale-100">
                  <React.Suspense fallback={<div className="opacity-0" />}>
                    <LazyHeroProductRail side="left" products={railProducts.slice(0, 4)} />
                  </React.Suspense>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-y-10 right-0 hidden w-[26%] opacity-55 lg:block xl:opacity-80 2xl:w-[30%]">
                <div className="pointer-events-auto h-full origin-right scale-75 xl:scale-90 2xl:scale-100">
                  <React.Suspense fallback={<div className="opacity-0" />}>
                    <LazyHeroProductRail side="right" products={railProducts.slice(4, 8)} />
                  </React.Suspense>
                </div>
              </div>
            </>
          )}

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6 animate-fade-in">
              <Sparkles className="h-3.5 w-3.5 text-secondary-300" />
              <span className="text-xs font-bold text-white tracking-wide">
                {t('home.trustedBy')}
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.05] text-balance animate-slide-up">
              {t('home.heroTitle')}
              <br />
              <span className="text-secondary-300"> {t('home.heroTitleHighlight')}</span>
            </h1>

            <p className="mt-6 text-lg lg:text-xl text-white/90 leading-relaxed max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: '80ms' }}>
              {t('home.heroSubtitle')}
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
                    {t('home.searchProducts')}
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
                    {t('home.pasteUrl')}
                  </button>
                </div>

                <div className="relative flex flex-col sm:flex-row gap-3 items-stretch">
                  {activeTab === 'search' ? (
                    <SearchInput
                      placeholder={t('home.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      wrapperClassName="flex-1"
                    />
                  ) : (
                    <UrlInput
                      placeholder={t('home.urlPlaceholder')}
                      value={urlQuery}
                      onChange={(e) => setUrlQuery(e.target.value)}
                      wrapperClassName="flex-1"
                    />
                  )}
                  <Button type="submit" size="xl" className="sm:w-auto w-full shadow-lg shadow-primary/25 min-w-[140px] px-6">
                    <span className="font-semibold">{activeTab === 'search' ? t('home.searchButton') : t('home.getQuote')}</span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/80">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-medium">{t('home.buyerProtection')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-medium">{t('home.transparentFee')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="font-medium">{t('home.freeStorage')}</span>
                  </div>
                </div>
              </form>
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
                <span>{t('home.flashSale')}</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase">
                  ✈️ New
                </span>
                <span>{t('home.freeExpressShipping')}</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase">
                  🎁 Gift
                </span>
                <span>{t('home.firstTimeBuyers')}</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500 text-white text-xs font-bold uppercase">
                  ⭐ Trending
                </span>
                <span>{t('home.limitedEdition')}</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-bold uppercase">
                  💎 Premium
                </span>
                <span>{t('home.exclusiveWatches')}</span>
              </div>
              <span className="text-white/40 text-xl">•</span>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-600 text-white text-xs font-bold uppercase">
                  ✓ Verified
                </span>
                <span>{t('home.verifiedSellers')}</span>
              </div>
            </div>
          </Marquee>
        </div>
      </section>

      {/* ===================== MARKETPLACE SOURCES BAR ===================== */}
      <section className="border-b border-border bg-muted/30">
        <div className="container-page py-6 flex flex-col md:flex-row items-center justify-center md:justify-between gap-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t('home.shopFromMarketplaces')}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {[t('home.mercari'), t('home.yahooAuctions'), t('home.rakuten'), t('home.amazon'), t('home.ebay'), t('home.aliExpress')].map((s) => (
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
                {t('home.exploreCategories')}
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
                {t('home.shopByCategory')}
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                {t('home.categoryDescription')}
              </p>
            </div>
            <Button variant="ghost" size="md" asChild className="hidden md:inline-flex">
              <Link to="/categories" className="group">
                <span>{t('home.viewAllCategories')}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 lg:gap-4">
            {categoriesLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <CategorySkeleton key={i} />
              ))
            ) : categoriesError ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">Failed to load categories</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No categories available</p>
              </div>
            ) : (
              categories.map((cat) => {
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
                      {formatNumber(cat.count || 0)} {t('home.items')}
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          <Button variant="primary" size="lg" asChild className="md:hidden mt-6 w-full max-w-md mx-auto shadow-md">
            <Link to="/categories" className="flex items-center justify-center gap-2">
              <span>{t('home.viewAllCategories')}</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ===================== FEATURED PRODUCTS ===================== */}
      <section className="py-16 lg:py-20 bg-muted/20">
        <div className="container-page">
          <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
            <div>
              <Badge variant="info" size="sm" className="mb-3" dot>
                {t('home.trendingNow')}
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
                {t('home.featuredFinds')}
              </h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                {t('home.featuredDescription')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" asChild className="shadow-sm">
                <Link to="/marketplace" className="flex items-center">
                  <span>{t('home.viewAllProducts')}</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {productsLoading ? (
              <ProductListSkeleton count={8} />
            ) : productsError ? (
              <div className="col-span-full text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load products</h3>
                <p className="text-sm text-muted-foreground">Please try again later</p>
              </div>
            ) : products.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden opacity-60">
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-muted-foreground text-center">No products yet</h3>
                    <p className="text-xs text-muted-foreground/70 text-center mt-1">Add products via Admin</p>
                  </div>
                </div>
              ))
            ) : (
              products.slice(0, 8).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onFavorite={toggleFavorite}
                  isFavorite={isFavorite(p.id)}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" ref={howItWorksRef} className="py-16 lg:py-24">
        {howItWorksInView && (
          <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="primary" size="sm" className="mb-3">
              {t('home.simpleProcess')}
            </Badge>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
              {t('home.howItWorks')}
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              {t('home.howItWorksDescription')}
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
                      <h3 className="text-base font-bold mb-1.5">{t(`home.step${idx + 1}Title`)}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t(`home.step${idx + 1}Desc`)}
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
        )}
      </section>

      {/* ===================== TRUST & SECURITY ===================== */}
      <section id="trust" ref={trustRef} className="py-16 lg:py-24 bg-primary-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-pattern opacity-10" />
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-secondary-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />

        {trustInView && (
          <div className="container-page relative">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="accent" size="sm" className="mb-3">
              {t('home.yourTrustMatters')}
            </Badge>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
              {t('home.shopWithConfidence')}
            </h2>
            <p className="mt-3 text-primary-100/80 text-lg">
              {t('home.trustDescription')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trustFeatures.map((f, idx) => {
              const Icon = iconMap[f.icon] || ShieldCheck
              return (
                <Card
                  key={f.icon}
                  className="bg-white/5 border-white/10 backdrop-blur hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <CardContent className="p-6 lg:p-7">
                    <div className="h-12 w-12 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-white">{t(`home.trust${idx + 1}Title`)}</h3>
                    <p className="text-sm text-primary-100/70 leading-relaxed">
                      {t(`home.trust${idx + 1}Desc`)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
        )}
      </section>

      {/* ===================== INTERNATIONAL SHIPPING ===================== */}
      <section id="shipping" ref={shippingRef} className="py-16 lg:py-24">
        {shippingInView && (
          <div className="container-page">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative aspect-square max-w-lg mx-auto lg:mx-0">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-100 to-secondary-100" />
                <div className="absolute inset-4 rounded-2xl bg-gray-50 shadow-xl ring-1 ring-black/5 flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/shipping.jpg"
                    alt="International shipping"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
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
                {t('home.globalShipping')}
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                {t('home.internationalShipping')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t('home.shippingDescription')}
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{t('home.freeConsolidation')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{t('home.fullTracking')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{t('home.professionalPackaging')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{t('home.insuranceAvailable')}</span>
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
        )}
      </section>

      {/* ===================== TESTIMONIALS ===================== */}
      <section className="py-16 lg:py-20 bg-muted/20">
        <div className="container-page">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="accent" size="sm" className="mb-3">
              {t('home.realCustomers')}
            </Badge>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
              {t('home.lovedByThousands')}
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
                {t('home.faq')}
              </Badge>
              <h2 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">
                {t('home.frequentlyAskedQuestions')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {t('home.faqDescription')}
              </p>
              <Button variant="outline" size="lg" className="shadow-sm">
                <Headphones className="h-5 w-5" />
                <span>{t('home.contactSupport')}</span>
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
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1] text-balance mb-6">
                Ready to Shop Global Markets?
              </h2>
              <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                Join 250,000+ shoppers worldwide enjoying authentic products with transparent pricing and reliable delivery. Signing up takes 30 seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="xl"
                  variant="outline"
                  className="w-full sm:w-auto !bg-white !text-primary hover:!bg-white/90 !border-white shadow-lg min-w-[200px]"
                  asChild
                >
                  <Link to="/register" className="flex items-center justify-center">
                    <span className="font-semibold">Get Started Free</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="xl"
                  className="w-full sm:w-auto !bg-white/10 !text-white !border-white/20 hover:!bg-white/20 shadow-lg min-w-[200px]"
                  asChild
                >
                  <Link to="/marketplace" className="flex items-center justify-center">
                    <Globe2 className="h-5 w-5" />
                    <span className="font-semibold">Start Browsing</span>
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
