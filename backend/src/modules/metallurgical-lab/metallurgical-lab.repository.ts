import {
  LaboratoryTestRecordDocument,
  LaboratoryTestRecordModel
} from './metallurgical-lab.model.js';
import {
  QueryLabTestRecordsDto,
  ILaboratoryTestRecord
} from './metallurgical-lab.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IMetallurgicalLabRepository {
  create(
    tenantId: string,
    data: Partial<ILaboratoryTestRecord>
  ): Promise<LaboratoryTestRecordDocument>;

  findById(
    tenantId: string,
    id: string
  ): Promise<LaboratoryTestRecordDocument | null>;

  findByRecordNumber(
    tenantId: string,
    recordNumber: string
  ): Promise<LaboratoryTestRecordDocument | null>;

  findByInspectionId(
    tenantId: string,
    inspectionId: string
  ): Promise<LaboratoryTestRecordDocument[]>;

  findByJobId(
    tenantId: string,
    jobId: string
  ): Promise<LaboratoryTestRecordDocument[]>;

  queryRecords(
    tenantId: string,
    filters: QueryLabTestRecordsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<LaboratoryTestRecordDocument>>;

  generateNextRecordNumber(tenantId: string): Promise<string>;
}

export class MetallurgicalLabRepository implements IMetallurgicalLabRepository {
  public async create(
    tenantId: string,
    data: Partial<ILaboratoryTestRecord>
  ): Promise<LaboratoryTestRecordDocument> {
    return LaboratoryTestRecordModel.create({
      ...data,
      tenantId,
      isDeleted: false
    });
  }

  public async findById(
    tenantId: string,
    id: string
  ): Promise<LaboratoryTestRecordDocument | null> {
    return LaboratoryTestRecordModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findByRecordNumber(
    tenantId: string,
    recordNumber: string
  ): Promise<LaboratoryTestRecordDocument | null> {
    return LaboratoryTestRecordModel.findOne({
      recordNumber,
      tenantId,
      isDeleted: false
    });
  }

  public async findByInspectionId(
    tenantId: string,
    inspectionId: string
  ): Promise<LaboratoryTestRecordDocument[]> {
    return LaboratoryTestRecordModel.find({
      inspectionId,
      tenantId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async findByJobId(
    tenantId: string,
    jobId: string
  ): Promise<LaboratoryTestRecordDocument[]> {
    return LaboratoryTestRecordModel.find({
      jobId,
      tenantId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async queryRecords(
    tenantId: string,
    filters: QueryLabTestRecordsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<LaboratoryTestRecordDocument>> {
    const filterQuery: Record<string, any> = {
      tenantId,
      isDeleted: false
    };

    if (filters.inspectionId) filterQuery.inspectionId = filters.inspectionId;
    if (filters.inspectionNumber) filterQuery.inspectionNumber = filters.inspectionNumber;
    if (filters.jobId) filterQuery.jobId = filters.jobId;
    if (filters.jobNumber) filterQuery.jobNumber = filters.jobNumber;
    if (filters.heatLotNumber) filterQuery.heatLotNumber = filters.heatLotNumber;
    if (filters.status) filterQuery.status = filters.status;

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      filterQuery.$or = [
        { recordNumber: searchRegex },
        { inspectionNumber: searchRegex },
        { jobNumber: searchRegex },
        { heatLotNumber: searchRegex },
        { materialGrade: searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const sort = pagination.sort || { createdAt: -1 };

    const [items, total] = await Promise.all([
      LaboratoryTestRecordModel.find(filterQuery).sort(sort).skip(skip).limit(limit),
      LaboratoryTestRecordModel.countDocuments(filterQuery)
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

  public async generateNextRecordNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `LAB-${yearMonth}-`;

    const latest = await LaboratoryTestRecordModel.findOne({
      tenantId,
      recordNumber: { $regex: `^${prefix}` }
    })
      .sort({ recordNumber: -1 })
      .select('recordNumber')
      .lean();

    let sequence = 1;
    if (latest && (latest as any).recordNumber) {
      const parts = (latest as any).recordNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}

export const metallurgicalLabRepository = new MetallurgicalLabRepository();
