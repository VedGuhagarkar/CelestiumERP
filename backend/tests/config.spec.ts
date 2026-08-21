import { loadConfig } from '../src/config/app.config.js';
import { rawEnvSchema } from '../src/config/env.schema.js';

describe('Centralized Configuration System & Environment Validation', () => {
  const validDevEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    PORT: '5000',
    API_PREFIX: '/api/v1',
    CORS_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/astralis_erp_dev',
    JWT_SECRET: 'a_very_secure_jwt_access_secret_key_at_least_32_characters_long_1',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'a_very_secure_jwt_refresh_secret_key_at_least_32_characters_long_2',
    JWT_REFRESH_EXPIRES_IN: '7d',
    DEFAULT_TENANT_ID: 'tenant_default_001',
    ENABLE_MULTI_TENANT_ISOLATION: 'true',
    LOG_LEVEL: 'debug',
    RATE_LIMIT_WINDOW_MS: '900000',
    RATE_LIMIT_MAX: '1000',
    ENABLE_AMS_2750G_PYROMETRY: 'true',
    ENABLE_REALTIME_PLC_TELEMETRY: 'false',
    ENABLE_AUTO_COC_GENERATION: 'true'
  };

  it('should load and structure a valid development environment configuration', () => {
    const config = loadConfig(validDevEnv);

    expect(config.app.env).toBe('development');
    expect(config.app.isDevelopment).toBe(true);
    expect(config.app.isProduction).toBe(false);
    expect(config.server.port).toBe(5000);
    expect(config.server.corsOrigins).toEqual(['http://localhost:5173']);
    expect(config.database.uri).toBe('mongodb://127.0.0.1:27017/astralis_erp_dev');
    expect(config.auth.jwtSecret).toBe(validDevEnv.JWT_SECRET);
    expect(config.auth.jwtRefreshSecret).toBe(validDevEnv.JWT_REFRESH_SECRET);
    expect(config.features.enableAms2750gPyrometry).toBe(true);
  });

  it('should guarantee that the loaded configuration object is deeply frozen / immutable', () => {
    const config = loadConfig(validDevEnv);

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.app)).toBe(true);
    expect(Object.isFrozen(config.server)).toBe(true);
    expect(Object.isFrozen(config.database)).toBe(true);
    expect(Object.isFrozen(config.auth)).toBe(true);
    expect(Object.isFrozen(config.tenant)).toBe(true);
    expect(Object.isFrozen(config.rateLimit)).toBe(true);
    expect(Object.isFrozen(config.features)).toBe(true);

    // Attempting to mutate in strict mode must throw
    expect(() => {
      (config.app as any).env = 'production';
    }).toThrow();
  });

  it('should fail validation when PORT is out of valid range (1–65535)', () => {
    const invalidPortEnv = { ...validDevEnv, PORT: '99999' };
    const result = rawEnvSchema.safeParse(invalidPortEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('PORT'))).toBe(true);
    }
  });

  it('should fail validation when JWT_SECRET is shorter than 32 characters', () => {
    const shortSecretEnv = { ...validDevEnv, JWT_SECRET: 'too_short' };
    const result = rawEnvSchema.safeParse(shortSecretEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('JWT_SECRET'))).toBe(true);
    }
  });

  it('should fail validation when JWT_SECRET and JWT_REFRESH_SECRET are identical', () => {
    const identicalSecretEnv = {
      ...validDevEnv,
      JWT_SECRET: 'identical_secret_key_that_is_at_least_32_characters_long_12345',
      JWT_REFRESH_SECRET: 'identical_secret_key_that_is_at_least_32_characters_long_12345'
    };
    const result = rawEnvSchema.safeParse(identicalSecretEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('must not be identical'))).toBe(true);
    }
  });

  it('should fail validation in production mode when insecure placeholder secrets are used', () => {
    const insecureProdEnv: NodeJS.ProcessEnv = {
      ...validDevEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'astralis_dev_super_secret_jwt_key_at_least_32_characters_long_12345',
      JWT_REFRESH_SECRET: 'real_production_refresh_token_secret_64_characters_hex_key_abcd1234',
      CORS_ORIGIN: 'https://erp.astralis.internal'
    };

    const result = rawEnvSchema.safeParse(insecureProdEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('Insecure development placeholder detected'))).toBe(true);
    }
  });

  it('should fail validation in production mode when wildcard CORS (*) is used', () => {
    const wildcardProdEnv: NodeJS.ProcessEnv = {
      ...validDevEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'production_access_token_secret_64_characters_hex_key_1234567890abcd',
      JWT_REFRESH_SECRET: 'production_refresh_token_secret_64_characters_hex_key_abcd12345678',
      CORS_ORIGIN: '*'
    };

    const result = rawEnvSchema.safeParse(wildcardProdEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('Wildcard CORS_ORIGIN (*) is prohibited'))).toBe(true);
    }
  });

  it('should successfully load a hardened production configuration with secure keys', () => {
    const secureProdEnv: NodeJS.ProcessEnv = {
      ...validDevEnv,
      NODE_ENV: 'production',
      JWT_SECRET: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      JWT_REFRESH_SECRET: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      CORS_ORIGIN: 'https://erp.astralis.internal'
    };

    const config = loadConfig(secureProdEnv);
    expect(config.app.isProduction).toBe(true);
    expect(config.logging.format).toBe('json');
    expect(config.database.autoIndex).toBe(false); // In production autoIndex is disabled for safety
  });
});
