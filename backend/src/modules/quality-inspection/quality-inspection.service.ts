import {
  IQualityInspectionRepository,
  qualityInspectionRepository
} from './quality-inspection.repository.js';
import {
  CreateQualityInspectionDto,
  AssignInspectorDto,
  RecordTestResultsDto,
  ApproveInspectionDto,
  RejectInspectionDto,
  RequestReinspectionDto,
  QueryQualityInspectionsDto,
  QualityInspectionDocument,
  IInspectorAssignment,
  IHardnessTestPoint
} from './quality-inspection.types.js';
import { productionJobRepository } from '../production-job/production-job.repository.js';
import { workforceCapacityRepository } from '../workforce-capacity/workforce-capacity.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEventBus } from '../../core/events/domain-event-bus.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class QualityInspectionService {
  private readonly eventBus = DomainEventBus.getInstance();

  constructor(
    private readonly repo: IQualityInspectionRepository = qualityInspectionRepository
  ) {}

  public async createInspection(
    tenantId: string,
    actor: IActorContext,
    dto: CreateQualityInspectionDto
  ): Promise<QualityInspectionDocument> {
    const job = await productionJobRepository.findById(tenantId, dto.jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${dto.jobId}' not found`);
    }

    let assignedInspector: IInspectorAssignment | null = null;
    if (dto.assignedInspectorId) {
      const employee = await workforceCapacityRepository.findEmployeeById(
        tenantId,
        dto.assignedInspectorId
      );
      if (!employee || employee.isDeleted || employee.status !== 'ACTIVE') {
        throw new BadRequestError(
          `Assigned employee '${dto.assignedInspectorId}' is not active or does not exist`
        );
      }

      assignedInspector = {
        inspectorId: employee.id,
        inspectorCode: employee.employeeCode,
        inspectorName: employee.fullName,
        assignedAt: new Date(),
        assignedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        }
      };
    }

    const inspectionNumber = await this.repo.generateNextInspectionNumber(tenantId);
    const sampleSize = dto.sampleSize || Math.max(3, Math.min(20, Math.ceil(job.quantity.targetQuantity * 0.05)));

    const now = new Date();
    const initialStatus = assignedInspector ? 'IN_REVIEW' : 'PENDING';

    const inspection = await this.repo.create(tenantId, {
      inspectionNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      planId: job.planId || null,
      planNumber: job.planNumber || null,
      status: initialStatus,
      disposition: 'PENDING',
      customer: {
        customerId: job.customer.customerId,
        customerCode: job.customer.customerCode,
        customerName: job.customer.customerName
      },
      item: {
        itemId: job.item.itemId,
        itemCode: job.item.itemCode,
        itemName: job.item.itemName,
        materialGrade: job.item.materialGrade,
        uom: job.item.uom
      },
      heatLots: (job.materialAllocations || []).map((m) => ({
        heatLotId: m.heatLotId || null,
        heatLotNumber: m.heatLotNumber || null,
        allocatedQuantity: m.allocatedQuantity,
        uom: m.uom
      })),
      recipeSnapshot: {
        recipeId: job.recipeSnapshot.recipeId,
        recipeCode: job.recipeSnapshot.recipeCode,
        revisionNumber: job.recipeSnapshot.revisionNumber,
        processFamily: job.recipeSnapshot.processFamily,
        name: job.recipeSnapshot.name,
        applicableMaterialGrades: job.recipeSnapshot.applicableMaterialGrades || [],
        stages: job.recipeSnapshot.stages || [],
        metallurgicalTargets: job.recipeSnapshot.metallurgicalTargets,
        machineRequirements: job.recipeSnapshot.machineRequirements
      },
      specificationSnapshot: {
        specificationId: job.specificationSnapshot.specificationId,
        specCode: job.specificationSnapshot.specCode,
        revisionNumber: job.specificationSnapshot.revisionNumber,
        title: job.specificationSnapshot.title,
        customerCode: job.specificationSnapshot.customerCode,
        surfaceHardness: job.specificationSnapshot.surfaceHardness,
        coreHardness: job.specificationSnapshot.coreHardness,
        caseDepth: job.specificationSnapshot.caseDepth,
        microstructure: job.specificationSnapshot.microstructure,
        customerAcceptance: job.specificationSnapshot.customerAcceptance
      },
      inspectionQuantity: {
        sampleSize,
        totalLotQuantity: job.quantity.completedQuantity || job.quantity.targetQuantity,
        unitOfMeasure: job.item.uom
      },
      assignedInspector,
      testResults: {
        hardnessTests: []
      },
      reinspection: {
        reinspectionCount: 0,
        parentInspectionId: null,
        reinspectionReason: null
      },
      assignmentHistory: assignedInspector
        ? [
            {
              action: 'ASSIGN',
              previousInspectorId: null,
              previousInspectorCode: null,
              newInspectorId: assignedInspector.inspectorId,
              newInspectorCode: assignedInspector.inspectorCode,
              performedBy: {
                userId: actor.userId,
                email: actor.email,
                role: actor.role
              },
              timestamp: now,
              reason: 'Initial assignment upon inspection creation'
            }
          ]
        : [],
      transitionHistory: [
        {
          fromStatus: 'PENDING',
          toStatus: initialStatus,
          timestamp: now,
          performedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          reason: 'Quality inspection request created'
        }
      ],
      notes: dto.notes || null
    });

    this.eventBus.publish({
      name: DomainEvents.QC_INSPECTION_CREATED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        jobId: job.id,
        jobNumber: job.jobNumber,
        specCode: job.specificationSnapshot.specCode
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'CREATE_QUALITY_INSPECTION',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      afterState: inspection.toJSON ? inspection.toJSON() : inspection,
      metadata: {
        inspectionNumber: inspection.inspectionNumber,
        jobNumber: job.jobNumber,
        specCode: job.specificationSnapshot.specCode
      }
    });

    return inspection;
  }

  public async getInspections(
    tenantId: string,
    filters: QueryQualityInspectionsDto = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<QualityInspectionDocument>> {
    return this.repo.queryInspections(tenantId, filters, pagination);
  }

  public async getInspectionById(
    tenantId: string,
    id: string
  ): Promise<QualityInspectionDocument> {
    const inspection = await this.repo.findById(tenantId, id);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${id}' not found`);
    }
    return inspection;
  }

  public async getInspectionByJobId(
    tenantId: string,
    jobId: string
  ): Promise<QualityInspectionDocument[]> {
    return this.repo.findByJobId(tenantId, jobId);
  }

  public async assignInspector(
    tenantId: string,
    actor: IActorContext,
    inspectionId: string,
    dto: AssignInspectorDto
  ): Promise<QualityInspectionDocument> {
    const inspection = await this.repo.findById(tenantId, inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${inspectionId}' not found`);
    }

    if (inspection.status === 'APPROVED') {
      throw new BadRequestError(`Cannot reassign inspector on APPROVED inspection '${inspection.inspectionNumber}'`);
    }

    const employee = await workforceCapacityRepository.findEmployeeById(tenantId, dto.inspectorId);
    if (!employee || employee.isDeleted || employee.status !== 'ACTIVE') {
      throw new BadRequestError(`Employee with ID '${dto.inspectorId}' is not active or does not exist`);
    }

    const prevId = inspection.assignedInspector?.inspectorId || null;
    const prevCode = inspection.assignedInspector?.inspectorCode || null;
    const action = prevId ? 'REALLOCATE' : 'ASSIGN';
    const now = new Date();

    inspection.assignedInspector = {
      inspectorId: employee.id,
      inspectorCode: employee.employeeCode,
      inspectorName: employee.fullName,
      assignedAt: now,
      assignedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      }
    };

    inspection.assignmentHistory.push({
      action,
      previousInspectorId: prevId,
      previousInspectorCode: prevCode,
      newInspectorId: employee.id,
      newInspectorCode: employee.employeeCode,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      reason: dto.reason || null
    });

    if (inspection.status === 'PENDING') {
      inspection.status = 'IN_REVIEW';
      inspection.transitionHistory.push({
        fromStatus: 'PENDING',
        toStatus: 'IN_REVIEW',
        timestamp: now,
        performedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        reason: `Auto-advanced to IN_REVIEW upon inspector assignment to '${employee.fullName}'`
      });

      this.eventBus.publish({
        name: DomainEvents.QC_INSPECTION_STARTED,
        tenantId,
        occurredAt: now,
        actorId: actor.userId,
        payload: {
          inspectionId: inspection.id,
          inspectionNumber: inspection.inspectionNumber,
          inspectorCode: employee.employeeCode
        }
      });
    }

    await inspection.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: `${action}_INSPECTOR`,
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      afterState: inspection.toJSON ? inspection.toJSON() : inspection,
      metadata: {
        inspectionNumber: inspection.inspectionNumber,
        inspectorCode: employee.employeeCode
      }
    });

    return inspection;
  }

  public async recordTestResults(
    tenantId: string,
    actor: IActorContext,
    inspectionId: string,
    dto: RecordTestResultsDto
  ): Promise<QualityInspectionDocument> {
    const inspection = await this.repo.findById(tenantId, inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${inspectionId}' not found`);
    }

    if (inspection.status === 'APPROVED') {
      throw new BadRequestError(
        `Cannot modify test results on APPROVED inspection '${inspection.inspectionNumber}'`
      );
    }

    const now = new Date();
    const prevStatus = inspection.status;

    if (!inspection.testResults) {
      inspection.testResults = { hardnessTests: [] };
    }

    if (dto.hardnessTests) {
      inspection.testResults.hardnessTests = dto.hardnessTests;
    }
    if (dto.caseDepth) {
      inspection.testResults.caseDepth = dto.caseDepth;
    }
    if (dto.microstructure) {
      inspection.testResults.microstructure = dto.microstructure;
    }
    if (dto.mechanical) {
      inspection.testResults.mechanical = dto.mechanical;
    }
    if (dto.visualDimensional) {
      inspection.testResults.visualDimensional = dto.visualDimensional;
    }
    if (dto.pyrometry) {
      inspection.testResults.pyrometry = dto.pyrometry;
    }

    inspection.testResults.evaluatedAt = now;
    inspection.testResults.evaluatedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };

    const hardnessPass = (inspection.testResults.hardnessTests || []).every((h: IHardnessTestPoint) => h.passed);
    const caseDepthPass = !inspection.testResults.caseDepth || inspection.testResults.caseDepth.passed;
    const microPass = !inspection.testResults.microstructure || inspection.testResults.microstructure.passed;
    const mechanicalPass = !inspection.testResults.mechanical || inspection.testResults.mechanical.passed;
    const visualPass = !inspection.testResults.visualDimensional || inspection.testResults.visualDimensional.passed;
    const pyrometryPass = !inspection.testResults.pyrometry || inspection.testResults.pyrometry.passed;

    inspection.testResults.overallTestPassed =
      hardnessPass && caseDepthPass && microPass && mechanicalPass && visualPass && pyrometryPass;

    if (dto.notes) {
      inspection.notes = inspection.notes ? `${inspection.notes}; ${dto.notes}` : dto.notes;
    }

    if (inspection.status === 'PENDING') {
      inspection.status = 'IN_REVIEW';
      inspection.transitionHistory.push({
        fromStatus: prevStatus,
        toStatus: 'IN_REVIEW',
        timestamp: now,
        performedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        reason: 'Test results logged - advanced to IN_REVIEW'
      });
    }

    await inspection.save();

    this.eventBus.publish({
      name: DomainEvents.QC_MEASUREMENTS_RECORDED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        overallTestPassed: inspection.testResults.overallTestPassed
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'RECORD_QUALITY_TEST_RESULTS',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      afterState: inspection.toJSON ? inspection.toJSON() : inspection,
      metadata: {
        inspectionNumber: inspection.inspectionNumber,
        overallTestPassed: inspection.testResults.overallTestPassed
      }
    });

    return inspection;
  }

  public async approveInspection(
    tenantId: string,
    actor: IActorContext,
    inspectionId: string,
    dto: ApproveInspectionDto
  ): Promise<QualityInspectionDocument> {
    const inspection = await this.repo.findById(tenantId, inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${inspectionId}' not found`);
    }

    if (inspection.status === 'APPROVED') {
      throw new BadRequestError(`Inspection '${inspection.inspectionNumber}' is already APPROVED`);
    }

    const hasHardness = inspection.testResults?.hardnessTests && inspection.testResults.hardnessTests.length > 0;
    const hasVisual = !!inspection.testResults?.visualDimensional;
    const hasMicro = !!inspection.testResults?.microstructure;
    const hasAnyTests = hasHardness || hasVisual || hasMicro;

    if (!hasAnyTests) {
      throw new BadRequestError(
        `Cannot approve inspection '${inspection.inspectionNumber}': Mandatory test results have not been recorded.`
      );
    }

    const isConforming = (dto.disposition || 'CONFORMING') === 'CONFORMING';
    if (isConforming && inspection.testResults?.overallTestPassed === false) {
      throw new BadRequestError(
        `Cannot approve inspection '${inspection.inspectionNumber}' as CONFORMING when test records contain failing measurements. Must record concession or request reinspection.`
      );
    }

    const now = new Date();
    const prevStatus = inspection.status;

    inspection.status = 'APPROVED';
    inspection.disposition = dto.disposition || 'CONFORMING';
    inspection.approvedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      timestamp: now,
      remarks: dto.remarks || null
    };

    inspection.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'APPROVED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `Inspection approved with disposition '${inspection.disposition}'. Remarks: ${dto.remarks || 'None'}`
    });

    await inspection.save();

    const job = await productionJobRepository.findById(tenantId, inspection.jobId);
    if (job && !job.isDeleted) {
      if (job.execution?.qualityHandoff) {
        job.execution.qualityHandoff.status = 'APPROVED';
      }
      await job.save();
    }

    this.eventBus.publish({
      name: DomainEvents.QC_APPROVED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        jobId: inspection.jobId,
        jobNumber: inspection.jobNumber,
        disposition: inspection.disposition
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'APPROVE_QUALITY_INSPECTION',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      afterState: inspection.toJSON ? inspection.toJSON() : inspection,
      metadata: {
        inspectionNumber: inspection.inspectionNumber,
        disposition: inspection.disposition,
        remarks: dto.remarks
      }
    });

    return inspection;
  }

  public async rejectInspection(
    tenantId: string,
    actor: IActorContext,
    inspectionId: string,
    dto: RejectInspectionDto
  ): Promise<QualityInspectionDocument> {
    const inspection = await this.repo.findById(tenantId, inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${inspectionId}' not found`);
    }

    if (inspection.status === 'APPROVED') {
      throw new BadRequestError(`Cannot reject already APPROVED inspection '${inspection.inspectionNumber}'`);
    }

    const now = new Date();
    const prevStatus = inspection.status;
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ncrNumber = `NCR-${yearMonth}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    inspection.status = 'REJECTED';
    inspection.disposition = 'NON_CONFORMING';

    inspection.nonConformance = {
      ncrNumber,
      defectCode: dto.defectCode || 'DEF-GENERIC',
      defectDescription: dto.defectDescription,
      severity: dto.severity,
      rootCauseCategory: dto.rootCauseCategory || undefined,
      dispositionRecommendation: dto.dispositionRecommendation || 'SCRAP',
      quarantineRequired: dto.quarantineRequired || false,
      quarantineLocationBay: dto.quarantineLocationBay || undefined,
      correctiveActionPlan: dto.correctiveActionPlan || undefined,
      raisedAt: now,
      raisedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      }
    };

    inspection.rejectedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      timestamp: now,
      remarks: dto.remarks || dto.defectDescription
    };

    inspection.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'REJECTED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `Non-conformance raised (${ncrNumber}): ${dto.defectDescription}`
    });

    await inspection.save();

    const job = await productionJobRepository.findById(tenantId, inspection.jobId);
    if (job && !job.isDeleted) {
      if (job.execution?.qualityHandoff) {
        job.execution.qualityHandoff.status = 'REJECTED';
      }
      await job.save();
    }

    this.eventBus.publish({
      name: DomainEvents.QC_REJECTED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        jobId: inspection.jobId,
        jobNumber: inspection.jobNumber,
        ncrNumber,
        defectDescription: dto.defectDescription,
        severity: dto.severity
      }
    });

    this.eventBus.publish({
      name: DomainEvents.QC_NCR_RAISED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        ncrNumber,
        severity: dto.severity,
        quarantineRequired: dto.quarantineRequired
      }
    });

    if (dto.quarantineRequired) {
      this.eventBus.publish({
        name: DomainEvents.WAREHOUSE_MATERIAL_QUARANTINED,
        tenantId,
        occurredAt: now,
        actorId: actor.userId,
        payload: {
          jobId: inspection.jobId,
          inspectionNumber: inspection.inspectionNumber,
          ncrNumber,
          locationBay: dto.quarantineLocationBay || 'QUARANTINE_HOLD'
        }
      });
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'REJECT_QUALITY_INSPECTION',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      afterState: inspection.toJSON ? inspection.toJSON() : inspection,
      metadata: {
        inspectionNumber: inspection.inspectionNumber,
        ncrNumber,
        severity: dto.severity,
        defectDescription: dto.defectDescription
      }
    });

    return inspection;
  }

  public async requestReinspection(
    tenantId: string,
    actor: IActorContext,
    inspectionId: string,
    dto: RequestReinspectionDto
  ): Promise<QualityInspectionDocument> {
    const inspection = await this.repo.findById(tenantId, inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${inspectionId}' not found`);
    }

    if (inspection.status === 'APPROVED') {
      throw new BadRequestError(`Cannot request reinspection on an already APPROVED inspection`);
    }

    const now = new Date();
    const prevStatus = inspection.status;
    const count = (inspection.reinspection?.reinspectionCount || 0) + 1;

    inspection.status = 'REINSPECTION';
    inspection.disposition = 'PENDING';

    inspection.reinspection = {
      reinspectionCount: count,
      parentInspectionId: inspection.id,
      reinspectionReason: dto.reinspectionReason
    };

    if (dto.revisedSampleSize) {
      inspection.inspectionQuantity.sampleSize = dto.revisedSampleSize;
    }

    if (dto.assignedInspectorId) {
      const employee = await workforceCapacityRepository.findEmployeeById(
        tenantId,
        dto.assignedInspectorId
      );
      if (employee && employee.status === 'ACTIVE') {
        inspection.assignedInspector = {
          inspectorId: employee.id,
          inspectorCode: employee.employeeCode,
          inspectorName: employee.fullName,
          assignedAt: now,
          assignedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          }
        };
      }
    }

    inspection.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'REINSPECTION',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `Reinspection cycle #${count} requested: ${dto.reinspectionReason}`
    });

    await inspection.save();

    this.eventBus.publish({
      name: DomainEvents.QC_REINSPECTION_REQUESTED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        inspectionId: inspection.id,
        inspectionNumber: inspection.inspectionNumber,
        reinspectionCount: count,
        reason: dto.reinspectionReason
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'REQUEST_REINSPECTION',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      afterState: inspection.toJSON ? inspection.toJSON() : inspection,
      metadata: {
        inspectionNumber: inspection.inspectionNumber,
        reinspectionCount: count,
        reason: dto.reinspectionReason
      }
    });

    return inspection;
  }
}

export const qualityInspectionService = new QualityInspectionService();
