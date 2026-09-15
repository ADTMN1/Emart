import { Router } from 'express';
import productController from '../controllers/product.controller';
import productImageController from '../controllers/product-image.controller';
import productImportController from '../controllers/product-import.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { createProductValidation, updateProductValidation, searchProductsValidation } from '../middleware/validations/product.validation';
import { uploadSingle, uploadCsvSingle, uploadImportFiles } from '../middleware/upload';

const router = Router();

// Public routes
router.get(
  '/',
  searchProductsValidation,
  validate,
  productController.getAllProducts
);

router.get('/featured', productController.getFeaturedProducts);

// Bulk import — Phase 1: template download only. Static segments are
// registered before /:id so "import" is never mistaken for a product id
// (same precedent as bulk-delete below).
router.get('/import/template', authenticate, authorize('ADMIN'), productImportController.getTemplate);

// Phase 2: validation only — parses + validates the CSV and returns a row
// report. Performs zero database writes.
router.post(
  '/import/validate',
  authenticate,
  authorize('ADMIN'),
  uploadCsvSingle,
  productImportController.validateCsv
);

// Phase 4: read-only ImportRun endpoints. History must be registered
// before :runId so "history" is not captured as a run id.
router.get(
  '/import/history',
  authenticate,
  authorize('ADMIN'),
  productImportController.getHistory
);

router.get(
  '/import/:runId',
  authenticate,
  authorize('ADMIN'),
  productImportController.getRun
);

router.post(
  '/import/:runId/retry',
  authenticate,
  authorize('ADMIN'),
  productImportController.retryFailedRows
);

// Phase 3: synchronous CREATE-mode import. Row-level failures never abort
// the run; results are persisted in ImportRun and returned inline.
router.post(
  '/import',
  authenticate,
  authorize('ADMIN'),
  uploadImportFiles,
  productImportController.importCsv
);

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
  updateProductValidation,
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
