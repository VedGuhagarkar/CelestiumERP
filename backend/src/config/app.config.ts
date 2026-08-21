import dotenv from 'dotenv';
import path from 'path';
import { rawEnvSchema, RawEnv } from './env.schema.js';

export interface AppConfig {
  app: {
    name: string;
    version: string;
    env: 'development' | 'test' | 'production';
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
    apiPrefix: string;
  };
  server: {
    port: number;
    host: string;
    corsOrigins: string[] | readonly string[];
  };
  database: {
    uri: string;
    maxPoolSize: number;
    minPoolSize: number;
    serverSelectionTimeoutMs: number;
    autoIndex: boolean;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshSecret: string;
    jwtRefreshExpiresIn: string;
    bcryptSaltRounds: number;
    passwordResetTokenExpiresInMs: number;
  };
  tenant: {
    defaultTenantId: string;
    enableMultiTenantIsolation: boolean;
  };
  logging: {
    level: string;
    format: 'json' | 'pretty';
    silent: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  features: {
    enableAms2750gPyrometry: boolean;
    enableRealtimePlcTelemetry: boolean;
    enableAutoCocGeneration: boolean;
  };
}

/**
 * Parses and maps validated raw environment variables into structured domain configuration
 */
export function buildAppConfig(raw: RawEnv): AppConfig {
  const isProduction = raw.NODE_ENV === 'production';
  const isDevelopment = raw.NODE_ENV === 'development';
  const isTest = raw.NODE_ENV === 'test';

  const corsOrigins = raw.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  const appConfig: AppConfig = {
    app: {
      name: raw.APP_NAME,
      version: raw.APP_VERSION,
      env: raw.NODE_ENV,
      isProduction,
      isDevelopment,
      isTest,
      apiPrefix: raw.API_PREFIX
    },
    server: {
      port: raw.PORT,
      host: raw.HOST,
      corsOrigins
    },
    database: {
      uri: raw.MONGODB_URI,
      maxPoolSize: raw.DB_MAX_POOL_SIZE,
      minPoolSize: raw.DB_MIN_POOL_SIZE,
      serverSelectionTimeoutMs: raw.DB_SERVER_SELECTION_TIMEOUT_MS,
      autoIndex: !isProduction
    },
    auth: {
      jwtSecret: raw.JWT_SECRET,
      jwtExpiresIn: raw.JWT_EXPIRES_IN,
      jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
      jwtRefreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
      bcryptSaltRounds: raw.BCRYPT_SALT_ROUNDS,
      passwordResetTokenExpiresInMs: raw.PASSWORD_RESET_TOKEN_EXPIRES_IN_MS
    },
    tenant: {
      defaultTenantId: raw.DEFAULT_TENANT_ID,
      enableMultiTenantIsolation: raw.ENABLE_MULTI_TENANT_ISOLATION
    },
    logging: {
      level: raw.LOG_LEVEL,
      format: isProduction ? 'json' : 'pretty',
      silent: isTest
    },
    rateLimit: {
      windowMs: raw.RATE_LIMIT_WINDOW_MS,
      maxRequests: raw.RATE_LIMIT_MAX
    },
    features: {
      enableAms2750gPyrometry: raw.ENABLE_AMS_2750G_PYROMETRY,
      enableRealtimePlcTelemetry: raw.ENABLE_REALTIME_PLC_TELEMETRY,
      enableAutoCocGeneration: raw.ENABLE_AUTO_COC_GENERATION
    }
  };

  // Deeply freeze configuration object to prevent runtime mutations
  return Object.freeze({
    ...appConfig,
    app: Object.freeze(appConfig.app),
    server: Object.freeze({ ...appConfig.server, corsOrigins: Object.freeze(appConfig.server.corsOrigins) }),
    database: Object.freeze(appConfig.database),
    auth: Object.freeze(appConfig.auth),
    tenant: Object.freeze(appConfig.tenant),
    logging: Object.freeze(appConfig.logging),
    rateLimit: Object.freeze(appConfig.rateLimit),
    features: Object.freeze(appConfig.features)
  });
}

/**
 * Load, validate, and construct configuration from environment source
 */
export function loadConfig(envSource?: NodeJS.ProcessEnv): AppConfig {
  if (!envSource) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envFile = `.env.${nodeEnv}`;
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });
    dotenv.config(); // Fallback to base .env
  }

  const source = envSource || process.env;
  const parseResult = rawEnvSchema.safeParse(source);

  if (!parseResult.success) {
    console.error('\n❌ ================= FATAL CONFIGURATION ERROR =================');
    console.error('The application failed to start due to invalid or missing configuration:\n');

    parseResult.error.errors.forEach((err) => {
      const fieldPath = err.path.join('.');
      console.error(`  • [${fieldPath}]: ${err.message}`);
    });
    console.error('=================================================================\n');

    throw new Error('Application configuration validation failed');
  }

  return buildAppConfig(parseResult.data);
}

// Global active configuration singleton
export const config = loadConfig();
