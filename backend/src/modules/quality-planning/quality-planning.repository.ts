import {
  QualityPlanDocument,
  QualityPlanModel
} from './quality-planning.model.js';
import {
  QueryQualityPlansDto,
  IQualityPlan,
  QualityPlanStatus
} from './quality-planning.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IQualityPlanningRepository {
  create(
    tenantId: string,
    data: Partial<IQualityPlan>
  ): Promise<QualityPlanDocument>;

  findById(
    tenantId: string,
    id: string
  ): Promise<QualityPlanDocument | null>;

  findByPlanCodeAndRevision(
    tenantId: string,
    planCode: string,
    revisionNumber: number
  ): Promise<QualityPlanDocument | null>;

  findActiveApprovedRevision(
    tenantId: string,
    planCode: string
  ): Promise<QualityPlanDocument | null>;

  findApplicablePlan(
    tenantId: string,
    params: {
      processFamily: string;
      specCode: string;
      customerCode?: string;
    }
  ): Promise<QualityPlanDocument | null>;

  queryPlans(
    tenantId: string,
    filters: QueryQualityPlansDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityPlanDocument>>;

  markPreviousRevisionsObsolete(
    tenantId: string,
    planCode: string,
    currentRevision: number
  ): Promise<void>;

  generateNextPlanCode(tenantId: string, processFamily: string): Promise<string>;
}

export class QualityPlanningRepository implements IQualityPlanningRepository {
  public async create(
    tenantId: string,
    data: Partial<IQualityPlan>
  ): Promise<QualityPlanDocument> {
    return QualityPlanModel.create({
      ...data,
      tenantId,
      isDeleted: false
    });
  }

  public async findById(
    tenantId: string,
    id: string
  ): Promise<QualityPlanDocument | null> {
    return QualityPlanModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findByPlanCodeAndRevision(
    tenantId: string,
    planCode: string,
    revisionNumber: number
  ): Promise<QualityPlanDocument | null> {
    return QualityPlanModel.findOne({
      planCode: planCode.toUpperCase(),
      revisionNumber,
      tenantId,
      isDeleted: false
    });
  }

  public async findActiveApprovedRevision(
    tenantId: string,
    planCode: string
  ): Promise<QualityPlanDocument | null> {
    return QualityPlanModel.findOne({
      planCode: planCode.toUpperCase(),
      status: 'APPROVED',
      tenantId,
      isDeleted: false
    }).sort({ revisionNumber: -1 });
  }

  public async findApplicablePlan(
    tenantId: string,
    params: {
      processFamily: string;
      specCode: string;
      customerCode?: string;
    }
  ): Promise<QualityPlanDocument | null> {
    const query: Record<string, any> = {
      tenantId,
      status: 'APPROVED',
      processFamily: params.processFamily,
      specCode: params.specCode.toUpperCase(),
      isDeleted: false
    };

    if (params.customerCode) {
      // First try matching customer specific plan
      const customerPlan = await QualityPlanModel.findOne({
        ...query,
        applicableCustomerCodes: params.customerCode.toUpperCase()
      }).sort({ revisionNumber: -1 });

      if (customerPlan) return customerPlan;
    }

    // Fallback to generic plan without customer restrictions or empty customer list
    return QualityPlanModel.findOne({
      ...query,
      $or: [
        { applicableCustomerCodes: { $size: 0 } },
        { applicableCustomerCodes: { $exists: false } }
      ]
    }).sort({ revisionNumber: -1 });
  }

  public async queryPlans(
    tenantId: string,
    filters: QueryQualityPlansDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityPlanDocument>> {
    const filterQuery: Record<string, any> = {
      tenantId,
      isDeleted: false
    };

    if (filters.status) filterQuery.status = filters.status;
    if (filters.processFamily) filterQuery.processFamily = filters.processFamily;
    if (filters.specCode) filterQuery.specCode = filters.specCode.toUpperCase();
    if (filters.specificationId) filterQuery.specificationId = filters.specificationId;
    if (filters.customerCode) {
      filterQuery.applicableCustomerCodes = filters.customerCode.toUpperCase();
    }

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      filterQuery.$or = [
        { planCode: searchRegex },
        { title: searchRegex },
        { specCode: searchRegex },
        { description: searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const sort = pagination.sort || { createdAt: -1 };

    const [items, total] = await Promise.all([
      QualityPlanModel.find(filterQuery).sort(sort).skip(skip).limit(limit),
      QualityPlanModel.countDocuments(filterQuery)
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

  public async markPreviousRevisionsObsolete(
    tenantId: string,
    planCode: string,
    currentRevision: number
  ): Promise<void> {
    await QualityPlanModel.updateMany(
      {
        tenantId,
        planCode: planCode.toUpperCase(),
        revisionNumber: { $lt: currentRevision },
        status: 'APPROVED',
        isDeleted: false
      },
      {
        $set: { status: 'OBSOLETE' as QualityPlanStatus }
      }
    );
  }

  public async generateNextPlanCode(
    tenantId: string,
    processFamily: string
  ): Promise<string> {
    const prefixMap: Record<string, string> = {
      CARBURIZING: 'QP-CARB-',
      CARBONITRIDING: 'QP-NITRCARB-',
      NITRIDING: 'QP-NITR-',
      NITROCARBURIZING: 'QP-FNC-',
      NEUTRAL_HARDENING: 'QP-HARD-',
      VACUUM_HEAT_TREATMENT: 'QP-VAC-',
      INDUCTION_HARDENING: 'QP-IND-',
      ANNEALING: 'QP-ANN-',
      NORMALIZING: 'QP-NORM-',
      STRESS_RELIEVING: 'QP-SR-',
      TEMPERING: 'QP-TEMP-',
      SOLUTION_AGE: 'QP-SOL-'
    };

    const prefix = prefixMap[processFamily] || 'QP-GEN-';

    const latest = await QualityPlanModel.findOne({
      tenantId,
      planCode: { $regex: `^${prefix}` }
    })
      .sort({ planCode: -1 })
      .select('planCode')
      .lean();

    let sequence = 1;
    if (latest && (latest as any).planCode) {
      const parts = (latest as any).planCode.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}

export const qualityPlanningRepository = new QualityPlanningRepository();
