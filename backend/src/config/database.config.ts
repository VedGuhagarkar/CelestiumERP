import mongoose from 'mongoose';
import { dbConnection, DatabaseConnectionOptions } from '../core/database/connection.js';

export async function connectDatabase(options?: DatabaseConnectionOptions): Promise<typeof mongoose> {
  return dbConnection.connect(options);
}

export async function disconnectDatabase(timeoutMs?: number): Promise<void> {
  return dbConnection.disconnect(timeoutMs);
}

export { dbConnection };
