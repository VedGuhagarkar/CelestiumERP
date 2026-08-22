import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;

export const registerSchema: ValidationSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, and dashes')
      .toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must not exceed 128 characters')
      .regex(passwordPattern, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    firstName: z.string().trim().min(1, 'First name is required').max(50),
    lastName: z.string().trim().min(1, 'Last name is required').max(50),
    roles: z.array(z.string().trim()).optional()
  })
};

export const loginSchema: ValidationSchema = {
  body: z.object({
    identifier: z.string().trim().min(1, 'Email or username is required').toLowerCase(),
    password: z.string().min(1, 'Password is required')
  })
};

export const refreshTokenSchema: ValidationSchema = {
  body: z.object({
    refreshToken: z.string().trim().min(1, 'Refresh token is required')
  })
};

export const forgotPasswordSchema: ValidationSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase()
  })
};

export const resetPasswordSchema: ValidationSchema = {
  body: z.object({
    token: z.string().trim().min(1, 'Reset password token is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must not exceed 128 characters')
      .regex(passwordPattern, 'Password must contain at least one uppercase letter, one lowercase letter, and one number')
  })
};
