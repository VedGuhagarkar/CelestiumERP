import { BaseService } from '../../core/services/base.service.js';
import { IAuditLogRepository, auditLogRepository } from './audit-log.repository.js';
import {
  AuditLogDocument,
  RecordAuditOptions,
  AuditQueryFilters,
  StateDiff
} from './audit.types.js';
import { sanitizeObject } from '../../config/logger.config.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class AuditService extends BaseService {
  constructor(private readonly repo: IAuditLogRepository = auditLogRepository) {
    super('AuditService');
  }

  /**
   * Computes granular field-level differences between before and after states
   */
  public computeDiff(beforeState?: Record<string, any>, afterState?: Record<string, any>): StateDiff | undefined {
    if (!beforeState && !afterState) return undefined;
    if (!beforeState && afterState) {
      const diff: StateDiff = {};
      for (const [key, value] of Object.entries(afterState)) {
        diff[key] = { old: null, new: value };
      }
      return diff;
    }
    if (beforeState && !afterState) {
      const diff: StateDiff = {};
      for (const [key, value] of Object.entries(beforeState)) {
        diff[key] = { old: value, new: null };
      }
      return diff;
    }

    const diff: StateDiff = {};
    const allKeys = new Set([...Object.keys(beforeState!), ...Object.keys(afterState!)]);

    for (const key of allKeys) {
      const oldVal = beforeState![key];
      const newVal = afterState![key];

      // Compare JSON representations to handle nested objects/arrays
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal ?? null, new: newVal ?? null };
      }
    }

    return Object.keys(diff).length > 0 ? diff : undefined;
  }

  /**
   * Records an immutable audit log entry for regulatory and operational compliance
   */
  public async record(tenantId: string, options: RecordAuditOptions): Promise<AuditLogDocument> {
    const sanitizedBefore = options.beforeState ? sanitizeObject(options.beforeState) : null;
    const sanitizedAfter = options.afterState ? sanitizeObject(options.afterState) : null;
    const sanitizedMetadata = options.metadata ? sanitizeObject(options.metadata) : {};

    const diff = this.computeDiff(sanitizedBefore, sanitizedAfter);

    const auditEntry = await this.repo.create(tenantId, {
      actorId: options.actorId,
      actorEmail: options.actorEmail,
      actorRole: options.actorRole,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      beforeState: sanitizedBefore,
      afterState: sanitizedAfter,
      diff: diff || null,
      status: options.status || 'SUCCESS',
      errorMessage: options.errorMessage,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      correlationId: options.correlationId,
      metadata: sanitizedMetadata,
      occurredAt: new Date()
    } as any);

    this.logger.debug(
      `📋 Audit record created: [${options.action}] on [${options.entityType}:${options.entityId}] by [${options.actorEmail || options.actorId}]`
    );

    this.publishEvent('AUDIT_LOG_RECORDED', tenantId, {
      auditId: auditEntry.id,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      actorId: options.actorId
    });

    return auditEntry;
  }

  /**
   * Queries audit logs with filtering and pagination
   */
  public async queryAuditLogs(
    tenantId: string,
    filters: AuditQueryFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<AuditLogDocument>> {
    return this.repo.queryAuditLogs(tenantId, filters, pagination);
  }

  /**
   * Retrieves full chronological audit history for a specific entity
   */
  public async getEntityHistory(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditLogDocument[]> {
    return this.repo.findEntityHistory(tenantId, entityType, entityId);
  }
}

export const auditService = new AuditService();
