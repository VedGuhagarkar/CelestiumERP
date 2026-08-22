import { BaseService } from '../../core/services/base.service.js';
import { IMaintenanceRepository, maintenanceRepository } from './maintenance.repository.js';
import { machineService, MachineService } from '../machine/machine.service.js';
import { machineRepository, IMachineRepository } from '../machine/machine.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  PreventiveMaintenancePlanDocument,
  MaintenanceWorkOrderDocument,
  CreatePreventivePlanDto,
  UpdatePreventivePlanDto,
  ReportBreakdownDto,
  CreateWorkOrderDto,
  ResolveBreakdownDto,
  CompleteWorkOrderDto,
  QueryMaintenanceWorkOrdersDto,
  QueryPreventivePlansDto,
  MaintenanceMetrics,
  PlanFrequency
} from './maintenance.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class MaintenanceService extends BaseService {
  constructor(
    private readonly repo: IMaintenanceRepository = maintenanceRepository,
    private readonly machService: MachineService = machineService,
    private readonly machRepo: IMachineRepository = machineRepository
  ) {
    super('MaintenanceService');
  }

  // ==================== Preventive Maintenance Plans ====================

  public async createPreventivePlan(
    tenantId: string,
    actor: IActorContext,
    dto: CreatePreventivePlanDto
  ): Promise<PreventiveMaintenancePlanDocument> {
    const existing = await this.repo.findPlanByCode(tenantId, dto.planCode);
    if (existing) {
      throw new ConflictError(`Maintenance plan with code '${dto.planCode.toUpperCase()}' already exists`);
    }

    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const nextDueDate = dto.nextDueDate
      ? new Date(dto.nextDueDate)
      : this.calculateInitialNextDueDate(dto.frequency, dto.calendarIntervalDays);

    const nextDueRuntimeHours =
      dto.runtimeIntervalHours && dto.currentRuntimeHours !== undefined
        ? dto.currentRuntimeHours + dto.runtimeIntervalHours
        : dto.runtimeIntervalHours || null;

    const plan = await this.repo.createPlan(tenantId, {
      planCode: dto.planCode.toUpperCase(),
      name: dto.name,
      machineId: machine.id,
      machineCode: machine.machineCode,
      triggerType: dto.triggerType,
      frequency: dto.frequency,
      calendarIntervalDays: dto.calendarIntervalDays || null,
      nextDueDate,
      runtimeIntervalHours: dto.runtimeIntervalHours || null,
      currentRuntimeHours: dto.currentRuntimeHours || 0,
      nextDueRuntimeHours,
      estimatedDurationHours: dto.estimatedDurationHours,
      checklistTasks: dto.checklistTasks,
      isActive: true,
      isOverdue: false,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PREVENTIVE_PLAN_CREATED',
      entityType: 'PreventiveMaintenancePlan',
      entityId: plan.id,
      metadata: {
        planCode: plan.planCode,
        machineCode: machine.machineCode,
        frequency: plan.frequency
      }
    });

    this.publishEvent(DomainEvents.PREVENTIVE_PLAN_CREATED as any, tenantId, {
      planId: plan.id,
      planCode: plan.planCode,
      machineId: machine.id,
      machineCode: machine.machineCode
    }, actor.userId);

    return plan;
  }

  public async updatePreventivePlan(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: UpdatePreventivePlanDto
  ): Promise<PreventiveMaintenancePlanDocument> {
    const plan = await this.repo.findPlanById(tenantId, id);
    if (!plan) {
      throw new NotFoundError(`Preventive Maintenance Plan with ID '${id}' not found`);
    }

    const updated = await this.repo.updatePlan(tenantId, id, {
      ...dto,
      nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : plan.nextDueDate
    } as any);

    if (!updated) {
      throw new NotFoundError(`Preventive Maintenance Plan with ID '${id}' not found`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PREVENTIVE_PLAN_UPDATED',
      entityType: 'PreventiveMaintenancePlan',
      entityId: updated.id,
      metadata: { planCode: updated.planCode }
    });

    return updated;
  }

  public async queryPlans(
    tenantId: string,
    query: QueryPreventivePlansDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<PreventiveMaintenancePlanDocument>> {
    return await this.repo.queryPlans(tenantId, query, pagination);
  }

  public async getOverduePlans(tenantId: string): Promise<PreventiveMaintenancePlanDocument[]> {
    return await this.repo.findOverduePlans(tenantId);
  }

  // ==================== Breakdown Reporting & Resolution ====================

  /**
   * Reports an unexpected breakdown incident and AUTOMATICALLY transitions equipment to BREAKDOWN state
   */
  public async reportBreakdown(
    tenantId: string,
    actor: IActorContext,
    dto: ReportBreakdownDto
  ): Promise<MaintenanceWorkOrderDocument> {
    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const workOrderNumber = await this.repo.generateNextWorkOrderNumber(tenantId);
    const now = new Date();

    const workOrder = await this.repo.createWorkOrder(tenantId, {
      workOrderNumber,
      machineId: machine.id,
      machineCode: machine.machineCode,
      workOrderType: 'BREAKDOWN',
      priority: dto.priority || 'CRITICAL',
      status: 'OPEN',
      breakdownReportedAt: now,
      breakdownReportedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      failureSymptom: dto.failureSymptom,
      failureDescription: dto.failureDescription,
      productionInterrupted: dto.productionInterrupted ?? true,
      affectedJobId: dto.affectedJobId || null,
      affectedJobNumber: dto.affectedJobNumber || null,
      assignedTechnicians: [],
      checklistExecutions: [],
      partsReplaced: [],
      laborRecords: [],
      totalLaborHours: 0
    });

    // Authoritative machine state transition to BREAKDOWN
    try {
      await this.machService.changeMachineStatus(tenantId, actor, machine.id, {
        status: 'BREAKDOWN',
        reason: `Breakdown reported (${dto.failureSymptom}): ${dto.failureDescription}`,
        workOrderId: workOrder.id,
        jobId: dto.affectedJobId,
        jobNumber: dto.affectedJobNumber
      });
    } catch (err: any) {
      this.logger.warn(`Machine status transition note: ${err.message}`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MACHINE_BREAKDOWN_REPORTED',
      entityType: 'MaintenanceWorkOrder',
      entityId: workOrder.id,
      metadata: {
        workOrderNumber,
        machineCode: machine.machineCode,
        failureSymptom: dto.failureSymptom
      }
    });

    this.publishEvent(DomainEvents.MACHINE_BREAKDOWN_REPORTED, tenantId, {
      workOrderId: workOrder.id,
      workOrderNumber,
      machineId: machine.id,
      machineCode: machine.machineCode,
      failureSymptom: dto.failureSymptom
    }, actor.userId);

    return workOrder;
  }

  /**
   * Resolves a breakdown with root-cause analysis, parts replaced, and transitions equipment back to testing/operational state
   */
  public async resolveBreakdown(
    tenantId: string,
    actor: IActorContext,
    workOrderId: string,
    dto: ResolveBreakdownDto
  ): Promise<MaintenanceWorkOrderDocument> {
    const wo = await this.repo.findWorkOrderById(tenantId, workOrderId);
    if (!wo) {
      throw new NotFoundError(`Work Order with ID '${workOrderId}' not found`);
    }

    if (wo.status === 'COMPLETED') {
      throw new BadRequestError(`Work Order '${wo.workOrderNumber}' is already COMPLETED`);
    }

    const now = new Date();
    const startTime = wo.breakdownReportedAt || wo.startedAt || wo.createdAt;
    const downtimeMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(startTime).getTime()) / 60000)
    );

    const laborRecords = dto.laborRecords || wo.laborRecords || [];
    const totalLaborHours = laborRecords.reduce((sum, l) => sum + l.hoursSpent, 0);

    wo.status = 'COMPLETED';
    wo.completedAt = now;
    wo.downtimeDurationMinutes = downtimeMinutes;
    wo.rootCause = dto.rootCause;
    wo.rootCauseCategory = dto.rootCauseCategory;
    wo.repairActionsTaken = dto.repairActionsTaken;
    wo.partsReplaced = dto.partsReplaced || wo.partsReplaced || [];
    wo.laborRecords = laborRecords;
    wo.totalLaborHours = totalLaborHours;
    wo.checklistExecutions = dto.checklistExecutions || wo.checklistExecutions || [];
    wo.testingResolutionState = dto.testingResolutionState || 'IDLE';
    wo.postMaintenanceVerifiedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      verifiedAt: now,
      notes: dto.verificationNotes
    };

    await wo.save();

    // Transition Machine state: First to MAINTENANCE/CALIBRATING then to IDLE if requested
    const targetState = dto.testingResolutionState || 'IDLE';
    try {
      // Transition from BREAKDOWN -> MAINTENANCE first if still in BREAKDOWN
      const machine = await this.machRepo.findById(tenantId, wo.machineId);
      if (machine && machine.status === 'BREAKDOWN') {
        await this.machService.changeMachineStatus(tenantId, actor, machine.id, {
          status: 'MAINTENANCE',
          reason: 'Corrective maintenance active for breakdown repair',
          workOrderId: wo.id
        });
      }

      if (targetState === 'CALIBRATING') {
        await this.machService.changeMachineStatus(tenantId, actor, wo.machineId, {
          status: 'CALIBRATING',
          reason: `Post-repair calibration verification: ${dto.repairActionsTaken}`,
          workOrderId: wo.id
        });
      } else if (targetState === 'IDLE') {
        await this.machService.changeMachineStatus(tenantId, actor, wo.machineId, {
          status: 'IDLE',
          reason: `Breakdown repair completed and verified: ${dto.repairActionsTaken}`,
          workOrderId: wo.id
        });
      }
    } catch (err: any) {
      this.logger.warn(`Machine post-resolution transition note: ${err.message}`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MACHINE_BREAKDOWN_RESOLVED',
      entityType: 'MaintenanceWorkOrder',
      entityId: wo.id,
      metadata: {
        workOrderNumber: wo.workOrderNumber,
        machineCode: wo.machineCode,
        downtimeMinutes,
        rootCauseCategory: dto.rootCauseCategory
      }
    });

    this.publishEvent(DomainEvents.MACHINE_BREAKDOWN_RESOLVED, tenantId, {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      machineId: wo.machineId,
      machineCode: wo.machineCode,
      downtimeMinutes
    }, actor.userId);

    return wo;
  }

  // ==================== General Work Order Management ====================

  public async createWorkOrder(
    tenantId: string,
    actor: IActorContext,
    dto: CreateWorkOrderDto
  ): Promise<MaintenanceWorkOrderDocument> {
    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    let planCode: string | null = null;
    let initialChecklist = dto.checklistExecutions || [];

    if (dto.preventivePlanId) {
      const plan = await this.repo.findPlanById(tenantId, dto.preventivePlanId);
      if (plan) {
        planCode = plan.planCode;
        if (initialChecklist.length === 0 && plan.checklistTasks) {
          initialChecklist = plan.checklistTasks.map((t) => ({
            stepNumber: t.stepNumber,
            taskDescription: t.taskDescription,
            status: 'PASSED'
          }));
        }
      }
    }

    const workOrderNumber = await this.repo.generateNextWorkOrderNumber(tenantId);
    const now = new Date();

    const wo = await this.repo.createWorkOrder(tenantId, {
      workOrderNumber,
      machineId: machine.id,
      machineCode: machine.machineCode,
      workOrderType: dto.workOrderType,
      priority: dto.priority,
      status: 'OPEN',
      preventivePlanId: dto.preventivePlanId || null,
      preventivePlanCode: planCode,
      failureDescription: dto.failureDescription || null,
      assignedTechnicians: dto.assignedTechnicians || [],
      startedAt: now,
      checklistExecutions: initialChecklist,
      partsReplaced: [],
      laborRecords: [],
      totalLaborHours: 0,
      notes: dto.notes || null
    });

    if (dto.workOrderType === 'PREVENTIVE' || dto.workOrderType === 'OVERHAUL') {
      try {
        await this.machService.changeMachineStatus(tenantId, actor, machine.id, {
          status: 'MAINTENANCE',
          reason: `Scheduled ${dto.workOrderType} maintenance work order started (${workOrderNumber})`,
          workOrderId: wo.id
        });
      } catch (err: any) {
        this.logger.warn(`Machine status transition note: ${err.message}`);
      }
    }

    return wo;
  }

  public async completeWorkOrder(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: CompleteWorkOrderDto
  ): Promise<MaintenanceWorkOrderDocument> {
    const wo = await this.repo.findWorkOrderById(tenantId, id);
    if (!wo) {
      throw new NotFoundError(`Work Order with ID '${id}' not found`);
    }

    const now = new Date();
    const startTime = wo.startedAt || wo.createdAt;
    const downtimeMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(startTime).getTime()) / 60000)
    );

    const laborRecords = dto.laborRecords || wo.laborRecords || [];
    const totalLaborHours = laborRecords.reduce((sum, l) => sum + l.hoursSpent, 0);

    wo.status = 'COMPLETED';
    wo.completedAt = now;
    wo.downtimeDurationMinutes = downtimeMinutes;
    wo.repairActionsTaken = dto.repairActionsTaken;
    wo.partsReplaced = dto.partsReplaced || wo.partsReplaced || [];
    wo.laborRecords = laborRecords;
    wo.totalLaborHours = totalLaborHours;
    wo.checklistExecutions = dto.checklistExecutions || wo.checklistExecutions || [];
    wo.testingResolutionState = dto.testingResolutionState || 'IDLE';
    wo.postMaintenanceVerifiedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      verifiedAt: now,
      notes: dto.verificationNotes
    };

    await wo.save();

    // If PM plan was linked, advance plan due date
    if (wo.preventivePlanId) {
      const plan = await this.repo.findPlanById(tenantId, wo.preventivePlanId);
      if (plan) {
        plan.lastCompletedDate = now;
        plan.nextDueDate = this.calculateNextDueDate(plan.frequency, plan.calendarIntervalDays, now);
        plan.isOverdue = false;
        await plan.save();
      }
    }

    // Transition machine back to IDLE or CALIBRATING
    const targetState = dto.testingResolutionState || 'IDLE';
    try {
      await this.machService.changeMachineStatus(tenantId, actor, wo.machineId, {
        status: targetState,
        reason: `Maintenance work order completed: ${dto.repairActionsTaken}`,
        workOrderId: wo.id
      });
    } catch (err: any) {
      this.logger.warn(`Machine post-maintenance transition note: ${err.message}`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MAINTENANCE_WORK_ORDER_COMPLETED',
      entityType: 'MaintenanceWorkOrder',
      entityId: wo.id,
      metadata: { workOrderNumber: wo.workOrderNumber, machineCode: wo.machineCode }
    });

    this.publishEvent(DomainEvents.MAINTENANCE_WORK_ORDER_COMPLETED as any, tenantId, {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      machineId: wo.machineId,
      machineCode: wo.machineCode
    }, actor.userId);

    return wo;
  }

  public async getWorkOrderById(tenantId: string, id: string): Promise<MaintenanceWorkOrderDocument> {
    const wo = await this.repo.findWorkOrderById(tenantId, id);
    if (!wo) {
      throw new NotFoundError(`Work Order with ID '${id}' not found`);
    }
    return wo;
  }

  public async queryWorkOrders(
    tenantId: string,
    query: QueryMaintenanceWorkOrdersDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MaintenanceWorkOrderDocument>> {
    return await this.repo.queryWorkOrders(tenantId, query, pagination);
  }

  public async getMetrics(tenantId: string): Promise<MaintenanceMetrics> {
    return await this.repo.getMetrics(tenantId);
  }

  // --- Helper Methods ---

  private calculateInitialNextDueDate(frequency: PlanFrequency, intervalDays?: number | null): Date {
    const now = new Date();
    return this.calculateNextDueDate(frequency, intervalDays, now);
  }

  private calculateNextDueDate(
    frequency: PlanFrequency,
    intervalDays: number | null | undefined,
    from: Date
  ): Date {
    const next = new Date(from);
    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        next.setMonth(next.getMonth() + 6);
        break;
      case 'ANNUAL':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setDate(next.getDate() + (intervalDays || 30));
        break;
    }
    return next;
  }
}

export const maintenanceService = new MaintenanceService();
