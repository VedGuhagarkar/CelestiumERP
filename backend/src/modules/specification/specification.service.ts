import { BaseService } from '../../core/services/base.service.js';
import { ISpecificationRepository, specificationRepository } from './specification.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  SpecificationDocument,
  CreateSpecificationDto,
  UpdateSpecificationDto,
  ApproveSpecificationDto,
  RejectSpecificationDto,
  SpecificationFilterQuery
} from './specification.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class SpecificationService extends BaseService {
  constructor(
    private readonly repo: ISpecificationRepository = specificationRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('SpecificationService');
  }

  /**
   * Registers a new metallurgical specification in DRAFT status
   */
  public async createSpecification(
    tenantId: string,
    dto: CreateSpecificationDto,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const code = dto.specCode.toUpperCase();
    const existing = await this.repo.findByCodeAndRevision(tenantId, code, 1);
    if (existing) {
      throw new ConflictError(`Specification with code '${code}' already exists in this tenant`);
    }

    const spec = await this.repo.create(tenantId, {
      ...dto,
      specCode: code,
      revision: 1,
      authorId: actor?.userId || 'SYSTEM',
      status: 'DRAFT',
      referencedJobCount: 0
    } as any);

    this.logger.info(
      `🔬 Metallurgical specification created: [${spec.specCode} v${spec.revision}] "${spec.title}" (${spec.processFamily}) on tenant [${tenantId}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_CREATED',
        entityType: 'Specification',
        entityId: spec.id,
        afterState: spec.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_CREATED', tenantId, {
      specId: spec.id,
      specCode: spec.specCode,
      revision: spec.revision,
      processFamily: spec.processFamily
    });

    return spec;
  }

  /**
   * Retrieves specification by ID
   */
  public async getSpecificationById(tenantId: string, id: string): Promise<SpecificationDocument> {
    const spec = await this.repo.findById(tenantId, id);
    if (!spec) {
      throw new NotFoundError(`Specification with ID '${id}' not found`);
    }
    return spec;
  }

  /**
   * Retrieves specification by code and revision number
   */
  public async getSpecificationByCodeAndRevision(
    tenantId: string,
    code: string,
    revision: number
  ): Promise<SpecificationDocument> {
    const spec = await this.repo.findByCodeAndRevision(tenantId, code, revision);
    if (!spec) {
      throw new NotFoundError(`Specification [${code.toUpperCase()}] revision ${revision} not found`);
    }
    return spec;
  }

  /**
   * Retrieves latest ACTIVE specification revision for production binding
   */
  public async getLatestActiveSpecification(tenantId: string, code: string): Promise<SpecificationDocument> {
    const spec = await this.repo.findLatestActiveRevision(tenantId, code);
    if (!spec) {
      throw new NotFoundError(`No active approved revision found for Specification [${code.toUpperCase()}]`);
    }
    return spec;
  }

  /**
   * Updates specification in DRAFT status while guarding against mutable modification of active revisions
   */
  public async updateSpecification(
    tenantId: string,
    id: string,
    dto: UpdateSpecificationDto,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const spec = await this.getSpecificationById(tenantId, id);

    // STRICT IMMUTABILITY GUARD: Released specifications cannot be modified directly
    if (spec.status !== 'DRAFT' && spec.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Specification revision [${spec.specCode} v${spec.revision}] in status '${spec.status}' is strictly immutable. Create a new revision to modify metallurgical requirements.`
      );
    }

    if ((dto as any).specCode && (dto as any).specCode.toUpperCase() !== spec.specCode) {
      throw new BadRequestError('Specification code is immutable');
    }

    const beforeState = spec.toJSON();

    const updated = await this.repo.updateById(tenantId, id, { $set: dto });
    if (!updated) {
      throw new NotFoundError(`Specification with ID '${id}' not found`);
    }

    const afterState = updated.toJSON();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_UPDATED',
        entityType: 'Specification',
        entityId: updated.id,
        beforeState,
        afterState,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_UPDATED', tenantId, {
      specId: updated.id,
      specCode: updated.specCode,
      revision: updated.revision
    });

    return updated;
  }

  /**
   * Submits a DRAFT specification for metallurgical QA review
   */
  public async submitForApproval(
    tenantId: string,
    id: string,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const spec = await this.getSpecificationById(tenantId, id);

    if (spec.status !== 'DRAFT') {
      throw new BadRequestError(
        `Only DRAFT specifications can be submitted for approval. Current status: '${spec.status}'`
      );
    }

    spec.status = 'PENDING_APPROVAL';
    const updated = await spec.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_SUBMITTED_FOR_APPROVAL',
        entityType: 'Specification',
        entityId: spec.id,
        beforeState: { status: 'DRAFT' },
        afterState: { status: 'PENDING_APPROVAL' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_SUBMITTED_FOR_APPROVAL', tenantId, {
      specId: spec.id,
      specCode: spec.specCode,
      revision: spec.revision
    });

    return updated;
  }

  /**
   * Authorizes and releases a specification revision, superseding older revisions
   */
  public async approveSpecification(
    tenantId: string,
    id: string,
    dto: ApproveSpecificationDto,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const spec = await this.getSpecificationById(tenantId, id);

    if (spec.status !== 'PENDING_APPROVAL' && spec.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot approve specification in status '${spec.status}'`);
    }

    const beforeStatus = spec.status;

    spec.status = 'ACTIVE';
    spec.effectiveFrom = new Date();
    spec.approvedBy = {
      userId: actor?.userId || 'SYSTEM',
      email: actor?.email,
      role: actor?.role,
      approvedAt: new Date(),
      comments: dto.comments
    };

    const approved = await spec.save();

    // Automatically transition older revisions of this specification to SUPERSEDED
    await this.repo.supersedePreviousRevisions(tenantId, spec.specCode, spec.revision);

    this.logger.info(
      `✅ Specification approved and released: [${spec.specCode} v${spec.revision}] by [${actor?.email || actor?.userId}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_APPROVED',
        entityType: 'Specification',
        entityId: approved.id,
        beforeState: { status: beforeStatus },
        afterState: approved.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_APPROVED', tenantId, {
      specId: approved.id,
      specCode: approved.specCode,
      revision: approved.revision
    });

    return approved;
  }

  /**
   * Rejects a specification submitted for approval back to DRAFT
   */
  public async rejectSpecification(
    tenantId: string,
    id: string,
    dto: RejectSpecificationDto,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const spec = await this.getSpecificationById(tenantId, id);

    if (spec.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(`Cannot reject specification in status '${spec.status}'`);
    }

    spec.status = 'DRAFT';
    spec.rejectionReason = dto.rejectionReason;
    const updated = await spec.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_REJECTED',
        entityType: 'Specification',
        entityId: spec.id,
        beforeState: { status: 'PENDING_APPROVAL' },
        afterState: { status: 'DRAFT', rejectionReason: dto.rejectionReason },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_REJECTED', tenantId, {
      specId: spec.id,
      specCode: spec.specCode,
      revision: spec.revision,
      rejectionReason: dto.rejectionReason
    });

    return updated;
  }

  /**
   * Clones an existing specification into a new DRAFT revision
   */
  public async createNewRevision(
    tenantId: string,
    id: string,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const currentSpec = await this.getSpecificationById(tenantId, id);

    const highestRevDoc = await this.repo.findHighestRevision(tenantId, currentSpec.specCode);
    const nextRevision = (highestRevDoc ? highestRevDoc.revision : currentSpec.revision) + 1;

    const newRevision = await this.repo.create(tenantId, {
      specCode: currentSpec.specCode,
      revision: nextRevision,
      title: currentSpec.title,
      description: currentSpec.description,
      customerId: currentSpec.customerId,
      customerCode: currentSpec.customerCode,
      applicableMaterialGrades: currentSpec.applicableMaterialGrades,
      processFamily: currentSpec.processFamily,
      surfaceHardness: currentSpec.surfaceHardness,
      coreHardness: currentSpec.coreHardness,
      caseDepth: currentSpec.caseDepth,
      microstructure: currentSpec.microstructure,
      customerAcceptance: currentSpec.customerAcceptance,
      authorId: actor?.userId || 'SYSTEM',
      status: 'DRAFT',
      referencedJobCount: 0
    } as any);

    this.logger.info(
      `🌱 Created new specification revision: [${newRevision.specCode} v${newRevision.revision}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_REVISION_CREATED',
        entityType: 'Specification',
        entityId: newRevision.id,
        afterState: newRevision.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_REVISION_CREATED', tenantId, {
      specId: newRevision.id,
      specCode: newRevision.specCode,
      revision: newRevision.revision
    });

    return newRevision;
  }

  /**
   * Retires a specification revision
   */
  public async retireSpecification(
    tenantId: string,
    id: string,
    actor?: ActorContext
  ): Promise<SpecificationDocument> {
    const spec = await this.getSpecificationById(tenantId, id);

    spec.status = 'RETIRED';
    spec.effectiveTo = new Date();
    const updated = await spec.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SPECIFICATION_RETIRED',
        entityType: 'Specification',
        entityId: spec.id,
        beforeState: { status: spec.status },
        afterState: { status: 'RETIRED' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('SPECIFICATION_RETIRED', tenantId, {
      specId: spec.id,
      specCode: spec.specCode,
      revision: spec.revision
    });

    return updated;
  }

  /**
   * Search and filter specification records
   */
  public async searchSpecifications(
    tenantId: string,
    filters: SpecificationFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<SpecificationDocument>> {
    return this.repo.searchSpecifications(tenantId, filters, pagination);
  }
}

export const specificationService = new SpecificationService();
