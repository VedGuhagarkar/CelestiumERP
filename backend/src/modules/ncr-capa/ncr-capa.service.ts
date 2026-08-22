import { BaseService } from '../../core/services/base.service.js';
import { INcrCapaRepository, ncrCapaRepository } from './ncr-capa.repository.js';
import { productionJobRepository, IProductionJobRepository } from '../production-job/production-job.repository.js';
import { qualityInspectionRepository, IQualityInspectionRepository } from '../quality-inspection/quality-inspection.repository.js';
import { heatLotRepository, IHeatLotRepository } from '../traceability/heat-lot.repository.js';
import { quarantineRepository, IQuarantineRepository } from '../quarantine/quarantine.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  NonConformanceReportDocument,
  CorrectivePreventiveActionDocument,
  CreateNcrDto,
  RecordNcrRootCauseDto,
  RecordNcrDispositionDto,
  CloseNcrDto,
  CreateCapaDto,
  UpdateCapaActionItemDto,
  VerifyCapaEffectivenessDto,
  CloseCapaDto,
  QueryNcrsDto,
  QueryCapasDto
} from './ncr-capa.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class NcrCapaService extends BaseService {
  constructor(
    private readonly repo: INcrCapaRepository = ncrCapaRepository,
    private readonly jobRepo: IProductionJobRepository = productionJobRepository,
    private readonly inspectionRepo: IQualityInspectionRepository = qualityInspectionRepository,
    private readonly heatLotRepo: IHeatLotRepository = heatLotRepository,
    private readonly quarantineRepo: IQuarantineRepository = quarantineRepository
  ) {
    super('NcrCapaService');
  }

  // ==========================================
  // NON-CONFORMANCE REPORT (NCR) OPERATIONS
  // ==========================================

  /**
   * Creates a formal Non-Conformance Report (NCR) linked to a job and optionally an inspection
   */
  public async createNcr(
    tenantId: string,
    actor: IActorContext,
    dto: CreateNcrDto
  ): Promise<NonConformanceReportDocument> {
    const job = await this.jobRepo.findById(tenantId, dto.jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${dto.jobId}' not found`);
    }

    let inspectionNumber: string | null = null;
    if (dto.inspectionId) {
      const inspection = await this.inspectionRepo.findById(tenantId, dto.inspectionId);
      if (!inspection || inspection.isDeleted) {
        throw new NotFoundError(`Quality Inspection with ID '${dto.inspectionId}' not found`);
      }
      inspectionNumber = inspection.inspectionNumber;
    }

    const ncrNumber = await this.repo.generateNextNcrNumber(tenantId);
    const now = new Date();

    const heatLots = (job.materialAllocations || []).map((m) => ({
      heatLotId: m.heatLotId || null,
      heatLotNumber: m.heatLotNumber || null,
      quantity: m.allocatedQuantity,
      uom: m.uom
    }));

    let quarantineId: string | null = null;
    let quarantineNumber: string | null = null;

    if (dto.quarantineRequired) {
      quarantineNumber = `QR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        Math.floor(1000 + Math.random() * 9000)
      )}`;
      // Mark companion heat lots as quarantined if applicable
      for (const hl of heatLots) {
        if (hl.heatLotNumber) {
          const heatLotDoc = await this.heatLotRepo.findByHeatLotNumber(tenantId, hl.heatLotNumber);
          if (heatLotDoc) {
            heatLotDoc.status = 'QUARANTINED';
            heatLotDoc.quarantineReason = `NCR ${ncrNumber}: ${dto.defectDescription}`;
            await heatLotDoc.save();
          }
        }
      }
    }

    const ncr = await this.repo.createNcr(tenantId, {
      ncrNumber,
      status: 'OPEN',
      inspectionId: dto.inspectionId || null,
      inspectionNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      planId: job.planId || null,
      planNumber: job.planNumber || null,
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
      heatLots,
      processFamily: job.recipeSnapshot?.processFamily,
      defectType: dto.defectType,
      defectSeverity: dto.defectSeverity,
      defectDescription: dto.defectDescription,
      defectLocations: dto.defectLocations || [],
      affectedQuantity: {
        totalAffectedQuantity: dto.totalAffectedQuantity,
        rejectedQuantity: dto.rejectedQuantity,
        scrappedQuantity: 0,
        reworkedQuantity: 0,
        uom: dto.uom || job.item.uom
      },
      evidence: (dto.evidence || []).map((e, idx) => ({
        evidenceId: `EVD-${idx + 1}`,
        title: e.title,
        evidenceType: e.evidenceType,
        fileUrl: e.fileUrl,
        description: e.description,
        uploadedAt: now,
        uploadedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        }
      })),
      containment: {
        containmentAction: dto.containmentAction,
        isQuarantined: !!dto.quarantineRequired,
        quarantineId,
        quarantineNumber,
        quarantineBay: dto.quarantineBay || null,
        quarantineStatus: dto.quarantineRequired ? 'ACTIVE' : undefined,
        containedAt: now,
        containedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        }
      },
      rootCause: null,
      disposition: null,
      requiresCapa: dto.requiresCapa || dto.defectSeverity === 'CRITICAL',
      capaIds: [],
      capaNumbers: [],
      raisedAt: now,
      raisedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      transitionHistory: [
        {
          fromStatus: 'OPEN',
          toStatus: 'OPEN',
          timestamp: now,
          performedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          reason: `NCR raised for job ${job.jobNumber}: ${dto.defectDescription}`
        }
      ],
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NCR_CREATED',
      entityType: 'NonConformanceReport',
      entityId: ncr.id,
      metadata: {
        ncrNumber,
        jobNumber: job.jobNumber,
        defectType: dto.defectType,
        defectSeverity: dto.defectSeverity,
        requiresCapa: ncr.requiresCapa
      }
    });

    this.publishEvent(DomainEvents.QC_NCR_RAISED, tenantId, {
      ncrId: ncr.id,
      ncrNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      defectType: dto.defectType,
      defectSeverity: dto.defectSeverity
    }, actor.userId);

    return ncr;
  }

  /**
   * Records Root Cause Analysis (5-Why, Ishikawa/Fishbone, Metallurgical) for an NCR
   */
  public async recordRootCause(
    tenantId: string,
    actor: IActorContext,
    ncrId: string,
    dto: RecordNcrRootCauseDto
  ): Promise<NonConformanceReportDocument> {
    const ncr = await this.repo.findNcrById(tenantId, ncrId);
    if (!ncr) {
      throw new NotFoundError(`Non-Conformance Report with ID '${ncrId}' not found`);
    }

    if (ncr.status === 'CLOSED' || ncr.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot perform Root Cause Analysis on ${ncr.status} NCR '${ncr.ncrNumber}'`);
    }

    const now = new Date();
    const prevStatus = ncr.status;

    ncr.rootCause = {
      category: dto.category,
      investigationMethod: dto.investigationMethod,
      investigationDetails: dto.investigationDetails,
      fiveWhys: dto.fiveWhys || [],
      fishboneCategories: dto.fishboneCategories,
      investigatedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
        date: now
      }
    };

    if (ncr.status === 'OPEN') {
      ncr.status = 'UNDER_INVESTIGATION';
      ncr.transitionHistory.push({
        fromStatus: prevStatus,
        toStatus: 'UNDER_INVESTIGATION',
        timestamp: now,
        performedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        reason: `Root cause analysis recorded using ${dto.investigationMethod}`
      });
    }

    await ncr.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NCR_ROOT_CAUSE_RECORDED',
      entityType: 'NonConformanceReport',
      entityId: ncr.id,
      metadata: {
        ncrNumber: ncr.ncrNumber,
        category: dto.category,
        investigationMethod: dto.investigationMethod
      }
    });

    return ncr;
  }

  /**
   * Records Material Review Board (MRB) Disposition for non-conforming product
   */
  public async recordDisposition(
    tenantId: string,
    actor: IActorContext,
    ncrId: string,
    dto: RecordNcrDispositionDto
  ): Promise<NonConformanceReportDocument> {
    const ncr = await this.repo.findNcrById(tenantId, ncrId);
    if (!ncr) {
      throw new NotFoundError(`Non-Conformance Report with ID '${ncrId}' not found`);
    }

    if (ncr.status === 'CLOSED' || ncr.status === 'CANCELLED') {
      throw new BadRequestError(`Cannot record disposition on ${ncr.status} NCR '${ncr.ncrNumber}'`);
    }

    if (dto.dispositionType === 'USE_AS_IS_CONCESSION' && !dto.concessionNumber) {
      throw new BadRequestError(
        `Customer concession / waiver number is mandatory when disposition is 'USE_AS_IS_CONCESSION'`
      );
    }

    const now = new Date();
    const prevStatus = ncr.status;

    ncr.disposition = {
      dispositionType: dto.dispositionType,
      instructions: dto.instructions,
      concessionNumber: dto.concessionNumber || null,
      customerConcessionApproved: dto.customerConcessionApproved || false,
      customerApprovalReference: dto.customerApprovalReference || null,
      customerApprovedAt: dto.customerConcessionApproved ? now : null,
      dispositionSignoff: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
        timestamp: now,
        remarks: dto.remarks || null
      }
    };

    // Update quantities according to disposition
    if (dto.dispositionType === 'SCRAP') {
      ncr.affectedQuantity.scrappedQuantity = ncr.affectedQuantity.rejectedQuantity;
      ncr.affectedQuantity.reworkedQuantity = 0;
    } else if (
      dto.dispositionType === 'REWORK_REHEAT_TREAT' ||
      dto.dispositionType === 'REWORK_TEMPER_ONLY'
    ) {
      ncr.affectedQuantity.reworkedQuantity = ncr.affectedQuantity.rejectedQuantity;
      ncr.affectedQuantity.scrappedQuantity = 0;
    }

    // Handle Quarantine Resolution if requested
    if (dto.quarantineAction === 'RELEASE_FOR_REWORK' || dto.quarantineAction === 'SCRAP_HANDOFF') {
      if (ncr.containment.isQuarantined) {
        ncr.containment.quarantineStatus =
          dto.quarantineAction === 'RELEASE_FOR_REWORK' ? 'RELEASED' : 'DISPOSITIONED';

        for (const hl of ncr.heatLots) {
          if (hl.heatLotNumber) {
            const heatLotDoc = await this.heatLotRepo.findByHeatLotNumber(tenantId, hl.heatLotNumber);
            if (heatLotDoc && heatLotDoc.status === 'QUARANTINED') {
              heatLotDoc.status = dto.quarantineAction === 'RELEASE_FOR_REWORK' ? 'RELEASED' : 'CONSUMED';
              await heatLotDoc.save();
            }
          }
        }
      }
    }

    const nextStatus = ncr.requiresCapa && ncr.capaIds.length === 0 ? 'CAPA_PENDING' : 'DISPOSITIONED';
    ncr.status = nextStatus;

    ncr.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: nextStatus,
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `MRB Disposition recorded: ${dto.dispositionType}. ${dto.instructions}`
    });

    await ncr.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NCR_DISPOSITION_RECORDED',
      entityType: 'NonConformanceReport',
      entityId: ncr.id,
      metadata: {
        ncrNumber: ncr.ncrNumber,
        dispositionType: dto.dispositionType,
        nextStatus
      }
    });

    return ncr;
  }

  /**
   * Formally closes an NCR after ensuring disposition and CAPA requirements are fulfilled
   */
  public async closeNcr(
    tenantId: string,
    actor: IActorContext,
    ncrId: string,
    dto: CloseNcrDto
  ): Promise<NonConformanceReportDocument> {
    const ncr = await this.repo.findNcrById(tenantId, ncrId);
    if (!ncr) {
      throw new NotFoundError(`Non-Conformance Report with ID '${ncrId}' not found`);
    }

    if (ncr.status === 'CLOSED') {
      throw new BadRequestError(`NCR '${ncr.ncrNumber}' is already CLOSED`);
    }

    // GATING 1: Mandatory MRB disposition
    if (!ncr.disposition || !ncr.disposition.dispositionSignoff) {
      throw new BadRequestError(
        `Cannot close NCR '${ncr.ncrNumber}': Material Review Board (MRB) disposition and signoff are mandatory.`
      );
    }

    // GATING 2: Quarantined material must be handled (cannot remain unresolved ACTIVE quarantine)
    if (ncr.containment.isQuarantined && ncr.containment.quarantineStatus === 'ACTIVE') {
      throw new BadRequestError(
        `Cannot close NCR '${ncr.ncrNumber}': Quarantined material must be formally released or dispositioned first.`
      );
    }

    // GATING 3: If CAPA is required, verify all linked CAPAs are CLOSED or EFFECTIVE
    if (ncr.requiresCapa) {
      if (ncr.capaIds.length === 0) {
        throw new BadRequestError(
          `Cannot close NCR '${ncr.ncrNumber}': This failure requires CAPA actions, but no CAPA has been created.`
        );
      }

      const linkedCapas = await this.repo.findCapasByNcrId(tenantId, ncr.id);
      const openCapas = linkedCapas.filter((c) => c.status !== 'CLOSED' && c.status !== 'EFFECTIVE');
      if (openCapas.length > 0) {
        const openNumbers = openCapas.map((c) => c.capaNumber).join(', ');
        throw new BadRequestError(
          `Cannot close NCR '${ncr.ncrNumber}': Linked CAPA(s) [${openNumbers}] are still in progress. All CAPAs must be VERIFIED/EFFECTIVE or CLOSED.`
        );
      }
    }

    const now = new Date();
    const prevStatus = ncr.status;

    ncr.status = 'CLOSED';
    ncr.closedAt = now;
    ncr.closedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      remarks: dto.remarks || 'All disposition and CAPA actions verified'
    };

    ncr.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'CLOSED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `NCR closed. Remarks: ${dto.remarks || 'None'}`
    });

    await ncr.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NCR_CLOSED',
      entityType: 'NonConformanceReport',
      entityId: ncr.id,
      metadata: {
        ncrNumber: ncr.ncrNumber,
        dispositionType: ncr.disposition.dispositionType
      }
    });

    return ncr;
  }

  public async getNcrById(tenantId: string, id: string): Promise<NonConformanceReportDocument> {
    const ncr = await this.repo.findNcrById(tenantId, id);
    if (!ncr) {
      throw new NotFoundError(`Non-Conformance Report with ID '${id}' not found`);
    }
    return ncr;
  }

  public async getNcrByNumber(tenantId: string, ncrNumber: string): Promise<NonConformanceReportDocument> {
    const ncr = await this.repo.findNcrByNumber(tenantId, ncrNumber);
    if (!ncr) {
      throw new NotFoundError(`Non-Conformance Report with number '${ncrNumber}' not found`);
    }
    return ncr;
  }

  public async queryNcrs(
    tenantId: string,
    query: QueryNcrsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<NonConformanceReportDocument>> {
    return await this.repo.queryNcrs(tenantId, query, pagination);
  }

  // ==========================================
  // CORRECTIVE & PREVENTIVE ACTION (CAPA)
  // ==========================================

  /**
   * Initiates a CAPA tied to an originating NCR
   */
  public async createCapa(
    tenantId: string,
    actor: IActorContext,
    ncrId: string,
    dto: CreateCapaDto
  ): Promise<CorrectivePreventiveActionDocument> {
    const ncr = await this.repo.findNcrById(tenantId, ncrId);
    if (!ncr) {
      throw new NotFoundError(`Non-Conformance Report with ID '${ncrId}' not found`);
    }

    const capaNumber = await this.repo.generateNextCapaNumber(tenantId);
    const now = new Date();

    const actionItems = (dto.actionItems || []).map((item, idx) => ({
      itemNumber: idx + 1,
      actionType: item.actionType,
      description: item.description,
      assignedTo: {
        userId: item.assignedToUserId,
        email: item.assignedToEmail,
        name: item.assignedToName
      },
      targetCompletionDate: new Date(item.targetCompletionDate),
      actualCompletionDate: null,
      status: 'PENDING' as const,
      completionNotes: null
    }));

    const capa = await this.repo.createCapa(tenantId, {
      capaNumber,
      ncrId: ncr.id,
      ncrNumber: ncr.ncrNumber,
      type: dto.type,
      status: actionItems.length > 0 ? 'IN_PROGRESS' : 'OPEN',
      title: dto.title,
      problemStatement: dto.problemStatement,
      rootCauseSummary: dto.rootCauseSummary,
      actionItems,
      effectivenessVerification: null,
      raisedAt: now,
      raisedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      transitionHistory: [
        {
          fromStatus: 'OPEN',
          toStatus: actionItems.length > 0 ? 'IN_PROGRESS' : 'OPEN',
          timestamp: now,
          performedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          reason: `CAPA initiated for NCR ${ncr.ncrNumber}`
        }
      ],
      notes: dto.notes || null
    });

    // Link CAPA back to originating NCR
    ncr.capaIds.push(capa.id);
    ncr.capaNumbers.push(capa.capaNumber);
    if (ncr.status === 'CAPA_PENDING') {
      ncr.status = 'DISPOSITIONED';
    }
    await ncr.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CAPA_CREATED',
      entityType: 'CorrectivePreventiveAction',
      entityId: capa.id,
      metadata: {
        capaNumber,
        ncrNumber: ncr.ncrNumber,
        type: dto.type
      }
    });

    this.publishEvent(DomainEvents.QC_CAPA_UPDATED, tenantId, {
      capaId: capa.id,
      capaNumber,
      ncrId: ncr.id,
      ncrNumber: ncr.ncrNumber,
      status: capa.status
    }, actor.userId);

    return capa;
  }

  /**
   * Updates progress on an individual CAPA action item
   */
  public async updateActionItem(
    tenantId: string,
    actor: IActorContext,
    capaId: string,
    dto: UpdateCapaActionItemDto
  ): Promise<CorrectivePreventiveActionDocument> {
    const capa = await this.repo.findCapaById(tenantId, capaId);
    if (!capa) {
      throw new NotFoundError(`CAPA with ID '${capaId}' not found`);
    }

    if (capa.status === 'CLOSED' || capa.status === 'VOID') {
      throw new BadRequestError(`Cannot update action items on ${capa.status} CAPA '${capa.capaNumber}'`);
    }

    const item = capa.actionItems.find((i) => i.itemNumber === dto.itemNumber);
    if (!item) {
      throw new NotFoundError(`Action item #${dto.itemNumber} not found in CAPA '${capa.capaNumber}'`);
    }

    const now = new Date();
    item.status = dto.status;
    if (dto.completionNotes) item.completionNotes = dto.completionNotes;
    if (dto.status === 'COMPLETED') {
      item.actualCompletionDate = dto.actualCompletionDate ? new Date(dto.actualCompletionDate) : now;
    }

    // If all action items are completed, advance CAPA status to VERIFICATION
    const allCompleted = capa.actionItems.every((i) => i.status === 'COMPLETED');
    if (allCompleted && capa.status === 'IN_PROGRESS') {
      const prevStatus = capa.status;
      capa.status = 'VERIFICATION';
      capa.transitionHistory.push({
        fromStatus: prevStatus,
        toStatus: 'VERIFICATION',
        timestamp: now,
        performedBy: {
          userId: actor.userId,
          email: actor.email,
          role: actor.role
        },
        reason: 'All action items completed; moved to effectiveness verification'
      });
    }

    await capa.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CAPA_ACTION_ITEM_UPDATED',
      entityType: 'CorrectivePreventiveAction',
      entityId: capa.id,
      metadata: {
        capaNumber: capa.capaNumber,
        itemNumber: dto.itemNumber,
        status: dto.status
      }
    });

    return capa;
  }

  /**
   * Records effectiveness verification for a CAPA
   */
  public async verifyEffectiveness(
    tenantId: string,
    actor: IActorContext,
    capaId: string,
    dto: VerifyCapaEffectivenessDto
  ): Promise<CorrectivePreventiveActionDocument> {
    const capa = await this.repo.findCapaById(tenantId, capaId);
    if (!capa) {
      throw new NotFoundError(`CAPA with ID '${capaId}' not found`);
    }

    if (capa.status === 'CLOSED' || capa.status === 'VOID') {
      throw new BadRequestError(`Cannot verify effectiveness on ${capa.status} CAPA '${capa.capaNumber}'`);
    }

    const now = new Date();
    const prevStatus = capa.status;

    capa.effectivenessVerification = {
      verificationMethod: dto.verificationMethod,
      verificationPeriodDays: dto.verificationPeriodDays,
      verifiedAt: now,
      verifiedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      isEffective: dto.isEffective,
      notes: dto.notes
    };

    const nextStatus = dto.isEffective ? 'EFFECTIVE' : 'IN_PROGRESS';
    capa.status = nextStatus;

    capa.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: nextStatus,
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.isEffective
        ? `Effectiveness verified via ${dto.verificationMethod}: ${dto.notes}`
        : `Verification indicated ineffectiveness; returned to IN_PROGRESS. Notes: ${dto.notes}`
    });

    await capa.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CAPA_EFFECTIVENESS_VERIFIED',
      entityType: 'CorrectivePreventiveAction',
      entityId: capa.id,
      metadata: {
        capaNumber: capa.capaNumber,
        isEffective: dto.isEffective,
        nextStatus
      }
    });

    return capa;
  }

  /**
   * Formally closes a CAPA
   */
  public async closeCapa(
    tenantId: string,
    actor: IActorContext,
    capaId: string,
    dto: CloseCapaDto
  ): Promise<CorrectivePreventiveActionDocument> {
    const capa = await this.repo.findCapaById(tenantId, capaId);
    if (!capa) {
      throw new NotFoundError(`CAPA with ID '${capaId}' not found`);
    }

    if (capa.status === 'CLOSED') {
      throw new BadRequestError(`CAPA '${capa.capaNumber}' is already CLOSED`);
    }

    if (!capa.effectivenessVerification || !capa.effectivenessVerification.isEffective) {
      throw new BadRequestError(
        `Cannot close CAPA '${capa.capaNumber}': Verification of effectiveness confirming 'isEffective = true' is required prior to closure.`
      );
    }

    const now = new Date();
    const prevStatus = capa.status;

    capa.status = 'CLOSED';
    capa.closedAt = now;
    capa.closedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      remarks: dto.remarks || 'CAPA successfully implemented and verified effective'
    };

    capa.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'CLOSED',
      timestamp: now,
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: `CAPA closed. Remarks: ${dto.remarks || 'None'}`
    });

    await capa.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CAPA_CLOSED',
      entityType: 'CorrectivePreventiveAction',
      entityId: capa.id,
      metadata: {
        capaNumber: capa.capaNumber
      }
    });

    return capa;
  }

  public async getCapaById(tenantId: string, id: string): Promise<CorrectivePreventiveActionDocument> {
    const capa = await this.repo.findCapaById(tenantId, id);
    if (!capa) {
      throw new NotFoundError(`CAPA with ID '${id}' not found`);
    }
    return capa;
  }

  public async queryCapas(
    tenantId: string,
    query: QueryCapasDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CorrectivePreventiveActionDocument>> {
    return await this.repo.queryCapas(tenantId, query, pagination);
  }
}

export const ncrCapaService = new NcrCapaService();
