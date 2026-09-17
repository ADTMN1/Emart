import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Heart,
  Star,
  Truck,
  Store,
  User,
  Eye,
  ShoppingCart,
  Loader2,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Badge } from './Badge'
import { Button } from './Button'
import { OptimizedImage } from './OptimizedImage'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRatings } from '@/contexts/RatingsContext'
import { useToast } from './Toast'
import { api, ratingApi } from '@/lib/api'

interface ProductImage {
  id: string
  productId: string
  path: string
  url: string
  isPrimary: boolean
  sortOrder: number
  createdAt: string
}

interface ProductWithImages {
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
  category?: string | { id: string; name: string }
  categoryId?: string
  tags: string[]
  isNew?: boolean
  isBestSeller?: boolean
  rating?: number
  reviewCount?: number
  /** Real user-rating aggregates from the API (preferred over rating/reviewCount). */
  ratingAgg?: number
  ratingCount?: number
  productImages?: ProductImage[]
}

interface ProductCardProps {
  product: ProductWithImages
  className?: string
  onFavorite?: (id: string) => void
  isFavorite?: boolean
  compact?: boolean
}

const getProductImageUrl = (product: ProductWithImages): string => {
  if (product.productImages && product.productImages.length > 0) {
    const primary = product.productImages.find(img => img.isPrimary)
    if (primary && primary.url) return primary.url
    if (product.productImages[0]?.url) return product.productImages[0].url
  }
  if (product.image) return product.image
  if (product.images && product.images.length > 0) return product.images[0]
  return 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22600%22%20viewBox%3D%220%200%20600%20600%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22600%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E'
}

const conditionColors: Record<string, string> = {
  NEW: 'success',
  New: 'success',
  LIKE_NEW: 'success',
  'Like New': 'success',
  VERY_GOOD: 'info',
  'Very Good': 'info',
  GOOD: 'warning',
  Good: 'warning',
  ACCEPTABLE: 'warning',
  Acceptable: 'warning',
}

const sourceColors: Record<string, string> = {
  'Marketplace A': 'bg-rose-500',
  'Marketplace B': 'bg-amber-500',
  'Marketplace C': 'bg-red-600',
  'Marketplace D': 'bg-orange-500',
  'Marketplace E': 'bg-blue-500',
}

const normalizeCondition = (condition: string): string => {
  const map: Record<string, string> = {
    NEW: 'New',
    LIKE_NEW: 'Like New',
    VERY_GOOD: 'Very Good',
    GOOD: 'Good',
    ACCEPTABLE: 'Acceptable',
  }
  return map[condition] || condition
}

const normalizeSellerType = (sellerType: string): string => {
  const map: Record<string, string> = {
    SHOP: 'Shop',
    INDIVIDUAL: 'Individual',
  }
  return map[sellerType] || sellerType
}

/** Shared classes for the small round hover-action buttons. */
const railButtonClasses = cn(
  'h-9 w-9 rounded-full bg-white/95 shadow-md backdrop-blur-sm',
  'flex items-center justify-center text-foreground',
  'transition-all duration-200 hover:scale-110 hover:bg-white hover:text-primary',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
)

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  className,
  onFavorite,
  isFavorite = false,
  compact = false,
}) => {
  const { incrementCartCount } = useCart()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const { getMyRating, setLocalRating } = useRatings()
  const [isAddingToCart, setIsAddingToCart] = React.useState(false)
  // Interactive star rating state (grid cards only).
  const [hoverRating, setHoverRating] = React.useState(0)
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false)
  // Fresh aggregate from the most recent rating submission, so average/count
  // update immediately without waiting for a page refetch.
  const [aggOverride, setAggOverride] = React.useState<{ avg: number; count: number } | null>(null)

  const realAvg = aggOverride?.avg ?? product.ratingAgg ?? product.rating ?? 0
  const realCount = aggOverride?.count ?? product.ratingCount ?? product.reviewCount ?? 0
  const myRating = getMyRating(product.id)

  /** Submit (or change) the signed-in user's 1-5 star rating. */
  const submitRating = async (value: number) => {
    if (compact || isSubmittingRating) return
    if (!isAuthenticated) {
      toast({
        variant: 'warning',
        title: 'Sign in required',
        description: 'Please sign in to rate this product.',
      })
      return
    }
    if (value === myRating) return // already rated with this value — nothing to change

    setIsSubmittingRating(true)
    try {
      const res = await ratingApi.rate(product.id, value)
      setLocalRating(product.id, res.rating)
      setAggOverride({ avg: res.average, count: res.count })
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Unable to submit rating',
        description: err?.message || 'Please try again.',
      })
    } finally {
      setIsSubmittingRating(false)
    }
  }
  const imageUrl = getProductImageUrl(product)
  const displayCondition = normalizeCondition(product.condition)
  const isConditionNew = displayCondition.toUpperCase() === 'NEW'

  /** Real add-to-cart (same endpoint/flow as the product detail page). */
  const handleAddToCart = async () => {
    if (isAddingToCart) return
    setIsAddingToCart(true)
    incrementCartCount(1)

    try {
      await api.post('/cart/items', {
        productId: product.id,
        quantity: 1,
      })
      toast({
        variant: 'success',
        title: 'Added to cart',
        description: `${product.name.slice(0, 48)} added to your cart.`,
      })
    } catch (err: any) {
      incrementCartCount(-1)
      const status = err?.status || err?.response?.status
      if (status === 401) {
        toast({
          variant: 'warning',
          title: 'Sign in required',
          description: 'Please sign in to add items to your cart.',
        })
      } else {
        toast({
          variant: 'error',
          title: 'Unable to add to cart',
          description: err?.message || 'Please try again.',
        })
      }
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300',
        'hover:border-primary-300 hover:shadow-card-hover',
        // Grid: vertical card. List (compact): Amazon-style horizontal row —
        // fixed square image on the left, info column on the right.
        compact ? 'flex flex-row items-stretch' : 'flex flex-col h-full',
        className,
      )}
    >
      {/* Image cell. Grid: full-width block (unchanged). List: fixed-width
          square column so rows stay compact no matter the screen size. */}
      <div className={cn('relative shrink-0', compact && 'w-28 sm:w-40 md:w-48 p-3 sm:p-4')}>
        <Link
          to={`/product/${product.id}`}
          className={cn('relative block overflow-hidden bg-muted', compact && 'rounded-lg')}
        >
          <OptimizedImage
            src={imageUrl}
            alt={product.name}
            size="medium"
            context="card"
            lazy
            showShimmer
            aspectRatio="aspect-square"
            containerClassName="relative overflow-hidden"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isNew && !isConditionNew && (
              <Badge variant="info" size="sm" dot>
                NEW
              </Badge>
            )}
            {product.isBestSeller && (
              <Badge variant="accent" size="sm" dot>
                BESTSELLER
              </Badge>
            )}
            <Badge
              variant={conditionColors[product.condition] as any}
              size="sm"
            >
              {displayCondition}
            </Badge>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
            <span className={cn(
              'px-2 py-1 rounded-md text-[10px] font-bold text-white shadow-sm',
              sourceColors[product.source],
            )}>
              {product.source}
            </span>
            {product.domesticShipping === 0 ? (
              <span className="px-2 py-1 rounded-md bg-success text-white text-[10px] font-bold shadow-sm">
                FREE SHIP
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-foreground/75 text-white text-[10px] font-semibold shadow-sm">
                <Truck className="h-3 w-3" />
                +${product.domesticShipping.toLocaleString()}
              </span>
            )}
          </div>
        </Link>

        {/* Hover action rail: wishlist / quick view / add to cart. Anchored to
            the image cell in both modes so it never covers product info.
            Always visible & tappable on touch devices; desktop reveals on card
            hover with a subtle fade + slide. Sits outside the image link so the
            buttons are not nested anchors. */}
        <div
          className={cn(
            'absolute z-20 flex flex-col gap-2',
            compact ? 'top-2 right-2' : 'top-3 right-3',
            'transition-all duration-200 ease-out',
            'opacity-100 translate-x-0',
            'md:opacity-0 md:translate-x-2 md:pointer-events-none',
            'md:group-hover:opacity-100 md:group-hover:translate-x-0 md:group-hover:pointer-events-auto',
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onFavorite?.(product.id)
            }}
            className={cn(
              railButtonClasses,
              isFavorite
                ? 'bg-secondary text-white hover:bg-secondary-600 hover:text-white'
                : '',
            )}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={cn('h-4 w-4 transition-transform', isFavorite && 'fill-current')} />
          </button>

          <Link
            to={`/product/${product.id}`}
            className={railButtonClasses}
            aria-label="Quick view product"
          >
            <Eye className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleAddToCart()
            }}
            disabled={isAddingToCart}
            className={cn(railButtonClasses, 'disabled:opacity-70')}
            aria-label="Add to cart"
          >
            {isAddingToCart ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Info column */}
      <div className={cn(
        'flex flex-col flex-1 min-w-0',
        compact ? 'py-3 pr-3 pl-0 sm:py-4 sm:pr-4 gap-1.5' : 'p-4 gap-2.5',
      )}>
        <Link to={`/product/${product.id}`} className="group/title">
          <h3
            className={cn(
              'font-semibold text-foreground leading-snug line-clamp-2 group-hover/title:text-primary transition-colors',
              'text-sm',
              // Grid cards reserve exactly the 2-line title block so names
              // never change the card height; list rows size naturally.
              compact ? '' : 'min-h-10',
            )}
          >
            {product.name}
          </h3>
        </Link>

        {compact ? (
          /* List rows: static real rating (average + count), no input. */
          <div className="min-h-[16px] flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const shown = myRating ?? Math.round(realAvg)
                const isMine = myRating !== undefined && i < myRating
                return (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < shown
                        ? isMine
                          ? 'text-secondary fill-secondary'
                          : 'text-amber-400 fill-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                )
              })}
            </div>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {realCount > 0 ? realAvg.toFixed(1) : 'New'}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({realCount.toLocaleString()})
            </span>
          </div>
        ) : (
          /* Grid cards: interactive star rating — shows the real average +
              count, or the user's own rating once they've rated. Stars submit
              on click for authenticated users; signed-out users get a
              sign-in prompt. */
          <div className="min-h-[18px] flex items-center gap-1.5">
            <div
              className="flex items-center gap-0.5"
              onMouseLeave={() => setHoverRating(0)}
              role="radiogroup"
              aria-label={`Rate ${product.name}`}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const starValue = i + 1
                const shown = hoverRating > 0 ? hoverRating : (myRating ?? Math.round(realAvg))
                const filled = i < shown
                const isMine = myRating !== undefined && i < myRating
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={myRating === starValue}
                    aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
                    disabled={isSubmittingRating}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      submitRating(starValue)
                    }}
                    onMouseEnter={() => setHoverRating(starValue)}
                    className={cn(
                      'p-0.5 rounded-sm transition-transform duration-150',
                      'hover:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      'disabled:cursor-wait',
                    )}
                  >
                    <Star
                      className={cn(
                        'h-3 w-3 transition-colors duration-150',
                        filled
                          ? isMine
                            ? 'text-secondary fill-secondary'
                            : 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/30',
                      )}
                    />
                  </button>
                )
              })}
            </div>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {realCount > 0 ? realAvg.toFixed(1) : 'New'}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({realCount.toLocaleString()})
            </span>
          </div>
        )}

        <div className="min-h-[16px] flex items-center gap-1.5 text-xs text-muted-foreground">
          {normalizeSellerType(product.sellerType) === 'Shop' ? (
            <Store className="h-3 w-3 shrink-0" />
          ) : (
            <User className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{product.seller}</span>
        </div>

        {/* Short description snippet (list rows only, hidden on small phones) */}
        {compact && product.description && (
          <p className="hidden sm:block text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Footer wraps on ultra-narrow cards: price keeps its own line and
            the button drops to a full-width row instead of being crushed, so
            both stay usable. Cards in the same grid row share width, so heights
            stay uniform. */}
        <div className="mt-auto pt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          {/* Price never shrinks, wraps, or clips. */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                'whitespace-nowrap tabular-nums font-bold text-foreground leading-none',
                compact ? 'text-base' : 'text-lg',
              )}>
                {formatCurrency(product.price, 'USD')}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className={cn(
              'min-w-[44px] grow basis-auto',
              compact ? 'h-8 px-3 sm:grow-0' : 'grow basis-auto',
            )}
            onClick={handleAddToCart}
            disabled={isAddingToCart}
            leftIcon={
              isAddingToCart ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              )
            }
          >
            <span className="truncate">Add to Cart</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
