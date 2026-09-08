import { Router } from 'express';
import orderController from '../controllers/order.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { createOrderValidation } from '../middleware/validations/order.validation';

const router = Router();

// All order routes require authentication
router.use(authenticate);

router.post('/', createOrderValidation, validate, orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderById);
router.post('/:id/cancel', orderController.cancelOrder);

// Admin-only routes
router.put('/:id/status', authorize('ADMIN'), orderController.updateOrderStatus);

export default router;
