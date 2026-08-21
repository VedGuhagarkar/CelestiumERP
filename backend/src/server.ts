import { createApp } from './app.js';
import { config } from './config/app.config.js';
import { logger } from './config/logger.config.js';
import { connectDatabase, disconnectDatabase } from './config/database.config.js';
import http from 'http';

async function bootstrap() {
  try {
    logger.info(`🚀 Starting Astralis ERP Backend Server in [${config.app.env}] mode...`);

    // 1. Initialize MongoDB Connection
    await connectDatabase();

    // 2. Instantiate Express App
    const app = createApp();
    const server = http.createServer(app);

    // 3. Start HTTP Listener
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`✨ Astralis API listening at http://${config.server.host}:${config.server.port}${config.app.apiPrefix}`);
      logger.info(`🩺 Health check accessible at http://${config.server.host}:${config.server.port}${config.app.apiPrefix}/health`);
    });

    // 4. Graceful Shutdown Handlers
    const shutdown = async (signal: string) => {
      logger.warn(`🛑 Received ${signal}. Commencing graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force terminate if graceful shutdown hangs
      setTimeout(() => {
        logger.error('⚠️ Forcefully terminating after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Fatal error during server bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
