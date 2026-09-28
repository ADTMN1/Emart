import { Router } from 'express';
import sellerController from '../controllers/seller.controller';
import sellerProductController from '../controllers/seller-product.controller';
import messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { uploadSingle, uploadSellerDocument } from '../middleware/upload';
import {
  createSellerApplicationValidation,
  resubmitSellerApplicationValidation,
  updateSellerProfileValidation,
  sellerOrderIdValidation,
  confirmOrderRequestValidation,
  declineOrderRequestValidation,
  addPaymentMethodValidation,
  updatePaymentMethodValidation,
  paymentMethodIdValidation,
  sellerSalesReportValidation,
} from '../middleware/validations/seller.validation';
import {
  createSellerProductValidation,
  updateSellerProductValidation,
  sellerProductIdParam,
  listSellerProductsValidation,
} from '../middleware/validations/seller-product.validation';
import { sendMessageValidation } from '../middleware/validations/message.validation';

const router = Router();

// All seller customer routes require authentication. Ownership is derived
// exclusively from the authenticated user — never from the body.
router.use(authenticate);

// Submit a first application; resubmitting a rejected one reuses the same
// record (same URL, same validation).
// Multipart: the identity document is parsed into memory by multer before the
// body validators run, then uploaded to private storage by the controller.
router.post('/application', uploadSellerDocument, createSellerApplicationValidation, sellerController.submitApplication.bind(sellerController));
router.post('/application/resubmit', uploadSellerDocument, resubmitSellerApplicationValidation, sellerController.submitApplication.bind(sellerController));
router.get('/application', sellerController.getMyApplication.bind(sellerController));
// Phase 8: EMART Seller Agreement — server-controlled version + acceptance.
router.get('/agreement', sellerController.getAgreement.bind(sellerController));
router.post('/agreement/accept', sellerController.acceptAgreement.bind(sellerController));
router.get('/profile', sellerController.getMyProfile.bind(sellerController));
router.put(
  '/profile',
  updateSellerProfileValidation,
  sellerController.updateMyProfile.bind(sellerController),
);
// Storefront media — the public shop-media bucket. Field name is 'image'.
router.put(
  '/profile/logo',
  uploadSingle,
  sellerController.uploadShopMedia('logo'),
);
router.delete('/profile/logo', sellerController.removeShopMedia('logo'));
router.put(
  '/profile/banner',
  uploadSingle,
  sellerController.uploadShopMedia('banner'),
);
router.delete('/profile/banner', sellerController.removeShopMedia('banner'));

// ---------------------------------------------------------------------
// Phase 6: Seller-owned product management.
// Real enforcement is requireApprovedSeller(), called inside every seller
// product controller method: it resolves the caller's SellerProfile from
// req.user.id and requires status APPROVED (401 unauthenticated via the
// router-level authenticate, 404 no profile, 403 PENDING/REJECTED/SUSPENDED).
// Ownership for every product operation derives from that profile —
// never from the client.
// ---------------------------------------------------------------------
const sellerProductRouter = Router();

sellerProductRouter.get(
  '/products',
  listSellerProductsValidation,
  validate,
  sellerProductController.listProducts.bind(sellerProductController),
);
sellerProductRouter.get(
  '/products/:id',
  sellerProductIdParam,
  validate,
  sellerProductController.getProduct.bind(sellerProductController),
);
sellerProductRouter.post(
  '/products',
  createSellerProductValidation,
  validate,
  sellerProductController.createProduct.bind(sellerProductController),
);
sellerProductRouter.put(
  '/products/:id',
  sellerProductIdParam,
  updateSellerProductValidation,
  validate,
  sellerProductController.updateProduct.bind(sellerProductController),
);
sellerProductRouter.delete(
  '/products/:id',
  sellerProductIdParam,
  validate,
  sellerProductController.deleteProduct.bind(sellerProductController),
);

// Image management — same handlers as admin, gated by product ownership.
sellerProductRouter.post(
  '/products/:id/images',
  sellerProductIdParam,
  validate,
  uploadSingle,
  sellerProductController.uploadImage.bind(sellerProductController),
);
sellerProductRouter.delete(
  '/products/:id/images/:imageId',
  sellerProductIdParam,
  validate,
  sellerProductController.deleteImage.bind(sellerProductController),
);
sellerProductRouter.put(
  '/products/:id/images/reorder',
  sellerProductIdParam,
  validate,
  sellerProductController.reorderImages.bind(sellerProductController),
);
// Registered after /reorder so "reorder" is never captured as an imageId.
sellerProductRouter.put(
  '/products/:id/images/:imageId/primary',
  sellerProductIdParam,
  validate,
  sellerProductController.setPrimaryImage.bind(sellerProductController),
);

router.use(sellerProductRouter);

// ---------------------------------------------------------------------
// Phase 7: Seller conversations. requireApprovedSeller() resolves the
// caller's APPROVED SellerProfile from req.user.id; every conversation is
// scoped to that profile — the seller can never read/reply to a conversation
// owned by another store.
// ---------------------------------------------------------------------
const sellerConversationRouter = Router();

sellerConversationRouter.get(
  '/conversations',
  messageController.listMyConversations.bind(messageController),
);
sellerConversationRouter.get(
  '/conversations/:id/messages',
  messageController.getSellerMessages.bind(messageController),
);
sellerConversationRouter.post(
  '/conversations/:id/messages',
  sendMessageValidation,
  validate,
  messageController.sendSellerReply.bind(messageController),
);
sellerConversationRouter.patch(
  '/conversations/:id/read',
  messageController.markSellerConversationRead.bind(messageController),
);

router.use(sellerConversationRouter);

// Order requests for seller
router.get('/order-requests', messageController.getOrderRequests.bind(messageController));
router.post('/order-requests/:id/confirm', confirmOrderRequestValidation, messageController.confirmOrderRequest.bind(messageController));
router.post('/order-requests/:id/decline', declineOrderRequestValidation, messageController.declineOrderRequest.bind(messageController));
router.get('/orders', messageController.getSellerOrders.bind(messageController));
router.get('/orders/:id', sellerOrderIdValidation, messageController.getSellerOrderById.bind(messageController));

// Seller payment methods (payout methods)
router.get('/payment-methods', sellerController.listPaymentMethods.bind(sellerController));
router.post('/payment-methods', addPaymentMethodValidation, sellerController.addPaymentMethod.bind(sellerController));
router.put('/payment-methods/:id', updatePaymentMethodValidation, sellerController.updatePaymentMethod.bind(sellerController));
router.delete('/payment-methods/:id', paymentMethodIdValidation, sellerController.deletePaymentMethod.bind(sellerController));

// Store-scoped sales report (revenue, orders, best sellers) for a date window.
// The window defaults to the last 30 days server-side; the seller is always
// resolved from the authenticated user, never from the query string.
router.get('/sales', sellerSalesReportValidation, sellerController.getSalesReport.bind(sellerController));

export default router;
