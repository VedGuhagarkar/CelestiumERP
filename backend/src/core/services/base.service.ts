import { logger } from '../../config/logger.config.js';
import { DomainEventBus, eventBus, IDomainEvent } from '../events/domain-event-bus.js';
import { DomainEventName } from '../constants/events.js';
import winston from 'winston';

/**
 * Base Service Convention
 * Contains core domain business logic, invariant enforcement, and domain event dispatching.
 *
 * ARCHITECTURAL CONTRACT:
 * - Services MUST contain all domain algorithms and lifecycle state transitions.
 * - Services coordinate Repositories and publish Domain Events.
 * - Services MUST NOT import Express Request/Response objects.
 * - Cross-domain synchronous communication MUST go through the other domain's Service, NOT directly into foreign Repositories.
 * Reference: CelestiumERP.md Section 1.9 & 7
 */

export abstract class BaseService {
  protected readonly logger: winston.Logger;
  protected readonly eventBus: DomainEventBus;

  protected constructor(serviceName: string) {
    this.logger = logger.child({ service: serviceName });
    this.eventBus = eventBus;
  }

  /**
   * Publish a decoupled domain event to the event bus
   */
  protected publishEvent<T = any>(
    name: DomainEventName | string,
    tenantId: string,
    payload: T,
    actorId?: string,
    correlationId?: string
  ): void {
    const event: IDomainEvent<T> = {
      name,
      tenantId,
      occurredAt: new Date(),
      actorId,
      payload,
      correlationId
    };

    this.eventBus.publish(event);
  }

  /**
   * Validate business invariant condition or throw error
   */
  protected assertInvariant(condition: boolean, error: Error): void {
    if (!condition) {
      this.logger.warn(`Business invariant violation: ${error.message}`);
      throw error;
    }
  }
}
