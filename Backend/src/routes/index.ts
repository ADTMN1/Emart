import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import aiRoutes from './ai.routes';
import walletRoutes from './wallet.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import favoriteRoutes from './favorite.routes';
import sellerRoutes from './seller.routes';
import sellerDocumentRoutes from './seller-document.routes';
import notificationRoutes from './notification.routes';
import supportMessageRoutes from './supportMessage.routes';
import cjSupplierRoutes from './cj-supplier.routes';
import loanRoutes from './loan.routes';
import adminLoanRoutes from './admin-loan.routes';

const router = Router();

// API routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/ai', aiRoutes);
router.use('/wallet', walletRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/seller', sellerRoutes);
router.use('/seller-documents', sellerDocumentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', supportMessageRoutes);
router.use('/admin/suppliers/cj', cjSupplierRoutes);
router.use('/loans', loanRoutes);
router.use('/admin/loans', adminLoanRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
