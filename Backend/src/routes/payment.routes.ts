import { Router } from 'express';
import paymentController from '../controllers/payment.controller';

const router = Router();
router.get('/crypto', paymentController.getCryptoConfig.bind(paymentController));
// Keep existing open browser sessions working while the client refreshes to /crypto.
router.get('/binance', paymentController.getCryptoConfig.bind(paymentController));

export default router;
