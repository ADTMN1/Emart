import * as React from 'react'
import { Link } from 'react-router-dom'
import { Heart, ArrowLeft, ShoppingBag, Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/ui/ProductCard'
import { ProductListSkeleton } from '@/components/ui/Skeleton'
import { useLanguage } from '@/contexts/LanguageContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useAuth } from '@/contexts/AuthContext'
import { favoritesApi } from '@/lib/api'
import type { Product } from '@/lib/types'

const Favorites: React.FC = () => {
  const { t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const { toggleFavorite, isFavorite, favoritesCount } = useFavorites()
  const [favorites, setFavorites] = React.useState<Product[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    const loadFavorites = async () => {
      if (!isAuthenticated) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(false)
        const data = await favoritesApi.getFavorites()
        setFavorites(data.favorites.map((f: any) => f.product))
      } catch (err) {
        console.error('Failed to load favorites:', err)
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadFavorites()
  }, [isAuthenticated, favoritesCount]) // Reload when favorites count changes

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background py-16">
        <div className="container-page">
          <div className="max-w-md mx-auto text-center py-16">
            <div className="h-20 w-20 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mx-auto mb-6">
              <Heart className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-bold mb-3">{t('favorites.signInRequired')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('favorites.signInDescription')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="primary" size="lg">
                <Link to="/login">{t('navbar.signIn')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/marketplace">
                  <ShoppingBag className="h-4 w-4" />
                  {t('favorites.browseMerketplace')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border">
        <div className="container-page py-8 lg:py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.backToHome')}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight">
                {t('navbar.favorites')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {favoritesCount} {favoritesCount === 1 ? t('favorites.item') : t('favorites.items')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-page py-8 lg:py-12">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            <ProductListSkeleton count={8} />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('favorites.loadError')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t('favorites.loadErrorDescription')}
            </p>
            <Button onClick={() => window.location.reload()}>
              {t('common.tryAgain')}
            </Button>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Heart className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-2xl font-bold mb-3">{t('favorites.emptyTitle')}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('favorites.emptyDescription')}
            </p>
            <Button asChild size="lg">
              <Link to="/marketplace">
                <ShoppingBag className="h-4 w-4" />
                {t('favorites.startShopping')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {favorites.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onFavorite={toggleFavorite}
                isFavorite={isFavorite(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Favorites
