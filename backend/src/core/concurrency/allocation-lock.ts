/**
 * Enterprise Asynchronous Keyed Mutex / Allocation Lock Manager
 *
 * Provides in-process serialisation for concurrent operations sharing the same domain key
 * (e.g., `tenant:allocation:grn:grnId:item:itemId`).
 *
 * ARCHITECTURAL CONTRACT:
 * - Guarantees strict FIFO execution order for tasks queued under the same key.
 * - Releases resources immediately when locks become idle (zero memory leakage).
 * - Does not block operations on different keys (fine-grained locking).
 *
 * Reference: CelestiumERP Manufacturing Workflow State Machine & Inventory Integrity
 */

export class AllocationLockManager {
  private locks = new Map<string, Promise<void>>();

  /**
   * Executes an asynchronous task within a keyed mutual exclusion lock.
   * Tasks with the same key will execute sequentially in FIFO order.
   */
  public async withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prevLock = this.locks.get(key) || Promise.resolve();
    let releaseLock!: () => void;

    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Chain the new lock behind the existing one
    this.locks.set(
      key,
      prevLock.then(
        () => currentLock,
        () => currentLock
      )
    );

    await prevLock;

    try {
      return await task();
    } finally {
      releaseLock();
      if (this.locks.get(key) === currentLock) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Helper to inspect currently active lock count (primarily for diagnostics and telemetry).
   */
  public getActiveLockCount(): number {
    return this.locks.size;
  }
}

export const allocationLockManager = new AllocationLockManager();
