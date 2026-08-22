import {
  PreventiveMaintenancePlanModel,
  MaintenanceWorkOrderModel
} from './maintenance.model.js';
import {
  PreventiveMaintenancePlanDocument,
  MaintenanceWorkOrderDocument,
  QueryPreventivePlansDto,
  QueryMaintenanceWorkOrdersDto,
  MaintenanceMetrics
} from './maintenance.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IMaintenanceRepository {
  // Preventive Plans
  createPlan(
    tenantId: string,
    data: Partial<PreventiveMaintenancePlanDocument>
  ): Promise<PreventiveMaintenancePlanDocument>;
  findPlanById(tenantId: string, id: string): Promise<PreventiveMaintenancePlanDocument | null>;
  findPlanByCode(tenantId: string, planCode: string): Promise<PreventiveMaintenancePlanDocument | null>;
  updatePlan(
    tenantId: string,
    id: string,
    data: Partial<PreventiveMaintenancePlanDocument>
  ): Promise<PreventiveMaintenancePlanDocument | null>;
  queryPlans(
    tenantId: string,
    query: QueryPreventivePlansDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<PreventiveMaintenancePlanDocument>>;
  findOverduePlans(tenantId: string): Promise<PreventiveMaintenancePlanDocument[]>;

  // Work Orders & Breakdowns
  createWorkOrder(
    tenantId: string,
    data: Partial<MaintenanceWorkOrderDocument>
  ): Promise<MaintenanceWorkOrderDocument>;
  findWorkOrderById(tenantId: string, id: string): Promise<MaintenanceWorkOrderDocument | null>;
  findWorkOrderByNumber(tenantId: string, workOrderNumber: string): Promise<MaintenanceWorkOrderDocument | null>;
  findActiveBreakdownByMachineId(tenantId: string, machineId: string): Promise<MaintenanceWorkOrderDocument | null>;
  updateWorkOrder(
    tenantId: string,
    id: string,
    data: Partial<MaintenanceWorkOrderDocument>
  ): Promise<MaintenanceWorkOrderDocument | null>;
  queryWorkOrders(
    tenantId: string,
    query: QueryMaintenanceWorkOrdersDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MaintenanceWorkOrderDocument>>;
  generateNextWorkOrderNumber(tenantId: string): Promise<string>;
  getMetrics(tenantId: string): Promise<MaintenanceMetrics>;
}

export class MaintenanceRepository implements IMaintenanceRepository {
  // --- Preventive Plans ---

  public async createPlan(
    tenantId: string,
    data: Partial<PreventiveMaintenancePlanDocument>
  ): Promise<PreventiveMaintenancePlanDocument> {
    const plan = new PreventiveMaintenancePlanModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await plan.save();
  }

  public async findPlanById(
    tenantId: string,
    id: string
  ): Promise<PreventiveMaintenancePlanDocument | null> {
    return await PreventiveMaintenancePlanModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findPlanByCode(
    tenantId: string,
    planCode: string
  ): Promise<PreventiveMaintenancePlanDocument | null> {
    return await PreventiveMaintenancePlanModel.findOne({
      tenantId,
      planCode: planCode.toUpperCase(),
      isDeleted: false
    });
  }

  public async updatePlan(
    tenantId: string,
    id: string,
    data: Partial<PreventiveMaintenancePlanDocument>
  ): Promise<PreventiveMaintenancePlanDocument | null> {
    return await PreventiveMaintenancePlanModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async queryPlans(
    tenantId: string,
    query: QueryPreventivePlansDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<PreventiveMaintenancePlanDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.machineId) filter.machineId = query.machineId;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.isOverdue !== undefined) filter.isOverdue = query.isOverdue;
    if (query.frequency) filter.frequency = query.frequency;

    if (query.search) {
      filter.$or = [
        { planCode: { $regex: query.search, $options: 'i' } },
        { name: { $regex: query.search, $options: 'i' } },
        { machineCode: { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await PreventiveMaintenancePlanModel.countDocuments(filter);
    const sort = pagination.sort || { nextDueDate: 1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await PreventiveMaintenancePlanModel.find(filter)
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

  public async findOverduePlans(tenantId: string): Promise<PreventiveMaintenancePlanDocument[]> {
    const now = new Date();
    return await PreventiveMaintenancePlanModel.find({
      tenantId,
      isActive: true,
      isDeleted: false,
      $or: [
        { isOverdue: true },
        { nextDueDate: { $lt: now } },
        {
          $expr: {
            $and: [
              { $ne: ['$nextDueRuntimeHours', null] },
              { $gte: ['$currentRuntimeHours', '$nextDueRuntimeHours'] }
            ]
          }
        }
      ]
    }).sort({ nextDueDate: 1 });
  }

  // --- Work Orders & Breakdowns ---

  public async createWorkOrder(
    tenantId: string,
    data: Partial<MaintenanceWorkOrderDocument>
  ): Promise<MaintenanceWorkOrderDocument> {
    const wo = new MaintenanceWorkOrderModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await wo.save();
  }

  public async findWorkOrderById(
    tenantId: string,
    id: string
  ): Promise<MaintenanceWorkOrderDocument | null> {
    return await MaintenanceWorkOrderModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findWorkOrderByNumber(
    tenantId: string,
    workOrderNumber: string
  ): Promise<MaintenanceWorkOrderDocument | null> {
    return await MaintenanceWorkOrderModel.findOne({
      tenantId,
      workOrderNumber: workOrderNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findActiveBreakdownByMachineId(
    tenantId: string,
    machineId: string
  ): Promise<MaintenanceWorkOrderDocument | null> {
    return await MaintenanceWorkOrderModel.findOne({
      tenantId,
      machineId,
      workOrderType: { $in: ['BREAKDOWN', 'EMERGENCY_REPAIR'] },
      status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING_PARTS'] },
      isDeleted: false
    });
  }

  public async updateWorkOrder(
    tenantId: string,
    id: string,
    data: Partial<MaintenanceWorkOrderDocument>
  ): Promise<MaintenanceWorkOrderDocument | null> {
    return await MaintenanceWorkOrderModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async queryWorkOrders(
    tenantId: string,
    query: QueryMaintenanceWorkOrdersDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MaintenanceWorkOrderDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.machineId) filter.machineId = query.machineId;
    if (query.workOrderType) filter.workOrderType = query.workOrderType;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;

    if (query.search) {
      filter.$or = [
        { workOrderNumber: { $regex: query.search, $options: 'i' } },
        { machineCode: { $regex: query.search, $options: 'i' } },
        { failureDescription: { $regex: query.search, $options: 'i' } },
        { rootCause: { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await MaintenanceWorkOrderModel.countDocuments(filter);
    const sort = pagination.sort || { createdAt: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await MaintenanceWorkOrderModel.find(filter)
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

  public async generateNextWorkOrderNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `WO-${yearMonth}-`;

    const latest = await MaintenanceWorkOrderModel.findOne({
      tenantId,
      workOrderNumber: { $regex: `^${prefix}` }
    })
      .sort({ workOrderNumber: -1 })
      .select('workOrderNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).workOrderNumber) {
      const parts = (latest as any).workOrderNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  public async getMetrics(tenantId: string): Promise<MaintenanceMetrics> {
    const allWorkOrders = await MaintenanceWorkOrderModel.find({ tenantId, isDeleted: false });
    const overduePlans = await this.findOverduePlans(tenantId);

    const totalWorkOrders = allWorkOrders.length;
    let openWorkOrders = 0;
    let activeBreakdowns = 0;
    let totalDowntimeMinutes = 0;
    let completedBreakdownsCount = 0;
    let completedBreakdownsDowntimeHours = 0;

    for (const wo of allWorkOrders) {
      if (wo.status === 'OPEN' || wo.status === 'IN_PROGRESS' || wo.status === 'PENDING_PARTS') {
        openWorkOrders++;
        if (wo.workOrderType === 'BREAKDOWN' || wo.workOrderType === 'EMERGENCY_REPAIR') {
          activeBreakdowns++;
        }
      }

      if (wo.downtimeDurationMinutes) {
        totalDowntimeMinutes += wo.downtimeDurationMinutes;
      }

      if (
        (wo.workOrderType === 'BREAKDOWN' || wo.workOrderType === 'EMERGENCY_REPAIR') &&
        wo.status === 'COMPLETED' &&
        wo.downtimeDurationMinutes
      ) {
        completedBreakdownsCount++;
        completedBreakdownsDowntimeHours += wo.downtimeDurationMinutes / 60;
      }
    }

    const totalDowntimeHours = Math.round((totalDowntimeMinutes / 60) * 10) / 10;
    const mttrHours =
      completedBreakdownsCount > 0
        ? Math.round((completedBreakdownsDowntimeHours / completedBreakdownsCount) * 10) / 10
        : 0;

    // Standard factory uptime baseline: 720 operating hours per active equipment monthly
    const estimatedTotalOperatingHours = totalWorkOrders * 120 + 720;
    const mtbfHours =
      completedBreakdownsCount > 0
        ? Math.round((estimatedTotalOperatingHours / completedBreakdownsCount) * 10) / 10
        : estimatedTotalOperatingHours;

    return {
      totalWorkOrders,
      openWorkOrders,
      activeBreakdowns,
      totalDowntimeHours,
      mttrHours,
      mtbfHours,
      overduePreventivePlansCount: overduePlans.length
    };
  }
}

export const maintenanceRepository = new MaintenanceRepository();
