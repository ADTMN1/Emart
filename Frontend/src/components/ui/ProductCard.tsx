import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Heart,
  Star,
  Truck,
  Store,
  User,
  ExternalLink,
} from 'lucide-react'
import { cn, formatCurrency, truncate } from '@/lib/utils'
import type { Product } from '@/data/mockData'
import { Badge } from './Badge'
import { Button } from './Button'

interface ProductCardProps {
  product: Product
  className?: string
  onFavorite?: (id: string) => void
  isFavorite?: boolean
  compact?: boolean
}

const conditionColors: Record<Product['condition'], string> = {
  New: 'success',
  'Like New': 'success',
  'Very Good': 'info',
  Good: 'warning',
  Acceptable: 'warning',
}

const sourceColors: Record<Product['source'], string> = {
  'Marketplace A': 'bg-rose-500',
  'Marketplace B': 'bg-amber-500',
  'Marketplace C': 'bg-red-600',
  'Marketplace D': 'bg-orange-500',
  'Marketplace E': 'bg-blue-500',
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  className,
  onFavorite,
  isFavorite = false,
  compact = false,
}) => {
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const [hoverFav, setHoverFav] = React.useState(false)

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300',
        'hover:border-primary-300 hover:shadow-card-hover',
        'flex flex-col h-full',
        className,
      )}
    >
      <Link to={`/product/${product.id}`} className="relative block overflow-hidden bg-muted">
        <div className="aspect-square w-full relative overflow-hidden">
          {!imgLoaded && (
            <div className="absolute inset-0 shimmer animate-shimmer rounded-none" />
          )}
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={cn(
              'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105',
              !imgLoaded && 'opacity-0',
            )}
          />
        </div>

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isNew && (
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
            {product.condition}
          </Badge>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5">
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

        <button
          onClick={(e) => {
            e.preventDefault()
            onFavorite?.(product.id)
          }}
          onMouseEnter={() => setHoverFav(true)}
          onMouseLeave={() => setHoverFav(false)}
          className={cn(
            'absolute top-3 right-3 h-9 w-9 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-200',
            'shadow-md',
            isFavorite
              ? 'bg-secondary text-white hover:bg-secondary-600'
              : 'bg-white/90 text-muted-foreground hover:bg-white hover:text-secondary backdrop-blur-sm',
            hoverFav && 'scale-110',
          )}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={cn('h-4 w-4 transition-transform', isFavorite && 'fill-current')}
          />
        </button>
      </Link>

      <div className={cn(
        'flex flex-col flex-1',
        compact ? 'p-3.5 gap-2' : 'p-4 gap-2.5',
      )}>
        <Link to={`/product/${product.id}`} className="group/title">
          <h3
            className={cn(
              'font-semibold text-foreground leading-snug line-clamp-2 group-hover/title:text-primary transition-colors',
              compact ? 'text-sm' : 'text-sm',
            )}
          >
            {product.name}
          </h3>
        </Link>

        {!compact && product.rating !== undefined && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {(() => {
                const rating = product.rating ?? 0
                return Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.round(rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-muted-foreground/30',
                    )}
                  />
                ))
              })()}
            </div>
            <span className="text-xs font-medium text-foreground">{product.rating}</span>
            {product.reviewCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                ({(product.reviewCount ?? 0).toLocaleString()})
              </span>
            )}
          </div>
        )}

        {!compact && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {product.sellerType === 'Shop' ? (
              <Store className="h-3 w-3 shrink-0" />
            ) : (
              <User className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{product.seller}</span>
          </div>
        )}

        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                'font-bold text-foreground leading-none',
                compact ? 'text-base' : 'text-lg',
              )}>
                {formatCurrency(product.estimatedPriceUsd, 'USD')}
              </span>
              {!compact && (
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                  est.
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>
                {formatCurrency(product.price, 'JPY')}
              </span>
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </div>
          </div>

          <Button
            size={compact ? 'sm' : 'sm'}
            variant="outline"
            className={cn('shrink-0', compact && 'h-8 px-2.5')}
            onClick={(e) => {
              e.preventDefault()
              onFavorite?.(product.id)
            }}
            asChild
          >
            <Link to={`/product/${product.id}`}>
              View
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
