import {
  IProductionJobRepository,
  productionJobRepository
} from './production-job.repository.js';
import {
  CreateDirectJobDto,
  UpdateJobDto,
  AssignOperatorDto,
  RemoveOperatorDto,
  AssignFurnaceDto,
  RemoveFurnaceDto,
  TransitionJobDto,
  CancelJobDto,
  ConvertPlanToJobDto,
  QueryJobsDto,
  ProductionJobDocument,
  IJobRecipeSnapshot,
  IJobSpecificationSnapshot,
  IJobMaterialAllocation,
  ALLOWED_STATUS_TRANSITIONS,
  PRIORITY_WEIGHTS
} from './production-job.types.js';
import { customerRepository } from '../customer/customer.repository.js';
import { itemRepository } from '../item/item.repository.js';
import { recipeRepository } from '../recipe/recipe.repository.js';
import { specificationRepository } from '../specification/specification.repository.js';
import { productionPlanRepository } from '../production-planning/production-plan.repository.js';
import { constraintAnalysisService } from '../constraint-analysis/constraint-analysis.service.js';
import { materialRequirementsRepository } from '../material-requirements/material-requirements.repository.js';
import { furnaceCapacityRepository } from '../furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../workforce-capacity/workforce-capacity.repository.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class ProductionJobService {
  constructor(
    private readonly repo: IProductionJobRepository = productionJobRepository
  ) {}

  public async createDirectJob(
    tenantId: string,
    actor: IActorContext,
    dto: CreateDirectJobDto
  ): Promise<ProductionJobDocument> {
    const customer = await customerRepository.findById(tenantId, dto.customerId);
    if (!customer || customer.isDeleted) {
      throw new NotFoundError(`Customer with ID '${dto.customerId}' not found`);
    }

    const item = await itemRepository.findById(tenantId, dto.itemId);
    if (!item || item.isDeleted) {
      throw new NotFoundError(`Item with ID '${dto.itemId}' not found`);
    }

    const recipe = await recipeRepository.findById(tenantId, dto.recipeId);
    if (!recipe || recipe.isDeleted || (recipe.status !== 'APPROVED' && recipe.status !== 'ACTIVE')) {
      throw new BadRequestError(
        `Recipe with ID '${dto.recipeId}' must be in APPROVED or ACTIVE status for job creation`
      );
    }

    const spec = await specificationRepository.findById(tenantId, dto.specificationId);
    if (!spec || spec.isDeleted || (spec.status !== 'APPROVED' && spec.status !== 'ACTIVE')) {
      throw new BadRequestError(
        `Specification with ID '${dto.specificationId}' must be in APPROVED or ACTIVE status for job creation`
      );
    }

    const recipeSnapshot: IJobRecipeSnapshot = {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revisionNumber: recipe.revision,
      processFamily: recipe.processFamily,
      name: recipe.name,
      applicableMaterialGrades: recipe.applicableMaterialGrades || [],
      stages: recipe.stages || [],
      metallurgicalTargets: recipe.metallurgicalTargets || ({} as any),
      machineRequirements: recipe.machineRequirements || ({} as any),
      snapshottedAt: new Date()
    };

    const specificationSnapshot: IJobSpecificationSnapshot = {
      specificationId: spec.id,
      specCode: spec.specCode,
      revisionNumber: spec.revision,
      title: spec.title,
      customerCode: spec.customerCode,
      surfaceHardness: spec.surfaceHardness || ({} as any),
      coreHardness: spec.coreHardness,
      caseDepth: spec.caseDepth,
      microstructure: spec.microstructure,
      customerAcceptance: spec.customerAcceptance || ({} as any),
      snapshottedAt: new Date()
    };

    let equipmentAssignment = {
      furnaceId: null as string | null,
      furnaceCode: null as string | null,
      locationBay: null as string | null,
      pyrometryClass: null as string | null
    };

    if (dto.assignedFurnaceId) {
      const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, dto.assignedFurnaceId);
      if (furnace) {
        equipmentAssignment = {
          furnaceId: furnace.id,
          furnaceCode: furnace.furnaceCode,
          locationBay: furnace.locationBay,
          pyrometryClass: furnace.thermalCapabilities.pyrometryClass
        };
      }
    }

    let operatorAssignment = {
      operatorId: null as string | null,
      operatorCode: null as string | null,
      operatorName: null as string | null,
      shift: dto.shift || null
    };

    if (dto.assignedOperatorId) {
      const operator = await workforceCapacityRepository.findEmployeeById(
        tenantId,
        dto.assignedOperatorId
      );
      if (operator) {
        operatorAssignment = {
          operatorId: operator.id,
          operatorCode: operator.employeeCode,
          operatorName: operator.fullName,
          shift: dto.shift || operator.defaultShift
        };
      }
    }

    const materialAllocations: IJobMaterialAllocation[] = (dto.materialAllocations || []).map((m) => ({
      reservationId: null,
      heatLotId: m.heatLotId || null,
      heatLotNumber: m.heatLotNumber || null,
      allocatedQuantity: m.allocatedQuantity,
      uom: m.uom
    }));

    const jobNumber = await this.repo.generateNextJobNumber(tenantId);

    const initialTransition = {
      fromStatus: 'DRAFT' as const,
      toStatus: 'DRAFT' as const,
      timestamp: new Date(),
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: 'Direct Job Initiation',
      notes: dto.notes || null
    };

    const job = await this.repo.create(tenantId, {
      jobNumber,
      customer: {
        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.companyName
      },
      item: {
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        materialGrade: item.materialGrade || 'GENERIC',
        uom: item.uom
      },
      quantity: {
        targetQuantity: dto.targetQuantity,
        loadedQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      status: 'DRAFT',
      priority: dto.priority || 'NORMAL',
      recipeSnapshot,
      specificationSnapshot,
      materialAllocations,
      equipmentAssignment,
      operatorAssignment,
      timeline: {
        plannedStartDate: new Date(dto.plannedStartDate),
        targetCompletionDate: new Date(dto.targetCompletionDate),
        actualStartDate: null,
        actualCompletionDate: null
      },
      transitionHistory: [initialTransition],
      assignmentHistory: [],
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'CREATE_PRODUCTION_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON(),
      metadata: {
        jobNumber: job.jobNumber,
        itemCode: item.itemCode,
        recipeCode: recipe.recipeCode,
        specCode: spec.specCode
      }
    });

    return job;
  }

  public async updateJob(
    tenantId: string,
    actorId: string,
    jobId: string,
    dto: UpdateJobDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    const preProductionStates = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED'];
    if (!preProductionStates.includes(job.status)) {
      throw new BadRequestError(
        `Cannot modify production job '${job.jobNumber}' in status '${job.status}'. Modifications are strictly locked once heat-treatment execution has commenced.`
      );
    }

    const beforeState = job.toJSON();

    if (dto.targetQuantity !== undefined) job.quantity.targetQuantity = dto.targetQuantity;
    if (dto.priority !== undefined) job.priority = dto.priority;
    if (dto.plannedStartDate) job.timeline.plannedStartDate = new Date(dto.plannedStartDate);
    if (dto.targetCompletionDate) job.timeline.targetCompletionDate = new Date(dto.targetCompletionDate);
    if (dto.notes !== undefined) job.notes = dto.notes;

    if (dto.assignedFurnaceId) {
      const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, dto.assignedFurnaceId);
      if (furnace) {
        job.equipmentAssignment = {
          furnaceId: furnace.id,
          furnaceCode: furnace.furnaceCode,
          locationBay: furnace.locationBay,
          pyrometryClass: furnace.thermalCapabilities.pyrometryClass
        };
      }
    }

    if (dto.assignedOperatorId) {
      const operator = await workforceCapacityRepository.findEmployeeById(
        tenantId,
        dto.assignedOperatorId
      );
      if (operator) {
        job.operatorAssignment = {
          operatorId: operator.id,
          operatorCode: operator.employeeCode,
          operatorName: operator.fullName,
          shift: dto.shift || operator.defaultShift
        };
      }
    }

    await job.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'UPDATE_PRODUCTION_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      beforeState,
      afterState: job.toJSON()
    });

    return job;
  }

  public async assignOperator(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: AssignOperatorDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new BadRequestError(
        `Cannot assign operator to a '${job.status}' production job`
      );
    }

    // 1. Validate Operator Existence and Active Status
    const operator = await workforceCapacityRepository.findEmployeeById(
      tenantId,
      dto.operatorId
    );
    if (!operator || operator.isDeleted || operator.status !== 'ACTIVE') {
      throw new BadRequestError(
        `Operator with ID '${dto.operatorId}' not found or is not in ACTIVE status`
      );
    }

    const jobStart = new Date(job.timeline.plannedStartDate);
    const jobEnd = new Date(job.timeline.targetCompletionDate);

    // 2. Validate Operator Leave Schedule
    const onLeave = (operator.approvedLeaves || []).some((leave) => {
      const lStart = new Date(leave.startDate);
      const lEnd = new Date(leave.endDate);
      return jobStart <= lEnd && jobEnd >= lStart;
    });

    if (onLeave) {
      throw new BadRequestError(
        `Operator '${operator.fullName}' has approved leave overlapping the planned job window`
      );
    }

    // 3. Validate Operator Qualification for Recipe Process Family
    const processFamily = job.recipeSnapshot?.processFamily || 'CARBURIZING';
    const reqSkillCode = `${processFamily}_OPERATION`;

    const isQualified = (operator.skills || []).some((s) => {
      const isSkillMatch =
        s.skillCode === reqSkillCode ||
        s.skillCode === 'SEALED_QUENCH_FURNACE_OPERATION' ||
        s.skillCode === 'VACUUM_FURNACE_OPERATION' ||
        s.skillCode === 'PIT_FURNACE_OPERATION' ||
        s.skillCode === 'NITRIDING_OPERATION';

      const isCertified = s.isCertified;
      const isNotExpired = !s.expiryDate || new Date(s.expiryDate) >= jobStart;

      return isSkillMatch && isCertified && isNotExpired;
    });

    if (!isQualified) {
      throw new BadRequestError(
        `Operator '${operator.fullName}' (${operator.employeeCode}) lacks certified, non-expired qualification for process '${processFamily}'`
      );
    }

    const previousResourceId = job.operatorAssignment?.operatorId || null;
    const previousResourceCode = job.operatorAssignment?.operatorCode || null;
    const action = previousResourceId ? 'REALLOCATE' : 'ASSIGN';

    job.operatorAssignment = {
      operatorId: operator.id,
      operatorCode: operator.employeeCode,
      operatorName: operator.fullName,
      shift: dto.shift || operator.defaultShift
    };

    job.assignmentHistory.push({
      resourceType: 'OPERATOR',
      action,
      previousResourceId,
      previousResourceCode,
      newResourceId: operator.id,
      newResourceCode: operator.employeeCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason || null,
      notes: dto.notes || null
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: `${action}_JOB_OPERATOR`,
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        operatorCode: operator.employeeCode,
        shift: job.operatorAssignment.shift
      }
    });

    return job;
  }

  public async removeOperator(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: RemoveOperatorDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot remove operator while job '${job.jobNumber}' is actively IN_PROGRESS. Please pause the job first.`
      );
    }

    if (!job.operatorAssignment?.operatorId) {
      throw new BadRequestError(
        `No operator currently assigned to job '${job.jobNumber}'`
      );
    }

    const previousResourceId = job.operatorAssignment.operatorId;
    const previousResourceCode = job.operatorAssignment.operatorCode;

    job.operatorAssignment = {
      operatorId: null,
      operatorCode: null,
      operatorName: null,
      shift: null
    };

    job.assignmentHistory.push({
      resourceType: 'OPERATOR',
      action: 'REMOVE',
      previousResourceId,
      previousResourceCode,
      newResourceId: null,
      newResourceCode: null,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason,
      notes: dto.notes || null
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'REMOVE_JOB_OPERATOR',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        removedOperatorCode: previousResourceCode,
        reason: dto.reason
      }
    });

    return job;
  }

  public async assignFurnace(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: AssignFurnaceDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new BadRequestError(
        `Cannot assign furnace to a '${job.status}' production job`
      );
    }

    if (job.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot reallocate furnace while job '${job.jobNumber}' is actively IN_PROGRESS. Please pause the job first.`
      );
    }

    // 1. Validate Furnace Existence
    const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, dto.furnaceId);
    if (!furnace || furnace.isDeleted) {
      throw new NotFoundError(`Furnace with ID '${dto.furnaceId}' not found`);
    }

    // 2. Validate Furnace Machine Availability
    if (furnace.status !== 'OPERATIONAL') {
      throw new BadRequestError(
        `Furnace '${furnace.furnaceCode}' is not available for assignment (Current status: '${furnace.status}')`
      );
    }

    // 3. Validate Process Family Capability
    const processFamily = job.recipeSnapshot?.processFamily || 'CARBURIZING';
    if (!furnace.processCapabilities.supportedProcessFamilies.includes(processFamily)) {
      throw new BadRequestError(
        `Furnace '${furnace.furnaceCode}' does not support process family '${processFamily}'`
      );
    }

    // 4. Validate Operating Temperature Envelope [Tmin, Tmax]
    const recipeStages = job.recipeSnapshot?.stages || [];
    const maxRecipeTemp = Math.max(...recipeStages.map((s) => s.targetTemperatureC), 0);

    if (
      maxRecipeTemp > furnace.thermalCapabilities.maxOperatingTempC ||
      maxRecipeTemp < furnace.thermalCapabilities.minOperatingTempC
    ) {
      throw new BadRequestError(
        `Recipe temperature (${maxRecipeTemp}°C) is outside furnace '${furnace.furnaceCode}' thermal operating envelope [${furnace.thermalCapabilities.minOperatingTempC}°C - ${furnace.thermalCapabilities.maxOperatingTempC}°C]`
      );
    }

    // 5. Validate Schedule Collision on Furnace
    const jobStart = new Date(job.timeline.plannedStartDate);
    const jobEnd = new Date(job.timeline.targetCompletionDate);

    const conflictingJobs = await this.repo.findConflictingJobs(
      tenantId,
      furnace.id,
      jobStart,
      jobEnd,
      job.id
    );

    if (conflictingJobs.length > 0) {
      throw new BadRequestError(
        `Schedule conflict: Furnace '${furnace.furnaceCode}' is already allocated to job '${conflictingJobs[0].jobNumber}' during this time window`
      );
    }

    const previousResourceId = job.equipmentAssignment?.furnaceId || null;
    const previousResourceCode = job.equipmentAssignment?.furnaceCode || null;
    const action = previousResourceId ? 'REALLOCATE' : 'ASSIGN';

    job.equipmentAssignment = {
      furnaceId: furnace.id,
      furnaceCode: furnace.furnaceCode,
      locationBay: furnace.locationBay,
      pyrometryClass: furnace.thermalCapabilities.pyrometryClass
    };

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action,
      previousResourceId,
      previousResourceCode,
      newResourceId: furnace.id,
      newResourceCode: furnace.furnaceCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason || null,
      notes: dto.notes || null
    });

    if (job.status === 'APPROVED') {
      job.status = 'SCHEDULED';
    }

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: `${action}_JOB_FURNACE`,
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        furnaceCode: furnace.furnaceCode,
        pyrometryClass: furnace.thermalCapabilities.pyrometryClass
      }
    });

    return job;
  }

  public async removeFurnace(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: RemoveFurnaceDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot remove furnace while job '${job.jobNumber}' is actively IN_PROGRESS. Please pause the job first.`
      );
    }

    if (!job.equipmentAssignment?.furnaceId) {
      throw new BadRequestError(
        `No furnace currently assigned to job '${job.jobNumber}'`
      );
    }

    const previousResourceId = job.equipmentAssignment.furnaceId;
    const previousResourceCode = job.equipmentAssignment.furnaceCode;

    job.equipmentAssignment = {
      furnaceId: null,
      furnaceCode: null,
      locationBay: null,
      pyrometryClass: null
    };

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action: 'REMOVE',
      previousResourceId,
      previousResourceCode,
      newResourceId: null,
      newResourceCode: null,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: new Date(),
      reason: dto.reason,
      notes: dto.notes || null
    });

    if (job.status === 'SCHEDULED') {
      job.status = 'APPROVED';
    }

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'REMOVE_JOB_FURNACE',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        removedFurnaceCode: previousResourceCode,
        reason: dto.reason
      }
    });

    return job;
  }

  public async transitionJob(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: TransitionJobDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    const currentStatus = job.status;
    const targetStatus = dto.toStatus;

    if (currentStatus === targetStatus) {
      return job;
    }

    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid lifecycle transition: Cannot transition job '${job.jobNumber}' from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${(allowedTransitions || []).join(', ')}]`
      );
    }

    const beforeState = job.toJSON();

    job.transitionHistory.push({
      fromStatus: currentStatus,
      toStatus: targetStatus,
      timestamp: new Date(),
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.reason || null,
      notes: dto.notes || null
    });

    if (targetStatus === 'IN_PROGRESS' && !job.timeline.actualStartDate) {
      job.timeline.actualStartDate = new Date();
    }
    if (targetStatus === 'COMPLETED' && !job.timeline.actualCompletionDate) {
      job.timeline.actualCompletionDate = new Date();
    }
    if (targetStatus === 'CANCELLED') {
      job.cancellationReason = dto.reason || 'Cancelled during lifecycle transition';
    }

    job.status = targetStatus;
    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'TRANSITION_PRODUCTION_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      beforeState,
      afterState: job.toJSON(),
      metadata: {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        reason: dto.reason
      }
    });

    return job;
  }

  public async cancelJob(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: CancelJobDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status === 'COMPLETED') {
      throw new BadRequestError(`Cannot cancel a COMPLETED production job ('${job.jobNumber}')`);
    }
    if (job.status === 'CANCELLED') {
      throw new BadRequestError(`Production job '${job.jobNumber}' is already CANCELLED`);
    }

    return this.transitionJob(tenantId, actor, jobId, {
      toStatus: 'CANCELLED',
      reason: dto.reason,
      notes: dto.notes
    });
  }

  public async getProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const jobs = await this.repo.findActiveQueueJobs(tenantId, filters);

    const sorted = [...jobs].sort((a, b) => {
      const pA = PRIORITY_WEIGHTS[a.priority] || 4;
      const pB = PRIORITY_WEIGHTS[b.priority] || 4;

      if (pA !== pB) return pA - pB;

      const dateA = new Date(a.timeline.targetCompletionDate).getTime();
      const dateB = new Date(b.timeline.targetCompletionDate).getTime();
      return dateA - dateB;
    });

    return sorted.map((job, idx) => ({
      queuePosition: idx + 1,
      id: job.id,
      jobNumber: job.jobNumber,
      planNumber: job.planNumber,
      customerName: job.customer.customerName,
      itemCode: job.item.itemCode,
      itemName: job.item.itemName,
      targetQuantity: job.quantity.targetQuantity,
      uom: job.item.uom,
      status: job.status,
      priority: job.priority,
      furnaceCode: job.equipmentAssignment?.furnaceCode || 'UNASSIGNED',
      plannedStartDate: job.timeline.plannedStartDate,
      targetCompletionDate: job.timeline.targetCompletionDate
    }));
  }

  public async convertPlanToJob(
    tenantId: string,
    actorId: string,
    planId: string,
    dto: ConvertPlanToJobDto = {}
  ): Promise<ProductionJobDocument> {
    if (dto.idempotencyKey) {
      const existingJob = await this.repo.findByIdempotencyKey(
        tenantId,
        planId,
        dto.idempotencyKey
      );
      if (existingJob) {
        return existingJob;
      }
    }

    const plan = await productionPlanRepository.findById(tenantId, planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with ID '${planId}' not found`);
    }

    if (plan.status !== 'PLANNED' && plan.status !== 'CONFIRMED') {
      throw new BadRequestError(
        `Cannot convert plan '${plan.planNumber}' to production job: Plan status is '${plan.status}' (Must be PLANNED or CONFIRMED)`
      );
    }

    const constraintReport = await constraintAnalysisService.evaluatePlanConstraints(
      tenantId,
      plan.id
    );

    if (constraintReport.isBlocked) {
      const blockingMessages = constraintReport.violations
        .filter((v) => v.severity === 'BLOCKING')
        .map((v) => `[${v.category}] ${v.message}`)
        .join('; ');

      throw new BadRequestError(
        `Cannot convert plan '${plan.planNumber}' to production job: Blocked by active constraints - ${blockingMessages}`
      );
    }

    const recipe = await recipeRepository.findById(tenantId, plan.recipe.recipeId);
    if (!recipe || recipe.isDeleted || (recipe.status !== 'APPROVED' && recipe.status !== 'ACTIVE')) {
      throw new BadRequestError(
        `Approved recipe revision '${plan.recipe.recipeCode}' (Rev ${plan.recipe.recipeRevision}) is required for conversion`
      );
    }

    const specification = await specificationRepository.findById(
      tenantId,
      plan.specification.specificationId
    );
    if (
      !specification ||
      specification.isDeleted ||
      (specification.status !== 'APPROVED' && specification.status !== 'ACTIVE')
    ) {
      throw new BadRequestError(
        `Approved specification revision '${plan.specification.specCode}' (Rev ${plan.specification.specRevision}) is required for conversion`
      );
    }

    const recipeSnapshot: IJobRecipeSnapshot = {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revisionNumber: recipe.revision,
      processFamily: recipe.processFamily,
      name: recipe.name,
      applicableMaterialGrades: recipe.applicableMaterialGrades || [],
      stages: recipe.stages || [],
      metallurgicalTargets: recipe.metallurgicalTargets || ({} as any),
      machineRequirements: recipe.machineRequirements || ({} as any),
      snapshottedAt: new Date()
    };

    const specificationSnapshot: IJobSpecificationSnapshot = {
      specificationId: specification.id,
      specCode: specification.specCode,
      revisionNumber: specification.revision,
      title: specification.title,
      customerCode: specification.customerCode,
      surfaceHardness: specification.surfaceHardness || ({} as any),
      coreHardness: specification.coreHardness,
      caseDepth: specification.caseDepth,
      microstructure: specification.microstructure,
      customerAcceptance: specification.customerAcceptance || ({} as any),
      snapshottedAt: new Date()
    };

    const activeReservations = await materialRequirementsRepository.findActiveReservationsByPlan(
      tenantId,
      plan.id
    );

    const materialAllocations: IJobMaterialAllocation[] = activeReservations.map((res) => ({
      reservationId: res.id,
      heatLotId: res.targetType === 'HEAT_LOT' ? res.targetId : null,
      heatLotNumber: res.targetType === 'HEAT_LOT' ? res.targetIdentifier : null,
      allocatedQuantity: res.reservedQuantity,
      uom: res.uom
    }));

    let equipmentAssignment = {
      furnaceId: null as string | null,
      furnaceCode: null as string | null,
      locationBay: null as string | null,
      pyrometryClass: null as string | null
    };

    const targetFurnaceId = dto.assignedFurnaceId;
    if (targetFurnaceId) {
      const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, targetFurnaceId);
      if (furnace) {
        equipmentAssignment = {
          furnaceId: furnace.id,
          furnaceCode: furnace.furnaceCode,
          locationBay: furnace.locationBay,
          pyrometryClass: furnace.thermalCapabilities.pyrometryClass
        };
      }
    }

    let operatorAssignment = {
      operatorId: null as string | null,
      operatorCode: null as string | null,
      operatorName: null as string | null,
      shift: dto.shift || null
    };

    const targetOperatorId = dto.assignedOperatorId;
    if (targetOperatorId) {
      const operator = await workforceCapacityRepository.findEmployeeById(
        tenantId,
        targetOperatorId
      );
      if (operator) {
        operatorAssignment = {
          operatorId: operator.id,
          operatorCode: operator.employeeCode,
          operatorName: operator.fullName,
          shift: dto.shift || operator.defaultShift
        };
      }
    }

    const targetQuantity =
      dto.targetQuantity ||
      Math.max(0, plan.quantityTargets.plannedQuantity - plan.quantityTargets.completedQuantity);

    const jobNumber = await this.repo.generateNextJobNumber(tenantId);

    const initialTransition = {
      fromStatus: 'APPROVED' as const,
      toStatus: 'APPROVED' as const,
      timestamp: new Date(),
      performedBy: {
        userId: actorId
      },
      reason: 'Plan-to-Job Execution Handoff',
      notes: dto.notes || null
    };

    const job = await this.repo.create(tenantId, {
      jobNumber,
      planId: plan.id,
      planNumber: plan.planNumber,
      customer: {
        customerId: plan.customer.customerId,
        customerCode: plan.customer.customerCode,
        customerName: plan.customer.customerName
      },
      item: {
        itemId: plan.item.itemId,
        itemCode: plan.item.itemCode,
        itemName: plan.item.itemName,
        materialGrade: plan.item.materialGrade,
        uom: plan.item.uom
      },
      quantity: {
        targetQuantity,
        loadedQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      status: 'APPROVED',
      priority: plan.priority as any,
      recipeSnapshot,
      specificationSnapshot,
      materialAllocations,
      equipmentAssignment,
      operatorAssignment,
      timeline: {
        plannedStartDate: plan.timeline.plannedStartDate,
        targetCompletionDate: plan.timeline.targetCompletionDate,
        actualStartDate: null,
        actualCompletionDate: null
      },
      transitionHistory: [initialTransition],
      assignmentHistory: [],
      idempotencyKey: dto.idempotencyKey || null,
      notes: dto.notes || null
    });

    plan.status = 'IN_PROGRESS';
    await plan.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'CONVERT_PLAN_TO_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON(),
      metadata: {
        planNumber: plan.planNumber,
        jobNumber: job.jobNumber,
        itemCode: plan.item.itemCode,
        recipeCode: recipe.recipeCode,
        specCode: specification.specCode
      }
    });

    return job;
  }

  public async getJobs(
    tenantId: string,
    filters: QueryJobsDto = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<ProductionJobDocument>> {
    return this.repo.queryJobs(tenantId, filters, pagination);
  }

  public async getJobById(tenantId: string, id: string): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, id);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${id}' not found`);
    }
    return job;
  }

  public async getJobByNumber(
    tenantId: string,
    jobNumber: string
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findJobByNumber(tenantId, jobNumber);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with number '${jobNumber}' not found`);
    }
    return job;
  }

  public async getJobsByPlanId(
    tenantId: string,
    planId: string
  ): Promise<ProductionJobDocument[]> {
    return this.repo.findJobsByPlanId(tenantId, planId);
  }
}

export const productionJobService = new ProductionJobService();
