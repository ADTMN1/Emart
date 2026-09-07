import * as React from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Home as HomeIcon,
  Heart,
  Share2,
  ShieldCheck,
  Truck,
  Package,
  Info,
  Star,
  Store,
  User,
  ExternalLink,
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { ProductCard } from '@/components/ui/ProductCard'
import { useToast } from '@/components/ui/Toast'
import { products, categories } from '@/data/mockData'
import { cn, formatCurrency } from '@/lib/utils'

const ProductDetails: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [imgIdx, setImgIdx] = React.useState(0)
  const [qty, setQty] = React.useState(1)
  const [isFav, setIsFav] = React.useState(false)

  const product = products.find((p) => p.id === id) || products[0]
  const category = categories.find((c) => c.id === product.category)

  const subtotalJpy = product.price + product.serviceFee + product.domesticShipping
  const subtotalUsd = product.estimatedPriceUsd
  const totalUsd = subtotalUsd + product.internationalShippingUsd

  const addToCart = (buyNow = false) => {
    toast({
      variant: 'success',
      title: buyNow ? 'Proceeding to checkout' : 'Added to cart',
      description: buyNow
        ? `${product.name} is ready for purchase.`
        : `${qty} × ${product.name.slice(0, 40)} added to your cart.`,
    })
    if (buyNow) {
      setTimeout(() => navigate('/checkout'), 600)
    }
  }

  const relatedProducts = products.filter((p) => p.id !== product.id && p.category === product.category)
  const displayImages = product.images.length > 0 ? product.images : [product.image]

  return (
    <div className="bg-background">
      <div className="container-page py-4 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto scrollbar-thin">
          <Link to="/" className="hover:text-primary flex items-center gap-1 shrink-0">
            <HomeIcon className="h-3 w-3" />
            Home
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          {category && (
            <>
              <Link to={`/categories?id=${category.id}`} className="hover:text-primary shrink-0">
                {category.name}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
            </>
          )}
          <span className="truncate max-w-xs text-foreground font-medium">
            {product.name}
          </span>
        </div>
      </div>

      <div className="container-page py-6 lg:py-10">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Images */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border">
              <img
                src={displayImages[imgIdx]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx((i) => (i - 1 + displayImages.length) % displayImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md hover:bg-white flex items-center justify-center text-foreground transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setImgIdx((i) => (i + 1) % displayImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md hover:bg-white flex items-center justify-center text-foreground transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </>
              )}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {product.isNew && <Badge variant="info" size="md" dot>NEW</Badge>}
                {product.isBestSeller && <Badge variant="accent" size="md" dot>BESTSELLER</Badge>}
                <Badge variant="success" size="md">{product.condition}</Badge>
              </div>
            </div>

            {displayImages.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto scrollbar-thin pb-1">
                {displayImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={cn(
                      'shrink-0 aspect-square w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden border-2 transition-all',
                      i === imgIdx
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-border',
                    )}
                  >
                    <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" size="sm">
                  <span className="h-1.5 w-1.5 rounded-full mr-1.5 bg-primary" />
                  {product.source}
                  <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                </Badge>
                {product.rating && (
                  <Badge variant="outline" size="sm">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400 mr-1" />
                    {product.rating} ({product.reviewCount?.toLocaleString()})
                  </Badge>
                )}
              </div>

              <h1 className="font-display text-xl lg:text-3xl font-extrabold tracking-tight leading-tight text-balance">
                {product.name}
              </h1>
            </div>

            {/* Seller Info */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/50 border border-border/60">
              <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
                {product.sellerType === 'Shop' ? (
                  <Store className="h-5 w-5" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{product.seller}</span>
                  <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    {product.sellerType}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <span className="font-medium text-foreground/80">4.9</span>
                  </div>
                  <span>•</span>
                  <span>2.3K sales</span>
                  <span>•</span>
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span>Verified</span>
                </div>
              </div>
              <Button variant="ghost" size="sm">View</Button>
            </div>

            {/* Price Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary-50/30 to-transparent">
              <CardContent className="p-6">
                <div className="flex items-baseline justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display text-3xl lg:text-4xl font-extrabold text-foreground">
                        {formatCurrency(totalUsd, 'USD')}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">
                        estimated total
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                      <span>Original: {formatCurrency(product.price, 'JPY')}</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </div>
                  </div>
                  <Badge variant="primary" size="md">
                    <Truck className="h-3 w-3 mr-1" />
                    Ships Worldwide
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      label: 'Product Price',
                      value: formatCurrency(product.price, 'JPY'),
                      valueUsd: `≈ ${formatCurrency(product.estimatedPriceUsd, 'USD')}`,
                      icon: Package,
                    },
                    {
                      label: 'Domestic Shipping',
                      value: product.domesticShipping === 0 ? 'FREE' : formatCurrency(product.domesticShipping, 'JPY'),
                      valueUsd: product.domesticShipping === 0 ? 'Included' : `≈ $${Math.round(product.domesticShipping * 0.007)}`,
                      icon: Truck,
                      free: product.domesticShipping === 0,
                    },
                    {
                      label: 'EMART Service Fee (7%)',
                      value: formatCurrency(product.serviceFee, 'JPY'),
                      valueUsd: `≈ $${Math.round(product.serviceFee * 0.007)}`,
                      icon: ShieldCheck,
                      info: 'Includes buyer protection',
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <row.icon className="h-3.5 w-3.5" />
                        <span className="font-medium text-foreground/80">{row.label}</span>
                        {row.info && <Info className="h-3.5 w-3.5 text-info" />}
                      </div>
                      <div className="text-right">
                        <div className={cn('font-semibold', row.free && 'text-success')}>{row.value}</div>
                        <div className="text-[11px] text-muted-foreground">{row.valueUsd}</div>
                      </div>
                    </div>
                  ))}

                  <div className="h-px bg-border/70 my-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Truck className="h-4 w-4 text-primary" />
                      Estimated International Shipping
                    </div>
                    <div className="font-bold text-foreground">
                      from {formatCurrency(product.internationalShippingUsd, 'USD')}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6 leading-snug">
                    Based on DHL Express (3-5 days) to your country. Choose your preferred carrier at checkout.
                  </p>

                  <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground leading-relaxed">
                      <span className="font-bold">Final price confirmed at checkout.</span> International shipping varies by destination and weight. Customs duties may apply in your country.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quantity & Actions */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-foreground w-20">Quantity</span>
                <div className="inline-flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                    disabled={qty <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="h-10 min-w-12 text-center font-bold flex items-center justify-center">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(10, q + 1))}
                    className="h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                    disabled={qty >= 10}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="xl"
                  variant="primary"
                  className="sm:flex-1 shadow-lg shadow-primary/25"
                  onClick={() => addToCart(false)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  size="xl"
                  variant="secondary"
                  className="sm:flex-1 shadow-lg shadow-secondary/25"
                  onClick={() => addToCart(true)}
                >
                  Buy Now
                </Button>
                <div className="flex sm:flex-col gap-2">
                  <Button
                    variant="outline"
                    size="xl"
                    className={cn(isFav && 'text-secondary border-secondary bg-secondary/5')}
                    onClick={() => setIsFav(!isFav)}
                  >
                    <Heart className={cn('h-4 w-4 mr-1.5', isFav && 'fill-current')} />
                    Save
                  </Button>
                  <Button variant="outline" size="xl">
                    <Share2 className="h-4 w-4 mr-1.5" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Tags */}
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {product.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/marketplace?q=${encodeURIComponent(t)}`}
                    className="px-3 py-1.5 rounded-lg bg-muted hover:bg-primary-50 hover:text-primary text-xs font-medium text-foreground/80 border border-border hover:border-primary-200 transition-colors"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <section className="mt-16 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl lg:text-2xl font-bold mb-4">About this item</h2>
            <div className="p-6 rounded-2xl bg-card border border-border">
              <p className="text-sm text-foreground/85 leading-relaxed">
                {product.description}
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  ['Condition', product.condition],
                  ['Seller Location', 'Global'],
                  ['Shipping from', 'EMART Warehouse'],
                  ['Seller Type', product.sellerType],
                  ['Marketplace', product.source],
                  ['Item Code', `EM-${product.id.toUpperCase()}-${Math.round(product.price)}`],
                ].map(([k, v]) => (
                  <li key={k} className="flex text-sm border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
                    <span className="w-36 shrink-0 text-muted-foreground font-medium">{k}</span>
                    <span className="text-foreground font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="font-bold">Shopping Safely with EMART</h3>
                <ul className="space-y-3">
                  {[
                    ['Free 45-Day Storage', 'Store items and consolidate'],
                    ['Item Verification', 'Photos before international ship'],
                    ['Buyer Protection', '100% coverage on every order'],
                    ['Secure Payments', 'PCI-DSS certified processing'],
                  ].map(([t, d]) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold">{t}</div>
                        <div className="text-xs text-muted-foreground">{d}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Related */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="font-display text-xl lg:text-2xl font-extrabold tracking-tight">
                  Related Products
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customers also viewed these {category?.name || 'items'}
                </p>
              </div>
              <Link to="/marketplace" className="text-sm font-bold text-primary hover:text-primary-700">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              {relatedProducts.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default ProductDetails
