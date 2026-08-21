import mongoose from 'mongoose';
import { config } from './app.config.js';
import { logger } from './logger.config.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    mongoose.set('strictQuery', true);

    // Setup connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info(`✅ MongoDB connection established: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB connection disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB connection re-established');
    });

    const conn = await mongoose.connect(config.database.uri, {
      serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMs,
      maxPoolSize: config.database.maxPoolSize,
      minPoolSize: config.database.minPoolSize,
      autoIndex: config.database.autoIndex
    });

    return conn;
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB on startup:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed cleanly');
  } catch (error) {
    logger.error('Error while disconnecting MongoDB:', error);
  }
}
