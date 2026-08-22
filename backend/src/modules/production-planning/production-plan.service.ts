import {
  IProductionPlanRepository,
  productionPlanRepository
} from './production-plan.repository.js';
import {
  CreateProductionPlanDto,
  UpdateProductionPlanDto,
  UpdatePlanStatusDto,
  QueryProductionPlanDto,
  ProductionPlanDocument,
  MaterialAvailabilityStatus
} from './production-plan.types.js';
import { customerRepository } from '../customer/customer.repository.js';
import { itemRepository } from '../item/item.repository.js';
import { recipeRepository } from '../recipe/recipe.repository.js';
import { specificationRepository } from '../specification/specification.repository.js';
import { heatLotRepository } from '../traceability/heat-lot.repository.js';
import { quarantineRepository } from '../quarantine/quarantine.repository.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';

export class ProductionPlanService {
  constructor(private readonly repository: IProductionPlanRepository = productionPlanRepository) {}

  public async createPlan(
    tenantId: string,
    actorId: string,
    dto: CreateProductionPlanDto
  ): Promise<ProductionPlanDocument> {
    // 1. Verify Customer
    const customer = await customerRepository.findById(tenantId, dto.customerId);
    if (!customer || customer.isDeleted) {
      throw new NotFoundError(`Customer with ID '${dto.customerId}' not found`);
    }
    if (customer.status !== 'active') {
      throw new BadRequestError(`Cannot plan production for customer in '${customer.status}' status`);
    }

    // 2. Verify Item
    const item = await itemRepository.findById(tenantId, dto.itemId);
    if (!item || item.isDeleted) {
      throw new NotFoundError(`Item with ID '${dto.itemId}' not found`);
    }
    if (item.status !== 'active') {
      throw new BadRequestError(`Cannot plan production for inactive item '${item.itemCode}'`);
    }

    // 3. Verify Recipe
    const recipe = await recipeRepository.findById(tenantId, dto.recipeId);
    if (!recipe || recipe.isDeleted) {
      throw new NotFoundError(`Recipe with ID '${dto.recipeId}' not found`);
    }
    if (recipe.status !== 'ACTIVE' && recipe.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot plan production with recipe in '${recipe.status}' status. Only ACTIVE or APPROVED recipes are allowed`
      );
    }

    // 4. Verify Specification
    const specification = await specificationRepository.findById(tenantId, dto.specificationId);
    if (!specification || specification.isDeleted) {
      throw new NotFoundError(`Specification with ID '${dto.specificationId}' not found`);
    }
    if (specification.status !== 'ACTIVE' && specification.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot plan production with specification in '${specification.status}' status. Only ACTIVE or APPROVED specifications are allowed`
      );
    }

    // 5. Cross-check Material & Recipe Compatibility
    if (
      recipe.applicableMaterialGrades &&
      recipe.applicableMaterialGrades.length > 0 &&
      item.materialGrade &&
      !recipe.applicableMaterialGrades.includes(item.materialGrade)
    ) {
      throw new BadRequestError(
        `Material grade mismatch: Item has '${item.materialGrade}', but Recipe requires one of [${recipe.applicableMaterialGrades.join(', ')}]`
      );
    }

    // 6. Check Material Availability & Quarantine Status
    const materialStatus = await this.evaluateMaterialReadiness(
      tenantId,
      item.itemCode,
      dto.requiredHeatLotNumber,
      dto.plannedQuantity
    );

    // 7. Generate Plan Number
    const planNumber = await this.repository.generateNextPlanNumber(tenantId);

    const plannedStart = new Date(dto.plannedStartDate);
    const targetCompletion = new Date(dto.targetCompletionDate);
    if (targetCompletion <= plannedStart) {
      throw new BadRequestError('Target completion date must be after planned start date');
    }

    const plan = await this.repository.create(tenantId, {
      planNumber,
      title: dto.title,
      status: 'PLANNED',
      priority: dto.priority || 'NORMAL',
      customer: {
        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.companyName
      },
      item: {
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        materialGrade: item.materialGrade || 'UNKNOWN',
        uom: item.uom
      },
      recipe: {
        recipeId: recipe.id,
        recipeCode: recipe.recipeCode,
        recipeRevision: recipe.revision,
        processFamily: recipe.processFamily
      },
      specification: {
        specificationId: specification.id,
        specCode: specification.specCode,
        specRevision: specification.revision
      },
      quantityTargets: {
        plannedQuantity: dto.plannedQuantity,
        scheduledQuantity: 0,
        inProgressQuantity: 0,
        completedQuantity: 0,
        scrappedQuantity: 0,
        completionPercentage: 0
      },
      timeline: {
        plannedStartDate: plannedStart,
        targetCompletionDate: targetCompletion,
        actualStartDate: null,
        actualCompletionDate: null
      },
      constraints: {
        materialAvailability: materialStatus.status,
        availableStockQuantity: materialStatus.availableStock,
        requiredHeatLotNumber: dto.requiredHeatLotNumber || null,
        compatibleFurnaceTypes: dto.compatibleFurnaceTypes || recipe.machineRequirements?.compatibleFurnaceTypes || [],
        estimatedFurnaceHours: dto.estimatedFurnaceHours || 0,
        operatorCertificationsRequired: dto.operatorCertificationsRequired || [],
        maxBatchWeightKg: dto.maxBatchWeightKg || null
      },
      assignedJobCardIds: [],
      notes: dto.notes || null,
      createdByActorId: actorId,
      updatedByActorId: actorId
    });

    await auditService.record(tenantId, {
      actorId,
      action: 'CREATE',
      entityType: 'PRODUCTION_PLAN',
      entityId: plan.id,
      afterState: plan.toJSON()
    });

    return plan;
  }

  public async getPlanById(tenantId: string, id: string): Promise<ProductionPlanDocument> {
    const plan = await this.repository.findById(tenantId, id);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with ID '${id}' not found`);
    }
    return plan;
  }

  public async getPlanByNumber(tenantId: string, planNumber: string): Promise<ProductionPlanDocument> {
    const plan = await this.repository.findByPlanNumber(tenantId, planNumber);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with number '${planNumber}' not found`);
    }
    return plan;
  }

  public async queryPlans(
    tenantId: string,
    query: QueryProductionPlanDto
  ): Promise<{ plans: ProductionPlanDocument[]; total: number }> {
    return this.repository.queryPlans(tenantId, query);
  }

  public async updatePlan(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateProductionPlanDto
  ): Promise<ProductionPlanDocument> {
    const plan = await this.getPlanById(tenantId, id);

    if (plan.status !== 'DRAFT' && plan.status !== 'PLANNED' && plan.status !== 'ON_HOLD') {
      throw new BadRequestError(`Cannot update production plan in '${plan.status}' status`);
    }

    const previousState = plan.toJSON();

    if (dto.title) plan.title = dto.title;
    if (dto.priority) plan.priority = dto.priority;
    if (dto.notes !== undefined) plan.notes = dto.notes;
    if (dto.plannedQuantity) {
      plan.quantityTargets.plannedQuantity = dto.plannedQuantity;
      plan.quantityTargets.completionPercentage =
        plan.quantityTargets.plannedQuantity > 0
          ? Math.min(100, Math.round((plan.quantityTargets.completedQuantity / plan.quantityTargets.plannedQuantity) * 100))
          : 0;
    }
    if (dto.plannedStartDate) plan.timeline.plannedStartDate = new Date(dto.plannedStartDate);
    if (dto.targetCompletionDate) plan.timeline.targetCompletionDate = new Date(dto.targetCompletionDate);
    if (dto.requiredHeatLotNumber !== undefined) plan.constraints.requiredHeatLotNumber = dto.requiredHeatLotNumber;
    if (dto.compatibleFurnaceTypes) plan.constraints.compatibleFurnaceTypes = dto.compatibleFurnaceTypes;
    if (dto.estimatedFurnaceHours !== undefined) plan.constraints.estimatedFurnaceHours = dto.estimatedFurnaceHours;
    if (dto.operatorCertificationsRequired) plan.constraints.operatorCertificationsRequired = dto.operatorCertificationsRequired;
    if (dto.maxBatchWeightKg !== undefined) plan.constraints.maxBatchWeightKg = dto.maxBatchWeightKg;

    plan.updatedByActorId = actorId;
    await plan.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'UPDATE',
      entityType: 'PRODUCTION_PLAN',
      entityId: plan.id,
      beforeState: previousState,
      afterState: plan.toJSON()
    });

    return plan;
  }

  public async updatePlanStatus(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdatePlanStatusDto
  ): Promise<ProductionPlanDocument> {
    const plan = await this.getPlanById(tenantId, id);
    const fromStatus = plan.status;
    const toStatus = dto.status;

    if (fromStatus === toStatus) {
      return plan;
    }

    // Validate Transition Rules
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['PLANNED', 'CANCELLED'],
      PLANNED: ['CONFIRMED', 'ON_HOLD', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'ON_HOLD'],
      ON_HOLD: ['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: []
    };

    if (!allowedTransitions[fromStatus]?.includes(toStatus)) {
      throw new BadRequestError(`Invalid status transition from '${fromStatus}' to '${toStatus}'`);
    }

    // If moving to CONFIRMED or IN_PROGRESS, verify material readiness
    if (toStatus === 'CONFIRMED' || toStatus === 'IN_PROGRESS') {
      const materialStatus = await this.evaluateMaterialReadiness(
        tenantId,
        plan.item.itemCode,
        plan.constraints.requiredHeatLotNumber,
        plan.quantityTargets.plannedQuantity
      );
      plan.constraints.materialAvailability = materialStatus.status;
      plan.constraints.availableStockQuantity = materialStatus.availableStock;

      if (materialStatus.status === 'BLOCKED_QUARANTINE') {
        throw new BadRequestError(
          `Cannot confirm or start production plan: Material is currently locked under active QUARANTINE`
        );
      }
    }

    if (toStatus === 'IN_PROGRESS' && !plan.timeline.actualStartDate) {
      plan.timeline.actualStartDate = new Date();
    }

    if (toStatus === 'COMPLETED') {
      plan.timeline.actualCompletionDate = new Date();
      plan.quantityTargets.completionPercentage = 100;
    }

    const previousState = plan.toJSON();
    plan.status = toStatus;
    plan.statusReason = dto.reason || null;
    plan.updatedByActorId = actorId;
    await plan.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'STATUS_CHANGE',
      entityType: 'PRODUCTION_PLAN',
      entityId: plan.id,
      beforeState: previousState,
      afterState: plan.toJSON(),
      metadata: { fromStatus, toStatus, reason: dto.reason }
    });

    return plan;
  }

  public async recalculatePlan(
    tenantId: string,
    id: string,
    actorId: string
  ): Promise<ProductionPlanDocument> {
    const plan = await this.getPlanById(tenantId, id);

    // 1. Recalculate Material Readiness
    const materialStatus = await this.evaluateMaterialReadiness(
      tenantId,
      plan.item.itemCode,
      plan.constraints.requiredHeatLotNumber,
      plan.quantityTargets.plannedQuantity
    );
    plan.constraints.materialAvailability = materialStatus.status;
    plan.constraints.availableStockQuantity = materialStatus.availableStock;

    // 2. Recalculate Completion Percentage
    if (plan.quantityTargets.plannedQuantity > 0) {
      plan.quantityTargets.completionPercentage = Math.min(
        100,
        Math.round((plan.quantityTargets.completedQuantity / plan.quantityTargets.plannedQuantity) * 100)
      );
    }

    // 3. Auto-complete if 100% finished
    if (
      plan.quantityTargets.completedQuantity >= plan.quantityTargets.plannedQuantity &&
      plan.status === 'IN_PROGRESS'
    ) {
      plan.status = 'COMPLETED';
      plan.timeline.actualCompletionDate = new Date();
    }

    plan.updatedByActorId = actorId;
    await plan.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'RECALCULATE',
      entityType: 'PRODUCTION_PLAN',
      entityId: plan.id,
      afterState: plan.toJSON()
    });

    return plan;
  }

  private async evaluateMaterialReadiness(
    tenantId: string,
    itemCode: string,
    requiredHeatLotNumber?: string | null,
    plannedQuantity: number = 0
  ): Promise<{ status: MaterialAvailabilityStatus; availableStock: number }> {
    let availableStock = 0;

    if (requiredHeatLotNumber) {
      // Specific heat lot required
      const heatLot = await heatLotRepository.findByHeatLotNumber(tenantId, requiredHeatLotNumber);
      if (!heatLot || heatLot.isDeleted) {
        return { status: 'PENDING_INWARD', availableStock: 0 };
      }

      // Check quarantine for this heat lot
      const activeQuarantine = await quarantineRepository.findActiveQuarantineForTarget(
        tenantId,
        'HEAT_LOT',
        requiredHeatLotNumber
      );
      if (activeQuarantine) {
        return { status: 'BLOCKED_QUARANTINE', availableStock: 0 };
      }

      availableStock = Math.max(0, heatLot.currentQuantity - (heatLot.allocatedQuantity || 0));
    } else {
      // Find all available heat lots for this itemCode
      const result = await heatLotRepository.searchHeatLots(
        tenantId,
        { itemCode },
        { page: 1, limit: 50, sort: { createdAt: -1 } }
      );
      for (const hl of result.items) {
        const activeQuarantine = await quarantineRepository.findActiveQuarantineForTarget(
          tenantId,
          'HEAT_LOT',
          hl.heatLotNumber
        );
        if (!activeQuarantine) {
          availableStock += Math.max(0, hl.currentQuantity - (hl.allocatedQuantity || 0));
        }
      }
    }

    let status: MaterialAvailabilityStatus = 'PENDING_INWARD';
    if (availableStock >= plannedQuantity) {
      status = 'AVAILABLE';
    } else if (availableStock > 0) {
      status = 'PARTIALLY_AVAILABLE';
    }

    return { status, availableStock };
  }
}

export const productionPlanService = new ProductionPlanService();
