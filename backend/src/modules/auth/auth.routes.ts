import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './auth.validator.js';
import { asyncHandler } from '../../core/middleware/async-handler.middleware.js';

export const authRouter = Router();

// Public Authentication Endpoints
authRouter.post('/register', validateRequest(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validateRequest(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh-token', validateRequest(refreshTokenSchema), asyncHandler(authController.refreshToken));
authRouter.post('/refresh', validateRequest(refreshTokenSchema), asyncHandler(authController.refreshToken));
authRouter.post('/forgot-password', validateRequest(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', validateRequest(resetPasswordSchema), asyncHandler(authController.resetPassword));

// Protected Identity & Session Endpoints
authRouter.get('/me', authenticateJwt, asyncHandler(authController.getMe));
authRouter.post('/logout', authenticateJwt, asyncHandler(authController.logout));
authRouter.post('/revoke-all-sessions', authenticateJwt, asyncHandler(authController.revokeAllSessions));
