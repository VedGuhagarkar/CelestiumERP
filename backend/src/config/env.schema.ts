import { z } from 'zod';

/**
 * Known insecure development placeholder patterns to reject in production
 */
const INSECURE_SECRET_PATTERNS = [
  'astralis_dev',
  'astralis_test',
  'super_secret',
  'replace_with',
  'change_me',
  'default_secret',
  '1234567890'
];

/**
 * Strict Environment Variable Validation Schema
 */
export const rawEnvSchema = z
  .object({
    // 1. Application & Runtime
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().default('Astralis ERP'),
    APP_VERSION: z.string().default('1.0.0'),
    API_PREFIX: z.string().default('/api/v1'),

    // 2. Server & Networking
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    HOST: z.string().default('0.0.0.0'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // 3. Database (MongoDB)
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default('mongodb://127.0.0.1:27017/astralis_erp_dev'),
    DB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
    DB_MIN_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
    DB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(5000),

    // 4. Authentication & JWT Security
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(16).default(12),
    PASSWORD_RESET_TOKEN_EXPIRES_IN_MS: z.coerce.number().int().default(3600000), // 1 hour

    // 5. Tenant Defaults
    DEFAULT_TENANT_ID: z.string().min(1).default('tenant_default_001'),
    ENABLE_MULTI_TENANT_ISOLATION: z
      .string()
      .transform((val) => val === 'true')
      .default('true'),

    // 6. Structured Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('debug'),

    // 7. Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000), // 15 mins
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(1000),

    // 8. Heat-Treatment Feature Flags (Runtime initial switches)
    ENABLE_AMS_2750G_PYROMETRY: z
      .string()
      .transform((val) => val === 'true')
      .default('true'),
    ENABLE_REALTIME_PLC_TELEMETRY: z
      .string()
      .transform((val) => val === 'true')
      .default('false'),
    ENABLE_AUTO_COC_GENERATION: z
      .string()
      .transform((val) => val === 'true')
      .default('true')
  })
  .superRefine((data, ctx) => {
    // Cross-field constraint: Access and Refresh tokens must NEVER be identical
    if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'Security risk: JWT_REFRESH_SECRET must not be identical to JWT_SECRET'
      });
    }

    // Production-specific hardening rules
    if (data.NODE_ENV === 'production') {
      // Secret entropy & placeholder check
      const secretLower = data.JWT_SECRET.toLowerCase();
      const refreshLower = data.JWT_REFRESH_SECRET.toLowerCase();

      if (INSECURE_SECRET_PATTERNS.some((pattern) => secretLower.includes(pattern))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'FATAL: Insecure development placeholder detected in JWT_SECRET for production environment'
        });
      }

      if (INSECURE_SECRET_PATTERNS.some((pattern) => refreshLower.includes(pattern))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'FATAL: Insecure development placeholder detected in JWT_REFRESH_SECRET for production environment'
        });
      }

      // Production CORS security check: Reject wildcard
      if (data.CORS_ORIGIN === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'Security risk: Wildcard CORS_ORIGIN (*) is prohibited in production'
        });
      }

      // Production Database Host check: Warn/block localhost unless forced
      if (data.MONGODB_URI.includes('127.0.0.1') || data.MONGODB_URI.includes('localhost')) {
        // Warning issue for production running on loopback
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MONGODB_URI'],
          message: 'Production configuration warning: MONGODB_URI points to localhost/loopback'
        });
      }
    }
  });

export type RawEnv = z.infer<typeof rawEnvSchema>;
