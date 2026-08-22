import {
  IProductionJobRepository,
  productionJobRepository
} from './production-job.repository.js';
import {
  ConvertPlanToJobDto,
  QueryJobsDto,
  ProductionJobDocument,
  IJobRecipeSnapshot,
  IJobSpecificationSnapshot,
  IJobMaterialAllocation
} from './production-job.types.js';
import { productionPlanRepository } from '../production-planning/production-plan.repository.js';
import { constraintAnalysisService } from '../constraint-analysis/constraint-analysis.service.js';
import { recipeRepository } from '../recipe/recipe.repository.js';
import { specificationRepository } from '../specification/specification.repository.js';
import { materialRequirementsRepository } from '../material-requirements/material-requirements.repository.js';
import { furnaceCapacityRepository } from '../furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../workforce-capacity/workforce-capacity.repository.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class ProductionJobService {
  constructor(
    private readonly repo: IProductionJobRepository = productionJobRepository
  ) {}

  public async convertPlanToJob(
    tenantId: string,
    actorId: string,
    planId: string,
    dto: ConvertPlanToJobDto = {}
  ): Promise<ProductionJobDocument> {
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existingJob = await this.repo.findByIdempotencyKey(
        tenantId,
        planId,
        dto.idempotencyKey
      );
      if (existingJob) {
        return existingJob; // Idempotent replay
      }
    }

    // 2. Fetch Originating Production Plan
    const plan = await productionPlanRepository.findById(tenantId, planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with ID '${planId}' not found`);
    }

    if (plan.status !== 'PLANNED' && plan.status !== 'CONFIRMED') {
      throw new BadRequestError(
        `Cannot convert plan '${plan.planNumber}' to production job: Plan status is '${plan.status}' (Must be PLANNED or CONFIRMED)`
      );
    }

    // 3. Pre-Handoff Constraint Analysis Gate
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

    // 4. Retrieve Exact Master Data for Snapshotting
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

    // 5. Construct Immutable Operational Snapshots
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

    // 6. Gather Material Reservations
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

    // 7. Equipment Assignment
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

    // 8. Operator Assignment
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

    // 9. Target Quantities
    const targetQuantity =
      dto.targetQuantity ||
      Math.max(0, plan.quantityTargets.plannedQuantity - plan.quantityTargets.completedQuantity);

    // 10. Generate Sequential Job Number
    const jobNumber = await this.repo.generateNextJobNumber(tenantId);

    // 11. Create Production Job Document
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
      status: 'RELEASED',
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
      idempotencyKey: dto.idempotencyKey || null,
      notes: dto.notes || null
    });

    // 12. Update Originating Plan Status
    plan.status = 'IN_PROGRESS';
    await plan.save();

    // 13. Audit Handoff Event
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
