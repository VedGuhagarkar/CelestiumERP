import { BaseRepository } from '../../core/repository/base.repository.js';
import { ProductionPlanDocument, QueryProductionPlanDto } from './production-plan.types.js';
import { ProductionPlanModel } from './production-plan.model.js';

export interface IProductionPlanRepository {
  generateNextPlanNumber(tenantId: string): Promise<string>;
  findByPlanNumber(tenantId: string, planNumber: string): Promise<ProductionPlanDocument | null>;
  queryPlans(tenantId: string, query: QueryProductionPlanDto): Promise<{ plans: ProductionPlanDocument[]; total: number }>;
  findActivePlansByItem(tenantId: string, itemId: string): Promise<ProductionPlanDocument[]>;
  findById(tenantId: string, id: string): Promise<ProductionPlanDocument | null>;
  create(tenantId: string, data: Partial<ProductionPlanDocument>): Promise<ProductionPlanDocument>;
  updateById(tenantId: string, id: string, update: any): Promise<ProductionPlanDocument | null>;
}

export class ProductionPlanRepository
  extends BaseRepository<ProductionPlanDocument>
  implements IProductionPlanRepository
{
  constructor() {
    super(ProductionPlanModel);
  }

  public async generateNextPlanNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PLAN-${yearMonth}-`;

    const latestPlan = await this.model
      .findOne({ tenantId, planNumber: { $regex: `^${prefix}` } })
      .sort({ planNumber: -1 })
      .exec();

    if (!latestPlan) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latestPlan.planNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async findByPlanNumber(tenantId: string, planNumber: string): Promise<ProductionPlanDocument | null> {
    return this.model.findOne({ tenantId, planNumber: planNumber.toUpperCase(), isDeleted: false }).exec();
  }

  public async findActivePlansByItem(tenantId: string, itemId: string): Promise<ProductionPlanDocument[]> {
    return this.model
      .find({
        tenantId,
        'item.itemId': itemId,
        status: { $in: ['PLANNED', 'CONFIRMED', 'IN_PROGRESS'] },
        isDeleted: false
      })
      .exec();
  }

  public async queryPlans(
    tenantId: string,
    query: QueryProductionPlanDto
  ): Promise<{ plans: ProductionPlanDocument[]; total: number }> {
    const filter: any = { tenantId, isDeleted: false };

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { planNumber: searchRegex },
        { title: searchRegex },
        { 'customer.customerName': searchRegex },
        { 'customer.customerCode': searchRegex },
        { 'item.itemCode': searchRegex },
        { 'recipe.recipeCode': searchRegex }
      ];
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.customerCode) {
      filter['customer.customerCode'] = query.customerCode.toUpperCase();
    }

    if (query.itemCode) {
      filter['item.itemCode'] = query.itemCode.toUpperCase();
    }

    if (query.materialGrade) {
      filter['item.materialGrade'] = new RegExp(query.materialGrade, 'i');
    }

    if (query.processFamily) {
      filter['recipe.processFamily'] = query.processFamily;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sortOptions: any = { [sortField]: sortOrder };

    const [plans, total] = await Promise.all([
      this.model.find(filter).sort(sortOptions).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec()
    ]);

    return { plans, total };
  }
}

export const productionPlanRepository = new ProductionPlanRepository();
