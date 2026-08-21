import winston from 'winston';
import { config } from './app.config.js';

// Keys to mask in log output for security compliance
const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'refreshToken', 'secret', 'jwtSecret', 'authorization'];

const maskSensitiveData = winston.format((info) => {
  const mask = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(mask);

    const copy = { ...obj };
    for (const key of Object.keys(copy)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        copy[key] = '***MASKED***';
      } else if (typeof copy[key] === 'object') {
        copy[key] = mask(copy[key]);
      }
    }
    return copy;
  };

  return mask(info);
});

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    maskSensitiveData(),
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
