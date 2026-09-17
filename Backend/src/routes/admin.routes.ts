import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import shipmentController from '../controllers/shipment.controller';
import paymentController from '../controllers/admin-payment.controller';
import reportController from '../controllers/report.controller';
import adminSellerController from '../controllers/admin-seller.controller';
import messageController from '../controllers/message.controller';
import {
  listSellerApplicationsValidation,
  getSellerApplicationValidation,
  approveSellerApplicationValidation,
  rejectSellerApplicationValidation,
  sellerStatusActionValidation,
} from '../middleware/validations/seller.validation';
import {
  salesOverviewValidation,
  salesTrendValidation,
  salesProductsValidation,
  salesCategoriesValidation,
} from '../middleware/validations/report.validation';
import {
  createShipmentValidation,
  updateShipmentValidation,
  changeShipmentStatusValidation,
  addTrackingEventValidation,
  orderIdParamValidation,
} from '../middleware/validations/shipment.validation';
import {
  getPaymentValidation,
  verifyPaymentValidation,
  rejectPaymentValidation,
  updatePaymentValidation,
} from '../middleware/validations/payment.validation';
import {
  sendMessageValidation,
  createConversationValidation,
} from '../middleware/validations/message.validation';
import { validate } from '../middleware/validator';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All admin routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', adminController.getStats);
router.get('/orders', adminController.getAdminOrders.bind(adminController));
router.get('/orders/:id', adminController.getAdminOrderById.bind(adminController));

// Shipment lifecycle for a specific order (ADMIN-only). Param name is
// :orderId to match the service/controller contract.
router.post(
  '/orders/:orderId/shipment',
  createShipmentValidation,
  validate,
  shipmentController.createShipment.bind(shipmentController)
);
router.get(
  '/orders/:orderId/shipment',
  orderIdParamValidation,
  validate,
  shipmentController.getShipment.bind(shipmentController)
);
router.patch(
  '/orders/:orderId/shipment',
  updateShipmentValidation,
  validate,
  shipmentController.updateShipment.bind(shipmentController)
);
router.post(
  '/orders/:orderId/shipment/status',
  changeShipmentStatusValidation,
  validate,
  shipmentController.changeShipmentStatus.bind(shipmentController)
);
router.post(
  '/orders/:orderId/shipment/events',
  addTrackingEventValidation,
  validate,
  shipmentController.addTrackingEvent.bind(shipmentController)
);
router.get(
  '/orders/:orderId/shipment/events',
  orderIdParamValidation,
  validate,
  shipmentController.getTrackingEvents.bind(shipmentController)
);

// Inline payment management for a specific order (ADMIN-only).
router.get(
  '/orders/:orderId/payment',
  getPaymentValidation,
  paymentController.getPayment.bind(paymentController)
);
router.post(
  '/orders/:orderId/payment/verify',
  verifyPaymentValidation,
  paymentController.verifyPayment.bind(paymentController)
);
router.post(
  '/orders/:orderId/payment/reject',
  rejectPaymentValidation,
  paymentController.rejectPayment.bind(paymentController)
);
router.patch(
  '/orders/:orderId/payment',
  updatePaymentValidation,
  paymentController.updatePayment.bind(paymentController)
);

// Sales reports / analytics (Phase 4). Aggregate business data only.
router.get('/reports/sales/overview', salesOverviewValidation, reportController.getSalesOverview.bind(reportController));
router.get('/reports/sales/trend', salesTrendValidation, reportController.getSalesTrend.bind(reportController));
router.get(
  '/reports/sales/products',
  salesProductsValidation,
  reportController.getSalesProducts.bind(reportController)
);
router.get(
  '/reports/sales/categories',
  salesCategoriesValidation,
  reportController.getSalesCategories.bind(reportController)
);
router.get(
  '/reports/sales/orders',
  salesOverviewValidation,
  reportController.getSalesOrdersBreakdown.bind(reportController)
);
router.get(
  '/reports/sales/payments',
  salesOverviewValidation,
  reportController.getSalesPaymentsBreakdown.bind(reportController)
);

// Seller foundation (Phase 5) — application review + seller identity management.
router.get(
  '/sellers/applications',
  listSellerApplicationsValidation,
  adminSellerController.listApplications.bind(adminSellerController)
);
router.get(
  '/sellers/applications/:id',
  getSellerApplicationValidation,
  adminSellerController.getApplication.bind(adminSellerController)
);
router.post(
  '/sellers/applications/:id/approve',
  approveSellerApplicationValidation,
  adminSellerController.approveApplication.bind(adminSellerController)
);
router.post(
  '/sellers/applications/:id/reject',
  rejectSellerApplicationValidation,
  adminSellerController.rejectApplication.bind(adminSellerController)
);
router.post(
  '/sellers/:sellerId/suspend',
  sellerStatusActionValidation,
  adminSellerController.suspendSeller.bind(adminSellerController)
);
router.post(
  '/sellers/:sellerId/activate',
  sellerStatusActionValidation,
  adminSellerController.activateSeller.bind(adminSellerController)
);
// Admin ↔ Seller messaging (Phase 7). One conversation exists per
// order+seller; admins are authorized by the router-level gate above and the
// seller is always resolved server-side from the order's own items.
router.get(
  '/orders/:orderId/conversations',
  messageController.listOrderConversations.bind(messageController),
);
router.post(
  '/orders/:orderId/conversations',
  createConversationValidation,
  validate,
  messageController.getOrCreateConversation.bind(messageController),
);
router.get(
  '/conversations/:id/messages',
  messageController.getAdminMessages.bind(messageController),
);
router.post(
  '/conversations/:id/messages',
  sendMessageValidation,
  validate,
  messageController.sendAdminMessage.bind(messageController),
);
router.patch(
  '/conversations/:id/read',
  messageController.markAdminConversationRead.bind(messageController),
);

router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/warehouse-packages', adminController.getWarehousePackages);
router.get('/shipments', adminController.getShipments);
router.get('/crypto-wallets', adminController.getCryptoWallets.bind(adminController));
router.post('/crypto-wallets', adminController.createCryptoWallet.bind(adminController));
router.put('/crypto-wallets/:id', adminController.updateCryptoWallet.bind(adminController));
router.delete('/crypto-wallets/:id', adminController.deleteCryptoWallet.bind(adminController));
router.get('/deposits', adminController.getDepositSubmissions.bind(adminController));
router.put('/deposits/:id/status', adminController.updateDepositSubmissionStatus.bind(adminController));

export default router;
