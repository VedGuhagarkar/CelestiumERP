import { BaseRepository } from '../../core/repository/base.repository.js';
import { ProductionScheduleDocument } from './production-schedule.types.js';
import { ProductionScheduleModel } from './production-schedule.model.js';
import { PaginatedResult, PaginationOptions } from '../../core/types/pagination.js';

export interface IProductionScheduleRepository {
  generateNextScheduleNumber(tenantId: string): Promise<string>;
  findActiveScheduleByJobId(
    tenantId: string,
    jobId: string
  ): Promise<ProductionScheduleDocument | null>;
  findActiveSchedulesByFurnaceAndTime(
    tenantId: string,
    furnaceId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string
  ): Promise<ProductionScheduleDocument[]>;
  findActiveSchedulesByOperatorAndTime(
    tenantId: string,
    operatorId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string
  ): Promise<ProductionScheduleDocument[]>;
  querySchedules(
    tenantId: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductionScheduleDocument>>;
  findById(tenantId: string, id: string): Promise<ProductionScheduleDocument | null>;
  create(
    tenantId: string,
    data: Partial<ProductionScheduleDocument>
  ): Promise<ProductionScheduleDocument>;
  updateById(
    tenantId: string,
    id: string,
    update: any
  ): Promise<ProductionScheduleDocument | null>;
}

export class ProductionScheduleRepository
  extends BaseRepository<ProductionScheduleDocument>
  implements IProductionScheduleRepository
{
  constructor() {
    super(ProductionScheduleModel);
  }

  public async generateNextScheduleNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `SCHED-${yearMonth}-`;

    const latest = await this.model
      .findOne({ tenantId, scheduleNumber: { $regex: `^${prefix}` } })
      .sort({ scheduleNumber: -1 })
      .exec();

    if (!latest) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latest.scheduleNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async findActiveScheduleByJobId(
    tenantId: string,
    jobId: string
  ): Promise<ProductionScheduleDocument | null> {
    return this.model
      .findOne({
        tenantId,
        jobId,
        status: { $in: ['SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS'] },
        isDeleted: false
      })
      .exec();
  }

  public async findActiveSchedulesByFurnaceAndTime(
    tenantId: string,
    furnaceId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string
  ): Promise<ProductionScheduleDocument[]> {
    const query: any = {
      tenantId,
      furnaceId,
      status: { $in: ['SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isDeleted: false
    };

    if (excludeScheduleId) {
      query._id = { $ne: excludeScheduleId };
    }

    return this.model.find(query).exec();
  }

  public async findActiveSchedulesByOperatorAndTime(
    tenantId: string,
    operatorId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string
  ): Promise<ProductionScheduleDocument[]> {
    const query: any = {
      tenantId,
      operatorId,
      status: { $in: ['SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isDeleted: false
    };

    if (excludeScheduleId) {
      query._id = { $ne: excludeScheduleId };
    }

    return this.model.find(query).exec();
  }

  public async querySchedules(
    tenantId: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductionScheduleDocument>> {
    const query: any = { tenantId, isDeleted: false };

    if (filters.furnaceId) query.furnaceId = filters.furnaceId;
    if (filters.operatorId) query.operatorId = filters.operatorId;
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;

    if (filters.startDate || filters.endDate) {
      query.startTime = {};
      if (filters.startDate) query.startTime.$gte = new Date(filters.startDate);
      if (filters.endDate) query.startTime.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { scheduleNumber: searchRegex },
        { jobNumber: searchRegex },
        { planNumber: searchRegex },
        { customerName: searchRegex },
        { itemCode: searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort(pagination.sort || { startTime: 1, priority: 1 })
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
}

export const productionScheduleRepository = new ProductionScheduleRepository();
