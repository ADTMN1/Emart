import { Router } from 'express';
import categoryController from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';
import { setPublicCache } from '../middleware/cache';

const router = Router();

// Public routes
router.get('/', setPublicCache, categoryController.getAllCategories);
router.get('/:id', setPublicCache, categoryController.getCategoryById);

// Admin-only routes
router.post('/', authenticate, authorize('ADMIN'), categoryController.createCategory);
router.put('/:id', authenticate, authorize('ADMIN'), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.deleteCategory);

export default router;
