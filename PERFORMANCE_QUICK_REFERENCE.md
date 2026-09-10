# EMART Performance Quick Reference

## For Developers: How to Use the New Performance Features

### 1. Using API Cache

#### Fetch Cached Data:
```typescript
import { cachedApi } from '@/lib/api'

// Categories (cached for 30 min)
const categories = await cachedApi.getCategories()

// Products (cached for 5 min)
const products = await cachedApi.getProducts({ limit: '10' })

// Specific product (cached for 5 min)
const product = await cachedApi.getProduct(productId)
```

#### Invalidate Cache (e.g., after admin updates):
```typescript
import { invalidateCache } from '@/lib/api'

// After creating/updating/deleting a product
invalidateCache.products()

// After updating a specific product
invalidateCache.product(productId)

// After updating categories
invalidateCache.categories()

// Clear all cache
invalidateCache.all()
```

#### Regular API Calls (Not Cached):
```typescript
import { api } from '@/lib/api'

// Sensitive data - never cached
const orders = await api.get('/orders')
const cart = await api.get('/cart')
const profile = await api.get('/auth/profile')
```

---

### 2. Using Skeleton Loaders

```typescript
import { CategorySkeleton, ProductListSkeleton, Skeleton } from '@/components/ui/Skeleton'

// Categories loading
{categoriesLoading ? (
  Array.from({ length: 8 }).map((_, i) => (
    <CategorySkeleton key={i} />
  ))
) : (
  categories.map(cat => <CategoryCard key={cat.id} {...cat} />)
)}

// Products loading
{productsLoading ? (
  <ProductListSkeleton count={8} />
) : (
  products.map(p => <ProductCard key={p.id} {...p} />)
)}

// Custom skeleton
<Skeleton className="h-12 w-full rounded-lg" />
```

---

### 3. Lazy Loading Below-the-Fold

```typescript
import { useInView } from '@/hooks/useInView'

function MyPage() {
  const [sectionRef, isInView] = useInView({ rootMargin: '200px' })
  
  return (
    <section ref={sectionRef}>
      {isInView && (
        <ExpensiveComponent />
      )}
    </section>
  )
}
```

**Options:**
- `threshold`: 0-1 (how much of element visible)
- `rootMargin`: e.g., "200px" (preload before visible)
- `triggerOnce`: true (default) or false

---

### 4. Request Cancellation (Prevent Stale Data)

```typescript
function MyComponent() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchRef = useRef(0)
  
  const fetchData = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    const reqId = ++fetchRef.current
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    try {
      const data = await api.get('/endpoint', {
        signal: abortController.signal
      } as any)
      
      // Only update if this is still the latest request
      if (reqId === fetchRef.current && !abortController.signal.aborted) {
        setData(data)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return // Ignore cancelled requests
      }
      // Handle other errors
    }
  }, [])
  
  return <div>...</div>
}
```

---

### 5. Progressive Image Loading

```typescript
import { useProgressiveImage } from '@/hooks/useProgressiveImage'

function HeroSection() {
  const heroImage = useProgressiveImage(
    '/images/hero-placeholder.jpg',  // Small placeholder (loads instantly)
    '/images/hero.jpg'                // Full image (loads in background)
  )
  
  return (
    <img
      src={heroImage.src}
      className={cn(
        "transition-opacity duration-700",
        heroImage.loading ? "opacity-50 blur-sm" : "opacity-100"
      )}
      alt="Hero"
    />
  )
}
```

---

## Cache Configuration

Modify cache TTL in `src/lib/apiCache.ts`:

```typescript
export const cacheConfig = {
  categories: { ttl: 30 * 60 * 1000 },      // 30 minutes
  products: { ttl: 5 * 60 * 1000 },          // 5 minutes
  productDetails: { ttl: 5 * 60 * 1000 },    // 5 minutes
  
  // Never cache these:
  auth: { ttl: 0 },
  profile: { ttl: 0 },
  orders: { ttl: 0 },
  wallet: { ttl: 0 },
  checkout: { ttl: 0 },
  payment: { ttl: 0 },
}
```

---

## Performance Best Practices

### ✅ DO:
- Use `cachedApi` for categories and products
- Add skeleton loaders for loading states
- Lazy load below-the-fold heavy content
- Cancel requests when component unmounts or params change
- Use progressive image loading for large images
- Defer non-critical components (3D, chat)

### ❌ DON'T:
- Cache sensitive data (auth, orders, payments)
- Block page render waiting for API calls
- Make duplicate simultaneous requests
- Use blank loading states (use skeletons)
- Load heavy content immediately if below-fold
- Forget to handle errors gracefully

---

## Debugging Performance Issues

### Check if data is being cached:
```typescript
import { apiCache } from '@/lib/apiCache'

// Check if key exists in cache
console.log('Has categories:', apiCache.has('/categories'))

// Get cached data (without fetching)
console.log('Cached categories:', apiCache.getCached('/categories'))
```

### Monitor network requests:
1. Open DevTools → Network tab
2. Look for duplicate requests (should not happen)
3. Check if cached data loads instantly (< 50ms)
4. Verify AbortController cancels old requests

### Check loading sequence:
1. Page shell should render immediately
2. Critical data loads first (above-fold)
3. Below-fold loads as user scrolls
4. Heavy 3D content loads after idle

---

## Common Patterns

### Pattern 1: List Page with Filters
```typescript
function ProductList() {
  const [filters, setFilters] = useState({})
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const fetchRef = useRef(0)
  
  useEffect(() => {
    const fetchProducts = async () => {
      const reqId = ++fetchRef.current
      setLoading(true)
      
      try {
        const data = await cachedApi.getProducts(filters)
        if (reqId === fetchRef.current) {
          setProducts(data.products)
        }
      } finally {
        if (reqId === fetchRef.current) {
          setLoading(false)
        }
      }
    }
    
    fetchProducts()
  }, [filters])
  
  return (
    <div>
      {loading ? <ProductListSkeleton /> : products.map(...)}
    </div>
  )
}
```

### Pattern 2: Detail Page with Related Items
```typescript
function ProductDetail({ id }) {
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(false)
  const [relatedLoading, setRelatedLoading] = useState(false)
  
  useEffect(() => {
    // Load product first (critical)
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const data = await cachedApi.getProduct(id)
        setProduct(data)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])
  
  useEffect(() => {
    if (!product) return
    
    // Load related products after (non-critical)
    const fetchRelated = async () => {
      setRelatedLoading(true)
      try {
        const data = await cachedApi.getProducts({
          category: product.categoryId,
          limit: '4'
        })
        setRelated(data.products)
      } finally {
        setRelatedLoading(false)
      }
    }
    
    // Defer slightly
    setTimeout(fetchRelated, 100)
  }, [product])
  
  return (...)
}
```

### Pattern 3: Independent Sections
```typescript
function HomePage() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [catLoading, setCatLoading] = useState(false)
  const [prodLoading, setProdLoading] = useState(false)
  
  // Categories - independent
  useEffect(() => {
    const fetch = async () => {
      setCatLoading(true)
      try {
        const data = await cachedApi.getCategories()
        setCategories(data)
      } finally {
        setCatLoading(false)
      }
    }
    setTimeout(fetch, 100) // Defer slightly
  }, [])
  
  // Products - independent
  useEffect(() => {
    const fetch = async () => {
      setProdLoading(true)
      try {
        const data = await cachedApi.getProducts({ limit: '8' })
        setProducts(data.products)
      } finally {
        setProdLoading(false)
      }
    }
    setTimeout(fetch, 200) // Defer slightly more
  }, [])
  
  // If one fails, the other still works!
  return (...)
}
```

---

## Testing Your Changes

After making changes, verify:

1. **Build passes**: `npm run build`
2. **TypeScript passes**: `npx tsc --noEmit`
3. **No duplicate requests**: Check Network tab
4. **Cached data loads fast**: < 50ms on repeat visits
5. **Skeletons show during loading**: No blank states
6. **Page renders immediately**: Don't wait for API
7. **Errors handled gracefully**: Network off → page still works

---

## Questions?

See `PERFORMANCE_OPTIMIZATION_SUMMARY.md` for full details.
