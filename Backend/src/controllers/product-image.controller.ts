import { Response, NextFunction } from 'express';
import productImageStorageService from '../services/product-image-storage.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { BadRequestError } from '../utils/errors';

export class ProductImageController {
  async uploadImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: productId } = req.params;
      
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const result = await productImageStorageService.uploadProductImage(
        productId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      return sendSuccess(res, result, 'Image uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: productId } = req.params;
      const images = await productImageStorageService.getProductImages(productId);
      
      return sendSuccess(res, images, 'Images retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: productId, imageId } = req.params;
      
      await productImageStorageService.deleteProductImage(productId, imageId);
      
      return sendSuccess(res, null, 'Image deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async setPrimaryImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: productId, imageId } = req.params;
      
      await productImageStorageService.setPrimaryImage(productId, imageId);
      
      return sendSuccess(res, null, 'Primary image updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async reorderImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: productId } = req.params;
      const { imageOrders } = req.body;

      if (!Array.isArray(imageOrders)) {
        throw new BadRequestError('imageOrders must be an array');
      }

      await productImageStorageService.reorderImages(productId, imageOrders);
      
      return sendSuccess(res, null, 'Images reordered successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new ProductImageController();
