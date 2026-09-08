import { Router } from 'express';
import productController from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { createProductValidation, searchProductsValidation } from '../middleware/validations/product.validation';

const router = Router();

// Public routes
router.get(
  '/',
  searchProductsValidation,
  validate,
  productController.getAllProducts
);

router.get('/featured', productController.getFeaturedProducts);

router.get('/:id', productController.getProductById);

router.get('/:id/related', productController.getRelatedProducts);

// Admin-only routes
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  createProductValidation,
  validate,
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  createProductValidation,
  validate,
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  productController.deleteProduct
);

export default router;
