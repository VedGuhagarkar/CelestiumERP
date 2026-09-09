import {
  IProductionJobRepository,
  productionJobRepository
} from './production-job.repository.js';
import {
  CreateDirectJobDto,
  CreateBatchOrderDto,
  UpdateProcessDetailsDto,
  IProcessDetailRow,
  ProcessRowStatus,
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
  TakeForProductionDto,
  RecordRecipeStageProgressDto,
  ApproveForInspectionDto,
  IProductionExecutionReadiness,
  TransitionToStorageDto,
  QueryJobsDto,
  ProductionJobDocument,
  ALLOWED_STATUS_TRANSITIONS,
  PRIORITY_WEIGHTS,
  IJobRecipeSnapshot,
  IJobSpecificationSnapshot,
  IBatchOrderGenealogy,
  IBatchOrderWorkflowState,
  IBatchOrderProductionReadiness,
  PRODUCTION_ONLY_FIELDS
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
import { userRepository } from '../auth/user.repository.js';
import { constraintAnalysisService } from '../constraint-analysis/constraint-analysis.service.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEventBus } from '../../core/events/domain-event-bus.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import { allocationLockManager } from '../../core/concurrency/allocation-lock.js';

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

    // 0b. Enforce Initial Workflow State & Anti-Manipulation Invariant (Prompt 6)
    const rawDto = dto as any;
    if (
      rawDto.inProduction ||
      rawDto.waitingForInspection ||
      rawDto.inInspection ||
      rawDto.waitingForDispatch ||
      rawDto.dispatched ||
      rawDto.inspection
    ) {
      throw new BadRequestError(
        "Invalid State Manipulation: Newly created Batch Order must strictly enter 'waiting for production'. Manipulating initial state to inProduction, waitingForInspection, inInspection, waitingForDispatch, dispatched, or inspection is strictly rejected."
      );
    }

    if (rawDto.waitingForProduction === false) {
      throw new BadRequestError(
        "Invalid State Manipulation: 'waitingForProduction' cannot be false on newly created Batch Order."
      );
    }

    if (rawDto.status && rawDto.status !== 'WAITING_FOR_PRODUCTION') {
      throw new BadRequestError(
        `Invalid State Manipulation: Initial status must be 'WAITING_FOR_PRODUCTION' (received: '${rawDto.status}').`
      );
    }

    if (rawDto.workflowState) {
      const ws = rawDto.workflowState;
      if (
        ws.inProduction ||
        ws.waitingForInspection ||
        ws.inInspection ||
        ws.waitingForDispatch ||
        ws.dispatched ||
        ws.inspection
      ) {
        throw new BadRequestError(
          "Invalid State Manipulation: Newly created Batch Order must strictly enter 'waiting for production'. Manipulating initial state to inProduction, waitingForInspection, inInspection, waitingForDispatch, dispatched, or inspection is strictly rejected."
        );
      }
      if (ws.waitingForProduction === false) {
        throw new BadRequestError(
          "Invalid State Manipulation: 'waitingForProduction' cannot be false on newly created Batch Order."
        );
      }
    }

    const activeFlagsCount = [
      rawDto.waitingForProduction,
      rawDto.inProduction,
      rawDto.waitingForInspection,
      rawDto.inInspection,
      rawDto.waitingForDispatch,
      rawDto.dispatched,
      rawDto.inspection
    ].filter((f) => f === true).length;

    if (activeFlagsCount > 1) {
      throw new BadRequestError(
        `Mutual Exclusivity Violation: Exactly one BO workflow state flag must be true at any moment. Received ${activeFlagsCount} active flags.`
      );
    }

    // Production Data Boundary Enforcement: Reject production-only fields in Planning
    const passedProductionFields = (PRODUCTION_ONLY_FIELDS as readonly string[]).filter(
      (f) => (dto as any)[f] !== undefined
    );

    if (passedProductionFields.length > 0) {
      throw new BadRequestError(
        `Production Data Boundary Violation: Fields belonging exclusively to the Production or Inspection phases (${passedProductionFields.join(', ')}) cannot be populated during the Planning Phase.`
      );
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

    const lockKey = `${tenantId}:allocation:grn:${grn.id}:item:${grnItem.itemId || grnItem.itemCode}`;
    return await allocationLockManager.withLock(lockKey, async () => {
      // Verify Item exists in Item master
      const item = await itemRepository.findById(tenantId, grnItem.itemId);
      if (!item || item.isDeleted) {
        throw new NotFoundError(`Item with ID '${grnItem.itemId}' not found in Item Master.`);
      }

      // 3b. Verify Part belongs to parent PO line items (Item -> PO relationship)
      let poItem: any = null;
      if (po.items && po.items.length > 0) {
        poItem = po.items.find(
          (pi) =>
            pi.itemId === item.id ||
            pi.itemCode === item.itemCode ||
            (pi as any)._id?.toString() === item.id ||
            pi.itemId === grnItem.itemId ||
            pi.itemCode === grnItem.itemCode
        );
        if (!poItem) {
          throw new BadRequestError(
            `Cross-Record Contamination Violation: Part '${item.itemCode}' does not exist on parent PO '${po.poNumber}'. Part must originate from PO line items.`
          );
        }
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

      // 5. Authoritative Quantity Validation & Cumulative Allocation (Prompt 7)
      const rawQuantity = dto.quantity !== undefined ? dto.quantity : dto.targetQuantity;
      if (rawQuantity === undefined || rawQuantity === null) {
        throw new BadRequestError('Batch Order quantity is required.');
      }
      const requestedQuantity = Number(rawQuantity);
      if (typeof rawQuantity !== 'number' || Number.isNaN(requestedQuantity) || !Number.isFinite(requestedQuantity)) {
        throw new BadRequestError('Malformed quantity: Batch Order quantity must be a valid finite number.');
      }
      if (requestedQuantity <= 0) {
        throw new BadRequestError('Batch Order quantity must be greater than zero.');
      }

      const authoritativeReceivedQuantity =
        grnItem.receivedQuantity !== undefined && grnItem.receivedQuantity !== null
          ? grnItem.receivedQuantity
          : grnItem.acceptedQuantity;

      if (
        authoritativeReceivedQuantity === undefined ||
        authoritativeReceivedQuantity === null ||
        authoritativeReceivedQuantity <= 0
      ) {
        throw new BadRequestError(
          `Quantity Allocation Violation: Selected GRN item '${grnItem.itemCode}' has no received quantity available for allocation.`
        );
      }

      if (requestedQuantity > authoritativeReceivedQuantity) {
        throw new BadRequestError(
          `Quantity Allocation Violation: Requested BO quantity [${requestedQuantity}] exceeds GRN received quantity [${authoritativeReceivedQuantity}] for item '${grnItem.itemCode}'.`
        );
      }

      // Cumulative allocation check across all active Batch Orders for this GRN and item
      const existingJobs = await this.repo.findByGrnId(tenantId, grn.id);
      const cumulativeAllocatedQuantity = (existingJobs || [])
        .filter(
          (j) =>
            !j.isDeleted &&
            j.status !== 'CANCELLED' &&
            (j.item?.itemId === grnItem.itemId || j.item?.itemCode === grnItem.itemCode)
        )
        .reduce((sum, j) => sum + (j.quantity?.targetQuantity || 0), 0);

      const availableQuantity = Math.max(0, authoritativeReceivedQuantity - cumulativeAllocatedQuantity);

      if (requestedQuantity > availableQuantity) {
        throw new BadRequestError(
          `Quantity Allocation Violation: Requested BO quantity [${requestedQuantity}] exceeds available GRN quantity [${availableQuantity}] for item '${grnItem.itemCode}'. Authoritative received: ${authoritativeReceivedQuantity}, already allocated across active Batch Orders: ${cumulativeAllocatedQuantity}. Cumulative BO quantity cannot exceed GRN received quantity.`
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

    // Reject Cross-Record Contamination: PO A + unrelated Customer (Client customer tampering)
    const clientCust =
      dto.customer ||
      (dto.customerId || dto.customerCode || dto.customerName
        ? { customerId: dto.customerId, customerCode: dto.customerCode, customerName: dto.customerName }
        : null);

    if (clientCust) {
      const clientCustId = clientCust.customerId ? String(clientCust.customerId).trim() : null;
      const clientCustCode = clientCust.customerCode ? String(clientCust.customerCode).trim().toUpperCase() : null;
      const clientCustName = clientCust.customerName ? String(clientCust.customerName).trim().toUpperCase() : null;

      const authId = String(customerId);
      const authPoId = String(po.id);
      const authCode = customerCode.toUpperCase();
      const authName = customerName.toUpperCase();

      const idMismatch =
        clientCustId &&
        clientCustId !== authId &&
        clientCustId !== authPoId &&
        clientCustId !== String(grn.poId);

      let resolvedCustMatch = !idMismatch;
      if (idMismatch && clientCustId) {
        const custDoc = await customerRepository.findById(tenantId, clientCustId);
        if (custDoc && !custDoc.isDeleted) {
          const custDocName = (custDoc.companyName || (custDoc as any).name || (custDoc as any).customerName || '').toUpperCase();
          const custDocCode = (custDoc.customerCode || '').toUpperCase();
          if (
            custDocName === authName ||
            custDocName.includes(authName) ||
            authName.includes(custDocName) ||
            (authCode !== 'CUST-DEFAULT' && custDocCode === authCode)
          ) {
            resolvedCustMatch = true;
          }
        }
      }

      const codeMismatch =
        clientCustCode &&
        clientCustCode !== authCode &&
        !authCode.includes(clientCustCode) &&
        !clientCustCode.includes(authCode);

      const nameMismatch =
        clientCustName &&
        clientCustName !== authName &&
        !authName.includes(clientCustName) &&
        !clientCustName.includes(authName);

      if (!resolvedCustMatch || codeMismatch || nameMismatch) {
        throw new BadRequestError(
          `Cross-Record Contamination Violation: Client-supplied customer '${clientCust.customerName || clientCust.customerCode || clientCust.customerId}' contradicts authoritative PO/GRN customer '${customerName}' (${customerCode}). Client customer tampering is prohibited.`
        );
      }
    }

    // Reject Cross-Record Contamination: GRN A + unrelated material
    const requestedMaterial = dto.materialGrade || (dto as any).material;
    if (requestedMaterial) {
      const reqMatUpper = requestedMaterial.trim().toUpperCase();
      const itemGradeUpper = itemGrade.trim().toUpperCase();
      if (reqMatUpper !== itemGradeUpper) {
        throw new BadRequestError(
          `Cross-Record Contamination Violation: Requested material grade '${requestedMaterial}' contradicts authoritative GRN material grade '${itemGrade}'. Combining GRN with unrelated material is prohibited.`
        );
      }
    }

    if (poItem && poItem.materialGrade) {
      const poGradeUpper = String(poItem.materialGrade).trim().toUpperCase();
      const itemGradeUpper = itemGrade.trim().toUpperCase();
      if (poGradeUpper !== itemGradeUpper) {
        throw new BadRequestError(
          `Cross-Record Contamination Violation: GRN material grade '${itemGrade}' contradicts parent PO material grade '${poItem.materialGrade}'.`
        );
      }
    }

    const plannedStartDate = dto.plannedStartDate ? new Date(dto.plannedStartDate) : new Date();
    const targetCompletionDate = dto.targetCompletionDate
      ? new Date(dto.targetCompletionDate)
      : new Date(Date.now() + 24 * 3600000);

    // 10b. Authoritative Process Planning Table (15 Positions)
    const processDetails = await this.validateAndNormalizeProcessTable(
      tenantId,
      actor,
      grn,
      item,
      recipe,
      dto.processDetails
    );

    // 10c. Seal Immutable Authoritative Source Genealogy (Supplier -> PO -> GRN -> BO, Item -> Recipe -> BO)
    const genealogy: IBatchOrderGenealogy = {
      whichPo: {
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName || customerName,
        supplierCode: po.supplierCode || customerCode,
        orderDate: po.orderDate || undefined
      },
      whichGrn: {
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        supplierName: grn.supplierName || customerName,
        supplierCode: grn.supplierCode || customerCode,
        receivedDate: (grn as any).receivedDate || grn.createdAt
      },
      whichPart: {
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name || grnItem.itemName,
        materialGrade: itemGrade,
        uom: item.uom || grnItem.uom || 'PCS'
      },
      whichRecipe: {
        recipeId: recipe.id,
        recipeCode: recipe.recipeCode,
        recipeName: recipe.name,
        revisionNumber: (recipe as any).revisionNumber || recipe.revision || 1,
        processFamily: recipe.processFamily
      },
      lockedAt: new Date(),
      lockedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      isImmutable: true
    };

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
          waitingForProduction: true,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false,
          workflowState: {
            waitingForProduction: true,
            inProduction: false,
            waitingForInspection: false,
            inInspection: false,
            waitingForDispatch: false,
            dispatched: false
          },
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
          processDetails,
          genealogy,
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
        targetQuantity: dto.targetQuantity,
        initialWorkflowState: 'WAITING_FOR_PRODUCTION',
        waitingForProduction: true,
        workflowState: {
          waitingForProduction: true,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        }
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
        status: job.status,
        waitingForProduction: true,
        workflowState: {
          waitingForProduction: true,
          inProduction: false,
          waitingForInspection: false,
          inInspection: false,
          waitingForDispatch: false,
          dispatched: false
        }
      }
    });

      return job;
    });
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
   * Generates the authoritative 15-row process table in blank initial state.
   */
  public buildDefaultProcessTable(): IProcessDetailRow[] {
    const rows: IProcessDetailRow[] = [];
    for (let i = 1; i <= 15; i++) {
      rows.push({
        serialNumber: i,
        partId: null,
        partCode: null,
        partName: null,
        process: null,
        recipeId: null,
        recipeCode: null,
        minhardness: null,
        maxhardness: null,
        userId: null,
        userName: null,
        status: 'BLANK',
        notes: null
      });
    }
    return rows;
  }

  /**
   * Authoritative validation and normalization for the 15-position process table.
   * Rejects:
   * - invalid Part (not present on GRN)
   * - invalid Recipe / Recipe mismatch with BO Item
   * - invalid Process (contradicts Recipe stages/processFamily)
   * - negative hardness or maxhardness < minhardness
   * - missing user input for hardness on configured rows
   * - invalid User (not a valid ERP user)
   * - invalid Status
   * - malformed rows or altered serial numbers
   */
  public async validateAndNormalizeProcessTable(
    tenantId: string,
    actor: IActorContext,
    grn: any,
    boItem: any,
    boRecipe: any,
    inputRows?: Partial<IProcessDetailRow>[]
  ): Promise<IProcessDetailRow[]> {
    if (!inputRows || inputRows.length === 0) {
      return this.buildDefaultProcessTable();
    }

    if (inputRows.length > 15) {
      throw new BadRequestError('The process table cannot contain more than 15 rows.');
    }

    const validStatuses: ProcessRowStatus[] = [
      'BLANK',
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'SKIPPED',
      'CANCELLED'
    ];

    const normalizedRows: IProcessDetailRow[] = [];

    for (let i = 0; i < 15; i++) {
      const expectedSerial = i + 1;

      if (i >= inputRows.length) {
        // Pad remaining positions with blank initial state rows
        normalizedRows.push({
          serialNumber: expectedSerial,
          partId: null,
          partCode: null,
          partName: null,
          process: null,
          recipeId: null,
          recipeCode: null,
          minhardness: null,
          maxhardness: null,
          userId: null,
          userName: null,
          status: 'BLANK',
          notes: null
        });
        continue;
      }

      const row = inputRows[i];

      // 1. Serial number validation
      if (row.serialNumber !== undefined && row.serialNumber !== null) {
        if (Number(row.serialNumber) !== expectedSerial) {
          throw new BadRequestError(
            `Serial Number Violation: Row at position ${expectedSerial} cannot have serial number ${row.serialNumber}. Serial numbers are system-generated and must be strictly sequential (1, 2, ... 15).`
          );
        }
      }

      // 2. Check if row is blank initial state
      const isBlankStatus = !row.status || row.status === 'BLANK';
      const hasNoContent =
        !row.partId &&
        !row.partCode &&
        !row.process &&
        !row.recipeId &&
        !row.recipeCode &&
        row.minhardness === undefined &&
        row.maxhardness === undefined;

      if (isBlankStatus && hasNoContent) {
        normalizedRows.push({
          serialNumber: expectedSerial,
          partId: null,
          partCode: null,
          partName: null,
          process: null,
          recipeId: null,
          recipeCode: null,
          minhardness: null,
          maxhardness: null,
          userId: null,
          userName: null,
          status: 'BLANK',
          notes: row.notes || null
        });
        continue;
      }

      // 3. Status validation
      const rowStatus = row.status || 'PENDING';
      if (!validStatuses.includes(rowStatus as ProcessRowStatus)) {
        throw new BadRequestError(`Invalid Status: '${row.status}' is not a permitted status.`);
      }

      // 4. Part Validation: Every process row must reference a valid Part present in the corresponding GRN
      const targetPartId = (row.partId || row.partCode || '').trim();
      if (!targetPartId) {
        throw new BadRequestError(
          `Row ${expectedSerial}: Part reference (partId or partCode) is required for configured process row.`
        );
      }

      const matchingGrnItem = grn.items?.find(
        (item: any) =>
          String(item.itemId) === targetPartId ||
          String(item.itemCode).toUpperCase() === targetPartId.toUpperCase() ||
          String((item as any)._id) === targetPartId
      );

      if (!matchingGrnItem) {
        throw new BadRequestError(
          `Part Membership Violation: Part '${targetPartId}' does not exist in GRN '${grn.grnNumber}'. Available GRN parts: [${grn.items?.map((it: any) => it.itemCode).join(', ')}]. Arbitrary unrelated parts are not allowed.`
        );
      }

      const partId = matchingGrnItem.itemId || (matchingGrnItem as any)._id?.toString() || targetPartId;
      const partCode = matchingGrnItem.itemCode;
      const partName = matchingGrnItem.itemName || matchingGrnItem.itemDescription || boItem.itemName || partCode;

      // 5. Recipe Validation: Each process row must reference valid Recipe data corresponding to the BO's Item
      const targetRecipeId = (row.recipeId || row.recipeCode || '').trim();
      if (!targetRecipeId) {
        throw new BadRequestError(
          `Row ${expectedSerial}: Recipe reference (recipeId or recipeCode) is required for configured process row.`
        );
      }

      let recipe = await recipeRepository.findById(tenantId, targetRecipeId);
      if (!recipe || recipe.isDeleted) {
        recipe = await recipeRepository.findHighestRevision(tenantId, targetRecipeId);
      }

      // If matching recipe still not found, check if it matches the current BO recipe
      if (!recipe && (boRecipe?.id === targetRecipeId || boRecipe?.recipeCode === targetRecipeId || (boRecipe as any)?._id?.toString() === targetRecipeId)) {
        recipe = boRecipe;
      }

      if (!recipe || (recipe as any).isDeleted) {
        throw new BadRequestError(`Invalid Recipe: Recipe '${targetRecipeId}' not found.`);
      }

      // The Recipe must correspond to the BO's Item
      const recipeItemId = (recipe as any).itemId || (recipe as any).item;
      const isRecipeItemMatched =
        !recipeItemId ||
        String(recipeItemId) === String(boItem.id) ||
        String(recipeItemId) === String(boItem.itemId) ||
        String(recipeItemId) === String((boItem as any)._id) ||
        String(recipeItemId).toUpperCase() === String(boItem.itemCode).toUpperCase();

      const itemGrade = boItem.materialGrade || matchingGrnItem.materialGrade;
      const isGradeCompatible =
        recipe.applicableMaterialGrades &&
        recipe.applicableMaterialGrades.some(
          (g: string) => g.toUpperCase().trim() === itemGrade?.toUpperCase().trim()
        );
      const isLineageBound =
        String(recipe.id) === String(matchingGrnItem.recipeId) ||
        recipe.recipeCode === matchingGrnItem.recipeCode;

      if (!isRecipeItemMatched && (!isGradeCompatible && !isLineageBound)) {
        throw new BadRequestError(
          `Recipe Mismatch Violation: Recipe '${recipe.recipeCode}' does not correspond to BO Item '${boItem.itemCode || boItem.itemName}'.`
        );
      }

      // 6. Process Validation: Must correspond to valid process information in the referenced Recipe
      const targetProcess = (row.process || '').trim();
      if (!targetProcess) {
        throw new BadRequestError(`Row ${expectedSerial}: Process name is required for configured process row.`);
      }

      const validStages = (recipe.stages || []).map((s: any) => (s.stageName || '').toUpperCase().trim());
      const recipeFamily = (recipe.processFamily || '').toUpperCase().trim();
      const recipeName = (recipe.name || '').toUpperCase().trim();
      const validProcessList = Array.from(new Set([recipeFamily, recipeName, ...validStages].filter(Boolean)));

      const targetProcessUpper = targetProcess.toUpperCase();
      const isProcessValid = validProcessList.some(
        (vp) =>
          vp === targetProcessUpper ||
          targetProcessUpper.includes(vp) ||
          vp.includes(targetProcessUpper)
      );

      if (!isProcessValid) {
        throw new BadRequestError(
          `Invalid Process: Process '${targetProcess}' contradicts Recipe '${recipe.recipeCode}'. Available Recipe processes: [${validProcessList.join(', ')}]. Arbitrary process information is not allowed.`
        );
      }

      // 7. Hardness Range Validation: User input required, non-negative, max >= min. Do not auto-populate!
      if (row.minhardness === undefined || row.minhardness === null || typeof row.minhardness !== 'number' || isNaN(row.minhardness)) {
        throw new BadRequestError(
          `Row ${expectedSerial}: 'minhardness' is required and must be explicitly provided by user input.`
        );
      }
      if (row.maxhardness === undefined || row.maxhardness === null || typeof row.maxhardness !== 'number' || isNaN(row.maxhardness)) {
        throw new BadRequestError(
          `Row ${expectedSerial}: 'maxhardness' is required and must be explicitly provided by user input.`
        );
      }
      if (row.minhardness < 0) {
        throw new BadRequestError(
          `Row ${expectedSerial}: 'minhardness' must be non-negative (received ${row.minhardness}).`
        );
      }
      if (row.maxhardness < 0) {
        throw new BadRequestError(
          `Row ${expectedSerial}: 'maxhardness' must be non-negative (received ${row.maxhardness}).`
        );
      }
      if (row.maxhardness < row.minhardness) {
        throw new BadRequestError(
          `Row ${expectedSerial}: 'maxhardness' (${row.maxhardness}) must be greater than or equal to 'minhardness' (${row.minhardness}).`
        );
      }

      // 8. User Validation: Valid ERP user relationship
      const targetUserId = row.userId ? String(row.userId).trim() : actor.userId;
      let resolvedUserName = row.userName ? String(row.userName).trim() : null;

      if (targetUserId === actor.userId) {
        resolvedUserName = resolvedUserName || actor.email || 'Current User';
      } else {
        const erpUser =
          (await userRepository.findById(tenantId, targetUserId)) ||
          (await userRepository.findByUsername(tenantId, targetUserId)) ||
          (await userRepository.findByEmail(tenantId, targetUserId));

        if (erpUser && !erpUser.isDeleted) {
          resolvedUserName =
            resolvedUserName ||
            (erpUser as any).fullName ||
            (erpUser as any).name ||
            erpUser.username ||
            erpUser.email;
        } else {
          const employee = await workforceCapacityRepository.findEmployeeById(tenantId, targetUserId);
          if (employee) {
            resolvedUserName = resolvedUserName || employee.fullName || employee.employeeCode;
          } else {
            throw new BadRequestError(
              `Invalid User: User identifier '${targetUserId}' is not a valid ERP user. Arbitrary user identifiers are prohibited.`
            );
          }
        }
      }

      normalizedRows.push({
        serialNumber: expectedSerial,
        partId,
        partCode,
        partName,
        process: targetProcess,
        recipeId: recipe.id || (recipe as any)._id?.toString() || targetRecipeId,
        recipeCode: recipe.recipeCode,
        minhardness: row.minhardness,
        maxhardness: row.maxhardness,
        userId: targetUserId,
        userName: resolvedUserName,
        status: (rowStatus === 'BLANK' ? 'PENDING' : rowStatus) as ProcessRowStatus,
        notes: row.notes || null
      });
    }

    return normalizedRows;
  }

  /**
   * Retrieves the 15-position process planning details for a Batch Order.
   */
  public async getProcessDetails(tenantId: string, jobId: string): Promise<IProcessDetailRow[]> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found.`);
    }

    if (!job.processDetails || job.processDetails.length === 0) {
      return this.buildDefaultProcessTable();
    }

    return job.processDetails;
  }

  /**
   * Updates the 15-position process planning details for a Batch Order.
   */
  public async updateProcessDetails(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: UpdateProcessDetailsDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found.`);
    }

    if (!job.grnId) {
      throw new BadRequestError('Batch Order has no associated GRN.');
    }

    const grn = await grnRepository.findGrnById(tenantId, job.grnId);
    if (!grn || grn.isDeleted) {
      throw new NotFoundError(`Associated GRN '${job.grnId}' not found.`);
    }

    let recipe = await recipeRepository.findById(tenantId, job.recipeSnapshot?.recipeId);
    if (!recipe || recipe.isDeleted) {
      recipe = job.recipeSnapshot as any;
    }

    const normalizedRows = await this.validateAndNormalizeProcessTable(
      tenantId,
      actor,
      grn,
      job.item,
      recipe,
      dto.processDetails
    );

    const docId = (job as any)._id ? (job as any)._id.toString() : job.id;
    const updatedJob = await this.repo.updateById(tenantId, docId, {
      processDetails: normalizedRows
    });

    if (!updatedJob) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found.`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'UPDATE_BATCH_ORDER_PROCESS_DETAILS',
      entityType: 'BATCH_ORDER',
      entityId: job.id,
      afterState: updatedJob.toJSON ? updatedJob.toJSON() : updatedJob,
      metadata: {
        boNumber: job.boNumber,
        configuredRowsCount: normalizedRows.filter((r) => r.status !== 'BLANK').length
      }
    });

    return updatedJob;
  }

  /**
   * Authoritative Source Genealogy Query
   * Answers the 4 core traceability questions:
   * 1. Which PO created this BO?
   * 2. Which GRN supplied it?
   * 3. Which Part does it represent?
   * 4. Which Recipe governs it?
   */
  public async getBatchOrderGenealogy(tenantId: string, jobId: string) {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found.`);
    }

    const genealogy: IBatchOrderGenealogy = job.genealogy || {
      whichPo: {
        poId: job.poId || 'N/A',
        poNumber: job.poNumber || 'N/A',
        supplierName: job.customer?.customerName || 'N/A',
        supplierCode: job.customer?.customerCode || 'N/A'
      },
      whichGrn: {
        grnId: job.grnId || 'N/A',
        grnNumber: job.grnNumber || 'N/A',
        supplierName: job.customer?.customerName || 'N/A',
        supplierCode: job.customer?.customerCode || 'N/A'
      },
      whichPart: {
        itemId: job.item?.itemId || 'N/A',
        itemCode: job.item?.itemCode || 'N/A',
        itemName: job.item?.itemName || 'N/A',
        materialGrade: job.item?.materialGrade || 'N/A',
        uom: job.item?.uom || 'PCS'
      },
      whichRecipe: {
        recipeId: job.recipeSnapshot?.recipeId || 'N/A',
        recipeCode: job.recipeSnapshot?.recipeCode || 'N/A',
        recipeName: job.recipeSnapshot?.name || 'N/A',
        revisionNumber: job.recipeSnapshot?.revisionNumber || 1,
        processFamily: job.recipeSnapshot?.processFamily || 'N/A'
      },
      lockedAt: (job as any).createdAt || new Date(),
      lockedBy: {
        userId: 'SYSTEM',
        role: 'SYSTEM'
      },
      isImmutable: true
    };

    return {
      boNumber: job.boNumber || job.jobNumber,
      status: job.status,
      genealogy,
      answers: {
        whichPoCreatedThisBo: `PO ${genealogy.whichPo.poNumber} (ID: ${genealogy.whichPo.poId})`,
        whichGrnSuppliedIt: `GRN ${genealogy.whichGrn.grnNumber} (ID: ${genealogy.whichGrn.grnId})`,
        whichPartDoesItRepresent: `${genealogy.whichPart.itemCode} - ${genealogy.whichPart.itemName} [${genealogy.whichPart.materialGrade}] (ID: ${genealogy.whichPart.itemId})`,
        whichRecipeGovernsIt: `${genealogy.whichRecipe.recipeCode} - ${genealogy.whichRecipe.recipeName} (Rev ${genealogy.whichRecipe.revisionNumber})`
      },
      traceabilityChain: `Supplier (${genealogy.whichPo.supplierName}) -> PO (${genealogy.whichPo.poNumber}) -> GRN (${genealogy.whichGrn.grnNumber}) -> BO (${job.boNumber || job.jobNumber}) governed by Recipe (${genealogy.whichRecipe.recipeCode})`
    };
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
          .filter(
            (j) =>
              !j.isDeleted &&
              j.status !== 'CANCELLED' &&
              (j.item?.itemId === item.itemId || j.item?.itemCode === item.itemCode)
          )
          .reduce((sum, j) => sum + (j.quantity?.targetQuantity || 0), 0);

        const authoritativeReceived =
          item.receivedQuantity !== undefined && item.receivedQuantity !== null
            ? item.receivedQuantity
            : item.acceptedQuantity;

        const availableQuantity = Math.max(0, authoritativeReceived - allocatedQty);

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
          receivedQuantity: authoritativeReceived,
          acceptedQuantity: item.acceptedQuantity,
          allocatedQuantity: allocatedQty,
          availableQuantity,
          availableUnitsCount: itemUnits.length,
          availableUnits: serializedUnits,
          canCreateBatchOrder:
            availableQuantity > 0 && ((units && units.length > 0) ? itemUnits.length > 0 : true),
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

    if (
      (dto as any).genealogy ||
      (dto as any).poId ||
      (dto as any).poNumber ||
      (dto as any).grnId ||
      (dto as any).grnNumber ||
      (dto as any).itemId ||
      (dto as any).item ||
      (dto as any).recipeId ||
      (dto as any).recipeSnapshot ||
      (dto as any).customer ||
      (dto as any).customerName ||
      (dto as any).customerCode ||
      (dto as any).weightKg ||
      (dto as any).weight ||
      (dto as any).boNumber
    ) {
      throw new BadRequestError(
        'Read-Only Source Data Violation: Authoritative source data (PO, GRN, Customer, Part, Recipe, Weight) is strictly read-only and cannot be modified from the Batch Order view.'
      );
    }

    // State Transition Authority Enforcement
    if (
      (dto as any).status !== undefined ||
      (dto as any).workflowState !== undefined ||
      (dto as any).inProduction !== undefined ||
      (dto as any).waitingForInspection !== undefined ||
      (dto as any).inInspection !== undefined ||
      (dto as any).waitingForDispatch !== undefined ||
      (dto as any).dispatched !== undefined
    ) {
      throw new BadRequestError(
        'State Transition Authority Violation: Planning users cannot directly transition Batch Orders into downstream lifecycle states (IN_PROGRESS, WAITING_FOR_INSPECTION, IN_INSPECTION, WAITING_FOR_DISPATCH, DISPATCHED). Downstream phases control their own execution and transitions.'
      );
    }

    // Production Data Boundary Enforcement: Reject production-only fields in Planning
    const passedProductionFields = (PRODUCTION_ONLY_FIELDS as readonly string[]).filter(
      (f) => (dto as any)[f] !== undefined
    );

    if (passedProductionFields.length > 0) {
      throw new BadRequestError(
        `Production Data Boundary Violation: Fields belonging exclusively to the Production or Inspection phases (${passedProductionFields.join(', ')}) cannot be populated during the Planning Phase.`
      );
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

    if (job.status !== 'SCHEDULED' && job.status !== 'APPROVED' && job.status !== 'WAITING_FOR_PRODUCTION') {
      throw new BadRequestError(
        `Cannot start job '${job.jobNumber}' in status '${job.status}'. Expected 'SCHEDULED', 'APPROVED', or 'WAITING_FOR_PRODUCTION'.`
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
    job.workflowState = {
      waitingForProduction: false,
      inProduction: true,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false
    };
    (job as any).waitingForProduction = false;
    (job as any).inProduction = true;
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

    // State Transition Authority: Prevent phase skipping from WAITING_FOR_PRODUCTION
    if (currentStatus === 'WAITING_FOR_PRODUCTION') {
      const downstreamPhases = ['QUALITY_CHECK', 'STORAGE', 'READY_FOR_DISPATCH', 'DISPATCHED', 'COMPLETED'];
      if (downstreamPhases.includes(targetStatus)) {
        throw new BadRequestError(
          `State Transition Authority Violation: Invalid lifecycle transition from '${currentStatus}' to '${targetStatus}'. Cannot skip the Production Phase to enter Inspection or Dispatch directly from Planning.`
        );
      }
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid lifecycle transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowedNext.join(', ')}]`
      );
    }

    job.status = targetStatus;

    if (targetStatus === 'IN_PROGRESS') {
      job.workflowState = {
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      };
      (job as any).waitingForProduction = false;
      (job as any).inProduction = true;
    }
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

  public validateProductionReadiness(job: any): IBatchOrderProductionReadiness {
    const missingFields: string[] = [];
    const validationErrors: string[] = [];

    // 1. PO check
    const hasPo = !!(job.poId || job.genealogy?.poId) && !!(job.poNumber || job.genealogy?.poNumber);
    if (!hasPo) {
      missingFields.push('Purchase Order (poId, poNumber)');
      validationErrors.push('Missing authoritative Purchase Order reference.');
    }

    // 2. GRN check
    const hasGrn = !!(job.grnId || job.genealogy?.grnId) && !!(job.grnNumber || job.genealogy?.grnNumber);
    if (!hasGrn) {
      missingFields.push('Goods Receipt Note (grnId, grnNumber)');
      validationErrors.push('Missing authoritative Goods Receipt Note reference.');
    }

    // 3. Customer check
    const customerName = job.customer?.customerName || (job as any).customerName;
    const hasCustomer = !!customerName;
    if (!hasCustomer) {
      missingFields.push('Customer');
      validationErrors.push('Missing authoritative Customer details.');
    }

    // 4. Part check
    const hasPart = !!(job.item?.itemCode || (job as any).itemId) && !!(job.item?.materialGrade);
    if (!hasPart) {
      missingFields.push('Part (itemCode, materialGrade)');
      validationErrors.push('Missing authoritative Part / Material Grade details.');
    }

    // 5. Quantity check
    const qty = job.quantity?.targetQuantity ?? (job as any).targetQuantity;
    const hasQty = typeof qty === 'number' && Number.isFinite(qty) && qty > 0;
    if (!hasQty) {
      missingFields.push('Quantity (targetQuantity > 0)');
      validationErrors.push('Batch Order quantity must be a positive number greater than 0.');
    }

    // 6. Weight check
    const weight = job.weightKg ?? (job as any).weight;
    const hasWeight = typeof weight === 'number' && Number.isFinite(weight) && weight > 0;
    if (!hasWeight) {
      missingFields.push('Weight (weightKg > 0)');
      validationErrors.push('Batch Order weight must be a positive number greater than 0.');
    }

    // 7. Recipe check
    const hasRecipe = !!(job.recipeId || job.recipeSnapshot?.recipeCode);
    if (!hasRecipe) {
      missingFields.push('Recipe');
      validationErrors.push('Missing Recipe specification snapshot.');
    }

    // 8. Process detail structure (15 fixed positions)
    const processDetails = job.processDetails;
    const has15Processes = Array.isArray(processDetails) && processDetails.length === 15;
    if (!has15Processes) {
      missingFields.push('Process Details Structure (15 standard positions)');
      validationErrors.push(
        `Process details table must contain exactly 15 sequential process positions (found: ${Array.isArray(processDetails) ? processDetails.length : 0}).`
      );
    } else {
      // 9. Process sequential structure check
      const invalidProcessRows = processDetails.filter(
        (p: any, idx: number) => !p || (p.serialNumber !== idx + 1 && p.processNumber !== idx + 1)
      );
      if (invalidProcessRows.length > 0) {
        validationErrors.push(
          `Process details table contains ${invalidProcessRows.length} non-sequential process rows.`
        );
      }
    }

    // 10. Valid workflow state check
    const status = job.status;
    const isWaitingForProd = status === 'WAITING_FOR_PRODUCTION';
    const isWfFlagWaiting = job.workflowState?.waitingForProduction === true || job.waitingForProduction === true;
    if (!isWaitingForProd || !isWfFlagWaiting) {
      if (!isWaitingForProd) {
        validationErrors.push(`Job status is '${status}', expected 'WAITING_FOR_PRODUCTION'.`);
      }
      if (!isWfFlagWaiting) {
        validationErrors.push("Workflow state flag 'waitingForProduction' must be true.");
      }
    }

    const isReadyForProduction = missingFields.length === 0 && validationErrors.length === 0;

    const readinessSummary = isReadyForProduction
      ? 'Batch Order meets all planning requirements and is fully ready for Production execution.'
      : `Batch Order is incomplete and not eligible for production. Missing: [${missingFields.join(', ')}]. Errors: [${validationErrors.join(', ')}]`;

    return {
      jobId: job.id || job._id?.toString(),
      jobNumber: job.jobNumber,
      boNumber: job.boNumber || job.jobNumber,
      status: job.status,
      isReadyForProduction,
      hasAuthoritativePo: hasPo,
      hasAuthoritativeGrn: hasGrn,
      hasCustomer,
      hasPart,
      hasValidQuantity: hasQty,
      hasValidWeight: hasWeight,
      hasRecipe,
      has15ProcessDetails: has15Processes,
      hasValidWorkflowState: isWaitingForProd && isWfFlagWaiting,
      missingFields,
      errors: validationErrors,
      validationErrors,
      readinessSummary
    };
  }

  public async getBatchOrderProductionReadiness(
    tenantId: string,
    jobId: string
  ): Promise<IBatchOrderProductionReadiness> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found`);
    }

    return this.validateProductionReadiness(job);
  }

  public async getProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const activeJobs = await this.repo.findActiveQueueJobs(tenantId, filters);

    // Prevent Premature Visibility: Incomplete or invalid BOs must not appear in the production queue
    const readyJobs = activeJobs.filter((job) => {
      if (job.status === 'WAITING_FOR_PRODUCTION' || (job as any).boNumber) {
        const readiness = this.validateProductionReadiness(job);
        return readiness.isReadyForProduction;
      }
      return true;
    });

    const sorted = [...readyJobs].sort((a, b) => {
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
      boNumber: job.boNumber || job.jobNumber,
      planNumber: job.planNumber,
      poId: job.poId || (job.genealogy as any)?.whichPo?.poId || (job.genealogy as any)?.poId || null,
      poNumber: job.poNumber || (job.genealogy as any)?.whichPo?.poNumber || (job.genealogy as any)?.poNumber || null,
      grnId: job.grnId || (job.genealogy as any)?.whichGrn?.grnId || (job.genealogy as any)?.grnId || null,
      grnNumber: job.grnNumber || (job.genealogy as any)?.whichGrn?.grnNumber || (job.genealogy as any)?.grnNumber || null,
      customerName: job.customer?.customerName || (job as any).customerName,
      itemCode: job.item?.itemCode,
      itemName: job.item?.itemName,
      materialGrade: job.item?.materialGrade,
      recipeId: (job as any).recipeId || job.recipeSnapshot?.recipeId || null,
      recipeCode: job.recipeSnapshot?.recipeCode || null,
      recipeName: (job.recipeSnapshot as any)?.name || (job.recipeSnapshot as any)?.recipeName || null,
      weightKg: job.weightKg || null,
      targetQuantity: job.quantity?.targetQuantity,
      priority: job.priority,
      status: job.status,
      workflowState: job.workflowState || null,
      assignedFurnaceCode: job.equipmentAssignment?.furnaceCode || null,
      assignedOperatorName: job.operatorAssignment?.operatorName || null,
      targetCompletionDate: job.timeline?.targetCompletionDate
    }));
  }

  // --- Authoritative Revised Production Phase Methods (Waiting -> In Production -> Waiting for Inspection) ---

  public async getWaitingForProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const rawJobs = await this.repo.findWaitingForProductionQueue(tenantId, filters);
    const readyJobs = rawJobs.filter((job) => {
      const readiness = this.validateProductionReadiness(job);
      return readiness.isReadyForProduction;
    });

    return readyJobs.map((job, idx) => ({
      queuePosition: idx + 1,
      jobId: job.id,
      jobNumber: job.jobNumber,
      boNumber: job.boNumber || job.jobNumber,
      poId: job.poId || (job.genealogy as any)?.whichPo?.poId || null,
      poNumber: job.poNumber || (job.genealogy as any)?.whichPo?.poNumber || null,
      grnId: job.grnId || (job.genealogy as any)?.whichGrn?.grnId || null,
      grnNumber: job.grnNumber || (job.genealogy as any)?.whichGrn?.grnNumber || null,
      customerName: job.customer?.customerName,
      itemCode: job.item?.itemCode,
      itemName: job.item?.itemName,
      materialGrade: job.item?.materialGrade,
      recipeId: job.recipeSnapshot?.recipeId || null,
      recipeCode: job.recipeSnapshot?.recipeCode || null,
      recipeName: job.recipeSnapshot?.name || null,
      recipeStagesCount: job.recipeSnapshot?.stages?.length || 0,
      recipeStages: job.recipeSnapshot?.stages || [],
      weightKg: job.weightKg || null,
      targetQuantity: job.quantity?.targetQuantity,
      priority: job.priority,
      status: job.status,
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      workflowState: job.workflowState || null,
      assignedFurnaceCode: job.equipmentAssignment?.furnaceCode || null,
      assignedOperatorName: job.operatorAssignment?.operatorName || null,
      targetCompletionDate: job.timeline?.targetCompletionDate
    }));
  }

  public async getInProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const jobs = await this.repo.findInProductionQueue(tenantId, filters);

    return jobs.map((job, idx) => {
      const totalStages = job.recipeSnapshot?.stages?.length || 0;
      const completedStages = job.execution?.stageProgress?.length || 0;

      return {
        queuePosition: idx + 1,
        jobId: job.id,
        jobNumber: job.jobNumber,
        boNumber: job.boNumber || job.jobNumber,
        poNumber: job.poNumber || (job.genealogy as any)?.whichPo?.poNumber || null,
        grnNumber: job.grnNumber || (job.genealogy as any)?.whichGrn?.grnNumber || null,
        customerName: job.customer?.customerName,
        itemCode: job.item?.itemCode,
        itemName: job.item?.itemName,
        materialGrade: job.item?.materialGrade,
        recipeCode: job.recipeSnapshot?.recipeCode || null,
        recipeName: job.recipeSnapshot?.name || null,
        recipeStages: job.recipeSnapshot?.stages || [],
        totalStages,
        completedStages,
        targetQuantity: job.quantity?.targetQuantity,
        loadedQuantity: job.quantity?.loadedQuantity || job.execution?.furnaceCharge?.loadedPieceCount,
        completedQuantity: job.quantity?.completedQuantity || 0,
        scrappedQuantity: job.quantity?.scrappedQuantity || 0,
        priority: job.priority,
        status: job.status,
        inProduction: true,
        workflowState: job.workflowState || null,
        furnaceCode: job.equipmentAssignment?.furnaceCode || null,
        furnaceId: job.equipmentAssignment?.furnaceId || null,
        operatorName: job.operatorAssignment?.operatorName || null,
        chargeNumber: job.execution?.furnaceCharge?.chargeNumber || null,
        cycleStartTime: job.execution?.cycleTimer?.cycleStartTime || job.timeline?.actualStartDate || null,
        stageProgress: job.execution?.stageProgress || [],
        downtimeLog: job.execution?.downtimeLog || [],
        productionLogs: job.execution?.productionLogs || []
      };
    });
  }

  public async getWaitingForInspectionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<any[]> {
    const jobs = await this.repo.findWaitingForInspectionQueue(tenantId, filters);

    return jobs.map((job, idx) => ({
      queuePosition: idx + 1,
      jobId: job.id,
      jobNumber: job.jobNumber,
      boNumber: job.boNumber || job.jobNumber,
      poNumber: job.poNumber || (job.genealogy as any)?.whichPo?.poNumber || null,
      grnNumber: job.grnNumber || (job.genealogy as any)?.whichGrn?.grnNumber || null,
      customerName: job.customer?.customerName,
      itemCode: job.item?.itemCode,
      itemName: job.item?.itemName,
      materialGrade: job.item?.materialGrade,
      recipeCode: job.recipeSnapshot?.recipeCode || null,
      recipeName: job.recipeSnapshot?.name || null,
      completedQuantity: job.quantity?.completedQuantity || 0,
      scrappedQuantity: job.quantity?.scrappedQuantity || 0,
      inspectionRequestId: job.execution?.qualityHandoff?.inspectionRequestId || null,
      status: job.status,
      waitingForInspection: true,
      workflowState: job.workflowState || null,
      actualCompletionDate: job.timeline?.actualCompletionDate || null
    }));
  }

  public async takeForProduction(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: TakeForProductionDto = {}
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found`);
    }

    if (job.inProduction || job.status === 'IN_PRODUCTION') {
      throw new ConflictError(
        `Batch Order '${job.boNumber || job.jobNumber}' is already in production and cannot be taken simultaneously by another user.`
      );
    }

    if (!job.waitingForProduction && job.status !== 'WAITING_FOR_PRODUCTION' && job.status !== 'SCHEDULED' && job.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot take Batch Order '${job.boNumber || job.jobNumber}' into production. Current status is '${job.status}'. Only Batch Orders waiting for production may be taken.`
      );
    }

    // Assert readiness
    const readiness = this.validateProductionReadiness(job);
    if (!readiness.isReadyForProduction) {
      throw new BadRequestError(
        `Cannot take Batch Order '${job.boNumber || job.jobNumber}' into production: Incomplete planning readiness (${readiness.missingFields.join(', ')}).`
      );
    }

    // Furnace capability & operational status check
    const furnaceId = dto.furnaceId || dto.assignedFurnaceId || job.equipmentAssignment?.furnaceId;
    let furnaceDoc: any = null;
    if (furnaceId) {
      furnaceDoc = await furnaceCapacityRepository.findFurnaceById(tenantId, furnaceId);
      if (furnaceDoc && (furnaceDoc.isDeleted || furnaceDoc.status !== 'OPERATIONAL')) {
        throw new BadRequestError(
          `Assigned furnace is not in OPERATIONAL state (Current status: '${furnaceDoc?.status || 'NOT_FOUND'}')`
        );
      }
      if (furnaceDoc && dto.initialFurnaceTempC && dto.initialFurnaceTempC > furnaceDoc.thermalCapabilities?.maxOperatingTempC) {
        throw new BadRequestError(
          `Initial furnace temperature (${dto.initialFurnaceTempC}°C) exceeds furnace maximum rating (${furnaceDoc.thermalCapabilities.maxOperatingTempC}°C)`
        );
      }
    }

    const now = new Date();
    const prevStatus = job.status;

    const chargeNumber =
      dto.chargeNumber ||
      `CHG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const loadedPieces = dto.loadedPieceCount || job.quantity?.loadedQuantity || job.quantity?.targetQuantity || 1;
    const loadedWeight = dto.loadedWeightKg || job.weightKg || 10;

    const updatePayload: any = {
      status: 'IN_PRODUCTION',
      waitingForProduction: false,
      inProduction: true,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: false,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      'timeline.actualStartDate': now,
      'quantity.loadedQuantity': loadedPieces,
      'execution.furnaceCharge': {
        chargeNumber,
        loadedWeightKg: loadedWeight,
        loadedPieceCount: loadedPieces,
        fixtureId: dto.fixtureId || null,
        initialFurnaceTempC: dto.initialFurnaceTempC || 25,
        initialAtmosphereLevel: dto.initialAtmosphereLevel || null,
        thermocoupleLocations: dto.thermocoupleLocations || ['TC_TOP', 'TC_CENTER', 'TC_BOTTOM'],
        startedAt: now,
        startedBy: { userId: actor.userId, email: actor.email, role: actor.role }
      },
      'execution.cycleTimer': {
        cycleStartTime: now,
        cycleEndTime: null,
        totalRunDurationMinutes: 0,
        totalDowntimeDurationMinutes: 0
      }
    };

    if (furnaceDoc) {
      updatePayload['equipmentAssignment.furnaceId'] = furnaceDoc.id;
      updatePayload['equipmentAssignment.furnaceCode'] = furnaceDoc.furnaceCode;
      updatePayload['equipmentAssignment.locationBay'] = furnaceDoc.locationBay;
      updatePayload['equipmentAssignment.pyrometryClass'] = furnaceDoc.thermalCapabilities?.pyrometryClass || 'CLASS_2';
    }

    const operatorId = dto.operatorId || dto.assignedOperatorId || job.operatorAssignment?.operatorId || actor.userId;
    if (operatorId) {
      updatePayload['operatorAssignment.operatorId'] = operatorId;
      updatePayload['operatorAssignment.operatorName'] = actor.email || 'Furnace Operator';
      if (dto.shift) updatePayload['operatorAssignment.shift'] = dto.shift;
    }

    const updated = await this.repo.atomicTakeForProduction(tenantId, job.id, {
      $set: updatePayload,
      $push: {
        transitionHistory: {
          fromStatus: prevStatus,
          toStatus: 'IN_PRODUCTION',
          timestamp: now,
          performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
          reason: 'Batch Order taken into production',
          notes: dto.notes || null
        }
      }
    });

    if (!updated) {
      throw new ConflictError(
        `Batch Order '${job.boNumber || job.jobNumber}' could not be taken into production. It was taken by another user or is no longer waiting for production.`
      );
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'PRODUCTION_JOB_TAKE',
      entityType: 'PRODUCTION_JOB',
      entityId: updated.id,
      metadata: {
        jobNumber: updated.jobNumber,
        boNumber: updated.boNumber,
        previousStatus: prevStatus,
        status: 'IN_PRODUCTION'
      }
    });

    this.eventBus.publish({
      name: DomainEvents.JOB_STARTED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: { jobId: updated.id, jobNumber: updated.jobNumber, boNumber: updated.boNumber, status: 'IN_PRODUCTION' }
    });

    this.eventBus.publish({
      name: DomainEvents.JOB_IN_PRODUCTION,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: { jobId: updated.id, jobNumber: updated.jobNumber, boNumber: updated.boNumber, status: 'IN_PRODUCTION' }
    });

    return updated;
  }

  public async recordRecipeStageProgress(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: RecordRecipeStageProgressDto
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found`);
    }

    if (!job.inProduction && job.status !== 'IN_PRODUCTION' && job.status !== 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot record production data for '${job.jobNumber}'. Batch Order is not in production (Current status: '${job.status}').`
      );
    }

    const recipeStages = job.recipeSnapshot?.stages || [];
    let matchedRecipeStage = recipeStages.find((s: any) => s.sequence === dto.stageSequence);

    if (recipeStages.length > 0 && !matchedRecipeStage) {
      throw new BadRequestError(
        `Recipe Stage sequence ${dto.stageSequence} does not exist in referenced Recipe '${job.recipeSnapshot.recipeCode}'. Production must follow the referenced Recipe.`
      );
    }

    const stageName = dto.stageName || matchedRecipeStage?.stageName || `Stage ${dto.stageSequence}`;
    const stageType = (matchedRecipeStage as any)?.stageType || 'SOAK';
    const targetTemp = matchedRecipeStage?.targetTemperatureC || dto.actualTemperatureC;
    const targetDuration = matchedRecipeStage?.soakTimeMinutes || dto.actualDurationMinutes;

    if (!job.execution) {
      job.execution = { stageProgress: [], downtimeLog: [], productionLogs: [] };
    }
    if (!job.execution.stageProgress) {
      job.execution.stageProgress = [];
    }

    const existingIdx = job.execution.stageProgress.findIndex((s) => s.stageSequence === dto.stageSequence);
    const stageRecord: any = {
      stageSequence: dto.stageSequence,
      stageName,
      stageType,
      targetTemperatureC: targetTemp,
      actualTemperatureC: dto.actualTemperatureC,
      targetDurationMinutes: targetDuration,
      actualDurationMinutes: dto.actualDurationMinutes,
      quenchMedium: dto.quenchMedium || matchedRecipeStage?.quenchParameters?.medium || null,
      quenchAgitationSpeedRpm: dto.quenchAgitationSpeedRpm || matchedRecipeStage?.quenchParameters?.agitationSpeedPercent || null,
      quenchMediaInitialTempC: dto.quenchMediaInitialTempC || null,
      quenchMediaFinalTempC: dto.quenchMediaFinalTempC || null,
      atmosphereDetails: dto.atmosphereDetails || null,
      recordedBy: { userId: actor.userId, email: actor.email, role: actor.role },
      timestamp: new Date(),
      notes: dto.notes || null
    };

    if (existingIdx >= 0) {
      job.execution.stageProgress[existingIdx] = stageRecord;
    } else {
      job.execution.stageProgress.push(stageRecord);
      job.execution.stageProgress.sort((a, b) => a.stageSequence - b.stageSequence);
    }

    await job.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'PRODUCTION_RECIPE_STAGE_RECORDED',
      entityType: 'PRODUCTION_JOB',
      entityId: job.id,
      metadata: {
        jobNumber: job.jobNumber,
        stageSequence: dto.stageSequence,
        stageName,
        actualTemperatureC: dto.actualTemperatureC,
        actualDurationMinutes: dto.actualDurationMinutes
      }
    });

    return job;
  }

  public async evaluateProductionExecutionReadiness(
    tenantId: string,
    jobId: string
  ): Promise<IProductionExecutionReadiness> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found`);
    }

    const recipeStages = job.recipeSnapshot?.stages || [];
    const totalRecipeStages = recipeStages.length;
    const executedStages = job.execution?.stageProgress || [];
    const completedStagesCount = executedStages.length;

    const missingRequirements: string[] = [];
    const errors: string[] = [];

    const executedSequences = new Set(executedStages.map((s) => s.stageSequence));
    for (const rs of recipeStages) {
      if (!executedSequences.has(rs.sequence)) {
        missingRequirements.push(`Recipe stage ${rs.sequence} (${rs.stageName}) has not been executed.`);
      }
    }

    const chargeRecorded = !!job.execution?.furnaceCharge?.chargeNumber;
    if (!chargeRecorded) {
      missingRequirements.push('Furnace charge setup has not been recorded.');
    }

    const loadedPieceCount =
      job.quantity?.loadedQuantity || job.execution?.furnaceCharge?.loadedPieceCount || job.quantity?.targetQuantity || 0;
    const completedQuantity = job.quantity?.completedQuantity || 0;
    const scrappedQuantity = job.quantity?.scrappedQuantity || 0;
    const pieceCountBalanced = completedQuantity + scrappedQuantity === loadedPieceCount && loadedPieceCount > 0;

    const allRecipeStagesCompleted = missingRequirements.length === 0;
    const isReadyForInspection = allRecipeStagesCompleted && chargeRecorded;

    return {
      isReadyForInspection,
      jobId: job.id,
      jobNumber: job.jobNumber,
      boNumber: job.boNumber || job.jobNumber,
      status: job.status,
      allRecipeStagesCompleted,
      totalRecipeStages,
      completedStagesCount,
      chargeRecorded,
      cycleTimerRecorded: !!job.execution?.cycleTimer?.cycleStartTime,
      pieceCountBalanced,
      loadedPieceCount,
      completedQuantity,
      scrappedQuantity,
      missingRequirements,
      errors
    };
  }

  public async approveForInspection(
    tenantId: string,
    actor: IActorContext,
    jobId: string,
    dto: ApproveForInspectionDto = {}
  ): Promise<ProductionJobDocument> {
    const job = await this.repo.findById(tenantId, jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order with ID '${jobId}' not found`);
    }

    if (!job.inProduction && job.status !== 'IN_PRODUCTION' && job.status !== 'IN_PROGRESS') {
      throw new BadRequestError(
        `Cannot approve Batch Order '${job.boNumber || job.jobNumber}' for inspection: It is not in production (Current status: '${job.status}').`
      );
    }

    // Verify recipe stage completion
    const recipeStages = job.recipeSnapshot?.stages || [];
    if (recipeStages.length > 0) {
      const executedSequences = new Set((job.execution?.stageProgress || []).map((s) => s.stageSequence));
      const missingStages = recipeStages.filter((rs: any) => !executedSequences.has(rs.sequence));
      if (missingStages.length > 0) {
        throw new BadRequestError(
          `Cannot approve for inspection: Incomplete Recipe execution. Missing recipe stage(s): ${missingStages.map((s: any) => `Seq ${s.sequence} (${s.stageName})`).join(', ')}.`
        );
      }
    } else {
      if (!job.execution?.stageProgress || job.execution.stageProgress.length === 0) {
        throw new BadRequestError(
          `Cannot approve for inspection: No production stage progress recorded for Batch Order '${job.jobNumber}'.`
        );
      }
    }

    const loadedPieceCount =
      job.quantity?.loadedQuantity || job.execution?.furnaceCharge?.loadedPieceCount || job.quantity?.targetQuantity || 1;
    const completedQty = dto.completedQuantity ?? (loadedPieceCount - (dto.scrappedQuantity || 0));
    const scrappedQty = dto.scrappedQuantity ?? 0;

    if (completedQty + scrappedQty !== loadedPieceCount) {
      throw new BadRequestError(
        `Piece count balance discrepancy: Completed pieces (${completedQty}) + Scrapped pieces (${scrappedQty}) does not equal Loaded piece count (${loadedPieceCount}).`
      );
    }

    const now = new Date();
    const prevStatus = job.status;

    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(Math.floor(1000 + Math.random() * 9000));
    const inspectionRequestId = `INSP-REQ-${yearMonth}-${seq}`;
    const pyrometryArchiveId = `PYRO-${yearMonth}-${seq}`;

    const updatePayload: any = {
      status: 'WAITING_FOR_INSPECTION',
      waitingForProduction: false,
      inProduction: false,
      waitingForInspection: true,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: true,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      'quantity.completedQuantity': completedQty,
      'quantity.scrappedQuantity': scrappedQty,
      'timeline.actualCompletionDate': now,
      'execution.cycleTimer.cycleEndTime': now,
      'execution.qualityHandoff': {
        inspectionRequestId,
        status: 'PENDING_INSPECTION',
        requestedAt: now,
        pyrometryArchiveId,
        completedQuantity: completedQty,
        scrappedQuantity: scrappedQty,
        notes: dto.operatorNotes || dto.notes || null
      }
    };

    const updated = await this.repo.atomicApproveForInspection(tenantId, job.id, {
      $set: updatePayload,
      $push: {
        transitionHistory: {
          fromStatus: prevStatus,
          toStatus: 'WAITING_FOR_INSPECTION',
          timestamp: now,
          performedBy: { userId: actor.userId, email: actor.email, role: actor.role },
          reason: `Production completed following Recipe '${job.recipeSnapshot?.recipeCode || 'STANDARD'}'. Approved for Inspection (${inspectionRequestId}).`,
          notes: dto.notes || null
        }
      }
    });

    if (!updated) {
      throw new BadRequestError(`Failed to transition Batch Order '${job.jobNumber}' to WAITING_FOR_INSPECTION.`);
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'PRODUCTION_JOB_APPROVED_FOR_INSPECTION',
      entityType: 'PRODUCTION_JOB',
      entityId: updated.id,
      metadata: {
        jobNumber: updated.jobNumber,
        boNumber: updated.boNumber,
        previousStatus: prevStatus,
        status: 'WAITING_FOR_INSPECTION',
        inspectionRequestId,
        completedQuantity: completedQty,
        scrappedQuantity: scrappedQty
      }
    });

    this.eventBus.publish({
      name: DomainEvents.JOB_COMPLETED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        jobId: updated.id,
        jobNumber: updated.jobNumber,
        boNumber: updated.boNumber,
        status: 'WAITING_FOR_INSPECTION',
        inspectionRequestId,
        completedQuantity: completedQty
      }
    });

    this.eventBus.publish({
      name: DomainEvents.JOB_APPROVED_FOR_INSPECTION,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        jobId: updated.id,
        jobNumber: updated.jobNumber,
        boNumber: updated.boNumber,
        status: 'WAITING_FOR_INSPECTION',
        inspectionRequestId,
        completedQuantity: completedQty,
        scrappedQuantity: scrappedQty
      }
    });

    return updated;
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
    const initialStatus = 'WAITING_FOR_PRODUCTION';

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
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      workflowState: {
        waitingForProduction: true,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false
      },
      processDetails: this.buildDefaultProcessTable(),
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
  ): Promise<any> {
    const job = await this.repo.findById(tenantId, id);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Batch Order / Production Job with ID '${id}' not found`);
    }

    // Ensure genealogy is fully populated
    const genealogy: IBatchOrderGenealogy = job.genealogy || {
      whichPo: {
        poId: job.poId || 'N/A',
        poNumber: job.poNumber || 'N/A',
        supplierName: job.customer?.customerName || 'N/A',
        supplierCode: job.customer?.customerCode || 'N/A',
        orderDate: (job.timeline as any)?.orderDate || null
      },
      whichGrn: {
        grnId: job.grnId || 'N/A',
        grnNumber: job.grnNumber || 'N/A',
        supplierName: job.customer?.customerName || 'N/A',
        supplierCode: job.customer?.customerCode || 'N/A',
        receivedDate: (job.timeline as any)?.receivedDate || null
      },
      whichPart: {
        itemId: job.item?.itemId || 'N/A',
        itemCode: job.item?.itemCode || 'N/A',
        itemName: job.item?.itemName || 'N/A',
        materialGrade: job.item?.materialGrade || 'N/A',
        uom: job.item?.uom || 'PCS'
      },
      whichRecipe: {
        recipeId: job.recipeSnapshot?.recipeId || 'N/A',
        recipeCode: job.recipeSnapshot?.recipeCode || 'N/A',
        recipeName: job.recipeSnapshot?.name || 'N/A',
        revisionNumber: job.recipeSnapshot?.revisionNumber || 1,
        processFamily: job.recipeSnapshot?.processFamily || 'N/A'
      },
      lockedAt: (job as any).createdAt || new Date(),
      lockedBy: {
        userId: 'SYSTEM',
        role: 'SYSTEM'
      },
      isImmutable: true
    };

    // Ensure processDetails contains all 15 positions
    const processDetails =
      job.processDetails && job.processDetails.length === 15
        ? job.processDetails
        : this.buildDefaultProcessTable();

    const jobJson = job.toJSON ? job.toJSON() : { ...job };

    // Explicit authoritative hierarchy: PO / GRN / BO
    const hierarchy = {
      po: {
        id: job.poId || genealogy.whichPo.poId,
        poNumber: job.poNumber || genealogy.whichPo.poNumber,
        supplierName: job.customer?.customerName || genealogy.whichPo.supplierName,
        supplierCode: job.customer?.customerCode || genealogy.whichPo.supplierCode
      },
      grn: {
        id: job.grnId || genealogy.whichGrn.grnId,
        grnNumber: job.grnNumber || genealogy.whichGrn.grnNumber,
        supplierName: job.customer?.customerName || genealogy.whichGrn.supplierName
      },
      bo: {
        id: job.id || (job as any)._id?.toString(),
        boNumber: job.boNumber || job.jobNumber,
        jobNumber: job.jobNumber,
        status: job.status,
        workflowState: job.workflowState
      },
      relationship: `PO (${job.poNumber || genealogy.whichPo.poNumber}) -> GRN (${job.grnNumber || genealogy.whichGrn.grnNumber}) -> BO (${job.boNumber || job.jobNumber})`,
      displayHierarchy: `${job.poNumber || genealogy.whichPo.poNumber} / ${job.grnNumber || genealogy.whichGrn.grnNumber} / ${job.boNumber || job.jobNumber}`
    };

    // Authoritative source information block (Read-Only)
    const sourceInformation = {
      po: {
        poId: job.poId || genealogy.whichPo.poId,
        poNumber: job.poNumber || genealogy.whichPo.poNumber,
        supplierName: job.customer?.customerName || genealogy.whichPo.supplierName,
        supplierCode: job.customer?.customerCode || genealogy.whichPo.supplierCode,
        readOnly: true
      },
      grn: {
        grnId: job.grnId || genealogy.whichGrn.grnId,
        grnNumber: job.grnNumber || genealogy.whichGrn.grnNumber,
        readOnly: true
      },
      customer: {
        customerId: job.customer?.customerId,
        customerCode: job.customer?.customerCode,
        customerName: job.customer?.customerName,
        readOnly: true
      },
      part: {
        itemId: job.item?.itemId,
        itemCode: job.item?.itemCode,
        itemName: job.item?.itemName,
        materialGrade: job.item?.materialGrade,
        uom: job.item?.uom,
        readOnly: true
      },
      quantity: {
        targetQuantity: job.quantity?.targetQuantity,
        uom: job.item?.uom || 'PCS',
        readOnly: true
      },
      weight: {
        weightKg: job.weightKg || job.weight || 0,
        uom: 'KG',
        readOnly: true
      },
      dueDate: job.timeline?.dueDate || (job as any).dueDate || null,
      recipe: {
        recipeId: job.recipeSnapshot?.recipeId,
        recipeCode: job.recipeSnapshot?.recipeCode,
        recipeName: job.recipeSnapshot?.name,
        revisionNumber: job.recipeSnapshot?.revisionNumber,
        processFamily: job.recipeSnapshot?.processFamily,
        stages: job.recipeSnapshot?.stages || [],
        readOnly: true
      },
      isReadOnlySourceData: true
    };

    return {
      ...jobJson,
      genealogy,
      processDetails,
      hierarchy,
      sourceInformation,
      isReadOnlySourceData: true,
      traceabilityLinks: {
        boToGrnToPo: `${job.boNumber || job.jobNumber} -> GRN ${job.grnNumber || genealogy.whichGrn.grnNumber} -> PO ${job.poNumber || genealogy.whichPo.poNumber}`,
        boToItemToRecipe: `${job.boNumber || job.jobNumber} -> Part ${job.item?.itemCode} [${job.item?.materialGrade}] -> Recipe ${job.recipeSnapshot?.recipeCode}`
      },
      recipeCorrespondence: {
        itemCode: job.item?.itemCode,
        itemName: job.item?.itemName,
        materialGrade: job.item?.materialGrade,
        recipeCode: job.recipeSnapshot?.recipeCode,
        recipeName: job.recipeSnapshot?.name,
        isCorresponded: true
      }
    };
  }

  public async getJobsByPlanId(
    tenantId: string,
    planId: string
  ): Promise<ProductionJobDocument[]> {
    return this.repo.findByPlanId(tenantId, planId);
  }
}

export const productionJobService = new ProductionJobService();
