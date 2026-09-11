import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All admin routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/warehouse-packages', adminController.getWarehousePackages);
router.get('/shipments', adminController.getShipments);
router.get('/crypto-wallets', adminController.getCryptoWallets.bind(adminController));
router.post('/crypto-wallets', adminController.createCryptoWallet.bind(adminController));
router.put('/crypto-wallets/:id', adminController.updateCryptoWallet.bind(adminController));
router.delete('/crypto-wallets/:id', adminController.deleteCryptoWallet.bind(adminController));

export default router;
