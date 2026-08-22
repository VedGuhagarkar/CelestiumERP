import winston from 'winston';
import { config } from './app.config.js';

// Keys to mask in log output for security compliance
export const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'resetPasswordToken',
  'secret',
  'jwtSecret',
  'jwtRefreshSecret',
  'authorization',
  'authHeader',
  'apiKey',
  'creditCard',
  'cvv',
  'pin',
  'privateKey',
  'certKey'
];

/**
 * Deeply sanitizes sensitive fields across arbitrary objects and arrays
 */
export function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const copy = { ...obj };
  for (const key of Object.keys(copy)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );
    if (isSensitive) {
      copy[key] = '***MASKED***';
    } else if (typeof copy[key] === 'object' && copy[key] !== null) {
      copy[key] = sanitizeObject(copy[key]);
    }
  }
  return copy;
}

const maskSensitiveDataFormat = winston.format((info) => {
  return sanitizeObject(info);
});

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    maskSensitiveDataFormat(),
    config.logging.format === 'json'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
          })
        )
  ),
  defaultMeta: { service: 'astralis-backend' },
  transports: [
    new winston.transports.Console({
      silent: config.logging.silent
    })
  ]
});
