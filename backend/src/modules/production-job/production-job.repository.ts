import { BaseRepository } from '../../core/repository/base.repository.js';
import { ProductionJobDocument, JobStatus } from './production-job.types.js';
import { ProductionJobModel } from './production-job.model.js';
import { PaginatedResult, PaginationOptions } from '../../core/types/pagination.js';

export interface IProductionJobRepository {
  generateNextJobNumber(tenantId: string): Promise<string>;
  findJobByNumber(tenantId: string, jobNumber: string): Promise<ProductionJobDocument | null>;
  findJobsByPlanId(tenantId: string, planId: string): Promise<ProductionJobDocument[]>;
  findByIdempotencyKey(
    tenantId: string,
    planId: string,
    idempotencyKey: string
  ): Promise<ProductionJobDocument | null>;
  queryJobs(
    tenantId: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductionJobDocument>>;
  findActiveQueueJobs(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findConflictingJobs(
    tenantId: string,
    furnaceId: string,
    startDate: Date,
    endDate: Date,
    excludeJobId?: string
  ): Promise<ProductionJobDocument[]>;
  findById(tenantId: string, id: string): Promise<ProductionJobDocument | null>;
  create(tenantId: string, data: Partial<ProductionJobDocument>): Promise<ProductionJobDocument>;
  updateById(tenantId: string, id: string, update: any): Promise<ProductionJobDocument | null>;
}

export class ProductionJobRepository
  extends BaseRepository<ProductionJobDocument>
  implements IProductionJobRepository
{
  constructor() {
    super(ProductionJobModel);
  }

  public async generateNextJobNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `JOB-${yearMonth}-`;

    const latest = await this.model
      .findOne({ tenantId, jobNumber: { $regex: `^${prefix}` } })
      .sort({ jobNumber: -1 })
      .exec();

    if (!latest) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latest.jobNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async findJobByNumber(
    tenantId: string,
    jobNumber: string
  ): Promise<ProductionJobDocument | null> {
    return this.model
      .findOne({ tenantId, jobNumber: jobNumber.toUpperCase(), isDeleted: false })
      .exec();
  }

  public async findJobsByPlanId(
    tenantId: string,
    planId: string
  ): Promise<ProductionJobDocument[]> {
    return this.model
      .find({ tenantId, planId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findByIdempotencyKey(
    tenantId: string,
    planId: string,
    idempotencyKey: string
  ): Promise<ProductionJobDocument | null> {
    return this.model
      .findOne({ tenantId, planId, idempotencyKey, isDeleted: false })
      .exec();
  }

  public async queryJobs(
    tenantId: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductionJobDocument>> {
    const query: any = { tenantId, isDeleted: false };

    if (filters.status) query.status = filters.status;
    if (filters.furnaceId) query['equipmentAssignment.furnaceId'] = filters.furnaceId;
    if (filters.itemCode) query['item.itemCode'] = filters.itemCode.toUpperCase();
    if (filters.planId) query.planId = filters.planId;
    if (filters.priority) query.priority = filters.priority;

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { jobNumber: searchRegex },
        { planNumber: searchRegex },
        { 'item.itemCode': searchRegex },
        { 'item.itemName': searchRegex },
        { 'customer.customerName': searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort(pagination.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query).exec()
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages
    };
  }

  public async findActiveQueueJobs(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const activeStatuses: JobStatus[] = [
      'APPROVED',
      'SCHEDULED',
      'IN_PROGRESS',
      'PAUSED',
      'QUALITY_CHECK',
      'STORAGE',
      'READY_FOR_DISPATCH'
    ];

    const query: any = {
      tenantId,
      isDeleted: false,
      status: { $in: activeStatuses }
    };

    if (filters.furnaceId) {
      query['equipmentAssignment.furnaceId'] = filters.furnaceId;
    }
    if (filters.status) {
      query.status = filters.status;
    }

    return this.model
      .find(query)
      .sort({ 'timeline.targetCompletionDate': 1, createdAt: 1 })
      .exec();
  }

  public async findConflictingJobs(
    tenantId: string,
    furnaceId: string,
    startDate: Date,
    endDate: Date,
    excludeJobId?: string
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      isDeleted: false,
      'equipmentAssignment.furnaceId': furnaceId,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'] },
      'timeline.plannedStartDate': { $lt: endDate },
      'timeline.targetCompletionDate': { $gt: startDate }
    };

    if (excludeJobId) {
      query._id = { $ne: excludeJobId };
    }

    return this.model.find(query).exec();
  }
}

export const productionJobRepository = new ProductionJobRepository();
