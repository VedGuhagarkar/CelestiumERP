import {
  IProductionScheduleRepository,
  productionScheduleRepository
} from './production-schedule.repository.js';
import {
  ScheduleJobDto,
  RescheduleJobDto,
  UnscheduleJobDto,
  QueryScheduleDto,
  ProductionScheduleDocument,
  IScheduleHistoryEntry
} from './production-schedule.types.js';
import { productionJobRepository } from '../production-job/production-job.repository.js';
import { furnaceCapacityRepository } from '../furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../workforce-capacity/workforce-capacity.repository.js';
import { constraintAnalysisService } from '../constraint-analysis/constraint-analysis.service.js';
import { auditService } from '../audit/audit.service.js';
import { PRIORITY_WEIGHTS } from '../production-job/production-job.types.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class ProductionScheduleService {
  constructor(
    private readonly repo: IProductionScheduleRepository = productionScheduleRepository
  ) {}

  public async scheduleJob(
    tenantId: string,
    actor: IActorContext,
    dto: ScheduleJobDto
  ): Promise<ProductionScheduleDocument> {
    // 1. Fetch Target Production Job
    const job = await productionJobRepository.findById(tenantId, dto.jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${dto.jobId}' not found`);
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new BadRequestError(
        `Cannot schedule a job in '${job.status}' status`
      );
    }

    const existingSchedule = await this.repo.findActiveScheduleByJobId(tenantId, job.id);
    if (existingSchedule) {
      throw new BadRequestError(
        `Job '${job.jobNumber}' already has an active schedule ('${existingSchedule.scheduleNumber}'). Use the reschedule endpoint to modify it.`
      );
    }

    const startTime = new Date(dto.plannedStartTime);
    const endTime = new Date(dto.plannedEndTime);

    // 2. Validate Pre-Scheduling Constraints (if associated plan exists)
    if (job.planId && !dto.overrideConstraints) {
      const constraintReport = await constraintAnalysisService.evaluatePlanConstraints(
        tenantId,
        job.planId
      );

      if (constraintReport.isBlocked) {
        const blockingReasons = constraintReport.violations
          .filter((v) => v.severity === 'BLOCKING')
          .map((v) => `[${v.category}] ${v.message}`)
          .join('; ');

        throw new BadRequestError(
          `Cannot schedule job '${job.jobNumber}': Blocked by factory constraints - ${blockingReasons}`
        );
      }
    }

    if (dto.overrideConstraints && !dto.overrideReason) {
      throw new BadRequestError(
        'An explicit override reason is mandatory when bypassing factory constraints for scheduling'
      );
    }

    // 3. Validate Machine Capability & Availability
    const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, dto.furnaceId);
    if (!furnace || furnace.isDeleted) {
      throw new NotFoundError(`Furnace with ID '${dto.furnaceId}' not found`);
    }

    if (furnace.status !== 'OPERATIONAL') {
      throw new BadRequestError(
        `Furnace '${furnace.furnaceCode}' is not available for scheduling (Current status: '${furnace.status}')`
      );
    }

    const processFamily = job.recipeSnapshot?.processFamily || 'CARBURIZING';
    if (!furnace.processCapabilities.supportedProcessFamilies.includes(processFamily)) {
      throw new BadRequestError(
        `Furnace '${furnace.furnaceCode}' does not support process family '${processFamily}'`
      );
    }

    const maxRecipeTemp = Math.max(
      ...(job.recipeSnapshot?.stages || []).map((s) => s.targetTemperatureC),
      0
    );

    if (
      maxRecipeTemp > furnace.thermalCapabilities.maxOperatingTempC ||
      maxRecipeTemp < furnace.thermalCapabilities.minOperatingTempC
    ) {
      throw new BadRequestError(
        `Recipe soak temperature (${maxRecipeTemp}°C) is outside furnace '${furnace.furnaceCode}' thermal operating envelope [${furnace.thermalCapabilities.minOperatingTempC}°C - ${furnace.thermalCapabilities.maxOperatingTempC}°C]`
      );
    }

    // 4. Detect Machine Slot Collisions
    const furnaceConflicts = await this.repo.findActiveSchedulesByFurnaceAndTime(
      tenantId,
      furnace.id,
      startTime,
      endTime
    );

    if (furnaceConflicts.length > 0) {
      throw new BadRequestError(
        `Furnace schedule collision: Furnace '${furnace.furnaceCode}' is already scheduled for job '${furnaceConflicts[0].jobNumber}' (${furnaceConflicts[0].scheduleNumber}) during this time window`
      );
    }

    // 5. Validate Operator Qualification & Availability (if provided)
    let operatorDoc = null;
    if (dto.operatorId) {
      operatorDoc = await workforceCapacityRepository.findEmployeeById(tenantId, dto.operatorId);
      if (!operatorDoc || operatorDoc.isDeleted || operatorDoc.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Operator with ID '${dto.operatorId}' not found or is not in ACTIVE status`
        );
      }

      const onLeave = (operatorDoc.approvedLeaves || []).some((leave) => {
        const lStart = new Date(leave.startDate);
        const lEnd = new Date(leave.endDate);
        return startTime <= lEnd && endTime >= lStart;
      });

      if (onLeave) {
        throw new BadRequestError(
          `Operator '${operatorDoc.fullName}' has approved leave overlapping the scheduled time window`
        );
      }

      const reqSkillCode = `${processFamily}_OPERATION`;
      const isQualified = (operatorDoc.skills || []).some((s) => {
        const isSkillMatch =
          s.skillCode === reqSkillCode ||
          s.skillCode === 'SEALED_QUENCH_FURNACE_OPERATION' ||
          s.skillCode === 'VACUUM_FURNACE_OPERATION' ||
          s.skillCode === 'PIT_FURNACE_OPERATION' ||
          s.skillCode === 'NITRIDING_OPERATION';

        const isCertified = s.isCertified;
        const isNotExpired = !s.expiryDate || new Date(s.expiryDate) >= startTime;

        return isSkillMatch && isCertified && isNotExpired;
      });

      if (!isQualified) {
        throw new BadRequestError(
          `Operator '${operatorDoc.fullName}' lacks certified qualification for process '${processFamily}'`
        );
      }

      const operatorConflicts = await this.repo.findActiveSchedulesByOperatorAndTime(
        tenantId,
        operatorDoc.id,
        startTime,
        endTime
      );

      if (operatorConflicts.length > 0) {
        throw new BadRequestError(
          `Operator schedule collision: Operator '${operatorDoc.fullName}' is already double-booked for job '${operatorConflicts[0].jobNumber}' during this time window`
        );
      }
    }

    // 6. Generate Schedule Number
    const scheduleNumber = await this.repo.generateNextScheduleNumber(tenantId);
    const durationHours = Math.round(((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * 10) / 10;

    const initialHistoryEntry: IScheduleHistoryEntry = {
      action: dto.overrideConstraints ? 'OVERRIDE_SCHEDULE' : 'SCHEDULE',
      newFurnaceId: furnace.id,
      newFurnaceCode: furnace.furnaceCode,
      newOperatorId: operatorDoc?.id || null,
      newOperatorCode: operatorDoc?.employeeCode || null,
      newStartTime: startTime,
      newEndTime: endTime,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.overrideReason || dto.notes || 'Production job scheduled',
      notes: dto.notes || null
    };

    // 7. Create Production Schedule Record
    const schedule = await this.repo.create(tenantId, {
      scheduleNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      planId: job.planId || null,
      planNumber: job.planNumber || null,
      customerName: job.customer.customerName,
      itemCode: job.item.itemCode,
      itemName: job.item.itemName,
      materialGrade: job.item.materialGrade,
      processFamily,
      furnaceId: furnace.id,
      furnaceCode: furnace.furnaceCode,
      operatorId: operatorDoc?.id || null,
      operatorCode: operatorDoc?.employeeCode || null,
      operatorName: operatorDoc?.fullName || null,
      shift: dto.shift || operatorDoc?.defaultShift || null,
      startTime,
      endTime,
      durationHours,
      status: 'SCHEDULED',
      priority: job.priority,
      overrideApplied: !!dto.overrideConstraints,
      overrideReason: dto.overrideReason || null,
      history: [initialHistoryEntry],
      notes: dto.notes || null
    });

    // 8. Update Production Job Status & Assignments
    const previousJobStatus = job.status;
    job.status = 'SCHEDULED';
    job.timeline.plannedStartDate = startTime;
    job.timeline.targetCompletionDate = endTime;
    job.equipmentAssignment = {
      furnaceId: furnace.id,
      furnaceCode: furnace.furnaceCode,
      locationBay: furnace.locationBay,
      pyrometryClass: furnace.thermalCapabilities.pyrometryClass
    };

    if (operatorDoc) {
      job.operatorAssignment = {
        operatorId: operatorDoc.id,
        operatorCode: operatorDoc.employeeCode,
        operatorName: operatorDoc.fullName,
        shift: dto.shift || operatorDoc.defaultShift
      };
    }

    if (previousJobStatus !== 'SCHEDULED') {
      job.transitionHistory.push({
        fromStatus: previousJobStatus,
        toStatus: 'SCHEDULED',
        timestamp: new Date(),
        performedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        reason: `Scheduled on Furnace '${furnace.furnaceCode}' (${schedule.scheduleNumber})`
      });
    }

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action: 'ASSIGN',
      newResourceId: furnace.id,
      newResourceCode: furnace.furnaceCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: `Assigned via Schedule '${schedule.scheduleNumber}'`
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'SCHEDULE_PRODUCTION_JOB',
      entityType: 'PRODUCTION_SCHEDULE',
      entityId: schedule.id,
      afterState: schedule.toJSON(),
      metadata: {
        scheduleNumber: schedule.scheduleNumber,
        jobNumber: job.jobNumber,
        furnaceCode: furnace.furnaceCode,
        startTime,
        endTime
      }
    });

    return schedule;
  }

  public async rescheduleJob(
    tenantId: string,
    actor: IActorContext,
    scheduleId: string,
    dto: RescheduleJobDto
  ): Promise<ProductionScheduleDocument> {
    const schedule = await this.repo.findById(tenantId, scheduleId);
    if (!schedule || schedule.isDeleted) {
      throw new NotFoundError(`Production Schedule with ID '${scheduleId}' not found`);
    }

    if (schedule.status !== 'SCHEDULED' && schedule.status !== 'RESCHEDULED') {
      throw new BadRequestError(
        `Cannot reschedule a production schedule in status '${schedule.status}'`
      );
    }

    const job = await productionJobRepository.findById(tenantId, schedule.jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Associated Production Job with ID '${schedule.jobId}' not found`);
    }

    if (job.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot reschedule job '${job.jobNumber}' while it is actively IN_PROGRESS. Please pause the job first.`
      );
    }

    const newStartTime = new Date(dto.newPlannedStartTime);
    const newEndTime = new Date(dto.newPlannedEndTime);

    const targetFurnaceId = dto.newFurnaceId || schedule.furnaceId;
    const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, targetFurnaceId);
    if (!furnace || furnace.isDeleted) {
      throw new NotFoundError(`Furnace with ID '${targetFurnaceId}' not found`);
    }

    if (furnace.status !== 'OPERATIONAL') {
      throw new BadRequestError(
        `Furnace '${furnace.furnaceCode}' is not available (Current status: '${furnace.status}')`
      );
    }

    const furnaceConflicts = await this.repo.findActiveSchedulesByFurnaceAndTime(
      tenantId,
      furnace.id,
      newStartTime,
      newEndTime,
      schedule.id
    );

    if (furnaceConflicts.length > 0) {
      throw new BadRequestError(
        `Furnace schedule collision: Furnace '${furnace.furnaceCode}' is already scheduled for job '${furnaceConflicts[0].jobNumber}' during this new time window`
      );
    }

    let operatorDoc = null;
    const targetOperatorId = dto.newOperatorId || schedule.operatorId;
    if (targetOperatorId) {
      operatorDoc = await workforceCapacityRepository.findEmployeeById(tenantId, targetOperatorId);
      if (!operatorDoc || operatorDoc.isDeleted || operatorDoc.status !== 'ACTIVE') {
        throw new BadRequestError(`Operator with ID '${targetOperatorId}' not found or inactive`);
      }

      const onLeave = (operatorDoc.approvedLeaves || []).some((leave) => {
        const lStart = new Date(leave.startDate);
        const lEnd = new Date(leave.endDate);
        return newStartTime <= lEnd && newEndTime >= lStart;
      });

      if (onLeave) {
        throw new BadRequestError(
          `Operator '${operatorDoc.fullName}' has approved leave overlapping the new schedule window`
        );
      }

      const operatorConflicts = await this.repo.findActiveSchedulesByOperatorAndTime(
        tenantId,
        operatorDoc.id,
        newStartTime,
        newEndTime,
        schedule.id
      );

      if (operatorConflicts.length > 0) {
        throw new BadRequestError(
          `Operator schedule collision: Operator '${operatorDoc.fullName}' is already double-booked for job '${operatorConflicts[0].jobNumber}' during this new window`
        );
      }
    }

    const previousFurnaceId = schedule.furnaceId;
    const previousFurnaceCode = schedule.furnaceCode;
    const previousOperatorId = schedule.operatorId;
    const previousOperatorCode = schedule.operatorCode;
    const previousStartTime = schedule.startTime;
    const previousEndTime = schedule.endTime;

    const newDurationHours =
      Math.round(((newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60)) * 10) / 10;

    schedule.history.push({
      action: 'RESCHEDULE',
      previousFurnaceId,
      previousFurnaceCode,
      previousOperatorId,
      previousOperatorCode,
      previousStartTime,
      previousEndTime,
      newFurnaceId: furnace.id,
      newFurnaceCode: furnace.furnaceCode,
      newOperatorId: operatorDoc?.id || null,
      newOperatorCode: operatorDoc?.employeeCode || null,
      newStartTime,
      newEndTime,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason,
      notes: dto.notes || null
    });

    schedule.furnaceId = furnace.id;
    schedule.furnaceCode = furnace.furnaceCode;
    schedule.operatorId = operatorDoc?.id || null;
    schedule.operatorCode = operatorDoc?.employeeCode || null;
    schedule.operatorName = operatorDoc?.fullName || null;
    schedule.shift = dto.newShift || schedule.shift;
    schedule.startTime = newStartTime;
    schedule.endTime = newEndTime;
    schedule.durationHours = newDurationHours;
    schedule.status = 'RESCHEDULED';

    await schedule.save();

    // Update job timeline
    job.timeline.plannedStartDate = newStartTime;
    job.timeline.targetCompletionDate = newEndTime;
    job.equipmentAssignment = {
      furnaceId: furnace.id,
      furnaceCode: furnace.furnaceCode,
      locationBay: furnace.locationBay,
      pyrometryClass: furnace.thermalCapabilities.pyrometryClass
    };

    if (operatorDoc) {
      job.operatorAssignment = {
        operatorId: operatorDoc.id,
        operatorCode: operatorDoc.employeeCode,
        operatorName: operatorDoc.fullName,
        shift: dto.newShift || operatorDoc.defaultShift
      };
    }

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action: 'REALLOCATE',
      previousResourceId: previousFurnaceId,
      previousResourceCode: previousFurnaceCode,
      newResourceId: furnace.id,
      newResourceCode: furnace.furnaceCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'RESCHEDULE_PRODUCTION_JOB',
      entityType: 'PRODUCTION_SCHEDULE',
      entityId: schedule.id,
      afterState: schedule.toJSON(),
      metadata: {
        scheduleNumber: schedule.scheduleNumber,
        jobNumber: job.jobNumber,
        reason: dto.reason
      }
    });

    return schedule;
  }

  public async unscheduleJob(
    tenantId: string,
    actor: IActorContext,
    scheduleId: string,
    dto: UnscheduleJobDto
  ): Promise<ProductionScheduleDocument> {
    const schedule = await this.repo.findById(tenantId, scheduleId);
    if (!schedule || schedule.isDeleted) {
      throw new NotFoundError(`Production Schedule with ID '${scheduleId}' not found`);
    }

    if (schedule.status === 'UNSCHEDULED' || schedule.status === 'CANCELLED') {
      throw new BadRequestError(
        `Production Schedule '${schedule.scheduleNumber}' is already in status '${schedule.status}'`
      );
    }

    const job = await productionJobRepository.findById(tenantId, schedule.jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Associated Production Job with ID '${schedule.jobId}' not found`);
    }

    if (job.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot cancel schedule for job '${job.jobNumber}' while it is actively IN_PROGRESS`
      );
    }

    schedule.history.push({
      action: 'UNSCHEDULE',
      previousFurnaceId: schedule.furnaceId,
      previousFurnaceCode: schedule.furnaceCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason,
      notes: dto.notes || null
    });

    schedule.status = 'UNSCHEDULED';
    await schedule.save();

    // Revert Job to backlog state (APPROVED)
    const prevStatus = job.status;
    job.status = 'APPROVED';
    job.equipmentAssignment = {
      furnaceId: null,
      furnaceCode: null,
      locationBay: null,
      pyrometryClass: null
    };

    job.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'APPROVED',
      timestamp: new Date(),
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `Schedule cancelled: ${dto.reason}. Returned to backlog.`
    });

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action: 'REMOVE',
      previousResourceId: schedule.furnaceId,
      previousResourceCode: schedule.furnaceCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'UNSCHEDULE_PRODUCTION_JOB',
      entityType: 'PRODUCTION_SCHEDULE',
      entityId: schedule.id,
      afterState: schedule.toJSON(),
      metadata: {
        scheduleNumber: schedule.scheduleNumber,
        jobNumber: job.jobNumber,
        reason: dto.reason
      }
    });

    return schedule;
  }

  public async getProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const schedules = await this.repo.querySchedules(tenantId, {
      ...filters,
      status: filters.status || 'SCHEDULED'
    }, { page: 1, limit: 100 });

    const sorted = [...schedules.items].sort((a, b) => {
      const pA = PRIORITY_WEIGHTS[a.priority] || 4;
      const pB = PRIORITY_WEIGHTS[b.priority] || 4;

      if (pA !== pB) return pA - pB;

      const dateA = new Date(a.startTime).getTime();
      const dateB = new Date(b.startTime).getTime();
      return dateA - dateB;
    });

    return sorted.map((s, idx) => ({
      queuePosition: idx + 1,
      scheduleId: s.id,
      scheduleNumber: s.scheduleNumber,
      jobId: s.jobId,
      jobNumber: s.jobNumber,
      planNumber: s.planNumber,
      customerName: s.customerName,
      itemCode: s.itemCode,
      itemName: s.itemName,
      materialGrade: s.materialGrade,
      processFamily: s.processFamily,
      furnaceId: s.furnaceId,
      furnaceCode: s.furnaceCode,
      operatorId: s.operatorId,
      operatorName: s.operatorName,
      shift: s.shift,
      startTime: s.startTime,
      endTime: s.endTime,
      durationHours: s.durationHours,
      status: s.status,
      priority: s.priority
    }));
  }

  public async querySchedules(
    tenantId: string,
    filters: QueryScheduleDto = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<ProductionScheduleDocument>> {
    return this.repo.querySchedules(tenantId, filters, pagination);
  }

  public async getScheduleById(
    tenantId: string,
    id: string
  ): Promise<ProductionScheduleDocument> {
    const schedule = await this.repo.findById(tenantId, id);
    if (!schedule || schedule.isDeleted) {
      throw new NotFoundError(`Production Schedule with ID '${id}' not found`);
    }
    return schedule;
  }
}

export const productionScheduleService = new ProductionScheduleService();
