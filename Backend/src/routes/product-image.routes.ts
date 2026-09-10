import { Router } from 'express';
import productImageController from '../controllers/product-image.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';

const router = Router();

// All routes require authentication
// Image upload/modification requires admin role

// Get all images for a product (public)
router.get('/:id/images', productImageController.getImages);

// Upload image (admin only)
router.post('/:id/images', authenticate, authorize('ADMIN'), uploadSingle, productImageController.uploadImage);

// Set primary image (admin only)
router.put('/:id/images/:imageId/primary', authenticate, authorize('ADMIN'), productImageController.setPrimaryImage);

// Reorder images (admin only)
router.put('/:id/images/reorder', authenticate, authorize('ADMIN'), productImageController.reorderImages);

// Delete image (admin only)
router.delete('/:id/images/:imageId', authenticate, authorize('ADMIN'), productImageController.deleteImage);

export default router;
