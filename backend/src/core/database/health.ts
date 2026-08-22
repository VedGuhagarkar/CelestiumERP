import mongoose from 'mongoose';
import { dbConnection } from './connection.js';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectionState: 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'uninitialized';
  pingLatencyMs?: number;
  databaseName?: string;
  host?: string;
  port?: number;
  error?: string;
}

/**
 * Executes a deep ping check against MongoDB and measures round-trip latency
 */
export async function getDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const connectionState = dbConnection.getConnectionStateName();

  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      status: 'unhealthy',
      connectionState,
      error: 'Database connection is not open'
    };
  }

  try {
    const startTime = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingLatencyMs = Date.now() - startTime;

    return {
      status: pingLatencyMs > 200 ? 'degraded' : 'healthy',
      connectionState,
      pingLatencyMs,
      databaseName: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      connectionState,
      error: error.message || 'Database ping command failed'
    };
  }
}
