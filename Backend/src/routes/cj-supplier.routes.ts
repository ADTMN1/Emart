import { Router } from 'express';
import cjSupplierController from '../controllers/cj-supplier.controller';
import { validate } from '../middleware/validator';
import { authenticate, authorize } from '../middleware/auth';
import {
  searchCJProductsValidation,
  getCJProductDetailValidation,
  importCJProductValidation,
  importCJCategoryValidation,
} from '../middleware/validations/cj-supplier.validation';

const router = Router();

// All CJ supplier routes require ADMIN authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// GET /admin/suppliers/cj/categories - Get CJ categories
router.get('/categories', cjSupplierController.getCategories.bind(cjSupplierController));

// POST /admin/suppliers/cj/categories/:categoryId/import - Start CJ category import
router.post(
  '/categories/:categoryId/import',
  importCJCategoryValidation,
  validate,
  cjSupplierController.importCategory.bind(cjSupplierController)
);

// GET /admin/suppliers/cj/products - Search CJ products
router.get(
  '/products',
  searchCJProductsValidation,
  validate,
  cjSupplierController.searchProducts.bind(cjSupplierController)
);

// GET /admin/suppliers/cj/products/:productId - Get CJ product detail
router.get(
  '/products/:productId',
  getCJProductDetailValidation,
  validate,
  cjSupplierController.getProductDetail.bind(cjSupplierController)
);

// POST /admin/suppliers/cj/products/:productId/import - Import CJ product
router.post(
  '/products/:productId/import',
  importCJProductValidation,
  validate,
  cjSupplierController.importProduct.bind(cjSupplierController)
);

export default router;