import {
  IProductionJobRepository,
  productionJobRepository
} from './production-job.repository.js';
import {
  CreateDirectJobDto,
  CreateBatchOrderDto,
  UpdateJobDto,
  AssignOperatorDto,
  RemoveOperatorDto,
  AssignFurnaceDto,
  RemoveFurnaceDto,
  TransitionJobDto,
  CancelJobDto,
  ConvertPlanToJobDto,
  StartJobExecutionDto,
  RecordStageProgressDto,
  PauseJobExecutionDto,
  ResumeJobExecutionDto,
  AddProductionLogDto,
  CompleteJobExecutionDto,
  TransitionToStorageDto,
  QueryJobsDto,
  ProductionJobDocument,
  ALLOWED_STATUS_TRANSITIONS,
  PRIORITY_WEIGHTS,
  IJobRecipeSnapshot,
  IJobSpecificationSnapshot
} from './production-job.types.js';
import { customerRepository } from '../customer/customer.repository.js';
import { itemRepository } from '../item/item.repository.js';
import { recipeRepository } from '../recipe/recipe.repository.js';
import { specificationRepository } from '../specification/specification.repository.js';
import { productionPlanRepository } from '../production-planning/production-plan.repository.js';
import { purchaseOrderRepository } from '../purchase-order/purchase-order.repository.js';
import { grnRepository } from '../grn/grn.repository.js';
import { furnaceCapacityRepository } from '../furnace-capacity/furnace-capacity.repository.js';
import { workforceCapacityRepository } from '../workforce-capacity/workforce-capacity.repository.js';
import { constraintAnalysisService } from '../constraint-analysis/constraint-analysis.service.js';
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

export class ProductionJobService {
  private readonly eventBus = DomainEventBus.getInstance();

  constructor(
    private readonly repo: IProductionJobRepository = productionJobRepository
  ) {}

  /**
   * 1. Authoritative Batch Order Creation
   * Enforces PO -> GRN -> BO and Item -> Recipe -> BO lineage
   * Initial Status: WAITING_FOR_PRODUCTION
   */
  public async createBatchOrder(
    tenantId: string,
    actor: IActorContext,
    dto: CreateBatchOrderDto
  ): Promise<ProductionJobDocument> {
    // 0. Idempotency replay check
    if (dto.idempotencyKey) {
      const existingJob = await this.repo.findByIdempotencyKey(tenantId, dto.idempotencyKey);
      if (existingJob) {
        return existingJob;
      }
    }

    if (!dto.poId) {
      throw new BadRequestError('Purchase Order reference (poId) is required for Batch Order creation.');
    }
    if (!dto.grnId) {
      throw new BadRequestError('Goods Receipt Note reference (grnId) is required for Batch Order creation.');
    }
    if (!dto.itemId) {
      throw new BadRequestError('Part reference (itemId) is required for Batch Order creation.');
    }

    // 1. Verify PO exists and is in valid status
    const po = await purchaseOrderRepository.findById(tenantId, dto.poId);
    if (!po || po.isDeleted) {
      throw new NotFoundError(`Purchase Order with ID '${dto.poId}' not found.`);
    }
    const eligiblePoStatuses = ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'];
    if (!eligiblePoStatuses.includes(po.status)) {
      throw new BadRequestError(
        `Purchase Order '${po.poNumber}' is in '${po.status}' status and is not eligible for planning. Required: [${eligiblePoStatuses.join(', ')}].`
      );
    }

    // 2. Verify GRN exists and completed Creation Phase
    const grn = await grnRepository.findGrnById(tenantId, dto.grnId);
    if (!grn || grn.isDeleted) {
      throw new NotFoundError(`Goods Receipt Note with ID '${dto.grnId}' not found.`);
    }

    // Enforce PO-GRN hierarchy ownership
    const grnPoIdMatches = String(grn.poId) === String(po.id) || String(grn.poId) === String(po._id);
    const grnPoNumberMatches = grn.poNumber?.toUpperCase() === po.poNumber?.toUpperCase();
    if (!grnPoIdMatches && !grnPoNumberMatches) {
      throw new BadRequestError(
        `Hierarchy Violation: GRN '${grn.grnNumber}' belongs to PO '${grn.poNumber}', not to selected PO '${po.poNumber}'.`
      );
    }

    // Check GRN status: must have completed Creation Phase
    const eligibleGrnStatuses = ['AVAILABLE_FOR_PLANNING', 'PRINTED', 'ISSUED'];
    if (!eligibleGrnStatuses.includes(grn.status)) {
      throw new BadRequestError(
        `GRN '${grn.grnNumber}' is in '${grn.status}' status and has not completed the Creation Phase.`
      );
    }
    if (!grn.items || grn.items.length === 0) {
      throw new BadRequestError(`GRN '${grn.grnNumber}' has no items.`);
    }

    // 3. Verify selected Part exists in GRN
    const grnItem = grn.items.find(
      (item) => item.itemId === dto.itemId || item.itemCode === dto.itemId || (item as any)._id?.toString() === dto.itemId
    );
    if (!grnItem) {
      throw new BadRequestError(
        `Part Membership Violation: Part '${dto.itemId}' does not exist in GRN '${grn.grnNumber}'. Available items: [${grn.items.map((i) => i.itemCode).join(', ')}].`
      );
    }

    // Verify Item exists in Item master
    const item = await itemRepository.findById(tenantId, grnItem.itemId);
    if (!item || item.isDeleted) {
      throw new NotFoundError(`Item with ID '${grnItem.itemId}' not found in Item Master.`);
    }

    // 4. Verify Recipe exists and corresponds to the BO Item
    const targetRecipeId = dto.recipeId || grnItem.recipeId;
    if (!targetRecipeId) {
      throw new BadRequestError('Recipe is required. Every BO must reference a Recipe.');
    }

    const recipe = await recipeRepository.findById(tenantId, targetRecipeId);
    if (!recipe || recipe.isDeleted) {
      throw new NotFoundError(`Recipe with ID '${targetRecipeId}' not found.`);
    }

    if (recipe.status !== 'APPROVED' && recipe.status !== 'ACTIVE') {
      throw new BadRequestError(
        `Recipe '${recipe.recipeCode}' must be in APPROVED or ACTIVE status (Current: '${recipe.status}').`
      );
    }

    // Enforce Recipe.item === BO.item
    const recipeItemId = (recipe as any).itemId || (recipe as any).item;
    const isItemIdMatched =
      !recipeItemId ||
      String(recipeItemId) === String(item.id) ||
      String(recipeItemId) === String(item._id) ||
      String(recipeItemId) === String(item.itemCode);

    if (recipeItemId && !isItemIdMatched) {
      throw new BadRequestError(
        `Recipe Mismatch Violation: Recipe '${recipe.recipeCode}' belongs to another Item ('${recipeItemId}') and does not correspond to BO Item '${item.itemCode}'. Recipe.item must match BO.item.`
      );
    }

    // Validate Recipe material grade compatibility
    const itemGrade = item.materialGrade || grnItem.materialGrade;
    const isGradeCompatible =
      recipe.applicableMaterialGrades &&
      recipe.applicableMaterialGrades.some((g: string) => g.toUpperCase().trim() === itemGrade.toUpperCase().trim());
    const isLineageBound = String(recipe.id) === String(grnItem.recipeId) || recipe.recipeCode === grnItem.recipeCode;

    if (!isGradeCompatible && !isLineageBound) {
      throw new BadRequestError(
        `Metallurgical Incompatibility: Recipe '${recipe.recipeCode}' does not apply to material grade '${itemGrade}'. Applicable: [${recipe.applicableMaterialGrades?.join(', ')}].`
      );
    }

    // 5. Validate Quantity
    const requestedQuantity = dto.quantity !== undefined ? dto.quantity : dto.targetQuantity;
    if (requestedQuantity === undefined || requestedQuantity === null) {
      throw new BadRequestError('Batch Order quantity is required.');
    }
    if (requestedQuantity <= 0) {
      throw new BadRequestError('Batch Order quantity must be greater than zero.');
    }
    const maxReceivedQuantity =
      grnItem.receivedQuantity !== undefined ? grnItem.receivedQuantity : grnItem.acceptedQuantity;
    if (requestedQuantity > maxReceivedQuantity) {
      throw new BadRequestError(
        `Requested quantity [${requestedQuantity}] exceeds GRN received quantity [${maxReceivedQuantity}].`
      );
    }

    // 6. Validate Weight (required, kg, non-negative)
    const requestedWeight = dto.weight !== undefined ? dto.weight : dto.weightKg;
    if (requestedWeight === undefined || requestedWeight === null) {
      throw new BadRequestError('Batch Order weight in kilograms is required.');
    }
    if (requestedWeight < 0) {
      throw new BadRequestError('Batch Order weight must not be negative.');
    }

    // 7. Validate Due Date
    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestError('Invalid due date provided.');
      }
    } else if (dto.targetCompletionDate) {
      dueDate = new Date(dto.targetCompletionDate);
    } else {
      dueDate = new Date(Date.now() + 7 * 24 * 3600000);
    }

    // 8. Process Structure Snapshots
    const recipeSnapshot: IJobRecipeSnapshot = {
      recipeId: recipe.id,
      recipeCode: recipe.recipeCode,
      revisionNumber: (recipe as any).revisionNumber || recipe.revision || 1,
      processFamily: recipe.processFamily,
      name: recipe.name,
      applicableMaterialGrades: recipe.applicableMaterialGrades || [],
      stages: recipe.stages || [],
      metallurgicalTargets: recipe.metallurgicalTargets,
      machineRequirements: recipe.machineRequirements,
      snapshottedAt: new Date()
    };

    let specSnapshot: any = {
      specificationId: 'SPEC-DEFAULT',
      specCode: 'SPEC-STANDARD',
      revisionNumber: 1,
      title: 'Standard Metallurgical Specification',
      surfaceHardness: {},
      customerAcceptance: {},
      snapshottedAt: new Date()
    };
    if (dto.specificationId) {
      const spec = await specificationRepository.findById(tenantId, dto.specificationId);
      if (spec && !spec.isDeleted) {
        specSnapshot = {
          specificationId: spec.id,
          specCode: spec.specCode,
          revisionNumber: (spec as any).revisionNumber || spec.revision || 1,
          title: spec.title,
          customerCode: spec.customerCode,
          surfaceHardness: spec.surfaceHardness || {},
          coreHardness: spec.coreHardness || undefined,
          caseDepth: spec.caseDepth || undefined,
          microstructure: spec.microstructure || undefined,
          customerAcceptance: spec.customerAcceptance || {},
          snapshottedAt: new Date()
        };
      }
    }

    // 9. Equipment & Operator Assignments
    let equipmentAssignment = {};
    if (dto.assignedFurnaceId) {
      const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, dto.assignedFurnaceId);
      if (furnace) {
        equipmentAssignment = {
          furnaceId: furnace.id,
          furnaceCode: furnace.furnaceCode,
          locationBay: furnace.locationBay,
          pyrometryClass: furnace.thermalCapabilities?.pyrometryClass || null
        };
      }
    }

    let operatorAssignment = {};
    if (dto.assignedOperatorId) {
      const operator = await workforceCapacityRepository.findEmployeeById(tenantId, dto.assignedOperatorId);
      if (operator) {
        operatorAssignment = {
          operatorId: operator.id,
          operatorCode: operator.employeeCode,
          operatorName: operator.fullName,
          shift: dto.shift || operator.defaultShift
        };
      }
    }

    // 10. Allocate GRN Units
    const grnUnits = await grnRepository.findUnitsByGrnId(tenantId, grn.id);
    const eligibleUnits = grnUnits.filter(
      (u) =>
        (u.itemId === grnItem.itemId || u.itemCode === grnItem.itemCode) &&
        u.status === 'AVAILABLE_FOR_PLANNING'
    );

    const unitsToAllocate = eligibleUnits.slice(0, Math.ceil(requestedQuantity));

    const materialAllocations = unitsToAllocate.map((u) => ({
      reservationId: u.unitIdentifier,
      heatLotId: null,
      heatLotNumber: u.supplierHeatNumber || null,
      supplierHeatNumber: u.supplierHeatNumber || null,
      allocatedQuantity: u.quantity,
      uom: u.uom
    }));

    // Authoritative Customer Derivation from GRN / PO
    const customerName = grn.supplierName || (po as any).supplierName || (po as any).vendorName || 'Valued Customer';
    const customerCode = grn.supplierCode || (po as any).supplierCode || 'CUST-DEFAULT';
    const customerId = (po as any).customerId || grn.poId || po.id;

    const plannedStartDate = dto.plannedStartDate ? new Date(dto.plannedStartDate) : new Date();
    const targetCompletionDate = dto.targetCompletionDate
      ? new Date(dto.targetCompletionDate)
      : new Date(Date.now() + 24 * 3600000);

    // 11. Create Batch Order Document with Concurrency Safety and Retry
    let retries = 5;
    let job: ProductionJobDocument | null = null;
    let boNumber = '';

    while (retries > 0) {
      boNumber = await this.repo.generateNextBatchOrderNumber(tenantId);
      const jobNumber = boNumber;

      try {
        job = await this.repo.create(tenantId, {
          jobNumber,
          boNumber,
          batchOrderNumber: boNumber,
          poId: po.id,
          poNumber: po.poNumber,
          grnId: grn.id,
          grnNumber: grn.grnNumber,
          customer: {
            customerId,
            customerCode,
            customerName
          },
          item: {
            itemId: item.id,
            itemCode: item.itemCode,
            itemName: item.name || grnItem.itemName,
            materialGrade: itemGrade,
            uom: item.uom || grnItem.uom || 'PCS'
          },
          quantity: {
            targetQuantity: requestedQuantity,
            loadedQuantity: 0,
            completedQuantity: 0,
            scrappedQuantity: 0
          },
          weightKg: requestedWeight,
          weight: requestedWeight,
          dueDate,
          status: 'WAITING_FOR_PRODUCTION',
          priority: dto.priority || 'NORMAL',
          recipeSnapshot,
          specificationSnapshot: specSnapshot,
          materialAllocations:
            materialAllocations.length > 0
              ? materialAllocations
              : [
                  {
                    heatLotId: null,
                    heatLotNumber: grnItem.supplierHeatNumber || null,
                    supplierHeatNumber: grnItem.supplierHeatNumber || null,
                    allocatedQuantity: requestedQuantity,
                    uom: grnItem.uom
                  }
                ],
          equipmentAssignment,
          operatorAssignment,
          timeline: {
            plannedStartDate,
            targetCompletionDate,
            dueDate
          },
          execution: {
            stageProgress: [],
            downtimeLog: [],
            productionLogs: []
          },
          transitionHistory: [
            {
              fromStatus: 'WAITING_FOR_PRODUCTION',
              toStatus: 'WAITING_FOR_PRODUCTION',
              timestamp: new Date(),
              performedBy: {
                userId: actor.userId,
                email: actor.email,
                role: actor.role
              },
              reason: `Authoritative PO -> GRN -> BO Creation (${po.poNumber} -> ${grn.grnNumber} -> ${boNumber})`
            }
          ],
          assignmentHistory: [],
          notes: dto.notes || null,
          idempotencyKey: dto.idempotencyKey || null
        });
        break;
      } catch (err: any) {
        if (
          (err.code === 11000 ||
            err.message?.includes('duplicate key') ||
            err.message?.includes('E11000')) &&
          retries > 1
        ) {
          retries--;
          continue;
        }
        throw err;
      }
    }

    if (!job) {
      throw new BadRequestError('Failed to allocate Batch Order due to concurrent contention. Please retry.');
    }

    // Allocate GRN units with the generated boNumber
    for (const unit of unitsToAllocate) {
      await grnRepository.allocateUnit(
        tenantId,
        unit.unitIdentifier,
        boNumber,
        boNumber,
        boNumber
      );
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CREATE_BATCH_ORDER',
      entityType: 'BATCH_ORDER',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: {
        boNumber: job.boNumber,
        poNumber: po.poNumber,
        grnNumber: grn.grnNumber,
        itemCode: grnItem.itemCode,
        recipeCode: recipe.recipeCode,
        targetQuantity: dto.targetQuantity
      }
    });

    this.eventBus.publish({
      name: DomainEvents.BATCH_ORDER_CREATED,
      tenantId,
      occurredAt: new Date(),
      actorId: actor.userId,
      payload: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        boNumber: job.boNumber,
        poNumber: po.poNumber,
        grnNumber: grn.grnNumber,
        status: job.status
      }
    });

    return job;
  }

  /**
   * 2. Direct Job Creation endpoint (Legacy forwarder enforcing PO -> GRN -> BO hierarchy)
   */
  public async createDirectJob(
    tenantId: string,
    actor: IActorContext,
    dto: CreateDirectJobDto
  ): Promise<ProductionJobDocument> {
    if (dto.poId && dto.grnId) {
      return this.createBatchOrder(tenantId, actor, {
        poId: dto.poId,
        grnId: dto.grnId,
        itemId: dto.itemId,
        recipeId: dto.recipeId,
        specificationId: dto.specificationId,
        targetQuantity: dto.targetQuantity,
        priority: dto.priority,
        plannedStartDate: dto.plannedStartDate,
        targetCompletionDate: dto.targetCompletionDate,
        assignedFurnaceId: dto.assignedFurnaceId,
        assignedOperatorId: dto.assignedOperatorId,
        shift: dto.shift,
        notes: dto.notes
      });
    }

    throw new BadRequestError(
      'Batch Order creation requires a valid PO (poId) and completed GRN (grnId) reference. Arbitrary job creation without Creation Phase lineage is not permitted.'
    );
  }

  /**
   * 3. Planning Query: Get POs eligible for planning (POs that have completed GRNs)
   */
  public async getEligiblePOs(tenantId: string): Promise<any[]> {
    const { grns } = await grnRepository.queryGrns(tenantId, { limit: 500 });
    const eligibleGrns = grns.filter(
      (g) =>
        !g.isDeleted &&
        ['AVAILABLE_FOR_PLANNING', 'PRINTED', 'ISSUED'].includes(g.status) &&
        (g.items?.length ?? 0) > 0
    );

    const eligiblePoIds = Array.from(new Set(eligibleGrns.map((g) => g.poId).filter(Boolean)));
    const eligiblePos = [];

    for (const poId of eligiblePoIds) {
      const po = await purchaseOrderRepository.findById(tenantId, poId);
      if (po && !po.isDeleted && ['ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(po.status)) {
        const poGrns = eligibleGrns.filter((g) => String(g.poId) === String(po.id) || g.poNumber === po.poNumber);
        eligiblePos.push({
          id: po.id,
          poNumber: po.poNumber,
          supplierName: po.supplierName,
          orderDate: po.orderDate,
          status: po.status,
          itemCount: po.items?.length || 0,
          completedGrnCount: poGrns.length,
          grns: poGrns.map((g) => ({
            id: g.id,
            grnNumber: g.grnNumber,
            status: g.status,
            grnDate: g.grnDate,
            totalUnitsGenerated: g.totalUnitsGenerated || g.units?.length || 0
          }))
        });
      }
    }

    return eligiblePos;
  }

  /**
   * 4. Planning Query: Get completed GRNs strictly belonging to the specified PO
   */
  public async getEligibleGRNsForPO(tenantId: string, poId: string): Promise<any[]> {
    const po = await purchaseOrderRepository.findById(tenantId, poId);
    if (!po || po.isDeleted) {
      throw new NotFoundError(`Purchase Order with ID '${poId}' not found.`);
    }

    const grns = await grnRepository.findGrnsByPoId(tenantId, po.id);
    const eligibleGrns = grns.filter(
      (g) =>
        !g.isDeleted &&
        ['AVAILABLE_FOR_PLANNING', 'PRINTED', 'ISSUED'].includes(g.status) &&
        (g.items?.length ?? 0) > 0
    );

    const enrichedGrns = await Promise.all(
      eligibleGrns.map(async (g) => {
        let availableUnitsCount = 0;
        try {
          const units = await grnRepository.findUnitsByGrnId(tenantId, g.id);
          availableUnitsCount = (units || []).filter((u) => u.status === 'AVAILABLE_FOR_PLANNING').length;
        } catch {
          availableUnitsCount = g.totalUnitsGenerated || (g.units?.length ?? 0);
        }

        return {
          id: g.id,
          grnNumber: g.grnNumber,
          poId: po.id,
          poNumber: po.poNumber,
          status: g.status,
          grnDate: g.grnDate,
          supplierName: g.supplierName,
          supplierChallanNumber: g.supplierChallanNumber,
          warehouseCode: g.warehouseCode,
          storageLocationCode: g.storageLocationCode,
          items: g.items,
          totalUnits: g.totalUnitsGenerated || g.units?.length || 0,
          availableUnitsCount,
          hasAvailableMaterial: availableUnitsCount > 0,
          isCreationComplete: true,
          readOnly: true
        };
      })
    );

    return enrichedGrns;
  }

  /**
   * 5. Planning Query: Get parts available for planning on a specific GRN
   * Enriches parts with unallocated serialized units and authoritative bound recipe
   */
  public async getEligiblePartsForGRN(tenantId: string, grnId: string): Promise<any[]> {
    const grn = await grnRepository.findGrnById(tenantId, grnId);
    if (!grn || grn.isDeleted) {
      throw new NotFoundError(`Goods Receipt Note with ID '${grnId}' not found.`);
    }

    const eligibleGrnStatuses = ['AVAILABLE_FOR_PLANNING', 'PRINTED', 'ISSUED'];
    if (!eligibleGrnStatuses.includes(grn.status)) {
      throw new BadRequestError(
        `GRN '${grn.grnNumber}' is in '${grn.status}' status and has not completed the Creation Phase.`
      );
    }

    const units = await grnRepository.findUnitsByGrnId(tenantId, grn.id);
    const existingJobs = await this.repo.findByGrnId(tenantId, grn.id);

    const parts = await Promise.all(
      (grn.items || []).map(async (item) => {
        const itemUnits = (units || []).filter(
          (u) => (u.itemId === item.itemId || u.itemCode === item.itemCode) && u.status === 'AVAILABLE_FOR_PLANNING'
        );
        const allocatedQty = (existingJobs || [])
          .filter((j) => j.item.itemId === item.itemId && j.status !== 'CANCELLED')
          .reduce((sum, j) => sum + (j.quantity?.targetQuantity || 0), 0);

        const availableQuantity = Math.max(0, item.acceptedQuantity - allocatedQty);

        // Fetch authoritative bound recipe details
        let recipeDetails: any = null;
        if (item.recipeId) {
          try {
            const recipeDoc = await recipeRepository.findById(tenantId, item.recipeId);
            if (recipeDoc && !recipeDoc.isDeleted) {
              recipeDetails = {
                recipeId: recipeDoc.id,
                recipeCode: recipeDoc.recipeCode,
                recipeName: recipeDoc.name,
                processFamily: recipeDoc.processFamily,
                applicableMaterialGrades: recipeDoc.applicableMaterialGrades,
                stages: (recipeDoc.stages || []).map((stg: any) => ({
                  sequence: stg.sequence || stg.stageSequence || 1,
                  stageName: stg.stageName,
                  targetTemperatureC: stg.targetTemperatureC,
                  soakTimeMinutes: stg.soakTimeMinutes || stg.targetDurationMinutes || 60,
                  soakCriteria: stg.soakCriteria || 'LOAD_THERMOCOUPLE_REACHED'
                }))
              };
            }
          } catch {
            // Recipe fetch fallback handled below
          }
        }

        const serializedUnits = itemUnits.map((u) => ({
          unitIdentifier: u.unitIdentifier,
          quantity: u.quantity,
          uom: u.uom,
          status: u.status,
          heatNumber: u.supplierHeatNumber || (u as any).heatNumber || item.supplierHeatNumber
        }));

        return {
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          materialGrade: item.materialGrade,
          processFamily: item.processFamily || recipeDetails?.processFamily,
          recipeId: item.recipeId,
          recipeCode: item.recipeCode,
          recipeName: recipeDetails?.recipeName || item.recipeCode,
          recipeRevision: item.recipeRevision,
          recipeDetails,
          boundRecipe: recipeDetails,
          acceptedQuantity: item.acceptedQuantity,
          availableQuantity,
          availableUnitsCount: itemUnits.length,
          availableUnits: serializedUnits,
          canCreateBatchOrder: availableQuantity > 0 && itemUnits.length > 0,
          uom: item.uom,
          supplierHeatNumber: item.supplierHeatNumber,
          readOnly: true
        };
      })
    );

    return parts;
  }

  public async updateJob(
    tenantId: string,
    userId: string,
    jobId: string,
    dto: UpdateJobDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'DRAFT' && job.status !== 'APPROVED' && job.status !== 'SCHEDULED') {
      throw new BadRequestError(
        `Production Job '${job.jobNumber}' cannot be modified in status '${job.status}'. Modifications are strictly locked once production is in progress or completed.`
      );
    }

    const previousState = job.toJSON ? job.toJSON() : job;

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
          pyrometryClass: furnace.thermalCapabilities?.pyrometryClass || null
        };
      }
    }

    if (dto.assignedOperatorId) {
      const operator = await workforceCapacityRepository.findEmployeeById(tenantId, dto.assignedOperatorId);
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
      actorId: userId,
      action: 'UPDATE_PRODUCTION_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      beforeState: previousState,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber }
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
      throw new BadRequestError(`Cannot assign operator to job in '${job.status}' status`);
    }

    const employee = await workforceCapacityRepository.findEmployeeById(tenantId, dto.operatorId);
    if (!employee || employee.isDeleted || employee.status !== 'ACTIVE') {
      throw new BadRequestError(`Employee with ID '${dto.operatorId}' is not active or does not exist`);
    }

    const jobStart = job.timeline.plannedStartDate;
    const jobEnd = job.timeline.targetCompletionDate;
    const onLeave = (employee.approvedLeaves || []).some((leave) => {
      const lStart = new Date(leave.startDate);
      const lEnd = new Date(leave.endDate);
      return jobStart <= lEnd && jobEnd >= lStart;
    });

    if (onLeave) {
      throw new BadRequestError(`Operator '${employee.fullName}' has approved leave overlapping the job schedule`);
    }

    const processFamily = job.recipeSnapshot.processFamily;
    const reqSkillCode = `${processFamily}_OPERATION`;
    const isQualified = (employee.skills || []).some((s) => {
      const isMatch =
        s.skillCode === reqSkillCode ||
        s.skillCode === 'SEALED_QUENCH_FURNACE_OPERATION' ||
        s.skillCode === 'VACUUM_FURNACE_OPERATION' ||
        s.skillCode === 'PIT_FURNACE_OPERATION' ||
        s.skillCode === 'NITRIDING_OPERATION';
      const isCertified = s.isCertified;
      const isNotExpired = !s.expiryDate || new Date(s.expiryDate) >= jobStart;
      return isMatch && isCertified && isNotExpired;
    });

    if (!isQualified) {
      throw new BadRequestError(
        `Operator '${employee.fullName}' lacks certified, non-expired qualification for '${processFamily}'`
      );
    }

    const prevOpId = job.operatorAssignment?.operatorId || null;
    const prevOpCode = job.operatorAssignment?.operatorCode || null;
    const action = prevOpId ? 'REALLOCATE' : 'ASSIGN';

    job.operatorAssignment = {
      operatorId: employee.id,
      operatorCode: employee.employeeCode,
      operatorName: employee.fullName,
      shift: dto.shift || employee.defaultShift
    };

    job.assignmentHistory.push({
      resourceType: 'OPERATOR',
      action,
      previousResourceId: prevOpId,
      previousResourceCode: prevOpCode,
      newResourceId: employee.id,
      newResourceCode: employee.employeeCode,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
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
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, operatorCode: employee.employeeCode }
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
      throw new BadRequestError(`Cannot remove assigned operator while job '${job.jobNumber}' is actively IN_PROGRESS`);
    }

    const prevOpId = job.operatorAssignment?.operatorId || null;
    const prevOpCode = job.operatorAssignment?.operatorCode || null;

    job.operatorAssignment = { operatorId: null, operatorCode: null, operatorName: null, shift: null };

    job.assignmentHistory.push({
      resourceType: 'OPERATOR',
      action: 'REMOVE',
      previousResourceId: prevOpId,
      previousResourceCode: prevOpCode,
      newResourceId: null,
      newResourceCode: null,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
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
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, reason: dto.reason }
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
      throw new BadRequestError(`Cannot assign furnace to job in '${job.status}' status`);
    }

    const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, dto.furnaceId);
    if (!furnace || furnace.isDeleted) {
      throw new NotFoundError(`Furnace with ID '${dto.furnaceId}' not found`);
    }

    if (furnace.status !== 'OPERATIONAL') {
      throw new BadRequestError(`Furnace '${furnace.furnaceCode}' is not available for assignment (Status: '${furnace.status}')`);
    }

    const processFamily = job.recipeSnapshot.processFamily;
    if (!furnace.processCapabilities.supportedProcessFamilies.includes(processFamily)) {
      throw new BadRequestError(`Furnace '${furnace.furnaceCode}' does not support process family '${processFamily}'`);
    }

    const maxRecipeTemp = Math.max(...job.recipeSnapshot.stages.map((s) => s.targetTemperatureC), 0);
    if (
      maxRecipeTemp > furnace.thermalCapabilities.maxOperatingTempC ||
      maxRecipeTemp < furnace.thermalCapabilities.minOperatingTempC
    ) {
      throw new BadRequestError(
        `Recipe temperature (${maxRecipeTemp}°C) is outside furnace '${furnace.furnaceCode}' operating limits [${furnace.thermalCapabilities.minOperatingTempC}°C - ${furnace.thermalCapabilities.maxOperatingTempC}°C]`
      );
    }

    const conflictingJobs = await this.repo.findConflictingJobs(
      tenantId,
      furnace.id,
      job.timeline.plannedStartDate,
      job.timeline.targetCompletionDate,
      job.id
    );

    if (conflictingJobs.length > 0) {
      throw new BadRequestError(
        `Schedule conflict: Furnace '${furnace.furnaceCode}' is already assigned to job '${conflictingJobs[0].jobNumber}' in this time window`
      );
    }

    const prevFurnaceId = job.equipmentAssignment?.furnaceId || null;
    const prevFurnaceCode = job.equipmentAssignment?.furnaceCode || null;
    const action = prevFurnaceId ? 'REALLOCATE' : 'ASSIGN';

    job.equipmentAssignment = {
      furnaceId: furnace.id,
      furnaceCode: furnace.furnaceCode,
      locationBay: furnace.locationBay,
      pyrometryClass: furnace.thermalCapabilities.pyrometryClass
    };

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action,
      previousResourceId: prevFurnaceId,
      previousResourceCode: prevFurnaceCode,
      newResourceId: furnace.id,
      newResourceCode: furnace.furnaceCode,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      timestamp: new Date(),
      reason: dto.reason || null,
      notes: dto.notes || null
    });

    if (job.status === 'APPROVED' || job.status === 'DRAFT') {
      job.status = 'SCHEDULED';
      job.transitionHistory.push({
        fromStatus: job.status,
        toStatus: 'SCHEDULED',
        timestamp: new Date(),
        performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
        reason: `Auto-scheduled upon furnace assignment to '${furnace.furnaceCode}'`
      });
    }

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: `${action}_JOB_FURNACE`,
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, furnaceCode: furnace.furnaceCode }
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
      throw new BadRequestError(`Cannot remove assigned furnace while job '${job.jobNumber}' is actively IN_PROGRESS`);
    }

    const prevFurnaceId = job.equipmentAssignment?.furnaceId || null;
    const prevFurnaceCode = job.equipmentAssignment?.furnaceCode || null;

    job.equipmentAssignment = { furnaceId: null, furnaceCode: null, locationBay: null, pyrometryClass: null };

    job.assignmentHistory.push({
      resourceType: 'FURNACE',
      action: 'REMOVE',
      previousResourceId: prevFurnaceId,
      previousResourceCode: prevFurnaceCode,
      newResourceId: null,
      newResourceCode: null,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      timestamp: new Date(),
      reason: dto.reason,
      notes: dto.notes || null
    });

    if (job.status === 'SCHEDULED') {
      job.status = 'APPROVED';
      job.transitionHistory.push({
        fromStatus: 'SCHEDULED',
        toStatus: 'APPROVED',
        timestamp: new Date(),
        performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
        reason: `Reverted to APPROVED backlog state upon furnace removal`
      });
    }

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'REMOVE_JOB_FURNACE',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, reason: dto.reason }
    });

    return job;
  }

  // --- Complete Shop-Floor Cycle Execution Methods ---

  public async startJobExecution(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: StartJobExecutionDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'SCHEDULED' && job.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot start job '${job.jobNumber}' in status '${job.status}'. Expected 'SCHEDULED' or 'APPROVED'.`
      );
    }

    if (job.materialAllocations.length === 0) {
      throw new BadRequestError(`Cannot start job '${job.jobNumber}': No heat lot material allocations assigned.`);
    }

    const furnaceId = dto.furnaceId || job.equipmentAssignment?.furnaceId;
    if (!furnaceId) {
      throw new BadRequestError(`Cannot start job '${job.jobNumber}': No furnace assigned.`);
    }

    const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, furnaceId);
    if (!furnace || furnace.isDeleted || furnace.status !== 'OPERATIONAL') {
      throw new BadRequestError(
        `Furnace is not in OPERATIONAL state (Current status: '${furnace?.status || 'NOT_FOUND'}')`
      );
    }

    if (dto.initialFurnaceTempC > furnace.thermalCapabilities.maxOperatingTempC) {
      throw new BadRequestError(
        `Initial furnace temperature (${dto.initialFurnaceTempC}°C) exceeds furnace maximum rating (${furnace.thermalCapabilities.maxOperatingTempC}°C)`
      );
    }

    const startTime = new Date();
    const prevStatus = job.status;

    job.status = 'IN_PROGRESS';
    job.timeline.actualStartDate = startTime;
    job.quantity.loadedQuantity = dto.loadedPieceCount;

    if (!job.execution) {
      job.execution = {
        stageProgress: [],
        downtimeLog: [],
        productionLogs: []
      };
    }

    job.execution.furnaceCharge = {
      chargeNumber: dto.chargeNumber,
      loadedWeightKg: dto.loadedWeightKg,
      loadedPieceCount: dto.loadedPieceCount,
      fixtureId: dto.fixtureId || null,
      initialFurnaceTempC: dto.initialFurnaceTempC,
      initialAtmosphereLevel: dto.initialAtmosphereLevel || null,
      thermocoupleLocations: dto.thermocoupleLocations || [],
      startedAt: startTime,
      startedBy: { userId: actor.userId, email: actor.email, role: actor.role }
    };

    job.execution.cycleTimer = {
      cycleStartTime: startTime,
      cycleEndTime: null,
      totalRunDurationMinutes: 0,
      totalDowntimeDurationMinutes: 0
    };

    job.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'IN_PROGRESS',
      timestamp: startTime,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      reason: `Furnace cycle started. Charge #${dto.chargeNumber} loaded (${dto.loadedPieceCount} pcs, ${dto.loadedWeightKg} kg)`
    });

    await job.save();

    this.eventBus.publish({
      name: DomainEvents.JOB_STARTED,
      tenantId,
      occurredAt: startTime,
      actorId: actor.userId,
      payload: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        chargeNumber: dto.chargeNumber,
        furnaceCode: furnace.furnaceCode,
        loadedPieceCount: dto.loadedPieceCount
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'START_JOB_EXECUTION',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, chargeNumber: dto.chargeNumber, furnaceCode: furnace.furnaceCode }
    });

    return job;
  }

  public async recordStageProgress(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: RecordStageProgressDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot record stage progress for job '${job.jobNumber}' in status '${job.status}'. Expected 'IN_PROGRESS'.`
      );
    }

    if (!job.execution) {
      job.execution = { stageProgress: [], downtimeLog: [], productionLogs: [] };
    }

    job.execution.stageProgress.push({
      stageSequence: dto.stageSequence,
      stageName: dto.stageName,
      stageType: dto.stageType,
      targetTemperatureC: dto.targetTemperatureC,
      actualTemperatureC: dto.actualTemperatureC,
      targetDurationMinutes: dto.targetDurationMinutes,
      actualDurationMinutes: dto.actualDurationMinutes,
      quenchMedium: dto.quenchMedium || null,
      quenchAgitationSpeedRpm: dto.quenchAgitationSpeedRpm || null,
      quenchMediaInitialTempC: dto.quenchMediaInitialTempC || null,
      quenchMediaFinalTempC: dto.quenchMediaFinalTempC || null,
      atmosphereDetails: dto.atmosphereDetails || {},
      recordedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      timestamp: new Date(),
      notes: dto.notes || null
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'RECORD_STAGE_PROGRESS',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, stageName: dto.stageName, stageType: dto.stageType }
    });

    return job;
  }

  public async pauseJobExecution(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: PauseJobExecutionDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot pause job '${job.jobNumber}' in status '${job.status}'. Expected 'IN_PROGRESS'.`
      );
    }

    const pauseTime = new Date();
    const downtimeId = `DT-${Date.now()}`;

    if (!job.execution) {
      job.execution = { stageProgress: [], downtimeLog: [], productionLogs: [] };
    }

    job.status = 'PAUSED';
    job.execution.downtimeLog.push({
      downtimeId,
      category: dto.category,
      reason: dto.reason,
      startTime: pauseTime,
      endTime: null,
      durationMinutes: null,
      impactOnCycle: dto.impactOnCycle || null,
      actionTaken: null,
      loggedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      notes: dto.notes || null
    });

    job.transitionHistory.push({
      fromStatus: 'IN_PROGRESS',
      toStatus: 'PAUSED',
      timestamp: pauseTime,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      reason: `Cycle paused due to ${dto.category}: ${dto.reason}`
    });

    await job.save();

    this.eventBus.publish({
      name: DomainEvents.JOB_PAUSED,
      tenantId,
      occurredAt: pauseTime,
      actorId: actor.userId,
      payload: { jobId: job.id, jobNumber: job.jobNumber, category: dto.category, reason: dto.reason }
    });

    this.eventBus.publish({
      name: DomainEvents.JOB_DOWNTIME_LOGGED,
      tenantId,
      occurredAt: pauseTime,
      actorId: actor.userId,
      payload: { jobId: job.id, jobNumber: job.jobNumber, downtimeId, category: dto.category, reason: dto.reason }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'PAUSE_JOB_EXECUTION',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, category: dto.category, reason: dto.reason }
    });

    return job;
  }

  public async resumeJobExecution(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: ResumeJobExecutionDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'PAUSED') {
      throw new BadRequestError(
        `Cannot resume job '${job.jobNumber}' in status '${job.status}'. Expected 'PAUSED'.`
      );
    }

    const resumeTime = new Date();

    if (!job.execution) {
      job.execution = { stageProgress: [], downtimeLog: [], productionLogs: [] };
    }

    const openDowntime = job.execution.downtimeLog.find((d) => d.endTime === null || d.endTime === undefined);
    if (openDowntime) {
      openDowntime.endTime = resumeTime;
      const durationMs = resumeTime.getTime() - new Date(openDowntime.startTime).getTime();
      openDowntime.durationMinutes = Math.round((durationMs / 60000) * 10) / 10;
      openDowntime.actionTaken = dto.actionTaken;
      if (dto.notes) openDowntime.notes = openDowntime.notes ? `${openDowntime.notes}; ${dto.notes}` : dto.notes;

      if (job.execution.cycleTimer) {
        job.execution.cycleTimer.totalDowntimeDurationMinutes =
          (job.execution.cycleTimer.totalDowntimeDurationMinutes || 0) + openDowntime.durationMinutes;
      }
    }

    job.status = 'IN_PROGRESS';
    job.transitionHistory.push({
      fromStatus: 'PAUSED',
      toStatus: 'IN_PROGRESS',
      timestamp: resumeTime,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      reason: `Cycle resumed. Action taken: ${dto.actionTaken}`
    });

    await job.save();

    this.eventBus.publish({
      name: DomainEvents.JOB_RESUMED,
      tenantId,
      occurredAt: resumeTime,
      actorId: actor.userId,
      payload: { jobId: job.id, jobNumber: job.jobNumber, actionTaken: dto.actionTaken }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'RESUME_JOB_EXECUTION',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, actionTaken: dto.actionTaken }
    });

    return job;
  }

  public async addProductionLog(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: AddProductionLogDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (!job.execution) {
      job.execution = { stageProgress: [], downtimeLog: [], productionLogs: [] };
    }

    job.execution.productionLogs.push({
      logId: `LOG-${Date.now()}`,
      type: dto.type,
      shift: dto.shift || null,
      message: dto.message,
      recordedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      timestamp: new Date()
    });

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'ADD_PRODUCTION_LOG',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, logType: dto.type }
    });

    return job;
  }

  public async completeJobExecution(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: CompleteJobExecutionDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'IN_PROGRESS' && job.status !== 'PAUSED') {
      throw new BadRequestError(
        `Cannot complete job '${job.jobNumber}' in status '${job.status}'. Expected 'IN_PROGRESS' or 'PAUSED'.`
      );
    }

    if (!job.execution || job.execution.stageProgress.length === 0) {
      throw new BadRequestError(
        `Cannot complete job '${job.jobNumber}': No heat treatment stage execution records found.`
      );
    }

    const completionTime = new Date();
    const actualStart = job.timeline.actualStartDate || job.timeline.plannedStartDate;
    const totalDurationMs = completionTime.getTime() - new Date(actualStart).getTime();
    const totalDurationMinutes = Math.round((totalDurationMs / 60000) * 10) / 10;

    const prevStatus = job.status;
    job.status = 'QUALITY_CHECK';
    job.timeline.actualCompletionDate = completionTime;
    job.quantity.completedQuantity = dto.completedQuantity;
    job.quantity.scrappedQuantity = dto.scrappedQuantity || 0;

    if (job.execution.cycleTimer) {
      job.execution.cycleTimer.cycleEndTime = completionTime;
      job.execution.cycleTimer.totalRunDurationMinutes = Math.max(
        0,
        totalDurationMinutes - (job.execution.cycleTimer.totalDowntimeDurationMinutes || 0)
      );
    }

    const yearMonth = `${completionTime.getFullYear()}${String(completionTime.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    const inspectionRequestId = `INSP-REQ-${yearMonth}-${seq}`;
    const pyrometryArchiveId = `PYRO-${yearMonth}-${seq}`;

    job.execution.qualityHandoff = {
      inspectionRequestId,
      status: 'PENDING_INSPECTION',
      requestedAt: completionTime,
      pyrometryArchiveId,
      completedQuantity: dto.completedQuantity,
      scrappedQuantity: dto.scrappedQuantity || 0,
      notes: dto.operatorNotes || null
    };

    job.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'QUALITY_CHECK',
      timestamp: completionTime,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      reason: `Production completed. Handed off to Quality (${inspectionRequestId}) with ${dto.completedQuantity} passed, ${dto.scrappedQuantity || 0} scrap`
    });

    await job.save();

    this.eventBus.publish({
      name: DomainEvents.JOB_COMPLETED,
      tenantId,
      occurredAt: completionTime,
      actorId: actor.userId,
      payload: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        completedQuantity: dto.completedQuantity,
        scrappedQuantity: dto.scrappedQuantity || 0,
        pyrometryArchiveId
      }
    });

    this.eventBus.publish({
      name: DomainEvents.QC_INSPECTION_CREATED,
      tenantId,
      occurredAt: completionTime,
      actorId: actor.userId,
      payload: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        inspectionRequestId,
        pyrometryArchiveId,
        completedQuantity: dto.completedQuantity,
        specCode: job.specificationSnapshot.specCode,
        recipeCode: job.recipeSnapshot.recipeCode
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'COMPLETE_JOB_EXECUTION',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: {
        jobNumber: job.jobNumber,
        inspectionRequestId,
        completedQuantity: dto.completedQuantity,
        scrappedQuantity: dto.scrappedQuantity || 0
      }
    });

    return job;
  }

  public async transitionToStorage(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: TransitionToStorageDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${jobId}' not found`);
    }

    if (job.status !== 'QUALITY_CHECK') {
      throw new BadRequestError(
        `Cannot place job '${job.jobNumber}' into storage from status '${job.status}'. Expected 'QUALITY_CHECK'.`
      );
    }

    const storageTime = new Date();
    const prevStatus = job.status;

    job.status = 'STORAGE';

    if (!job.execution) {
      job.execution = { stageProgress: [], downtimeLog: [], productionLogs: [] };
    }

    job.execution.storagePlacement = {
      warehouseId: dto.warehouseId,
      locationBay: dto.locationBay,
      palletId: dto.palletId || null,
      placedAt: storageTime,
      placedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      notes: dto.notes || null
    };

    job.transitionHistory.push({
      fromStatus: prevStatus,
      toStatus: 'STORAGE',
      timestamp: storageTime,
      performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      reason: `Transferred to warehouse ${dto.warehouseId}, Bay ${dto.locationBay}`
    });

    await job.save();

    this.eventBus.publish({
      name: DomainEvents.WAREHOUSE_FG_RECEIVED,
      tenantId,
      occurredAt: storageTime,
      actorId: actor.userId,
      payload: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        warehouseId: dto.warehouseId,
        locationBay: dto.locationBay,
        quantity: job.quantity.completedQuantity
      }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'TRANSITION_JOB_TO_STORAGE',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, warehouseId: dto.warehouseId, locationBay: dto.locationBay }
    });

    return job;
  }

  public async getMachineUtilizationAndDowntime(
    tenantId: string,
    furnaceId?: string
  ): Promise<any> {
    const query: any = { tenantId, isDeleted: false };
    if (furnaceId) query['equipmentAssignment.furnaceId'] = furnaceId;

    const jobs = await this.repo.find(query);

    let totalRunMinutes = 0;
    let totalDowntimeMinutes = 0;
    const downtimeByCategory: Record<string, number> = {};
    let cycleCount = 0;

    for (const job of jobs) {
      if (job.execution?.cycleTimer) {
        cycleCount++;
        totalRunMinutes += job.execution.cycleTimer.totalRunDurationMinutes || 0;
        totalDowntimeMinutes += job.execution.cycleTimer.totalDowntimeDurationMinutes || 0;
      }

      for (const dt of job.execution?.downtimeLog || []) {
        const d = dt.durationMinutes || 0;
        downtimeByCategory[dt.category] = (downtimeByCategory[dt.category] || 0) + d;
      }
    }

    const totalOperatingMinutes = totalRunMinutes + totalDowntimeMinutes;
    const availabilityPercentage =
      totalOperatingMinutes > 0
        ? Math.round((totalRunMinutes / totalOperatingMinutes) * 1000) / 10
        : 100;

    return {
      furnaceId: furnaceId || 'ALL_FURNACES',
      cycleCount,
      totalRunMinutes,
      totalDowntimeMinutes,
      totalOperatingMinutes,
      availabilityPercentage,
      downtimeByCategory
    };
  }

  // --- End Complete Shop-Floor Cycle Execution Methods ---

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

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid lifecycle transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowedNext.join(', ')}]`
      );
    }

    job.status = targetStatus;
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

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'TRANSITION_PRODUCTION_JOB_STATUS',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, fromStatus: currentStatus, toStatus: targetStatus, reason: dto.reason }
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

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw new BadRequestError(
        `Cannot cancel a COMPLETED production job (Job '${job.jobNumber}' is in terminal status '${job.status}')`
      );
    }

    const previousStatus = job.status;
    job.status = 'CANCELLED';
    job.cancellationReason = dto.reason;

    job.transitionHistory.push({
      fromStatus: previousStatus,
      toStatus: 'CANCELLED',
      timestamp: new Date(),
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      reason: dto.reason,
      notes: dto.notes || null
    });

    await job.save();

    this.eventBus.publish({
      name: DomainEvents.JOB_CANCELLED,
      tenantId,
      occurredAt: new Date(),
      actorId: actor.userId,
      payload: { jobId: job.id, jobNumber: job.jobNumber, reason: dto.reason }
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'CANCEL_PRODUCTION_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: { jobNumber: job.jobNumber, reason: dto.reason }
    });

    return job;
  }

  public async getProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const activeJobs = await this.repo.findActiveQueueJobs(tenantId, filters);

    const sorted = [...activeJobs].sort((a, b) => {
      const pA = PRIORITY_WEIGHTS[a.priority] || 4;
      const pB = PRIORITY_WEIGHTS[b.priority] || 4;

      if (pA !== pB) return pA - pB;

      const dateA = new Date(a.timeline.targetCompletionDate).getTime();
      const dateB = new Date(b.timeline.targetCompletionDate).getTime();
      return dateA - dateB;
    });

    return sorted.map((job, idx) => ({
      queuePosition: idx + 1,
      jobId: job.id,
      jobNumber: job.jobNumber,
      planNumber: job.planNumber,
      customerName: job.customer.customerName,
      itemCode: job.item.itemCode,
      itemName: job.item.itemName,
      materialGrade: job.item.materialGrade,
      targetQuantity: job.quantity.targetQuantity,
      priority: job.priority,
      status: job.status,
      assignedFurnaceCode: job.equipmentAssignment?.furnaceCode || null,
      assignedOperatorName: job.operatorAssignment?.operatorName || null,
      targetCompletionDate: job.timeline.targetCompletionDate
    }));
  }

  public async convertPlanToJob(
    tenantId: string,
    userId: string,
    planId: string,
    dto: ConvertPlanToJobDto
  ): Promise<ProductionJobDocument> {
    if (dto.idempotencyKey) {
      const existingJob = await this.repo.findByIdempotencyKey(tenantId, planId, dto.idempotencyKey);
      if (existingJob) {
        return existingJob;
      }
    }

    const plan = await productionPlanRepository.findById(tenantId, planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with ID '${planId}' not found`);
    }

    const planStatus = plan.status as string;
    if (planStatus !== 'APPROVED' && planStatus !== 'CONFIRMED') {
      throw new BadRequestError(
        `Cannot convert Production Plan '${plan.planNumber}'. Plan must be in 'APPROVED' or 'CONFIRMED' status (Current: '${plan.status}')`
      );
    }

    const constraintReport = await constraintAnalysisService.evaluatePlanConstraints(tenantId, plan.id);
    if (constraintReport.isBlocked) {
      const blockingReasons = constraintReport.violations
        .filter((v) => v.severity === 'BLOCKING')
        .map((v) => `[${v.category}] ${v.message}`)
        .join('; ');

      throw new BadRequestError(
        `Cannot convert plan '${plan.planNumber}' to production job: Blocked by active constraints - ${blockingReasons}`
      );
    }

    const customerId = plan.customer?.customerId || (plan as any).demandRequirement?.customerId || (plan as any).customerId;
    let customer: any = plan.customer;
    if (!customer?.customerCode) {
      customer = await customerRepository.findById(tenantId, customerId);
    }

    const itemId = plan.item?.itemId || (plan as any).item?.id;
    let item: any = plan.item;
    if (!item?.itemCode) {
      item = await itemRepository.findById(tenantId, itemId);
    }

    const recipeId = plan.recipe?.recipeId || (plan as any).recipe?.id;
    let recipe: any = await recipeRepository.findById(tenantId, recipeId);
    if (!recipe && plan.recipe?.recipeCode) {
      recipe = plan.recipe;
    }

    const specId = plan.specification?.specificationId || (plan as any).specification?.id;
    let spec: any = await specificationRepository.findById(tenantId, specId);
    if (!spec && plan.specification?.specCode) {
      spec = plan.specification;
    }

    const recipeSnapshot: IJobRecipeSnapshot = {
      recipeId: recipe?.id || recipeId,
      recipeCode: recipe?.recipeCode || plan.recipe?.recipeCode || 'REC-UNKNOWN',
      revisionNumber: (plan.recipe as any)?.revisionNumber || (plan as any).recipe?.revision || (plan as any).recipe?.recipeRevision || 1,
      processFamily: recipe?.processFamily || plan.recipe?.processFamily || 'CARBURIZING',
      name: recipe?.name || plan.recipe?.recipeCode || 'Recipe',
      applicableMaterialGrades: recipe?.applicableMaterialGrades || [],
      stages: recipe?.stages || [],
      metallurgicalTargets: recipe?.metallurgicalTargets || {},
      machineRequirements: recipe?.machineRequirements || {},
      snapshottedAt: new Date()
    };

    const specSnapshot: IJobSpecificationSnapshot = {
      specificationId: spec?.id || specId,
      specCode: spec?.specCode || plan.specification?.specCode || 'SPEC-UNKNOWN',
      revisionNumber: (plan.specification as any)?.revisionNumber || (plan as any).specification?.revision || (plan as any).specification?.specRevision || 1,
      title: spec?.title || plan.specification?.specCode || 'Specification',
      customerCode: spec?.customerCode || plan.customer?.customerCode,
      surfaceHardness: spec?.surfaceHardness || ({} as any),
      coreHardness: spec?.coreHardness || undefined,
      caseDepth: spec?.caseDepth || undefined,
      microstructure: spec?.microstructure || undefined,
      customerAcceptance: spec?.customerAcceptance || ({} as any),
      snapshottedAt: new Date()
    };

    let equipmentAssignment = {};
    const furnaceIdToAssign = dto.assignedFurnaceId || (plan as any).schedule?.assignedFurnaceId;
    if (furnaceIdToAssign) {
      const furnace = await furnaceCapacityRepository.findFurnaceById(tenantId, furnaceIdToAssign);
      if (furnace) {
        equipmentAssignment = {
          furnaceId: furnace.id,
          furnaceCode: furnace.furnaceCode,
          locationBay: furnace.locationBay,
          pyrometryClass: furnace.thermalCapabilities?.pyrometryClass || null
        };
      }
    }

    let operatorAssignment = {};
    const operatorIdToAssign = dto.assignedOperatorId || (plan as any).workforceRequirement?.requiredOperatorRoles?.[0];
    if (operatorIdToAssign) {
      const operator = await workforceCapacityRepository.findEmployeeById(tenantId, operatorIdToAssign);
      if (operator) {
        operatorAssignment = {
          operatorId: operator.id,
          operatorCode: operator.employeeCode,
          operatorName: operator.fullName,
          shift: dto.shift || (plan as any).schedule?.shift || operator.defaultShift
        };
      }
    }

    const targetQuantity =
      dto.targetQuantity ||
      (plan as any).demandRequirement?.plannedQuantity ||
      (plan as any).quantityTargets?.plannedQuantity ||
      100;
    const plannedStart =
      (plan as any).schedule?.plannedStartDate || (plan as any).timeline?.plannedStartDate || new Date();
    const plannedEnd =
      (plan as any).schedule?.targetCompletionDate || (plan as any).timeline?.targetCompletionDate || new Date();

    const customerName = (customer as any)?.name || (customer as any)?.companyName || (customer as any)?.customerName || 'Customer';
    const customerCode = (customer as any)?.customerCode || 'CUST-001';
    const itemName = (item as any)?.name || (item as any)?.itemName || 'Item';
    const itemCode = (item as any)?.itemCode || 'ITEM-001';

    const jobNumber = await this.repo.generateNextJobNumber(tenantId);
    const initialStatus = 'RELEASED';

    const job = await this.repo.create(tenantId, {
      jobNumber,
      planId: plan.id,
      planNumber: plan.planNumber,
      customer: {
        customerId: customer?.id || customerId,
        customerCode,
        customerName
      },
      item: {
        itemId: item?.id || itemId,
        itemCode,
        itemName,
        materialGrade: item?.materialGrade || 'GENERIC',
        uom: item?.uom || 'EA'
      },
      quantity: {
        targetQuantity,
        loadedQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0
      },
      status: initialStatus as any,
      priority: (plan as any).demandRequirement?.priority || (plan as any).priority || 'NORMAL',
      recipeSnapshot,
      specificationSnapshot: specSnapshot,
      materialAllocations: ((plan as any).materialRequirement?.reservedHeatLots || []).map((res: any) => ({
        reservationId: res.reservationId,
        heatLotId: res.heatLotId,
        heatLotNumber: res.heatLotNumber,
        allocatedQuantity: res.allocatedQuantity,
        uom: res.uom
      })),
      equipmentAssignment,
      operatorAssignment,
      timeline: {
        plannedStartDate: plannedStart,
        targetCompletionDate: plannedEnd
      },
      execution: {
        stageProgress: [],
        downtimeLog: [],
        productionLogs: []
      },
      transitionHistory: [
        {
          fromStatus: 'DRAFT',
          toStatus: initialStatus as any,
          timestamp: new Date(),
          performedBy: { userId },
          reason: `Converted from approved production plan '${plan.planNumber}'`
        }
      ],
      assignmentHistory: [],
      idempotencyKey: dto.idempotencyKey || null,
      notes: dto.notes || plan.notes || null
    });

    plan.status = 'IN_PROGRESS';
    await plan.save();

    await auditService.record(tenantId, {
      actorId: userId,
      action: 'CONVERT_PLAN_TO_PRODUCTION_JOB',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      afterState: job.toJSON ? job.toJSON() : job,
      metadata: {
        jobNumber: job.jobNumber,
        planNumber: plan.planNumber,
        itemCode,
        targetQuantity
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

  public async getJobById(
    tenantId: string,
    id: string
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, id);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${id}' not found`);
    }
    return job;
  }

  public async getJobsByPlanId(
    tenantId: string,
    planId: string
  ): Promise<ProductionJobDocument[]> {
    return this.repo.findByPlanId(tenantId, planId);
  }
}

export const productionJobService = new ProductionJobService();
