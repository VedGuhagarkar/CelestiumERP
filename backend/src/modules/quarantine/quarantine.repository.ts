import { QuarantineRecordModel, QuarantineRecordDocument } from './quarantine.model.js';
import {
  IQuarantineRecord,
  QuarantineTargetType,
  QuarantineFilterQuery
} from './quarantine.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IQuarantineRepository {
  createQuarantine(tenantId: string, data: Partial<IQuarantineRecord>): Promise<QuarantineRecordDocument>;
  findQuarantineById(tenantId: string, id: string): Promise<QuarantineRecordDocument | null>;
  findQuarantineByNumber(tenantId: string, quarantineNumber: string): Promise<QuarantineRecordDocument | null>;
  findActiveQuarantineForTarget(
    tenantId: string,
    targetType: QuarantineTargetType,
    targetIdentifier: string
  ): Promise<QuarantineRecordDocument | null>;
  findActiveQuarantinesByItem(tenantId: string, itemId: string): Promise<QuarantineRecordDocument[]>;
  updateQuarantine(
    tenantId: string,
    id: string,
    data: Partial<IQuarantineRecord>
  ): Promise<QuarantineRecordDocument | null>;
  searchQuarantines(
    tenantId: string,
    filters: QuarantineFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QuarantineRecordDocument>>;
  generateQuarantineNumber(tenantId: string): Promise<string>;
}

export class QuarantineRepository implements IQuarantineRepository {
  public async createQuarantine(
    tenantId: string,
    data: Partial<IQuarantineRecord>
  ): Promise<QuarantineRecordDocument> {
    const quarantineNumber = data.quarantineNumber || (await this.generateQuarantineNumber(tenantId));

    return QuarantineRecordModel.create({
      ...data,
      tenantId,
      quarantineNumber,
      targetIdentifier: data.targetIdentifier?.toUpperCase(),
      itemCode: data.itemCode?.toUpperCase(),
      status: 'ACTIVE_QUARANTINE',
      isDeleted: false
    });
  }

  public async findQuarantineById(
    tenantId: string,
    id: string
  ): Promise<QuarantineRecordDocument | null> {
    return QuarantineRecordModel.findOne({ tenantId, _id: id, isDeleted: false });
  }

  public async findQuarantineByNumber(
    tenantId: string,
    quarantineNumber: string
  ): Promise<QuarantineRecordDocument | null> {
    return QuarantineRecordModel.findOne({
      tenantId,
      quarantineNumber: quarantineNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findActiveQuarantineForTarget(
    tenantId: string,
    targetType: QuarantineTargetType,
    targetIdentifier: string
  ): Promise<QuarantineRecordDocument | null> {
    return QuarantineRecordModel.findOne({
      tenantId,
      targetType,
      targetIdentifier: targetIdentifier.toUpperCase(),
      status: 'ACTIVE_QUARANTINE',
      isDeleted: false
    });
  }

  public async findActiveQuarantinesByItem(
    tenantId: string,
    itemId: string
  ): Promise<QuarantineRecordDocument[]> {
    return QuarantineRecordModel.find({
      tenantId,
      itemId,
      status: 'ACTIVE_QUARANTINE',
      isDeleted: false
    }).exec();
  }

  public async updateQuarantine(
    tenantId: string,
    id: string,
    data: Partial<IQuarantineRecord>
  ): Promise<QuarantineRecordDocument | null> {
    return QuarantineRecordModel.findOneAndUpdate(
      { tenantId, _id: id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  public async searchQuarantines(
    tenantId: string,
    filters: QuarantineFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QuarantineRecordDocument>> {
    const query: Record<string, any> = { tenantId, isDeleted: false };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { quarantineNumber: searchRegex },
        { targetIdentifier: searchRegex },
        { itemCode: searchRegex },
        { reasonDescription: searchRegex },
        { triggerReferenceNumber: searchRegex }
      ];
    }

    if (filters.targetType) {
      query.targetType = filters.targetType;
    }

    if (filters.targetIdentifier) {
      query.targetIdentifier = filters.targetIdentifier.toUpperCase();
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.itemCode) {
      query.itemCode = filters.itemCode.toUpperCase();
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.reasonCode) {
      query.reasonCode = filters.reasonCode;
    }

    if (filters.triggerSource) {
      query.triggerSource = filters.triggerSource;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      QuarantineRecordModel.find(query)
        .sort({ initiatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      QuarantineRecordModel.countDocuments(query).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateQuarantineNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const prefix = `QRN-${year}-`;

    const count = await QuarantineRecordModel.countDocuments({
      tenantId,
      quarantineNumber: new RegExp(`^${prefix}`)
    }).exec();

    const sequence = String(count + 1).padStart(5, '0');
    return `${prefix}${sequence}`;
  }
}

export const quarantineRepository = new QuarantineRepository();
