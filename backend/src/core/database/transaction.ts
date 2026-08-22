import mongoose, { ClientSession } from 'mongoose';
import { logger } from '../../config/logger.config.js';

export type SessionTransactionOptions = NonNullable<Parameters<ClientSession['startTransaction']>[0]>;

export interface TransactionManagerOptions extends SessionTransactionOptions {
  maxRetries?: number;
}

/**
 * Enterprise ACID Transaction Runner
 * Executes a unit of work inside a managed MongoDB session and transaction.
 *
 * ARCHITECTURAL CONTRACT:
 * - Use for multi-document operations requiring atomic integrity across collections
 *   (e.g., Job Dispatch + Inventory Deduction + CoC Issuance).
 * - Single-document mutations in MongoDB are naturally atomic and do not need sessions.
 * - Always pass the `session` object to all repository/query operations within the callback.
 *
 * Reference: CelestiumERP.md Section 1.5 & Section 1.10
 */
export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  options: TransactionManagerOptions = {}
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction(options);

    const result = await work(session);

    await session.commitTransaction();
    return result;
  } catch (error: any) {
    logger.warn(`⚠️ Transaction aborted due to error: ${error.message}`);
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
    } catch (abortError: any) {
      logger.error('Failed to abort transaction cleanly:', abortError);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export class TransactionManager {
  /**
   * Helper to execute work in a transaction if sessions are available
   */
  public static async execute<T>(
    work: (session: ClientSession) => Promise<T>,
    options?: TransactionManagerOptions
  ): Promise<T> {
    return withTransaction(work, options);
  }
}
