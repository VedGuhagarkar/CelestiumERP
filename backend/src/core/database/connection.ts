import mongoose, { Connection } from 'mongoose';
import { config } from '../../config/app.config.js';
import { logger } from '../../config/logger.config.js';

export interface DatabaseConnectionOptions {
  maxRetries?: number;
  retryInitialDelayMs?: number;
  retryMaxDelayMs?: number;
}

export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private isConnecting = false;
  private isShuttingDown = false;

  private constructor() {
    this.setupMongooseGlobalSettings();
    this.setupConnectionEventListeners(mongoose.connection);
  }

  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Configures global Mongoose driver defaults
   */
  private setupMongooseGlobalSettings(): void {
    mongoose.set('strictQuery', true);
    mongoose.set('autoIndex', config.database.autoIndex);
  }

  /**
   * Registers lifecycle event listeners on the active Mongoose connection
   */
  private setupConnectionEventListeners(connection: Connection): void {
    connection.on('connecting', () => {
      logger.info('⏳ Connecting to MongoDB...');
    });

    connection.on('connected', () => {
      logger.info(
        `✅ MongoDB connection established: ${connection.host}:${connection.port}/${connection.name}`
      );
    });

    connection.on('open', () => {
      logger.info('🔓 MongoDB connection stream opened ready for operations');
    });

    connection.on('disconnecting', () => {
      logger.warn('⚠️ MongoDB connection disconnecting...');
    });

    connection.on('disconnected', () => {
      if (!this.isShuttingDown) {
        logger.warn('⚠️ MongoDB connection lost. Driver will attempt automatic reconnection.');
      }
    });

    connection.on('reconnected', () => {
      logger.info('🔄 MongoDB connection successfully reconnected');
    });

    connection.on('error', (err: Error) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    connection.on('close', () => {
      logger.info('🔒 MongoDB connection closed cleanly');
    });
  }

  /**
   * Connects to MongoDB with retry and exponential backoff
   */
  public async connect(options: DatabaseConnectionOptions = {}): Promise<typeof mongoose> {
    if (this.isConnected()) {
      logger.debug('MongoDB already connected');
      return mongoose;
    }

    if (this.isConnecting) {
      logger.warn('MongoDB connection attempt already in progress');
      return mongoose;
    }

    this.isConnecting = true;
    const maxRetries = options.maxRetries ?? 5;
    const initialDelay = options.retryInitialDelayMs ?? 1000;
    const maxDelay = options.retryMaxDelayMs ?? 10000;

    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxRetries) {
      attempt++;
      try {
        logger.info(`Connecting to MongoDB (Attempt ${attempt}/${maxRetries})...`);

        const conn = await mongoose.connect(config.database.uri, {
          serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMs,
          maxPoolSize: config.database.maxPoolSize,
          minPoolSize: config.database.minPoolSize,
          autoIndex: config.database.autoIndex
        });

        this.isConnecting = false;
        return conn;
      } catch (error: any) {
        logger.error(`❌ MongoDB connection attempt ${attempt} failed: ${error.message}`);

        if (attempt >= maxRetries) {
          this.isConnecting = false;
          logger.error('💥 All MongoDB connection attempts exhausted. Failing startup.');
          throw error;
        }

        logger.info(`Retrying MongoDB connection in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay);
      }
    }

    this.isConnecting = false;
    throw new Error('Failed to connect to MongoDB');
  }

  /**
   * Disconnects cleanly with timeout protection
   */
  public async disconnect(timeoutMs = 5000): Promise<void> {
    if (mongoose.connection.readyState === 0) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Closing MongoDB connection cleanly...');

    try {
      const disconnectPromise = mongoose.disconnect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MongoDB disconnect timed out')), timeoutMs)
      );

      await Promise.race([disconnectPromise, timeoutPromise]);
      logger.info('✅ MongoDB connection closed gracefully');
    } catch (error) {
      logger.error('Error during MongoDB disconnect:', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Checks if MongoDB connection is open and ready
   */
  public isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Returns current readyState as human-readable string
   */
  public getConnectionStateName(): 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'uninitialized' {
    switch (mongoose.connection.readyState) {
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      case 3:
        return 'disconnecting';
      case 0:
        return 'disconnected';
      default:
        return 'uninitialized';
    }
  }

  /**
   * Raw Mongoose connection object
   */
  public getConnection(): Connection {
    return mongoose.connection;
  }
}

export const dbConnection = DatabaseConnectionManager.getInstance();
