import {
  NonConformanceReportModel,
  CorrectivePreventiveActionModel
} from './ncr-capa.model.js';
import {
  NonConformanceReportDocument,
  CorrectivePreventiveActionDocument,
  QueryNcrsDto,
  QueryCapasDto
} from './ncr-capa.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface INcrCapaRepository {
  // NCR Operations
  createNcr(tenantId: string, data: Partial<NonConformanceReportDocument>): Promise<NonConformanceReportDocument>;
  findNcrById(tenantId: string, id: string): Promise<NonConformanceReportDocument | null>;
  findNcrByNumber(tenantId: string, ncrNumber: string): Promise<NonConformanceReportDocument | null>;
  findNcrsByInspectionId(tenantId: string, inspectionId: string): Promise<NonConformanceReportDocument[]>;
  findNcrsByJobId(tenantId: string, jobId: string): Promise<NonConformanceReportDocument[]>;
  queryNcrs(
    tenantId: string,
    query: QueryNcrsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<NonConformanceReportDocument>>;
  generateNextNcrNumber(tenantId: string): Promise<string>;

  // CAPA Operations
  createCapa(tenantId: string, data: Partial<CorrectivePreventiveActionDocument>): Promise<CorrectivePreventiveActionDocument>;
  findCapaById(tenantId: string, id: string): Promise<CorrectivePreventiveActionDocument | null>;
  findCapaByNumber(tenantId: string, capaNumber: string): Promise<CorrectivePreventiveActionDocument | null>;
  findCapasByNcrId(tenantId: string, ncrId: string): Promise<CorrectivePreventiveActionDocument[]>;
  queryCapas(
    tenantId: string,
    query: QueryCapasDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CorrectivePreventiveActionDocument>>;
  generateNextCapaNumber(tenantId: string): Promise<string>;
}

export class NcrCapaRepository implements INcrCapaRepository {
  public async createNcr(
    tenantId: string,
    data: Partial<NonConformanceReportDocument>
  ): Promise<NonConformanceReportDocument> {
    const ncr = new NonConformanceReportModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await ncr.save();
  }

  public async findNcrById(tenantId: string, id: string): Promise<NonConformanceReportDocument | null> {
    return await NonConformanceReportModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findNcrByNumber(tenantId: string, ncrNumber: string): Promise<NonConformanceReportDocument | null> {
    return await NonConformanceReportModel.findOne({
      tenantId,
      ncrNumber,
      isDeleted: false
    });
  }

  public async findNcrsByInspectionId(tenantId: string, inspectionId: string): Promise<NonConformanceReportDocument[]> {
    return await NonConformanceReportModel.find({
      tenantId,
      inspectionId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async findNcrsByJobId(tenantId: string, jobId: string): Promise<NonConformanceReportDocument[]> {
    return await NonConformanceReportModel.find({
      tenantId,
      jobId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async queryNcrs(
    tenantId: string,
    query: QueryNcrsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<NonConformanceReportDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.status) filter.status = query.status;
    if (query.defectType) filter.defectType = query.defectType;
    if (query.defectSeverity) filter.defectSeverity = query.defectSeverity;
    if (query.jobId) filter.jobId = query.jobId;
    if (query.inspectionId) filter.inspectionId = query.inspectionId;
    if (query.customerCode) filter['customer.customerCode'] = query.customerCode;
    if (typeof query.requiresCapa === 'boolean') filter.requiresCapa = query.requiresCapa;

    if (query.search) {
      filter.$or = [
        { ncrNumber: { $regex: query.search, $options: 'i' } },
        { jobNumber: { $regex: query.search, $options: 'i' } },
        { defectDescription: { $regex: query.search, $options: 'i' } },
        { 'customer.customerName': { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await NonConformanceReportModel.countDocuments(filter);
    const sort = pagination.sort || { createdAt: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await NonConformanceReportModel.find(filter)
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

  public async generateNextNcrNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `NCR-${yearMonth}-`;

    const latest = await NonConformanceReportModel.findOne({
      tenantId,
      ncrNumber: { $regex: `^${prefix}` }
    })
      .sort({ ncrNumber: -1 })
      .select('ncrNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).ncrNumber) {
      const parts = (latest as any).ncrNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- CAPA Methods ---

  public async createCapa(
    tenantId: string,
    data: Partial<CorrectivePreventiveActionDocument>
  ): Promise<CorrectivePreventiveActionDocument> {
    const capa = new CorrectivePreventiveActionModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await capa.save();
  }

  public async findCapaById(tenantId: string, id: string): Promise<CorrectivePreventiveActionDocument | null> {
    return await CorrectivePreventiveActionModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findCapaByNumber(tenantId: string, capaNumber: string): Promise<CorrectivePreventiveActionDocument | null> {
    return await CorrectivePreventiveActionModel.findOne({
      tenantId,
      capaNumber,
      isDeleted: false
    });
  }

  public async findCapasByNcrId(tenantId: string, ncrId: string): Promise<CorrectivePreventiveActionDocument[]> {
    return await CorrectivePreventiveActionModel.find({
      tenantId,
      ncrId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }

  public async queryCapas(
    tenantId: string,
    query: QueryCapasDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CorrectivePreventiveActionDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.ncrId) filter.ncrId = query.ncrId;

    if (query.search) {
      filter.$or = [
        { capaNumber: { $regex: query.search, $options: 'i' } },
        { ncrNumber: { $regex: query.search, $options: 'i' } },
        { title: { $regex: query.search, $options: 'i' } },
        { problemStatement: { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await CorrectivePreventiveActionModel.countDocuments(filter);
    const sort = pagination.sort || { createdAt: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await CorrectivePreventiveActionModel.find(filter)
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

  public async generateNextCapaNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `CAPA-${yearMonth}-`;

    const latest = await CorrectivePreventiveActionModel.findOne({
      tenantId,
      capaNumber: { $regex: `^${prefix}` }
    })
      .sort({ capaNumber: -1 })
      .select('capaNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).capaNumber) {
      const parts = (latest as any).capaNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

export const ncrCapaRepository = new NcrCapaRepository();
