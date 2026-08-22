import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { AuditLogModel, AuditLogDocument } from './audit-log.model.js';
import { AuditQueryFilters } from './audit.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IAuditLogRepository extends IBaseRepository<AuditLogDocument> {
  queryAuditLogs(
    tenantId: string,
    filters: AuditQueryFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<AuditLogDocument>>;
  findEntityHistory(tenantId: string, entityType: string, entityId: string): Promise<AuditLogDocument[]>;
}

export class AuditLogRepository extends BaseRepository<AuditLogDocument> implements IAuditLogRepository {
  constructor() {
    super(AuditLogModel);
  }

  public async queryAuditLogs(
    tenantId: string,
    filters: AuditQueryFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<AuditLogDocument>> {
    const query: Record<string, any> = {};

    if (filters.entityType) {
      query.entityType = filters.entityType;
    }
    if (filters.entityId) {
      query.entityId = filters.entityId;
    }
    if (filters.actorId) {
      query.actorId = filters.actorId;
    }
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.occurredAt = {};
      if (filters.startDate) {
        query.occurredAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.occurredAt.$lte = new Date(filters.endDate);
      }
    }

    return this.findPaginated(tenantId, query, pagination);
  }

  public async findEntityHistory(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditLogDocument[]> {
    return this.find(
      tenantId,
      { entityType, entityId },
      { sort: { occurredAt: -1 } }
    );
  }
}

export const auditLogRepository = new AuditLogRepository();
