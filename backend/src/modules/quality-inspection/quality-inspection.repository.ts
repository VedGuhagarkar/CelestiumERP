import {
  QualityInspectionDocument,
  QualityInspectionModel
} from './quality-inspection.model.js';
import {
  QueryQualityInspectionsDto,
  IQualityInspection
} from './quality-inspection.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IQualityInspectionRepository {
  create(
    tenantId: string,
    data: Partial<IQualityInspection>
  ): Promise<QualityInspectionDocument>;

  findById(
    tenantId: string,
    id: string
  ): Promise<QualityInspectionDocument | null>;

  findByInspectionNumber(
    tenantId: string,
    inspectionNumber: string
  ): Promise<QualityInspectionDocument | null>;

  findByJobId(
    tenantId: string,
    jobId: string
  ): Promise<QualityInspectionDocument[]>;

  find(
    query: Record<string, any>
  ): Promise<QualityInspectionDocument[]>;

  queryInspections(
    tenantId: string,
    filters: QueryQualityInspectionsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityInspectionDocument>>;

  generateNextInspectionNumber(tenantId: string): Promise<string>;
}

export class QualityInspectionRepository implements IQualityInspectionRepository {
  public async create(
    tenantId: string,
    data: Partial<IQualityInspection>
  ): Promise<QualityInspectionDocument> {
    return QualityInspectionModel.create({
      ...data,
      tenantId,
      isDeleted: false
    });
  }

  public async findById(
    tenantId: string,
    id: string
  ): Promise<QualityInspectionDocument | null> {
    return QualityInspectionModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findByInspectionNumber(
    tenantId: string,
    inspectionNumber: string
  ): Promise<QualityInspectionDocument | null> {
    return QualityInspectionModel.findOne({
      inspectionNumber,
      tenantId,
      isDeleted: false
    });
  }

  public async findByJobId(
    tenantId: string,
    jobId: string
  ): Promise<QualityInspectionDocument[]> {
    return QualityInspectionModel.find({
      jobId,
      tenantId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async find(
    query: Record<string, any>
  ): Promise<QualityInspectionDocument[]> {
    return QualityInspectionModel.find({
      ...query,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async queryInspections(
    tenantId: string,
    filters: QueryQualityInspectionsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityInspectionDocument>> {
    const filterQuery: Record<string, any> = {
      tenantId,
      isDeleted: false
    };

    if (filters.status) filterQuery.status = filters.status;
    if (filters.disposition) filterQuery.disposition = filters.disposition;
    if (filters.jobId) filterQuery.jobId = filters.jobId;
    if (filters.jobNumber) filterQuery.jobNumber = filters.jobNumber;
    if (filters.inspectorId) filterQuery['assignedInspector.inspectorId'] = filters.inspectorId;
    if (filters.heatLotNumber) {
      filterQuery['heatLots.heatLotNumber'] = filters.heatLotNumber;
    }

    if (filters.startDate || filters.endDate) {
      filterQuery.createdAt = {};
      if (filters.startDate) filterQuery.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) filterQuery.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      filterQuery.$or = [
        { inspectionNumber: searchRegex },
        { jobNumber: searchRegex },
        { 'customer.customerName': searchRegex },
        { 'item.itemCode': searchRegex },
        { 'specificationSnapshot.specCode': searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const sort = pagination.sort || { createdAt: -1 };

    const [items, total] = await Promise.all([
      QualityInspectionModel.find(filterQuery).sort(sort).skip(skip).limit(limit),
      QualityInspectionModel.countDocuments(filterQuery)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages
    };
  }

  public async generateNextInspectionNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INSP-${yearMonth}-`;

    const latest = await QualityInspectionModel.findOne({
      tenantId,
      inspectionNumber: { $regex: `^${prefix}` }
    })
      .sort({ inspectionNumber: -1 })
      .select('inspectionNumber')
      .lean();

    let sequence = 1;
    if (latest && (latest as any).inspectionNumber) {
      const parts = (latest as any).inspectionNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}

export const qualityInspectionRepository = new QualityInspectionRepository();
