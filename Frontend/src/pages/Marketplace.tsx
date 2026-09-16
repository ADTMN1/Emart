import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  ChevronRight,
  Home as HomeIcon,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, SearchInput } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { ProductCard } from '@/components/ui/ProductCard'
import { Loading, NoSearchResults, ProductCardSkeleton } from '@/components/ui/States'
import { useFavorites } from '@/contexts/FavoritesContext'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import { cachedApi, api, invalidateCache } from '@/lib/api'

interface ProductImage {
  id: string
  productId: string
  path: string
  url: string
  isPrimary: boolean
  sortOrder: number
  createdAt: string
}

interface ApiProduct {
  id: string
  name: string
  image?: string
  images?: string[]
  price: number
  estimatedPriceUsd: number
  condition: string
  seller: string
  sellerType: string
  source: string
  domesticShipping: number
  internationalShippingUsd: number
  serviceFee: number
  description: string
  categoryId: string
  category?: { id: string; name: string }
  tags: string[]
  isNew?: boolean
  isBestSeller?: boolean
  rating?: number
  reviewCount?: number
  productImages?: ProductImage[]
}

/** Price bucket definitions; keys double as priceBuckets URL tokens. */
const PRICE_BUCKETS = [
  { key: '0-49.99', label: 'Under $50' },
  { key: '50-99.99', label: '$50 - $100' },
  { key: '100-249.99', label: '$100 - $250' },
  { key: '250-499.99', label: '$250 - $500' },
  { key: '500+', label: 'Over $500' },
]

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  VERY_GOOD: 'Very Good',
  GOOD: 'Good',
  ACCEPTABLE: 'Acceptable',
}

interface Facets {
  sources: Array<{ value: string; count: number }>
  conditions: Array<{ value: string; count: number }>
  buckets: Array<{ label: string; count: number }>
  priceMin: number
  priceMax: number
}

/** Draft filter selections; only applied to the URL when Apply is pressed. */
interface PendingFilters {
  minPrice: string
  maxPrice: string
  priceBuckets: string[]
  conditions: string[]
  sources: string[]
}

const EMPTY_PENDING: PendingFilters = {
  minPrice: '',
  maxPrice: '',
  priceBuckets: [],
  conditions: [],
  sources: [],
}

const Marketplace: React.FC = () => {
  const { toggleFavorite, isFavorite } = useFavorites()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = React.useState(params.get('q') || '')
  const [isLoading, setIsLoading] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(params.get('cat') || null)
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<string | null>(params.get('sub') || null)
  const [products, setProducts] = React.useState<ApiProduct[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(false)
  const fetchRef = React.useRef<number>(0)
  const lastRequestKeyRef = React.useRef<string | null>(null)
  const [facets, setFacets] = React.useState<Facets | null>(null)
  const [pending, setPending] = React.useState<PendingFilters>(EMPTY_PENDING)

  // Filter facets from the real catalog (sources/conditions/buckets + counts).
  React.useEffect(() => {
    let cancelled = false
    cachedApi
      .getFacets()
      .then((data) => {
        if (!cancelled && data) setFacets(data)
      })
      .catch((error) => console.error('Failed to load filter facets:', error))
    return () => {
      cancelled = true
    }
  }, [])

  // Seed the draft filters from the URL once on mount so shared/refreshed
  // links start with Apply in sync with what's shown.
  React.useEffect(() => {
    setPending({
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      priceBuckets: params.get('priceBuckets')?.split(',').filter(Boolean) || [],
      conditions: params.get('conditions')?.split(',').filter(Boolean) || [],
      sources: params.get('sources')?.split(',').filter(Boolean) || [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch categories (cached) once
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        const catData = await cachedApi.getCategories()
        if (Array.isArray(catData) && catData.length > 0) {
          setCategories(catData)
        }
      } catch (error) {
        console.error('Failed to load categories:', error)
      } finally {
        setCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  const fetchProducts = React.useCallback(async () => {
    const searchParams = new URLSearchParams()

    const q = params.get('q')
    const cat = params.get('cat')
    const source = params.get('source')
    const conditions = params.get('conditions')
    const sources = params.get('sources')
    const priceBuckets = params.get('priceBuckets')
    const minPrice = params.get('minPrice')
    const maxPrice = params.get('maxPrice')
    const hasActiveFilters = Boolean(
      cat || q || source || conditions || sources || priceBuckets || minPrice || maxPrice || params.get('sub')
    )

    if (q) searchParams.set('q', q)
    if (cat) searchParams.set('category', cat)
    if (source) searchParams.set('source', source)
    if (conditions) searchParams.set('conditions', conditions)
    if (sources) searchParams.set('sources', sources)
    if (priceBuckets) searchParams.set('priceBuckets', priceBuckets)
    if (minPrice) searchParams.set('minPrice', minPrice)
    if (maxPrice) searchParams.set('maxPrice', maxPrice)
    // Default browse (no filters at all): the backend round-robins the
    // grid across all available categories so one recent import can't fill it.
    if (!hasActiveFilters) searchParams.set('mix', 'categories')

    const requestKey = searchParams.toString()
    if (lastRequestKeyRef.current === requestKey) {
      return
    }
    lastRequestKeyRef.current = requestKey

    const reqId = ++fetchRef.current

    try {
      setIsLoading(true)
      const endpoint = requestKey ? `/products?${requestKey}` : '/products'
      
      const data = await api.get<{ products: ApiProduct[]; pagination: { total: number } }>(
        endpoint,
      )
      
      if (reqId === fetchRef.current) {
        setProducts(data?.products || [])
        setTotalCount(data?.pagination?.total || 0)
      }
    } catch (err: any) {
      console.error('Failed to fetch products:', err)
      if (reqId === fetchRef.current) {
        setProducts([])
        setTotalCount(0)
      }
    } finally {
      if (reqId === fetchRef.current) {
        setIsLoading(false)
      }
    }
  }, [params])

  React.useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Auto-refresh when tab becomes visible again (catches stale data after admin edits)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchProducts])

  // Update selected category from URL params
  React.useEffect(() => {
    setSelectedCategory(params.get('cat') || null)
    setSelectedSubcategory(params.get('sub') || null)
  }, [params])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (query.trim()) next.set('q', query.trim())
    else next.delete('q')
    setParams(next)
  }

  const handleCategoryClick = (categoryId: string) => {
    const next = new URLSearchParams(params)
    if (selectedCategory === categoryId) {
      next.delete('cat')
      setSelectedCategory(null)
    } else {
      next.set('cat', categoryId)
      setSelectedCategory(categoryId)
      // Clear search query and source when selecting a category
      next.delete('q')
      next.delete('source')
      setQuery('')
    }
    setParams(next)
  }

  const updatePending = (key: keyof PendingFilters, value: string, checked: boolean) => {
    setPending((prev) => {
      const list = prev[key] as string[]
      const nextList = checked
        ? list.includes(value)
          ? list
          : [...list, value]
        : list.filter((v) => v !== value)
      return { ...prev, [key]: nextList }
    })
  }

  /** Checking a price bucket replaces an explicit min/max range (and vice versa) */
  const handleBucketToggle = (key: string, checked: boolean) => {
    setPending((prev) => ({
      ...prev,
      minPrice: checked ? '' : prev.minPrice,
      maxPrice: checked ? '' : prev.maxPrice,
      priceBuckets: checked
        ? prev.priceBuckets.includes(key)
          ? prev.priceBuckets
          : [...prev.priceBuckets, key]
        : prev.priceBuckets.filter((k) => k !== key),
    }))
  }

  const handlePriceInputChange = (key: 'minPrice' | 'maxPrice', value: string) => {
    setPending((prev) => ({
      ...prev,
      [key]: value,
      // Typing an explicit range switches price filtering away from buckets.
      priceBuckets: value.trim() ? [] : prev.priceBuckets,
    }))
  }

  /** Apply: write the draft filters into the URL (refetch happens via params). */
  const applyFilters = () => {
    const next = new URLSearchParams(params)
    next.delete('minPrice')
    next.delete('maxPrice')
    next.delete('conditions')
    next.delete('sources')
    next.delete('priceBuckets')
    next.delete('source')

    const min = parseFloat(pending.minPrice)
    const max = parseFloat(pending.maxPrice)
    if (Number.isFinite(min)) next.set('minPrice', String(min))
    if (Number.isFinite(max) && (!Number.isFinite(min) || max >= min)) {
      next.set('maxPrice', String(max))
    }
    if (pending.priceBuckets.length > 0) {
      next.set('priceBuckets', pending.priceBuckets.join(','))
    }
    if (pending.conditions.length > 0) next.set('conditions', pending.conditions.join(','))
    if (pending.sources.length > 0) next.set('sources', pending.sources.join(','))

    setParams(next)
    setShowFilters(false)
  }

  /** Reset: clear the price/condition/source filters (search & category stay). */
  const resetFilters = () => {
    setPending(EMPTY_PENDING)
    const next = new URLSearchParams(params)
    ;['minPrice', 'maxPrice', 'conditions', 'sources', 'priceBuckets', 'source'].forEach((k) =>
      next.delete(k)
    )
    setParams(next)
  }

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <HomeIcon className="h-3 w-3" />
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Marketplace</span>
        </div>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight">
              {params.get('q') ? (
                <>Results for "{params.get('q')}"</>
              ) : (
                'Browse Marketplace'
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {totalCount > 0 ? `${totalCount.toLocaleString()}+` : 'all available'} products from top global marketplaces
            </p>
          </div>

          <form onSubmit={handleSearch} className="lg:max-w-md w-full">
            <SearchInput
              placeholder="Search within results..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
        </div>
      </div>

      <div className="container-page py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters sidebar */}
          <aside
            className={cn(
              'lg:w-72 shrink-0 space-y-6',
              !showFilters && 'hidden lg:block',
            )}
          >
            <div className="lg:sticky lg:top-24 space-y-6">
              <div className="flex items-center justify-between lg:hidden">
                <h2 className="font-bold">Filters</h2>
                <button onClick={() => setShowFilters(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-bold mb-4 flex items-center justify-between">
                  Categories
                  <ChevronDown className="h-4 w-4 text-muted-foreground lg:hidden" />
                </h3>
                <div className="space-y-1">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCategoryClick(c.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group',
                        selectedCategory === c.id
                          ? 'bg-primary text-white'
                          : 'hover:bg-muted text-foreground/80 group-hover:text-foreground'
                      )}
                    >
                      <span className="font-medium">
                        {c.name}
                      </span>
                      <span className={cn(
                        'text-xs',
                        selectedCategory === c.id ? 'text-white/70' : 'text-muted-foreground'
                      )}>
                        {(((c.count || 0)) / 1000).toFixed(0)}K
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-bold mb-4">Price (USD)</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min={0}
                      placeholder={`Min${facets ? ` (${Math.floor(facets.priceMin)})` : ''}`}
                      value={pending.minPrice}
                      onChange={(e) => handlePriceInputChange('minPrice', e.target.value)}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder={`Max${facets ? ` (${Math.ceil(facets.priceMax)})` : ''}`}
                      value={pending.maxPrice}
                      onChange={(e) => handlePriceInputChange('maxPrice', e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    {PRICE_BUCKETS.map((bucket) => {
                      const count = facets?.buckets.find((b) => b.label === bucket.label)?.count
                      const checked = pending.priceBuckets.includes(bucket.key)
                      return (
                        <label key={bucket.key} className="flex items-center justify-between gap-2.5 py-1 cursor-pointer group">
                          <span className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => handleBucketToggle(bucket.key, e.target.checked)}
                              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-foreground/80 group-hover:text-foreground">{bucket.label}</span>
                          </span>
                          {facets && count !== undefined && (
                            <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString()}</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-bold mb-4">Product Condition</h3>
                <div className="space-y-1.5">
                  {(facets?.conditions ?? []).map((c) => {
                    const checked = pending.conditions.includes(c.value)
                    return (
                      <label key={c.value} className="flex items-center justify-between gap-2.5 py-1 cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => updatePending('conditions', c.value, e.target.checked)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-foreground/80 group-hover:text-foreground">
                            {CONDITION_LABELS[c.value] || c.value}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">{c.count.toLocaleString()}</span>
                      </label>
                    )
                  })}
                  {facets && facets.conditions.length === 0 && (
                    <p className="text-xs text-muted-foreground">No conditions available</p>
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-bold mb-4">Source Marketplace</h3>
                <div className="space-y-1.5">
                  {(facets?.sources ?? []).map((s) => {
                    const checked = pending.sources.includes(s.value)
                    return (
                      <label key={s.value} className="flex items-center justify-between gap-2.5 py-1 cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => updatePending('sources', s.value, e.target.checked)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-foreground/80 group-hover:text-foreground">{s.value}</span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">{s.count.toLocaleString()}</span>
                      </label>
                    )
                  })}
                  {facets && facets.sources.length === 0 && (
                    <p className="text-xs text-muted-foreground">No sources available</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={resetFilters}>
                  Reset
                </Button>
                <Button variant="primary" className="flex-1" onClick={applyFilters}>
                  Apply
                </Button>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3.5 h-10 rounded-lg border border-border bg-white font-semibold text-sm"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Select className="w-44 h-10 text-sm">
                  <option>Sort: Featured</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Newest First</option>
                  <option>Most Popular</option>
                </Select>
                <div className="flex items-center border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                      viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground',
                    )}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                      viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground',
                    )}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <NoSearchResults query={params.get('q') || undefined} />
            ) : (
              <div className={cn(
                'gap-4 lg:gap-6',
                viewMode === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'flex flex-col',
              )}>
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onFavorite={toggleFavorite}
                    isFavorite={isFavorite(p.id)}
                    compact={viewMode === 'list'}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 flex items-center justify-center gap-2">
              <Button variant="outline" size="md" disabled>Previous</Button>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(totalCount / 20))
                const displayPages = Math.min(totalPages, 5)
                return Array.from({ length: displayPages }).map((_, i) => {
                  const pageNum = i === displayPages - 1 && totalPages > 5 ? '...' : String(i + 1)
                  return (
                    <Button
                      key={i}
                      variant={i === 0 ? 'primary' : 'outline'}
                      size="icon"
                      className="h-10 w-10 font-bold"
                    >
                      {pageNum}
                    </Button>
                  )
                })
              })()}
              <Button variant="outline" size="md">Next</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Marketplace
