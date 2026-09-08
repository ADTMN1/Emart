import { Router } from 'express';
import walletController from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import {
  depositValidation,
  withdrawValidation,
  transactionQueryValidation,
} from '../middleware/validations/wallet.validation';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Wallet management
router.get('/', walletController.getWallet);
router.get('/balance', walletController.getBalance);

// Transactions
router.post('/deposit', depositValidation, validate, walletController.deposit);
router.post('/withdraw', withdrawValidation, validate, walletController.withdraw);

// Transaction history
router.get('/transactions', transactionQueryValidation, validate, walletController.getTransactions);
router.get('/transactions/:id', walletController.getTransaction);

export default router;
