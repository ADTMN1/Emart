import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Smartphone,
  Shirt,
  Watch,
  Star,
  Gamepad2,
  Sparkles,
  Home as HomeIcon,
  Dumbbell,
  ChevronRight,
  Package,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Category } from '@/lib/types'
import { cn, formatNumber } from '@/lib/utils'
import { api } from '@/lib/api'
import { ProductCardSkeleton } from '@/components/ui/States'

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  smartphone: Smartphone,
  shirt: Shirt,
  watch: Watch,
  star: Star,
  'gamepad-2': Gamepad2,
  sparkles: Sparkles,
  home: HomeIcon,
  dumbbell: Dumbbell,
}

interface CategoryProduct {
  id: string
  name: string
  image?: string
  images?: string[]
  estimatedPriceUsd: number
  source: string
  productImages?: { id: string; url: string; isPrimary: boolean }[]
}

const PLACEHOLDER_IMG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22600%22%20viewBox%3D%220%200%20600%20600%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22600%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENo%20Products%3C%2Ftext%3E%3C%2Fsvg%3E'

const getProductImg = (p: CategoryProduct): string => {
  if (p.productImages && p.productImages.length > 0) {
    const primary = p.productImages.find(img => img.isPrimary)
    if (primary?.url) return primary.url
    if (p.productImages[0]?.url) return p.productImages[0].url
  }
  if (p.image) return p.image
  if (p.images && p.images.length > 0) return p.images[0]
  return PLACEHOLDER_IMG
}

const Categories: React.FC = () => {
  const [params] = useSearchParams()
  const selectedCategoryId = params.get('id')
  const [categoryProducts, setCategoryProducts] = React.useState<Record<string, CategoryProduct[]>>({})
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [categories, setCategories] = React.useState<Category[]>([])

  const visibleCategories = React.useMemo(() => {
    if (!selectedCategoryId) return categories
    return categories.filter((cat) => cat.id === selectedCategoryId)
  }, [categories, selectedCategoryId])

  React.useEffect(() => {
    if (selectedCategoryId) {
      const target = document.getElementById(selectedCategoryId)
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [selectedCategoryId, visibleCategories.length])

  React.useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true)
        let loadedCategories: Category[] = []
        try {
          const catData = await api.get<Category[]>('/categories')
          if (Array.isArray(catData) && catData.length > 0) {
            loadedCategories = catData
            setCategories(loadedCategories)
          }
        } catch {
          // no fallback, categories stay empty
        }

        const results: Record<string, CategoryProduct[]> = {}
        for (const cat of loadedCategories) {
          try {
            const data = await api.get<{ products: CategoryProduct[] }>(
              `/products?category=${encodeURIComponent(cat.id)}&limit=4`
            )
            results[cat.id] = data?.products || []
          } catch {
            results[cat.id] = []
          }
        }
        setCategoryProducts(results)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [reloadKey])

  // Refresh when tab becomes visible
  React.useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible') setReloadKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', handleVis)
    return () => document.removeEventListener('visibilitychange', handleVis)
  }, [])

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1 transition-colors">
            <HomeIcon className="h-3 w-3" />
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">All Categories</span>
        </div>

        <div className="mt-5 flex flex-col gap-2 md:gap-3">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Browse All Categories
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
            Explore every product category available from global marketplaces. From premium electronics to standout lifestyle pieces, discover your next favorite find.
          </p>
        </div>
      </div>

      <div className="container-page py-8 md:py-12 lg:py-14">
        {!loading && categories.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-card">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No categories yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">Add categories via Admin</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 md:space-y-10">
            {visibleCategories.map((cat) => {
              const Icon = iconMap[cat.icon] || Star
              const catProducts = categoryProducts[cat.id] || []

              return (
                <section key={cat.id} className="scroll-mt-24" id={cat.id}>
                  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 md:p-6 shadow-card">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground shadow-sm',
                            cat.color,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-xl font-bold text-foreground sm:text-2xl">
                              {cat.name}
                            </h2>
                            <Badge variant="outline" size="sm" className="border-border bg-background text-muted-foreground">
                              {formatNumber(cat.count || 0)} items
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Link
                        to={`/marketplace?cat=${cat.id}`}
                        className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary-300 hover:text-primary md:self-center"
                      >
                        <span>View all</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                      ))
                    ) : catProducts.length === 0 ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                          <div className="aspect-square overflow-hidden bg-muted">
                            <img
                              src={PLACEHOLDER_IMG}
                              alt="No products yet"
                              className="h-full w-full object-cover opacity-60"
                            />
                          </div>
                          <div className="p-3.5">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                              No products in {cat.name} yet
                            </h3>
                            <div className="mt-2 text-[11px] font-medium text-muted-foreground/80">
                              Add some via Admin
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      catProducts.slice(0, 4).map((p) => (
                        <div key={p.id} className="group">
                          <Link
                            to={`/product/${p.id}`}
                            className="block h-full overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary-300 hover:shadow-card-hover"
                          >
                            <div className="aspect-square overflow-hidden bg-muted">
                              <img
                                src={getProductImg(p)}
                                alt={p.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>

                            <div className="flex flex-col gap-2 p-3.5">
                              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                                {p.name}
                              </h3>

                              <div className="mt-auto flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-foreground">
                                  ${p.estimatedPriceUsd}
                                </span>
                                <Badge variant="outline" size="sm" className="border-border bg-background text-muted-foreground">
                                  {p.source}
                                </Badge>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-5 md:hidden">
                    <Button variant="outline" size="md" className="w-full" asChild>
                      <Link to={`/marketplace?cat=${cat.id}`}>
                        View all {cat.name}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Categories
