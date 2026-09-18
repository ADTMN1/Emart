import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  Home as HomeIcon,
  Truck,
  ShieldCheck,
  Package,
  Heart,
  ChevronDown,
  Info,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyCart } from '@/components/ui/States'
import { Select } from '@/components/ui/Select'
import { OptimizedImage } from '@/components/ui/OptimizedImage'
import type { Product } from '@/lib/types'
import { cn, formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCart } from '@/contexts/CartContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useAuth } from '@/contexts/AuthContext'
import { cachedApi, invalidateCache, api } from '@/lib/api'

interface CartItem {
  id: string
  productId: string
  quantity: number
  product?: Product
}

const initialCart: CartItem[] = []

const Cart: React.FC = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, isLoading } = useAuth()
  const { incrementCartCount, decrementCartCount } = useCart()
  const { toggleFavorite, isFavorite } = useFavorites()
  const [items, setItems] = React.useState<CartItem[]>(initialCart)
  const [shipCountry, setShipCountry] = React.useState('US')
  const [shippingMethod, setShippingMethod] = React.useState('dhl')
  const [loading, setLoading] = React.useState(true)
  const [updatingIds, setUpdatingIds] = React.useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set())

  const fetchCart = React.useCallback(async () => {
    // Wait for session restore so the user-scoped /cart key is used. Firing
    // before auth settles would issue a redundant unkeyed GET /cart and then a
    // second keyed one once the profile resolves.
    if (isLoading) return
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      // Shares the user-scoped /cart cache entry with CartContext and
      // Checkout — no second request hits the server on this page.
      const data = await cachedApi.getCart(user?.id)
      const rawItems = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      const items = rawItems.filter((item: any) => item && (item.product || item.productId))
      setItems(items)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, isLoading])

  React.useEffect(() => {
    fetchCart()
  }, [fetchCart])

  // Helper function to get product image - matches ProductDetails logic
  const getProductImage = (product: any): string => {
    // Try productImages array first (with url property)
    if (product?.productImages && Array.isArray(product.productImages)) {
      const validImages = product.productImages.filter((img: any) => img && img.url)
      if (validImages.length > 0) {
        return validImages[0].url
      }
    }
    // Fall back to image field
    if (product?.image) {
      return product.image
    }
    // Fall back to images array
    if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0]
    }
    // Return placeholder if no image found
    return 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22800%22%20viewBox%3D%220%200%20800%20800%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22800%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22sans-serif%22%20font-size%3D%2232%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E'
  }

  const cartItems = items
    .filter((i) => i.product)
    .map((i) => ({ ...i, product: i.product! }))

  const subtotal = cartItems.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0,
  )
  const proxyFees = cartItems.reduce(
    (sum, i) => sum + i.product.serviceFee * i.quantity,
    0,
  )
  const domestic = cartItems.reduce(
    (sum, i) => sum + Math.round(i.product.domesticShipping * 0.007) * i.quantity,
    0,
  )
  const shipping = shippingMethod === 'sea' ? 18 : shippingMethod === 'sal' ? 28 : shippingMethod === 'ems' ? 42 : 58
  const insurance = Math.round(subtotal * 0.02)
  const total = subtotal + proxyFees + domestic + shipping + insurance

  const updateQty = async (id: string, qty: number) => {
    if (qty < 1) return removeItem(id)
    const nextQty = Math.min(10, qty)
    if (updatingIds.has(id) || deletingIds.has(id)) return
    const previousItem = items.find((item) => item.id === id)
    if (!previousItem || previousItem.quantity === nextQty) return
    const delta = nextQty - previousItem.quantity

    setUpdatingIds((prev) => new Set(prev).add(id))
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, quantity: nextQty } : item))
    if (delta > 0) incrementCartCount(delta)
    else decrementCartCount(-delta)

    try {
      invalidateCache.cart()
      const updated = await api.put<{ quantity?: number }>(`/cart/items/${id}`, { quantity: nextQty })
      const confirmedQty = updated?.quantity ?? nextQty
      const correction = confirmedQty - nextQty
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, quantity: confirmedQty } : item))
      if (correction > 0) incrementCartCount(correction)
      else if (correction < 0) decrementCartCount(-correction)
    } catch {
      setItems((prev) => prev.map((item) => item.id === id ? previousItem : item))
      if (delta > 0) decrementCartCount(delta)
      else incrementCartCount(-delta)
      toast({ variant: 'error', title: 'Update failed', description: 'Could not update item quantity.' })
    } finally {
      invalidateCache.cart()
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const removeItem = async (id: string) => {
    if (deletingIds.has(id) || updatingIds.has(id)) return
    const itemIndex = items.findIndex((item) => item.id === id)
    const removedItem = items[itemIndex]
    if (!removedItem) return

    setDeletingIds((prev) => new Set(prev).add(id))
    setItems((prev) => prev.filter((item) => item.id !== id))
    decrementCartCount(removedItem.quantity)

    try {
      invalidateCache.cart()
      await api.delete(`/cart/items/${id}`)
      toast({ variant: 'info', title: t('cart.itemRemoved'), description: t('cart.itemRemovedDesc') })
    } catch {
      setItems((prev) => {
        const next = [...prev]
        next.splice(itemIndex, 0, removedItem)
        return next
      })
      incrementCartCount(removedItem.quantity)
      toast({ variant: 'error', title: 'Remove failed', description: 'Could not remove item from cart.' })
    } finally {
      invalidateCache.cart()
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const saveForLater = async (item: CartItem) => {
    if (!item.product) return
    const wasFavorite = isFavorite(item.product.id)
    await toggleFavorite(item.product.id)
    toast({
      variant: 'success',
      title: wasFavorite ? 'Removed from favorites' : 'Added to favorites',
      description: wasFavorite
        ? 'This item was removed from your favorites.'
        : 'You can find this item in your favorites.',
    })
  }

  if (loading) {
    return (
      <div className="container-page py-12 min-h-[60vh]">
        <div className="max-w-xl mx-auto text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your cart...</p>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="container-page py-12 min-h-[60vh]">
        <div className="max-w-xl mx-auto">
          <EmptyCart onShop={() => navigate('/marketplace')} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1"><HomeIcon className="h-3 w-3" />Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Cart</span>
        </div>
      </div>

      <div className="container-page py-6 lg:py-10">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <ShoppingCart className="h-7 w-7 text-primary" />
              {t('cart.yourCart')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cartItems.reduce((s, i) => s + i.quantity, 0)} {t('cart.items')} · {t('cart.readyForCheckout')}
            </p>
          </div>
          <Button variant="outline" size="md" rightIcon={<ArrowRight className="h-4 w-4" />} asChild>
            <Link to="/marketplace">
              {t('cart.continueShopping')}
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 lg:p-5 flex gap-4 lg:gap-5">
                  <Link
                    to={`/product/${item.product.id}`}
                    className="w-24 h-24 lg:w-32 lg:h-32 shrink-0 rounded-xl overflow-hidden bg-muted border border-border"
                  >
                    <OptimizedImage
                      src={getProductImage(item.product)}
                      alt={item.product.name}
                      size="small"
                      context="thumbnail"
                      lazy
                      showShimmer
                      aspectRatio="aspect-square"
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/product/${item.product.id}`}
                          className="font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors"
                        >
                          {item.product.name}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline" size="sm">{item.product.source}</Badge>
                          <Badge variant="success" size="sm" dot>{item.product.condition}</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-lg">
                          {formatCurrency(item.product.price * item.quantity, 'USD')}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQty(item.id, item.quantity - 1)}
                            disabled={updatingIds.has(item.id) || deletingIds.has(item.id)}
                            className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {updatingIds.has(item.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />}
                          </button>
                          <span className="h-8 min-w-10 text-center font-bold text-sm flex items-center justify-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            disabled={updatingIds.has(item.id) || deletingIds.has(item.id)}
                            className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => saveForLater(item)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            isFavorite(item.product.id)
                              ? 'text-orange-500 bg-orange-500/10 hover:bg-orange-500/15'
                              : 'text-muted-foreground hover:bg-muted hover:text-orange-500',
                          )}
                          title={isFavorite(item.product.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart className={cn('h-4 w-4', isFavorite(item.product.id) && 'fill-current')} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={updatingIds.has(item.id) || deletingIds.has(item.id)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:pointer-events-none"
                          title="Remove"
                        >
                          {deletingIds.has(item.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        {t('cart.shipsSeparately')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-primary-50/40 border-primary-200">
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-primary-100 text-primary flex items-center justify-center shrink-0">
                  <WarehouseIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{t('cart.warehouseStorage')}</div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {t('cart.consolidationInfo')}
                  </p>
                </div>
                <button className="text-xs font-bold text-primary shrink-0 self-start">
                  {t('cart.learnMore')}
                </button>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 self-start">
            <Card>
              <CardContent className="p-5 lg:p-6 space-y-5">
                <h3 className="font-display text-lg font-bold">{t('cart.orderSummary')}</h3>

                <div className="space-y-2">
                  {[
                    {
                      label: t('cart.subtotal'),
                      value: formatCurrency(subtotal, 'USD'),
                      info: `${cartItems.reduce((s, i) => s + i.quantity, 0)} ${t('cart.items')}`,
                    },
                    {
                      label: t('cart.serviceFees'),
                      value: formatCurrency(proxyFees, 'USD'),
                      info: t('cart.buyerProtection'),
                      icon: ShieldCheck,
                    },
                    {
                      label: t('cart.domesticShipping'),
                      value: formatCurrency(domestic, 'USD'),
                      info: `Shipping to our warehouse`,
                      icon: Truck,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5 text-foreground/80">
                        {row.icon && <row.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="font-medium">{row.label}</span>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{row.value}</div>
                        {row.info && <div className="text-[10px] text-muted-foreground">{row.info}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-border/70" />

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">
                    {t('cart.shippingTo')}
                  </label>
                  <Select value={shipCountry} onChange={(e) => setShipCountry(e.target.value)}>
                    <option value="US">🇺🇸 United States</option>
                    <option value="UK">🇬🇧 United Kingdom</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="SG">🇸🇬 Singapore</option>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">
                    {t('cart.shippingMethod')}
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'dhl', name: 'DHL Express', days: '3-5 days', price: 58 },
                      { id: 'ems', name: 'EMS', days: '5-8 days', price: 42 },
                      { id: 'sal', name: 'SAL', days: '10-14 days', price: 28 },
                      { id: 'sea', name: 'Sea Mail', days: '25-40 days', price: 18 },
                    ].map((m) => (
                      <label
                        key={m.id}
                        className={cn(
                          'flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                          shippingMethod === m.id
                            ? 'border-primary bg-primary-50/50 ring-2 ring-primary/15'
                            : 'border-border bg-white hover:border-border/80',
                        )}
                      >
                        <input
                          type="radio"
                          name="ship"
                          value={m.id}
                          checked={shippingMethod === m.id}
                          onChange={() => setShippingMethod(m.id)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm">{m.name}</span>
                            <span className="font-bold text-sm">
                              {formatCurrency(m.price, 'USD')}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {m.days} · {t('cart.fullyTracked')}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    {t('cart.shippingInsurance')}
                  </div>
                  <span className="font-semibold">{formatCurrency(insurance, 'USD')}</span>
                </div>

                <div className="h-px bg-border/70" />

                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-foreground/80">{t('cart.estimatedTotal')}</span>
                  <div>
                    <div className="font-display text-2xl font-extrabold text-foreground">
                      {formatCurrency(total, 'USD')}
                    </div>
                    <div className="text-xs text-right text-muted-foreground">
                      {t('cart.taxesAndDuties')}
                    </div>
                  </div>
                </div>

                <Button
                  size="xl"
                  className="w-full shadow-lg shadow-primary/25"
                  onClick={() => {
                    toast({ variant: 'success', title: 'Proceeding to checkout' })
                    setTimeout(() => navigate('/checkout'), 500)
                  }}
                >
                  {t('cart.proceedToCheckout')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>

                <div className="flex flex-wrap items-center justify-center gap-2 -mx-2">
                  {['Visa', 'MC', 'Amex', 'PayPal', 'Apple Pay', 'G Pay'].map((p) => (
                    <span key={p} className="px-2 py-1 rounded-md bg-muted text-[10px] font-bold text-muted-foreground/80">
                      {p}
                    </span>
                  ))}
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Your purchase is covered by our 100% Buyer Protection Guarantee. Free cancellations before items are purchased.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}

function WarehouseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
      <path d="M6 18h12" />
      <path d="M6 14h12" />
      <path d="M6 10h12" />
    </svg>
  )
}

export default Cart
