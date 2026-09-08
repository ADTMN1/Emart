import { Router } from 'express';
import cartController from '../controllers/cart.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { addToCartValidation, updateCartItemValidation } from '../middleware/validations/cart.validation';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', addToCartValidation, validate, cartController.addToCart);
router.put('/items/:itemId', updateCartItemValidation, validate, cartController.updateCartItem);
router.delete('/items/:itemId', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

export default router;
