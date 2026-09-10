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
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

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

const Marketplace: React.FC = () => {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = React.useState(params.get('q') || '')
  const [isLoading, setIsLoading] = React.useState(true)
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = React.useState(false)
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(params.get('cat') || null)
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<string | null>(params.get('sub') || null)
  const [products, setProducts] = React.useState<ApiProduct[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [categories, setCategories] = React.useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(true)
  const fetchRef = React.useRef<number>(0)

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        const catData = await api.get<Category[]>('/categories')
        if (Array.isArray(catData) && catData.length > 0) {
          setCategories(catData)
        }
      } catch {
        // no fallback, categories stay empty
      } finally {
        setCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  const fetchProducts = React.useCallback(async () => {
    const reqId = ++fetchRef.current
    try {
      setIsLoading(true)
      const searchParams = new URLSearchParams()
      
      const q = params.get('q')
      const cat = params.get('cat')
      const source = params.get('source')
      
      if (q) searchParams.set('q', q)
      if (cat) searchParams.set('category', cat)
      if (source) searchParams.set('source', source)
      
      const queryString = searchParams.toString()
      const endpoint = queryString ? `/products?${queryString}` : '/products'
      
      const data = await api.get<{ products: ApiProduct[]; pagination: { total: number } }>(endpoint)
      
      if (reqId === fetchRef.current) {
        setProducts(data?.products || [])
        setTotalCount(data?.pagination?.total || 0)
      }
    } catch (err) {
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
                    <Input type="number" placeholder="Min" />
                    <Input type="number" placeholder="Max" />
                  </div>
                  <div className="space-y-1.5">
                    {[
                      'Under $50',
                      '$50 - $100',
                      '$100 - $250',
                      '$250 - $500',
                      'Over $500',
                    ].map((p) => (
                      <label key={p} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                        <input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                        <span className="text-sm text-foreground/80 group-hover:text-foreground">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-bold mb-4">Product Condition</h3>
                <div className="space-y-1.5">
                  {['New', 'Like New', 'Very Good', 'Good', 'Acceptable'].map((c) => (
                    <label key={c} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                      <input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                      <span className="text-sm text-foreground/80 group-hover:text-foreground">{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-bold mb-4">Source Marketplace</h3>
                <div className="space-y-1.5">
                  {['Mercari', 'Yahoo Auctions', 'Rakuten', 'Amazon', 'eBay'].map((s) => (
                    <label key={s} className="flex items-center gap-2.5 py-1 cursor-pointer group">
                      <input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                      <span className="text-sm text-foreground/80 group-hover:text-foreground">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">Reset</Button>
                <Button variant="primary" className="flex-1">Apply</Button>
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
                    isFavorite={favorites.has(p.id)}
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
