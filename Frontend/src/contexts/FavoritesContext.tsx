import * as React from 'react'
import { favoritesApi } from '@/lib/api'
import { useAuth } from './AuthContext'

interface FavoritesContextValue {
  favorites: Set<string>
  favoritesCount: number
  isLoading: boolean
  toggleFavorite: (productId: string) => Promise<void>
  isFavorite: (productId: string) => boolean
  refreshFavorites: () => Promise<void>
}

const FavoritesContext = React.createContext<FavoritesContextValue | undefined>(undefined)

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set())
  const [favoritesCount, setFavoritesCount] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)

  // Load favorites when user logs in
  const loadFavorites = React.useCallback(async () => {
    if (!user) {
      setFavorites(new Set())
      setFavoritesCount(0)
      return
    }

    try {
      setIsLoading(true)
      const data = await favoritesApi.getFavoriteIds()
      const favoriteSet = new Set(data.productIds)
      setFavorites(favoriteSet)
      setFavoritesCount(favoriteSet.size)
    } catch (error) {
      console.error('Failed to load favorites:', error)
      // Silently fail - favorites are not critical
      setFavorites(new Set())
      setFavoritesCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Load favorites on mount and when user changes
  React.useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const toggleFavorite = React.useCallback(async (productId: string) => {
    if (!user) {
      // If user is not logged in, could show a login prompt
      console.warn('Must be logged in to add favorites')
      return
    }

    // Optimistic update
    const wasFavorite = favorites.has(productId)
    const newFavorites = new Set(favorites)
    
    if (wasFavorite) {
      newFavorites.delete(productId)
    } else {
      newFavorites.add(productId)
    }
    
    setFavorites(newFavorites)
    setFavoritesCount(newFavorites.size)

    try {
      const response = await favoritesApi.toggleFavorite(productId)
      // Server response confirms the state
      // If the server state differs from our optimistic update, correct it
      if (response.isFavorite !== !wasFavorite) {
        // Revert optimistic update
        setFavorites(favorites)
        setFavoritesCount(favorites.size)
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
      // Revert optimistic update on error
      setFavorites(favorites)
      setFavoritesCount(favorites.size)
    }
  }, [user, favorites])

  const isFavorite = React.useCallback((productId: string) => {
    return favorites.has(productId)
  }, [favorites])

  const refreshFavorites = React.useCallback(async () => {
    await loadFavorites()
  }, [loadFavorites])

  const value = React.useMemo(
    () => ({
      favorites,
      favoritesCount,
      isLoading,
      toggleFavorite,
      isFavorite,
      refreshFavorites,
    }),
    [favorites, favoritesCount, isLoading, toggleFavorite, isFavorite, refreshFavorites]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export const useFavorites = () => {
  const context = React.useContext(FavoritesContext)
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider')
  }
  return context
}
