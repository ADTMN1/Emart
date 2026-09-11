import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../types'

/**
 * Get user's favorites with product details
 */
export const getFavorites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: true,
            productImages: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.json({
      favorites: favorites.map((f) => ({
        id: f.id,
        productId: f.productId,
        createdAt: f.createdAt,
        product: f.product,
      })),
      count: favorites.length,
    })
  } catch (error) {
    console.error('Get favorites error:', error)
    return res.status(500).json({ error: 'Failed to fetch favorites' })
  }
}

/**
 * Get count of user's favorites
 */
export const getFavoritesCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const count = await prisma.favorite.count({
      where: { userId },
    })

    return res.json({ count })
  } catch (error) {
    console.error('Get favorites count error:', error)
    return res.status(500).json({ error: 'Failed to fetch favorites count' })
  }
}

/**
 * Get user's favorite product IDs (for quick lookups)
 */
export const getFavoriteIds = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      select: { productId: true },
    })

    return res.json({
      productIds: favorites.map((f) => f.productId),
    })
  } catch (error) {
    console.error('Get favorite IDs error:', error)
    return res.status(500).json({ error: 'Failed to fetch favorite IDs' })
  }
}

/**
 * Add product to favorites
 */
export const addFavorite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { productId } = req.body
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' })
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    })

    if (existing) {
      return res.status(200).json({
        message: 'Product already in favorites',
        favorite: existing,
      })
    }

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: {
          include: {
            category: true,
            productImages: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            },
          },
        },
      },
    })

    return res.status(201).json({
      message: 'Product added to favorites',
      favorite,
    })
  } catch (error) {
    console.error('Add favorite error:', error)
    return res.status(500).json({ error: 'Failed to add favorite' })
  }
}

/**
 * Remove product from favorites
 */
export const removeFavorite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { productId } = req.params

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    })

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' })
    }

    await prisma.favorite.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    })

    return res.json({ message: 'Product removed from favorites' })
  } catch (error) {
    console.error('Remove favorite error:', error)
    return res.status(500).json({ error: 'Failed to remove favorite' })
  }
}

/**
 * Toggle favorite (add if not exists, remove if exists)
 */
export const toggleFavorite = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { productId } = req.body
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' })
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    })

    if (existing) {
      // Remove favorite
      await prisma.favorite.delete({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      })

      return res.json({
        message: 'Product removed from favorites',
        isFavorite: false,
      })
    } else {
      // Add favorite
      const favorite = await prisma.favorite.create({
        data: {
          userId,
          productId,
        },
      })

      return res.status(201).json({
        message: 'Product added to favorites',
        isFavorite: true,
        favorite,
      })
    }
  } catch (error) {
    console.error('Toggle favorite error:', error)
    return res.status(500).json({ error: 'Failed to toggle favorite' })
  }
}
