import { logger } from '../../config/logger.config.js';
import { DomainEventName } from '../constants/events.js';

/**
 * In-Memory Type-Safe Domain Event Bus
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

export class DomainEventBus {
  private static instance: DomainEventBus;
  private handlers: Map<string, Set<DomainEventHandler>> = new Map();

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
   * Publish a domain event asynchronously without blocking caller
   */
  public publish<T = any>(event: IDomainEvent<T>): void {
    const handlers = this.handlers.get(event.name);
    if (!handlers || handlers.size === 0) {
      logger.debug(`[EventBus] No handlers registered for event: ${event.name}`);
      return;
    }

    logger.info(`[EventBus] Publishing event: ${event.name} (Tenant: ${event.tenantId})`);

    // Execute handlers asynchronously with error isolation
    setImmediate(async () => {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          logger.error(`[EventBus] Error executing subscriber for ${event.name}:`, error);
        }
      }
    });
  }

  /**
   * Clear all handlers (used primarily in test suites)
   */
  public clearAll(): void {
    this.handlers.clear();
  }
}

export const eventBus = DomainEventBus.getInstance();
