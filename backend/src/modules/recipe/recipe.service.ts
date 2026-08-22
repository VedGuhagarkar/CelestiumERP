import { BaseService } from '../../core/services/base.service.js';
import { IRecipeRepository, recipeRepository } from './recipe.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  RecipeDocument,
  CreateRecipeDto,
  UpdateRecipeDto,
  ApproveRecipeDto,
  RejectRecipeDto,
  RecipeFilterQuery
} from './recipe.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class RecipeService extends BaseService {
  constructor(
    private readonly repo: IRecipeRepository = recipeRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('RecipeService');
  }

  /**
   * Registers a new heat-treatment recipe in DRAFT status
   */
  public async createRecipe(tenantId: string, dto: CreateRecipeDto, actor?: ActorContext): Promise<RecipeDocument> {
    const code = dto.recipeCode.toUpperCase();
    const existing = await this.repo.findByCodeAndRevision(tenantId, code, 1);
    if (existing) {
      throw new ConflictError(`Recipe with code '${code}' already exists in this tenant`);
    }

    const recipe = await this.repo.create(tenantId, {
      ...dto,
      recipeCode: code,
      revision: 1,
      authorId: actor?.userId || 'SYSTEM',
      status: 'DRAFT',
      referencedJobCount: 0
    } as any);

    this.logger.info(`🔥 Recipe registered: [${recipe.recipeCode} v${recipe.revision}] "${recipe.name}" (${recipe.processFamily}) on tenant [${tenantId}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_CREATED',
        entityType: 'Recipe',
        entityId: recipe.id,
        afterState: recipe.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_CREATED', tenantId, {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revision: recipe.revision,
      processFamily: recipe.processFamily
    });

    return recipe;
  }

  /**
   * Retrieves recipe by ID
   */
  public async getRecipeById(tenantId: string, id: string): Promise<RecipeDocument> {
    const recipe = await this.repo.findById(tenantId, id);
    if (!recipe) {
      throw new NotFoundError(`Recipe with ID '${id}' not found`);
    }
    return recipe;
  }

  /**
   * Retrieves recipe by code and revision
   */
  public async getRecipeByCodeAndRevision(
    tenantId: string,
    code: string,
    revision: number
  ): Promise<RecipeDocument> {
    const recipe = await this.repo.findByCodeAndRevision(tenantId, code, revision);
    if (!recipe) {
      throw new NotFoundError(`Recipe [${code.toUpperCase()}] revision ${revision} not found`);
    }
    return recipe;
  }

  /**
   * Retrieves latest ACTIVE recipe revision for job processing
   */
  public async getLatestActiveRecipe(tenantId: string, code: string): Promise<RecipeDocument> {
    const recipe = await this.repo.findLatestActiveRevision(tenantId, code);
    if (!recipe) {
      throw new NotFoundError(`No active approved revision found for Recipe [${code.toUpperCase()}]`);
    }
    return recipe;
  }

  /**
   * Updates recipe in DRAFT or PENDING_APPROVAL status with strict immutability protection
   */
  public async updateRecipe(
    tenantId: string,
    id: string,
    dto: UpdateRecipeDto,
    actor?: ActorContext
  ): Promise<RecipeDocument> {
    const recipe = await this.getRecipeById(tenantId, id);

    // STRICT IMMUTABILITY GUARD: Approved, Active, Superseded, or Retired revisions cannot be modified
    if (recipe.status !== 'DRAFT' && recipe.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(
        `Recipe revision [${recipe.recipeCode} v${recipe.revision}] in status '${recipe.status}' is strictly immutable. Create a new revision to introduce metallurgical modifications.`
      );
    }

    if ((dto as any).recipeCode && (dto as any).recipeCode.toUpperCase() !== recipe.recipeCode) {
      throw new BadRequestError('Recipe code is immutable');
    }

    const beforeState = recipe.toJSON();

    const updated = await this.repo.updateById(tenantId, id, { $set: dto });
    if (!updated) {
      throw new NotFoundError(`Recipe with ID '${id}' not found`);
    }

    const afterState = updated.toJSON();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_UPDATED',
        entityType: 'Recipe',
        entityId: updated.id,
        beforeState,
        afterState,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_UPDATED', tenantId, {
      recipeId: updated.id,
      recipeCode: updated.recipeCode,
      revision: updated.revision
    });

    return updated;
  }

  /**
   * Submits a DRAFT recipe for metallurgical quality approval
   */
  public async submitForApproval(tenantId: string, id: string, actor?: ActorContext): Promise<RecipeDocument> {
    const recipe = await this.getRecipeById(tenantId, id);

    if (recipe.status !== 'DRAFT') {
      throw new BadRequestError(`Only DRAFT recipes can be submitted for approval. Current status: '${recipe.status}'`);
    }

    recipe.status = 'PENDING_APPROVAL';
    const updated = await recipe.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_SUBMITTED_FOR_APPROVAL',
        entityType: 'Recipe',
        entityId: recipe.id,
        beforeState: { status: 'DRAFT' },
        afterState: { status: 'PENDING_APPROVAL' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_SUBMITTED_FOR_APPROVAL', tenantId, {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revision: recipe.revision
    });

    return updated;
  }

  /**
   * Authorizes and releases a recipe revision, automatically superseding older revisions
   */
  public async approveRecipe(
    tenantId: string,
    id: string,
    dto: ApproveRecipeDto,
    actor?: ActorContext
  ): Promise<RecipeDocument> {
    const recipe = await this.getRecipeById(tenantId, id);

    if (recipe.status !== 'PENDING_APPROVAL' && recipe.status !== 'DRAFT') {
      throw new BadRequestError(`Cannot approve recipe in status '${recipe.status}'`);
    }

    const beforeStatus = recipe.status;

    recipe.status = 'ACTIVE';
    recipe.effectiveFrom = new Date();
    recipe.approvedBy = {
      userId: actor?.userId || 'SYSTEM',
      email: actor?.email,
      role: actor?.role,
      approvedAt: new Date(),
      comments: dto.comments
    };

    const approved = await recipe.save();

    // Automatically transition older revisions of this recipe code to SUPERSEDED
    await this.repo.supersedePreviousRevisions(tenantId, recipe.recipeCode, recipe.revision);

    this.logger.info(`✅ Recipe approved and released: [${recipe.recipeCode} v${recipe.revision}] by [${actor?.email || actor?.userId}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_APPROVED',
        entityType: 'Recipe',
        entityId: approved.id,
        beforeState: { status: beforeStatus },
        afterState: approved.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_APPROVED', tenantId, {
      recipeId: approved.id,
      recipeCode: approved.recipeCode,
      revision: approved.revision
    });

    return approved;
  }

  /**
   * Rejects a recipe submitted for approval
   */
  public async rejectRecipe(
    tenantId: string,
    id: string,
    dto: RejectRecipeDto,
    actor?: ActorContext
  ): Promise<RecipeDocument> {
    const recipe = await this.getRecipeById(tenantId, id);

    if (recipe.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError(`Cannot reject recipe in status '${recipe.status}'`);
    }

    recipe.status = 'DRAFT';
    recipe.rejectionReason = dto.rejectionReason;
    const updated = await recipe.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_REJECTED',
        entityType: 'Recipe',
        entityId: recipe.id,
        beforeState: { status: 'PENDING_APPROVAL' },
        afterState: { status: 'DRAFT', rejectionReason: dto.rejectionReason },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_REJECTED', tenantId, {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revision: recipe.revision,
      rejectionReason: dto.rejectionReason
    });

    return updated;
  }

  /**
   * Clones an existing recipe into a new DRAFT revision
   */
  public async createNewRevision(tenantId: string, id: string, actor?: ActorContext): Promise<RecipeDocument> {
    const currentRecipe = await this.getRecipeById(tenantId, id);

    const highestRevDoc = await this.repo.findHighestRevision(tenantId, currentRecipe.recipeCode);
    const nextRevision = (highestRevDoc ? highestRevDoc.revision : currentRecipe.revision) + 1;

    const newRevision = await this.repo.create(tenantId, {
      recipeCode: currentRecipe.recipeCode,
      revision: nextRevision,
      name: currentRecipe.name,
      description: currentRecipe.description,
      processFamily: currentRecipe.processFamily,
      applicableMaterialGrades: currentRecipe.applicableMaterialGrades,
      stages: currentRecipe.stages,
      metallurgicalTargets: currentRecipe.metallurgicalTargets,
      machineRequirements: currentRecipe.machineRequirements,
      authorId: actor?.userId || 'SYSTEM',
      status: 'DRAFT',
      referencedJobCount: 0
    } as any);

    this.logger.info(`🌱 Created new recipe revision: [${newRevision.recipeCode} v${newRevision.revision}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_REVISION_CREATED',
        entityType: 'Recipe',
        entityId: newRevision.id,
        afterState: newRevision.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_REVISION_CREATED', tenantId, {
      recipeId: newRevision.id,
      recipeCode: newRevision.recipeCode,
      revision: newRevision.revision
    });

    return newRevision;
  }

  /**
   * Retires a recipe revision
   */
  public async retireRecipe(tenantId: string, id: string, actor?: ActorContext): Promise<RecipeDocument> {
    const recipe = await this.getRecipeById(tenantId, id);

    recipe.status = 'RETIRED';
    recipe.effectiveTo = new Date();
    const updated = await recipe.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RECIPE_RETIRED',
        entityType: 'Recipe',
        entityId: recipe.id,
        beforeState: { status: recipe.status },
        afterState: { status: 'RETIRED' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('RECIPE_RETIRED', tenantId, {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revision: recipe.revision
    });

    return updated;
  }

  /**
   * Search and filter recipe records
   */
  public async searchRecipes(
    tenantId: string,
    filters: RecipeFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<RecipeDocument>> {
    return this.repo.searchRecipes(tenantId, filters, pagination);
  }
}

export const recipeService = new RecipeService();
