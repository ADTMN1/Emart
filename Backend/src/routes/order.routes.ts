import { Router } from 'express';
import orderController from '../controllers/order.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { createOrderValidation } from '../middleware/validations/order.validation';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// BUYER ORDERS — CUSTOMER only. An approved SELLER is seller-only and must not
// create, read or cancel buyer orders even by calling the API directly, so
// these are gated per-route (the admin status route below must stay reachable
// for ADMIN and must therefore NOT inherit this guard).
router.post('/', authorize('CUSTOMER'), createOrderValidation, validate, orderController.createOrder);
router.get('/', authorize('CUSTOMER'), orderController.getOrders);
router.get('/stats', authorize('CUSTOMER'), orderController.getOrderStats);

// Customer shipment endpoint - get shipments for user's orders (MUST be before /:id)
router.get('/shipments', authorize('CUSTOMER'), orderController.getUserShipments);

router.get('/:id', authorize('CUSTOMER'), orderController.getOrderById);
router.post('/:id/cancel', authorize('CUSTOMER'), orderController.cancelOrder);

// Admin-only routes
router.put('/:id/status', authorize('ADMIN'), orderController.updateOrderStatus);

export default router;
