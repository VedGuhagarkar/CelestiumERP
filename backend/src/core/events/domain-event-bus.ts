import { logger } from '../../config/logger.config.js';
import { DomainEventName } from '../constants/events.js';

/**
 * In-Memory Type-Safe Resilient Domain Event Bus with Dead-Letter Queue (DLQ)
 * Reference: CelestiumERP.md Section 1.2
 */

export interface IDomainEvent<T = any> {
  name: DomainEventName | string;
  tenantId: string;
  occurredAt: Date;
  actorId?: string;
  payload: T;
  correlationId?: string;
}

export type DomainEventHandler<T = any> = (event: IDomainEvent<T>) => Promise<void> | void;

export interface IDeadLetterEvent {
  id: string;
  event: IDomainEvent;
  error: string;
  stack?: string;
  failedAt: Date;
  retryCount: number;
  maxRetries: number;
  status: 'PENDING_RETRY' | 'FAILED_PERMANENTLY' | 'RESOLVED';
}

export class DomainEventBus {
  private static instance: DomainEventBus;
  private handlers: Map<string, Set<DomainEventHandler>> = new Map();
  private deadLetterQueue: Map<string, IDeadLetterEvent> = new Map();
  private maxRetries = 3;

  private constructor() {}

  public static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  /**
   * Subscribe an event handler to a domain event
   */
  public subscribe<T = any>(eventName: DomainEventName | string, handler: DomainEventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);
    logger.debug(`[EventBus] Subscribed handler to event: ${eventName}`);
  }

  /**
   * Unsubscribe an event handler
   */
  public unsubscribe(eventName: DomainEventName | string, handler: DomainEventHandler): void {
    if (this.handlers.has(eventName)) {
      this.handlers.get(eventName)!.delete(handler);
    }
  }

  /**
   * Publish a domain event asynchronously with error isolation, retry policy, and DLQ capture
   */
  public publish<T = any>(event: IDomainEvent<T>): void {
    const handlers = this.handlers.get(event.name);
    if (!handlers || handlers.size === 0) {
      logger.debug(`[EventBus] No handlers registered for event: ${event.name}`);
      return;
    }

    logger.info(`[EventBus] Publishing event: ${event.name} (Tenant: ${event.tenantId})`);

    // Execute handlers asynchronously with error isolation and retries
    setImmediate(async () => {
      for (const handler of handlers) {
        await this.executeHandlerWithRetry(handler, event);
      }
    });
  }

  private async executeHandlerWithRetry<T = any>(
    handler: DomainEventHandler<T>,
    event: IDomainEvent<T>
  ): Promise<void> {
    let attempts = 0;
    let lastError: any = null;

    while (attempts < this.maxRetries) {
      attempts++;
      try {
        await handler(event);
        return; // Success
      } catch (error: any) {
        lastError = error;
        logger.warn(
          `[EventBus] Handler attempt ${attempts}/${this.maxRetries} failed for ${event.name}: ${error.message}`
        );

        if (attempts < this.maxRetries) {
          // Linear backoff before retry (e.g. 50ms, 100ms)
          await new Promise((res) => setTimeout(res, attempts * 50));
        }
      }
    }

    // If all retries exhausted, capture in Dead Letter Queue
    const dlqId = `dlq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const deadLetter: IDeadLetterEvent = {
      id: dlqId,
      event,
      error: lastError?.message || 'Unknown handler failure',
      stack: lastError?.stack,
      failedAt: new Date(),
      retryCount: attempts,
      maxRetries: this.maxRetries,
      status: 'FAILED_PERMANENTLY'
    };

    this.deadLetterQueue.set(dlqId, deadLetter);
    logger.error(
      `[EventBus] 💥 Event ${event.name} permanently failed after ${attempts} retries. Moved to DLQ [${dlqId}]`
    );
  }

  /**
   * Returns all captured dead-letter events
   */
  public getDeadLetters(tenantId?: string): IDeadLetterEvent[] {
    const list = Array.from(this.deadLetterQueue.values());
    if (tenantId) {
      return list.filter((dlq) => dlq.event.tenantId === tenantId);
    }
    return list;
  }

  /**
   * Retries execution of a dead-letter event
   */
  public async retryDeadLetter(id: string): Promise<boolean> {
    const dlq = this.deadLetterQueue.get(id);
    if (!dlq) return false;

    const handlers = this.handlers.get(dlq.event.name);
    if (!handlers || handlers.size === 0) return false;

    try {
      for (const handler of handlers) {
        await handler(dlq.event);
      }
      dlq.status = 'RESOLVED';
      this.deadLetterQueue.delete(id);
      logger.info(`[EventBus] Successfully recovered and processed DLQ event [${id}]`);
      return true;
    } catch (error: any) {
      dlq.retryCount++;
      dlq.error = error.message;
      logger.error(`[EventBus] Manual retry failed for DLQ event [${id}]:`, error);
      return false;
    }
  }

  /**
   * Clear all dead letters
   */
  public clearDeadLetters(): void {
    this.deadLetterQueue.clear();
  }

  /**
   * Clear all handlers (used in test suites)
   */
  public clearAll(): void {
    this.handlers.clear();
    this.deadLetterQueue.clear();
  }
}

export const eventBus = DomainEventBus.getInstance();
