import * as React from 'react'
import { ratingApi } from '@/lib/api'
import { useAuth } from './AuthContext'

interface RatingsContextValue {
  /** The signed-in user's rating for a product (undefined when unrated). */
  getMyRating: (productId: string) => number | undefined
  /** Optimistically record a submitted rating (server already persisted it). */
  setLocalRating: (productId: string, rating: number) => void
  refreshMyRatings: () => Promise<void>
  isLoading: boolean
}

const RatingsContext = React.createContext<RatingsContextValue | undefined>(undefined)

/**
 * Tracks the authenticated user's own product ratings so cards can show
 * "your rating" and allow changing it without duplicate submissions.
 * Average/count always come from the server with the product payload.
 */
export const RatingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [myRatings, setMyRatings] = React.useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = React.useState(false)

  const loadMyRatings = React.useCallback(async () => {
    if (!user) {
      setMyRatings({})
      return
    }

    try {
      setIsLoading(true)
      const data = await ratingApi.getMyRatings()
      setMyRatings(data?.ratings || {})
    } catch (error) {
      console.error('Failed to load your ratings:', error)
      setMyRatings({})
    } finally {
      setIsLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    loadMyRatings()
  }, [loadMyRatings])

  const getMyRating = React.useCallback(
    (productId: string) => myRatings[productId],
    [myRatings]
  )

  const setLocalRating = React.useCallback((productId: string, rating: number) => {
    setMyRatings((prev) => ({ ...prev, [productId]: rating }))
  }, [])

  const refreshMyRatings = React.useCallback(async () => {
    await loadMyRatings()
  }, [loadMyRatings])

  const value = React.useMemo(
    () => ({ getMyRating, setLocalRating, refreshMyRatings, isLoading }),
    [getMyRating, setLocalRating, refreshMyRatings, isLoading]
  )

  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>
}

export const useRatings = (): RatingsContextValue => {
  const context = React.useContext(RatingsContext)
  if (!context) {
    throw new Error('useRatings must be used within a RatingsProvider')
  }
  return context
}
