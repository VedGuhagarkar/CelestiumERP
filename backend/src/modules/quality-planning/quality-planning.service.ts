import {
  IQualityPlanningRepository,
  qualityPlanningRepository
} from './quality-planning.repository.js';
import {
  CreateQualityPlanDto,
  UpdateQualityPlanDto,
  ApproveQualityPlanDto,
  CreateQualityPlanRevisionDto,
  QueryQualityPlansDto,
  QualityPlanDocument,
  IQualityPlan,
  IQualityPlanSnapshot,
  IQualityPlanComplianceResult,
  IInspectionCharacteristic
} from './quality-planning.types.js';
import { specificationRepository } from '../specification/specification.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEventBus } from '../../core/events/domain-event-bus.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import { IQualityInspection } from '../quality-inspection/quality-inspection.types.js';
import { ILaboratoryTestRecord } from '../metallurgical-lab/metallurgical-lab.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class QualityPlanningService {
  private readonly eventBus = DomainEventBus.getInstance();

  constructor(
    private readonly repo: IQualityPlanningRepository = qualityPlanningRepository
  ) {}

  public async createPlan(
    tenantId: string,
    actor: IActorContext,
    dto: CreateQualityPlanDto
  ): Promise<QualityPlanDocument> {
    const spec = await specificationRepository.findById(tenantId, dto.specificationId);
    if (!spec) {
      throw new NotFoundError(
        `Authoritative Specification with ID '${dto.specificationId}' not found in Master Data`
      );
    }

    const planCode =
      dto.planCode?.toUpperCase() ||
      (await this.repo.generateNextPlanCode(tenantId, dto.processFamily));

    const existing = await this.repo.findByPlanCodeAndRevision(tenantId, planCode, 1);
    if (existing) {
      throw new BadRequestError(`Quality Plan with code '${planCode}' (Rev 1) already exists`);
    }

    const now = new Date();

    const plan = await this.repo.create(tenantId, {
      planCode,
      revisionNumber: 1,
      title: dto.title,
      description: dto.description || null,
      status: 'DRAFT',
      processFamily: dto.processFamily,
      specificationId: spec.id,
      specCode: spec.specCode,
      specRevisionNumber: spec.revision,
      applicableCustomerCodes: dto.applicableCustomerCodes?.map((c) => c.toUpperCase()) || [],
      applicableItemCategories: dto.applicableItemCategories?.map((c) => c.toUpperCase()) || [],
      characteristics: dto.characteristics,
      authorId: actor.userId,
      revisionHistory: [
        {
          revision: 1,
          changedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          changedAt: now,
          changeDescription: 'Initial Quality Plan draft creation'
        }
      ],
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'CREATE_QUALITY_PLAN',
      entityType: 'QUALITY_PLAN',
      entityId: plan.id,
      afterState: plan.toJSON ? plan.toJSON() : plan,
      metadata: {
        planCode: plan.planCode,
        specCode: plan.specCode,
        processFamily: plan.processFamily
      }
    });

    return plan;
  }

  public async updateDraftPlan(
    tenantId: string,
    actor: IActorContext,
    planId: string,
    dto: UpdateQualityPlanDto
  ): Promise<QualityPlanDocument> {
    const plan = await this.repo.findById(tenantId, planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Quality Plan with ID '${planId}' not found`);
    }

    if (plan.status !== 'DRAFT') {
      throw new BadRequestError(
        `Cannot modify Quality Plan '${plan.planCode}' (Rev ${plan.revisionNumber}) because it is in '${plan.status}' status. Approved criteria are strictly locked; create a new revision instead.`
      );
    }

    if (dto.title) plan.title = dto.title;
    if (dto.description !== undefined) plan.description = dto.description || null;
    if (dto.applicableCustomerCodes) {
      plan.applicableCustomerCodes = dto.applicableCustomerCodes.map((c) => c.toUpperCase());
    }
    if (dto.applicableItemCategories) {
      plan.applicableItemCategories = dto.applicableItemCategories.map((c) => c.toUpperCase());
    }
    if (dto.characteristics) {
      plan.characteristics = dto.characteristics;
    }
    if (dto.notes !== undefined) plan.notes = dto.notes || null;

    await plan.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'UPDATE_QUALITY_PLAN_DRAFT',
      entityType: 'QUALITY_PLAN',
      entityId: plan.id,
      afterState: plan.toJSON ? plan.toJSON() : plan,
      metadata: {
        planCode: plan.planCode,
        revisionNumber: plan.revisionNumber
      }
    });

    return plan;
  }

  public async approvePlan(
    tenantId: string,
    actor: IActorContext,
    planId: string,
    dto: ApproveQualityPlanDto
  ): Promise<QualityPlanDocument> {
    const plan = await this.repo.findById(tenantId, planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Quality Plan with ID '${planId}' not found`);
    }

    if (plan.status !== 'DRAFT') {
      throw new BadRequestError(
        `Quality Plan '${plan.planCode}' is in '${plan.status}' status and cannot be approved`
      );
    }

    const now = new Date();

    // Mark previous revisions obsolete
    await this.repo.markPreviousRevisionsObsolete(
      tenantId,
      plan.planCode,
      plan.revisionNumber
    );

    plan.status = 'APPROVED';
    plan.approvedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      approvedAt: now,
      remarks: dto.remarks || null
    };

    await plan.save();

    this.eventBus.publish({
      name: DomainEvents.QUALITY_PLAN_APPROVED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        planId: plan.id,
        planCode: plan.planCode,
        revisionNumber: plan.revisionNumber,
        specCode: plan.specCode,
        processFamily: plan.processFamily
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'APPROVE_QUALITY_PLAN',
      entityType: 'QUALITY_PLAN',
      entityId: plan.id,
      afterState: plan.toJSON ? plan.toJSON() : plan,
      metadata: {
        planCode: plan.planCode,
        revisionNumber: plan.revisionNumber,
        remarks: dto.remarks
      }
    });

    return plan;
  }

  public async createRevision(
    tenantId: string,
    actor: IActorContext,
    planId: string,
    dto: CreateQualityPlanRevisionDto
  ): Promise<QualityPlanDocument> {
    const currentPlan = await this.repo.findById(tenantId, planId);
    if (!currentPlan || currentPlan.isDeleted) {
      throw new NotFoundError(`Quality Plan with ID '${planId}' not found`);
    }

    if (currentPlan.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot create revision from Quality Plan '${currentPlan.planCode}' because it is in '${currentPlan.status}' status. Only APPROVED plans can be revised.`
      );
    }

    const nextRevision = currentPlan.revisionNumber + 1;
    const now = new Date();

    const characteristics = dto.updatedCharacteristics || currentPlan.characteristics;

    const revisionHistory = [
      ...currentPlan.revisionHistory,
      {
        revision: nextRevision,
        changedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        changedAt: now,
        changeDescription: dto.changeDescription
      }
    ];

    const newRevisionPlan = await this.repo.create(tenantId, {
      planCode: currentPlan.planCode,
      revisionNumber: nextRevision,
      title: currentPlan.title,
      description: currentPlan.description,
      status: 'DRAFT',
      processFamily: currentPlan.processFamily,
      specificationId: currentPlan.specificationId,
      specCode: currentPlan.specCode,
      specRevisionNumber: currentPlan.specRevisionNumber,
      applicableCustomerCodes: currentPlan.applicableCustomerCodes,
      applicableItemCategories: currentPlan.applicableItemCategories,
      characteristics,
      authorId: actor.userId,
      revisionHistory,
      notes: dto.notes || currentPlan.notes
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'CREATE_QUALITY_PLAN_REVISION',
      entityType: 'QUALITY_PLAN',
      entityId: newRevisionPlan.id,
      afterState: newRevisionPlan.toJSON ? newRevisionPlan.toJSON() : newRevisionPlan,
      metadata: {
        planCode: newRevisionPlan.planCode,
        fromRevision: currentPlan.revisionNumber,
        toRevision: nextRevision,
        changeDescription: dto.changeDescription
      }
    });

    return newRevisionPlan;
  }

  public async getPlanById(
    tenantId: string,
    id: string
  ): Promise<QualityPlanDocument> {
    const plan = await this.repo.findById(tenantId, id);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Quality Plan with ID '${id}' not found`);
    }
    return plan;
  }

  public async getActiveApprovedPlan(
    tenantId: string,
    planCode: string
  ): Promise<QualityPlanDocument> {
    const plan = await this.repo.findActiveApprovedRevision(tenantId, planCode);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Active APPROVED Quality Plan with code '${planCode}' not found`);
    }
    return plan;
  }

  public async findApplicablePlan(
    tenantId: string,
    params: {
      processFamily: string;
      specCode: string;
      customerCode?: string;
    }
  ): Promise<QualityPlanDocument | null> {
    return this.repo.findApplicablePlan(tenantId, params);
  }

  public async queryPlans(
    tenantId: string,
    filters: QueryQualityPlansDto = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<QualityPlanDocument>> {
    return this.repo.queryPlans(tenantId, filters, pagination);
  }

  public createSnapshot(plan: IQualityPlan): IQualityPlanSnapshot {
    return {
      planId: plan.id,
      planCode: plan.planCode,
      revisionNumber: plan.revisionNumber,
      title: plan.title,
      processFamily: plan.processFamily,
      specCode: plan.specCode,
      specRevisionNumber: plan.specRevisionNumber,
      characteristics: plan.characteristics,
      snapshottedAt: new Date()
    };
  }

  /**
   * Evaluates whether recorded inspection and laboratory measurements satisfy
   * all mandatory characteristics defined in the Quality Plan snapshot.
   */
  public evaluateInspectionCompliance(
    planSnapshot: IQualityPlanSnapshot,
    inspection: Partial<IQualityInspection>,
    labRecords: Partial<ILaboratoryTestRecord>[] = []
  ): IQualityPlanComplianceResult {
    const missingMandatoryChecks: string[] = [];
    const nonConformingChecks: string[] = [];

    const mandatoryCharacteristics = planSnapshot.characteristics.filter(
      (c) => c.isMandatory
    );

    let passedChecksCount = 0;

    for (const char of mandatoryCharacteristics) {
      let isRecorded = false;
      let isConforming = false;

      switch (char.characteristicType) {
        case 'SURFACE_HARDNESS': {
          const surfaceTest = inspection.testResults?.hardnessTests?.find(
            (h) => h.location === 'SURFACE' || h.location === 'CASE'
          );
          const labHardness = labRecords.flatMap((r) => r.hardnessMeasurements || []).find(
            (h) => h.location === 'SURFACE' || h.location === 'CASE'
          );

          if (surfaceTest || labHardness) {
            isRecorded = true;
            isConforming = surfaceTest ? surfaceTest.passed : (labHardness?.passed !== false);
          }
          break;
        }

        case 'CORE_HARDNESS': {
          const coreTest = inspection.testResults?.hardnessTests?.find(
            (h) => h.location === 'CORE'
          );
          const labHardness = labRecords.flatMap((r) => r.hardnessMeasurements || []).find(
            (h) => h.location === 'CORE'
          );

          if (coreTest || labHardness) {
            isRecorded = true;
            isConforming = coreTest ? coreTest.passed : (labHardness?.passed !== false);
          }
          break;
        }

        case 'EFFECTIVE_CASE_DEPTH':
        case 'TOTAL_CASE_DEPTH': {
          const caseTest = inspection.testResults?.caseDepth;
          const labTraverse = labRecords.flatMap((r) => r.hardnessTraverses || [])[0];

          if (caseTest || labTraverse) {
            isRecorded = true;
            isConforming = caseTest ? caseTest.passed : (labTraverse?.passed !== false);
          }
          break;
        }

        case 'MICROSTRUCTURE_MATRIX':
        case 'RETAINED_AUSTENITE':
        case 'GRAIN_SIZE':
        case 'DECARBURIZATION':
        case 'CARBIDE_MORPHOLOGY': {
          const microTest = inspection.testResults?.microstructure;
          const labMicro = labRecords.flatMap((r) => r.microstructureObservations || [])[0];

          if (microTest || labMicro) {
            isRecorded = true;
            isConforming = microTest ? microTest.passed : true;
          }
          break;
        }

        case 'VISUAL_DIMENSIONAL': {
          const visualTest = inspection.testResults?.visualDimensional;
          if (visualTest) {
            isRecorded = true;
            isConforming = visualTest.passed;
          }
          break;
        }

        case 'PYROMETRY_VERIFICATION': {
          const pyroTest = inspection.testResults?.pyrometry;
          if (pyroTest) {
            isRecorded = true;
            isConforming = pyroTest.passed;
          }
          break;
        }

        default: {
          isRecorded = true;
          isConforming = true;
          break;
        }
      }

      if (!isRecorded) {
        missingMandatoryChecks.push(`${char.itemCode} (${char.name})`);
      } else if (!isConforming) {
        nonConformingChecks.push(`${char.itemCode} (${char.name})`);
      } else {
        passedChecksCount += 1;
      }
    }

    const compliant =
      missingMandatoryChecks.length === 0 && nonConformingChecks.length === 0;

    let summary = 'Quality inspection meets all mandatory checklist requirements.';
    if (missingMandatoryChecks.length > 0) {
      summary = `Missing mandatory inspection checks: ${missingMandatoryChecks.join(', ')}.`;
    } else if (nonConformingChecks.length > 0) {
      summary = `Non-conforming inspection results detected in: ${nonConformingChecks.join(', ')}.`;
    }

    return {
      compliant,
      totalChecks: planSnapshot.characteristics.length,
      mandatoryChecksCount: mandatoryCharacteristics.length,
      passedChecksCount,
      missingMandatoryChecks,
      nonConformingChecks,
      evaluationSummary: summary
    };
  }
}

export const qualityPlanningService = new QualityPlanningService();
