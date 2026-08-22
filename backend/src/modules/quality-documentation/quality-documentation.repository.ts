import { QualityDocumentModel } from './quality-documentation.model.js';
import {
  QualityDocumentDocument,
  QueryQualityDocumentsDto,
  ReportType
} from './quality-documentation.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IQualityDocumentationRepository {
  create(tenantId: string, data: Partial<QualityDocumentDocument>): Promise<QualityDocumentDocument>;
  findById(tenantId: string, id: string): Promise<QualityDocumentDocument | null>;
  findByDocumentNumber(tenantId: string, documentNumber: string): Promise<QualityDocumentDocument | null>;
  findByVerificationCode(tenantId: string, code: string): Promise<QualityDocumentDocument | null>;
  findLatestByInspectionId(tenantId: string, inspectionId: string): Promise<QualityDocumentDocument | null>;
  findByJobId(tenantId: string, jobId: string): Promise<QualityDocumentDocument[]>;
  query(
    tenantId: string,
    query: QueryQualityDocumentsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityDocumentDocument>>;
  generateNextDocumentNumber(tenantId: string, type: ReportType): Promise<string>;
}

export class QualityDocumentationRepository implements IQualityDocumentationRepository {
  public async create(
    tenantId: string,
    data: Partial<QualityDocumentDocument>
  ): Promise<QualityDocumentDocument> {
    const doc = new QualityDocumentModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await doc.save();
  }

  public async findById(tenantId: string, id: string): Promise<QualityDocumentDocument | null> {
    return await QualityDocumentModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findByDocumentNumber(
    tenantId: string,
    documentNumber: string
  ): Promise<QualityDocumentDocument | null> {
    return await QualityDocumentModel.findOne({
      tenantId,
      documentNumber,
      isDeleted: false
    }).sort({ versionNumber: -1 });
  }

  public async findByVerificationCode(
    tenantId: string,
    code: string
  ): Promise<QualityDocumentDocument | null> {
    return await QualityDocumentModel.findOne({
      tenantId,
      securityVerificationCode: code,
      isDeleted: false
    });
  }

  public async findLatestByInspectionId(
    tenantId: string,
    inspectionId: string
  ): Promise<QualityDocumentDocument | null> {
    return await QualityDocumentModel.findOne({
      tenantId,
      inspectionId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async findByJobId(tenantId: string, jobId: string): Promise<QualityDocumentDocument[]> {
    return await QualityDocumentModel.find({
      tenantId,
      jobId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async query(
    tenantId: string,
    query: QueryQualityDocumentsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityDocumentDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.reportType) filter.reportType = query.reportType;
    if (query.status) filter.status = query.status;
    if (query.jobId) filter.jobId = query.jobId;
    if (query.inspectionId) filter.inspectionId = query.inspectionId;
    if (query.customerCode) filter['customer.customerCode'] = query.customerCode;

    if (query.search) {
      filter.$or = [
        { documentNumber: { $regex: query.search, $options: 'i' } },
        { jobNumber: { $regex: query.search, $options: 'i' } },
        { inspectionNumber: { $regex: query.search, $options: 'i' } },
        { 'customer.customerName': { $regex: query.search, $options: 'i' } },
        { securityVerificationCode: { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await QualityDocumentModel.countDocuments(filter);
    const sort = pagination.sort || { createdAt: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await QualityDocumentModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextDocumentNumber(tenantId: string, type: ReportType): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = type === 'CERTIFICATE_OF_CONFORMANCE' ? `COC-${yearMonth}-` : `TR-${yearMonth}-`;

    const latest = await QualityDocumentModel.findOne({
      tenantId,
      documentNumber: { $regex: `^${prefix}` }
    })
      .sort({ documentNumber: -1 })
      .select('documentNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).documentNumber) {
      const parts = (latest as any).documentNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

export const qualityDocumentationRepository = new QualityDocumentationRepository();
