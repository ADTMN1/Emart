import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getFavorites,
  getFavoritesCount,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  toggleFavorite,
} from '../controllers/favorite.controller'

const router = Router()

// All favorite routes require authentication
router.use(authenticate)

// GET /api/favorites - Get all favorites
router.get('/', getFavorites)

// GET /api/favorites/count - Get favorites count
router.get('/count', getFavoritesCount)

// GET /api/favorites/ids - Get favorite product IDs
router.get('/ids', getFavoriteIds)

// POST /api/favorites - Add to favorites
router.post('/', addFavorite)

// DELETE /api/favorites/:productId - Remove from favorites
router.delete('/:productId', removeFavorite)

// POST /api/favorites/toggle - Toggle favorite
router.post('/toggle', toggleFavorite)

export default router
