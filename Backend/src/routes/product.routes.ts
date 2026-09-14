import { Router } from 'express';
import productController from '../controllers/product.controller';
import productImageController from '../controllers/product-image.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { createProductValidation, searchProductsValidation } from '../middleware/validations/product.validation';
import { uploadSingle } from '../middleware/upload';

const router = Router();

// Public routes
router.get(
  '/',
  searchProductsValidation,
  validate,
  productController.getAllProducts
);

router.get('/featured', productController.getFeaturedProducts);

// Admin-only bulk delete — must be registered before /:id routes so that
// "bulk-delete" is not captured as a product id.
router.post(
  '/bulk-delete',
  authenticate,
  authorize('ADMIN'),
  productController.bulkDeleteProducts
);

router.get('/:id', productController.getProductById);

router.get('/:id/related', productController.getRelatedProducts);

// Product images routes (public read)
router.get('/:id/images', productImageController.getImages);

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

// Product images management (admin only)
router.post(
  '/:id/images',
  authenticate,
  authorize('ADMIN'),
  uploadSingle,
  productImageController.uploadImage
);

router.put(
  '/:id/images/:imageId/primary',
  authenticate,
  authorize('ADMIN'),
  productImageController.setPrimaryImage
);

router.put(
  '/:id/images/reorder',
  authenticate,
  authorize('ADMIN'),
  productImageController.reorderImages
);

router.delete(
  '/:id/images/:imageId',
  authenticate,
  authorize('ADMIN'),
  productImageController.deleteImage
);

export default router;
