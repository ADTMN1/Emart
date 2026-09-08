import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { authRateLimiter } from '../middleware/rateLimiter';
import { 
  registerValidation, 
  loginValidation, 
  updateProfileValidation,
  changePasswordValidation 
} from '../middleware/validations/auth.validation';

const router = Router();

// Public routes with rate limiting
router.post('/register', authRateLimiter, registerValidation, validate, authController.register);
router.post('/login', authRateLimiter, loginValidation, validate, authController.login);

// Google OAuth routes
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, updateProfileValidation, validate, authController.updateProfile);
router.post('/change-password', authenticate, changePasswordValidation, validate, authController.changePassword);
router.post('/refresh-token', authenticate, authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

export default router;
