import {
  CostRateCard,
  JobCost
} from './costing.model.js';
import {
  CostRateCardDocument,
  JobCostDocument,
  ICostRateCard,
  IJobCost,
  QueryJobCostsDto,
  IJobCostSummaryReport,
  ICostRateSnapshot
} from './costing.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export const DEFAULT_FACTORY_RATE_SNAPSHOT: ICostRateSnapshot = {
  standardLaborRatePerHour: 35.0,
  overtimeLaborRatePerHour: 52.5,
  specialistMetallurgistRatePerHour: 65.0,
  defaultMachineRatePerHour: 85.0,
  machineSpecificRates: [
    { machineCode: 'FURN-VAC-01', machineName: 'High-Vacuum 10-Bar Gas Quench Furnace', hourlyOperatingRate: 110.0, hourlySetupRate: 60.0 },
    { machineCode: 'FURN-VAC-02', machineName: 'Ultra-High Vacuum Carburizing Furnace', hourlyOperatingRate: 125.0, hourlySetupRate: 65.0 },
    { machineCode: 'FURN-ATM-01', machineName: 'Integral Sealed Quench Atmosphere Furnace', hourlyOperatingRate: 85.0, hourlySetupRate: 45.0 },
    { machineCode: 'FURN-TEMPER-01', machineName: 'Precision Forced Convection Tempering Oven', hourlyOperatingRate: 55.0, hourlySetupRate: 30.0 },
    { machineCode: 'FURN-NIT-01', machineName: 'Plasma/Ion Nitriding Bell Furnace', hourlyOperatingRate: 95.0, hourlySetupRate: 50.0 }
  ],
  utilityRates: {
    electricityRatePerKwh: 0.14,
    naturalGasRatePerM3: 1.20,
    nitrogenGasRatePerM3: 0.45,
    argonGasRatePerM3: 1.85,
    vacuumQuenchOilRatePerLiter: 4.50,
    saltBathChemicalRatePerKg: 3.20
  },
  overheadRates: {
    overheadMethod: 'PER_MACHINE_HOUR',
    overheadRate: 18.50,
    qualityAssuranceOverheadPerJob: 45.0,
    plantDepreciationRatePerHour: 12.0
  }
};

export interface ICostingRepository {
  findActiveRateCard(tenantId: string): Promise<CostRateCardDocument | null>;
  findRateCardByCode(tenantId: string, rateCardCode: string): Promise<CostRateCardDocument | null>;
  findAllRateCards(tenantId: string): Promise<CostRateCardDocument[]>;
  createRateCard(tenantId: string, data: Partial<ICostRateCard>): Promise<CostRateCardDocument>;
  updateRateCard(tenantId: string, rateCardCode: string, data: Partial<ICostRateCard>): Promise<CostRateCardDocument | null>;
  seedDefaultRateCards(tenantId: string): Promise<CostRateCardDocument>;
  generateNextCostingNumber(tenantId: string): Promise<string>;
  createJobCost(tenantId: string, data: Partial<IJobCost>): Promise<JobCostDocument>;
  findJobCostById(tenantId: string, id: string): Promise<JobCostDocument | null>;
  findJobCostByJobId(tenantId: string, jobId: string): Promise<JobCostDocument | null>;
  findJobCostByNumber(tenantId: string, costingNumber: string): Promise<JobCostDocument | null>;
  queryJobCosts(
    tenantId: string,
    query: QueryJobCostsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<JobCostDocument>>;
  getSummaryReport(tenantId: string, query?: QueryJobCostsDto): Promise<IJobCostSummaryReport>;
}

export class CostingRepository implements ICostingRepository {
  public async findActiveRateCard(tenantId: string): Promise<CostRateCardDocument | null> {
    return await CostRateCard.findOne({
      tenantId,
      status: 'ACTIVE',
      isDeleted: false
    }).sort({ effectiveFrom: -1 });
  }

  public async findRateCardByCode(tenantId: string, rateCardCode: string): Promise<CostRateCardDocument | null> {
    return await CostRateCard.findOne({
      tenantId,
      rateCardCode: rateCardCode.toUpperCase(),
      isDeleted: false
    }).sort({ revisionNumber: -1 });
  }

  public async findAllRateCards(tenantId: string): Promise<CostRateCardDocument[]> {
    return await CostRateCard.find({ tenantId, isDeleted: false }).sort({ effectiveFrom: -1 });
  }

  public async createRateCard(tenantId: string, data: Partial<ICostRateCard>): Promise<CostRateCardDocument> {
    return await CostRateCard.create({ ...data, tenantId });
  }

  public async updateRateCard(
    tenantId: string,
    rateCardCode: string,
    data: Partial<ICostRateCard>
  ): Promise<CostRateCardDocument | null> {
    return await CostRateCard.findOneAndUpdate(
      { tenantId, rateCardCode: rateCardCode.toUpperCase(), isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  public async seedDefaultRateCards(tenantId: string): Promise<CostRateCardDocument> {
    const existing = await this.findActiveRateCard(tenantId);
    if (existing) return existing;

    return await this.createRateCard(tenantId, {
      rateCardCode: 'RATE-2026-DEFAULT',
      name: 'Standard Heat-Treatment Factory Rate Card 2026',
      revisionNumber: 1,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      rates: DEFAULT_FACTORY_RATE_SNAPSHOT,
      notes: 'Authoritative machine, labor, gas/energy, and QA overhead standard rates'
    });
  }

  public async generateNextCostingNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `COST-${year}${month}-`;

    const latest = await JobCost.findOne({
      tenantId,
      costingNumber: new RegExp(`^${prefix}`)
    }).sort({ costingNumber: -1 });

    if (!latest) {
      return `${prefix}0001`;
    }

    const currentSequence = parseInt(latest.costingNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSequence) ? 1 : currentSequence + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async createJobCost(tenantId: string, data: Partial<IJobCost>): Promise<JobCostDocument> {
    return await JobCost.create({ ...data, tenantId });
  }

  public async findJobCostById(tenantId: string, id: string): Promise<JobCostDocument | null> {
    return await JobCost.findOne({ tenantId, _id: id, isDeleted: false });
  }

  public async findJobCostByJobId(tenantId: string, jobId: string): Promise<JobCostDocument | null> {
    return await JobCost.findOne({ tenantId, jobId, isDeleted: false }).sort({ createdAt: -1 });
  }

  public async findJobCostByNumber(tenantId: string, costingNumber: string): Promise<JobCostDocument | null> {
    return await JobCost.findOne({
      tenantId,
      costingNumber: costingNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async queryJobCosts(
    tenantId: string,
    query: QueryJobCostsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<JobCostDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.jobId) filter.jobId = query.jobId;
    if (query.jobNumber) filter.jobNumber = new RegExp(query.jobNumber, 'i');
    if (query.customerId) filter.customerId = query.customerId;
    if (query.customerCode) filter.customerCode = query.customerCode.toUpperCase();
    if (query.itemCode) filter.itemCode = query.itemCode.toUpperCase();
    if (query.status) filter.status = query.status;
    if (query.profitabilityStatus) filter.profitabilityStatus = query.profitabilityStatus;
    if (query.isFrozen !== undefined) filter.isFrozen = query.isFrozen;

    if (query.startDate || query.endDate) {
      filter.costingDate = {};
      if (query.startDate) filter.costingDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.costingDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      JobCost.find(filter).sort({ costingDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      JobCost.countDocuments(filter)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async getSummaryReport(tenantId: string, query?: QueryJobCostsDto): Promise<IJobCostSummaryReport> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };
    if (query?.startDate || query?.endDate) {
      filter.costingDate = {};
      if (query.startDate) filter.costingDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.costingDate.$lte = new Date(query.endDate);
    }

    const allCosts = await JobCost.find(filter);

    let totalStandardCost = 0;
    let totalActualCost = 0;
    let totalRevenueBilled = 0;
    let totalGrossProfit = 0;

    const jobsByProfitability: Record<string, number> = {
      HIGH_MARGIN: 0,
      STANDARD_MARGIN: 0,
      LOW_MARGIN: 0,
      NEGATIVE_LOSS: 0,
      UNBILLED: 0
    };

    for (const jc of allCosts) {
      totalStandardCost += jc.totalStandardCost || 0;
      totalActualCost += jc.totalActualCost || 0;
      totalRevenueBilled += jc.totalRevenueBilled || 0;
      totalGrossProfit += jc.grossProfit || 0;
      if (jc.profitabilityStatus) {
        jobsByProfitability[jc.profitabilityStatus] = (jobsByProfitability[jc.profitabilityStatus] || 0) + 1;
      }
    }

    const totalVariance = totalActualCost - totalStandardCost;
    const netVariancePercentage =
      totalStandardCost > 0 ? (totalVariance / totalStandardCost) * 100 : 0;
    const averageGrossMarginPercentage =
      totalRevenueBilled > 0 ? (totalGrossProfit / totalRevenueBilled) * 100 : 0;

    return {
      totalJobsCosted: allCosts.length,
      totalStandardCost: Number(totalStandardCost.toFixed(2)),
      totalActualCost: Number(totalActualCost.toFixed(2)),
      totalVariance: Number(totalVariance.toFixed(2)),
      netVariancePercentage: Number(netVariancePercentage.toFixed(2)),
      totalRevenueBilled: Number(totalRevenueBilled.toFixed(2)),
      totalGrossProfit: Number(totalGrossProfit.toFixed(2)),
      averageGrossMarginPercentage: Number(averageGrossMarginPercentage.toFixed(2)),
      jobsByProfitability: jobsByProfitability as any
    };
  }
}

export const costingRepository = new CostingRepository();
