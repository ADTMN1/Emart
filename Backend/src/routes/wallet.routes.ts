import { Router } from 'express';
import walletController from '../controllers/wallet.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validator';
import {
  depositValidation,
  withdrawValidation,
  transactionQueryValidation,
} from '../middleware/validations/wallet.validation';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Wallet management.
// Reads stay open to any authenticated account on purpose: the Seller Center
// Payments page and the seller overview KPI read the very same wallet, and
// §10 of the role-separation rules forbids touching seller functionality.
// Moving money in/out is a buyer action, so those two routes are CUSTOMER-only.
router.get('/', walletController.getWallet);
router.get('/balance', walletController.getBalance);

// Transactions
router.post('/deposit', authorize('CUSTOMER'), depositValidation, validate, walletController.deposit);
router.post('/withdraw', authorize('CUSTOMER'), withdrawValidation, validate, walletController.withdraw);

// Transaction history
router.get('/transactions', transactionQueryValidation, validate, walletController.getTransactions);
router.get('/transactions/:id', walletController.getTransaction);

export default router;
