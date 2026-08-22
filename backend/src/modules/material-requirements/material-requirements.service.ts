import {
  IMaterialRequirementsRepository,
  materialRequirementsRepository
} from './material-requirements.repository.js';
import {
  CalculateRequirementsDto,
  CreateReservationDto,
  ReleaseReservationDto,
  QueryShortageDto,
  IMaterialRequirement,
  MaterialReservationDocument
} from './material-requirements.types.js';
import { productionPlanRepository } from '../production-planning/production-plan.repository.js';
import { heatLotRepository } from '../traceability/heat-lot.repository.js';
import { itemRepository } from '../item/item.repository.js';
import { quarantineRepository } from '../quarantine/quarantine.repository.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';

export class MaterialRequirementsService {
  constructor(
    private readonly repo: IMaterialRequirementsRepository = materialRequirementsRepository
  ) {}

  public async calculateRequirements(
    tenantId: string,
    dto: CalculateRequirementsDto = {}
  ): Promise<IMaterialRequirement[]> {
    // 1. Fetch relevant active production plans
    const { plans } = await productionPlanRepository.queryPlans(tenantId, {
      limit: 500
    });

    let activePlans = plans.filter(
      (p) => p.status === 'PLANNED' || p.status === 'CONFIRMED' || p.status === 'IN_PROGRESS'
    );

    if (dto.planIds && dto.planIds.length > 0) {
      activePlans = activePlans.filter((p) => dto.planIds!.includes(p.id));
    }

    if (dto.itemCodes && dto.itemCodes.length > 0) {
      activePlans = activePlans.filter((p) => dto.itemCodes!.includes(p.item.itemCode));
    }

    // 2. Group demand by Item Code
    const demandByItem = new Map<
      string,
      {
        itemId: string;
        itemCode: string;
        itemName: string;
        materialGrade: string;
        uom: string;
        totalDemand: number;
        impactedPlans: {
          planId: string;
          planNumber: string;
          customerCode: string;
          requiredQuantity: number;
          targetCompletionDate: Date;
          priority: string;
        }[];
      }
    >();

    for (const plan of activePlans) {
      const itemCode = plan.item.itemCode;
      const netPlanDemand = Math.max(
        0,
        plan.quantityTargets.plannedQuantity - plan.quantityTargets.completedQuantity
      );

      if (netPlanDemand <= 0) continue;

      if (!demandByItem.has(itemCode)) {
        demandByItem.set(itemCode, {
          itemId: plan.item.itemId,
          itemCode,
          itemName: plan.item.itemName,
          materialGrade: plan.item.materialGrade,
          uom: plan.item.uom,
          totalDemand: 0,
          impactedPlans: []
        });
      }

      const entry = demandByItem.get(itemCode)!;
      entry.totalDemand += netPlanDemand;
      entry.impactedPlans.push({
        planId: plan.id,
        planNumber: plan.planNumber,
        customerCode: plan.customer.customerCode,
        requiredQuantity: netPlanDemand,
        targetCompletionDate: plan.timeline.targetCompletionDate,
        priority: plan.priority
      });
    }

    // 3. For each item with demand, calculate available stock, reservations, and shortages
    const results: IMaterialRequirement[] = [];

    for (const [itemCode, demand] of demandByItem.entries()) {
      let totalAvailable = 0;
      let totalReserved = 0;
      let totalQuarantined = 0;

      // Query heat lots
      const heatLotRes = await heatLotRepository.searchHeatLots(
        tenantId,
        { itemCode },
        { page: 1, limit: 100, sort: { createdAt: -1 } }
      );

      for (const hl of heatLotRes.items) {
        totalReserved += hl.allocatedQuantity || 0;

        const isQuarantined = await quarantineRepository.findActiveQuarantineForTarget(
          tenantId,
          'HEAT_LOT',
          hl.heatLotNumber
        );

        if (isQuarantined) {
          totalQuarantined += hl.currentQuantity;
        } else {
          const freeLotQty = Math.max(0, hl.currentQuantity - (hl.allocatedQuantity || 0));
          totalAvailable += freeLotQty;
        }
      }

      const netShortage = Math.max(0, demand.totalDemand - totalAvailable);

      let severity: 'NONE' | 'PARTIAL' | 'CRITICAL' = 'NONE';
      if (netShortage > 0) {
        severity = totalAvailable === 0 ? 'CRITICAL' : 'PARTIAL';
      }

      results.push({
        itemId: demand.itemId,
        itemCode: demand.itemCode,
        itemName: demand.itemName,
        materialGrade: demand.materialGrade,
        uom: demand.uom,
        totalRequiredQuantity: demand.totalDemand,
        totalAvailableQuantity: totalAvailable,
        totalReservedQuantity: totalReserved,
        totalQuarantinedQuantity: totalQuarantined,
        netShortageQuantity: netShortage,
        severity,
        impactedPlans: demand.impactedPlans.sort(
          (a, b) => new Date(a.targetCompletionDate).getTime() - new Date(b.targetCompletionDate).getTime()
        )
      });
    }

    return results;
  }

  public async getShortages(
    tenantId: string,
    query: QueryShortageDto = {}
  ): Promise<{ shortages: IMaterialRequirement[]; total: number }> {
    const allRequirements = await this.calculateRequirements(tenantId, {
      itemCodes: query.itemCode ? [query.itemCode] : undefined
    });

    let shortages = allRequirements.filter((r) => r.netShortageQuantity > 0);

    if (query.materialGrade) {
      const mgRegex = new RegExp(query.materialGrade, 'i');
      shortages = shortages.filter((s) => mgRegex.test(s.materialGrade));
    }

    if (query.severity) {
      shortages = shortages.filter((s) => s.severity === query.severity);
    }

    const total = shortages.length;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const paginated = shortages.slice((page - 1) * limit, page * limit);

    return { shortages: paginated, total };
  }

  public async reserveMaterial(
    tenantId: string,
    actorId: string,
    dto: CreateReservationDto
  ): Promise<MaterialReservationDocument> {
    // 1. Verify Plan
    const plan = await productionPlanRepository.findById(tenantId, dto.planId);
    if (!plan || plan.isDeleted) {
      throw new NotFoundError(`Production Plan with ID '${dto.planId}' not found`);
    }

    if (plan.status !== 'PLANNED' && plan.status !== 'CONFIRMED' && plan.status !== 'IN_PROGRESS') {
      throw new BadRequestError(`Cannot reserve material for plan in '${plan.status}' status`);
    }

    let itemDetails = {
      itemId: plan.item.itemId,
      itemCode: plan.item.itemCode,
      materialGrade: plan.item.materialGrade,
      uom: plan.item.uom,
      targetIdentifier: ''
    };

    // 2. Perform Atomic Reservation based on Target Type
    if (dto.targetType === 'HEAT_LOT') {
      const heatLot = await heatLotRepository.findById(tenantId, dto.targetId);
      if (!heatLot || heatLot.isDeleted) {
        throw new NotFoundError(`Heat Lot with ID '${dto.targetId}' not found`);
      }

      // Check quarantine status
      const activeQuarantine = await quarantineRepository.findActiveQuarantineForTarget(
        tenantId,
        'HEAT_LOT',
        heatLot.heatLotNumber
      );
      if (activeQuarantine) {
        throw new BadRequestError(
          `Cannot reserve heat lot '${heatLot.heatLotNumber}': currently locked under active QUARANTINE`
        );
      }

      // Check available quantity
      const availableLotQty = heatLot.currentQuantity - (heatLot.allocatedQuantity || 0);
      if (dto.reservedQuantity > availableLotQty) {
        throw new BadRequestError(
          `Over-reservation prevented: Requested ${dto.reservedQuantity} ${heatLot.uom}, but only ${availableLotQty} ${heatLot.uom} is available on heat lot '${heatLot.heatLotNumber}'`
        );
      }

      // Update Heat Lot allocated quantity and allocations record
      heatLot.allocatedQuantity = (heatLot.allocatedQuantity || 0) + dto.reservedQuantity;
      if (!heatLot.allocations) heatLot.allocations = [];
      heatLot.allocations.push({
        jobCardNumber: dto.jobCardId || plan.planNumber,
        allocatedQuantity: dto.reservedQuantity,
        allocatedAt: new Date(),
        status: 'ALLOCATED'
      } as any);

      await heatLot.save();

      itemDetails = {
        itemId: heatLot.itemId,
        itemCode: heatLot.itemCode,
        materialGrade: heatLot.materialGrade,
        uom: heatLot.uom,
        targetIdentifier: heatLot.heatLotNumber
      };
    } else {
      // INVENTORY_ITEM
      const item = await itemRepository.findById(tenantId, dto.targetId);
      if (!item || item.isDeleted) {
        throw new NotFoundError(`Item with ID '${dto.targetId}' not found`);
      }

      const availableStock = item.currentStock - (item.allocatedStock || 0);
      if (dto.reservedQuantity > availableStock) {
        throw new BadRequestError(
          `Over-reservation prevented: Requested ${dto.reservedQuantity} ${item.uom}, but only ${availableStock} ${item.uom} is available for item '${item.itemCode}'`
        );
      }

      await itemRepository.updateStock(tenantId, item.id, 0, dto.reservedQuantity);

      itemDetails = {
        itemId: item.id,
        itemCode: item.itemCode,
        materialGrade: item.materialGrade || 'UNKNOWN',
        uom: item.uom,
        targetIdentifier: item.itemCode
      };
    }

    // 3. Create Reservation Record
    const reservationNumber = await this.repo.generateNextReservationNumber(tenantId);

    const reservation = await this.repo.create(tenantId, {
      reservationNumber,
      planId: plan.id,
      planNumber: plan.planNumber,
      jobCardId: dto.jobCardId || null,
      targetType: dto.targetType,
      targetId: dto.targetId,
      targetIdentifier: itemDetails.targetIdentifier,
      itemId: itemDetails.itemId,
      itemCode: itemDetails.itemCode,
      materialGrade: itemDetails.materialGrade,
      reservedQuantity: dto.reservedQuantity,
      uom: itemDetails.uom,
      status: 'ACTIVE',
      reservedByActorId: actorId,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId,
      action: 'RESERVE_MATERIAL',
      entityType: 'MATERIAL_RESERVATION',
      entityId: reservation.id,
      afterState: reservation.toJSON(),
      metadata: { planNumber: plan.planNumber, targetIdentifier: itemDetails.targetIdentifier }
    });

    return reservation;
  }

  public async releaseReservation(
    tenantId: string,
    id: string,
    actorId: string,
    dto: ReleaseReservationDto
  ): Promise<MaterialReservationDocument> {
    const reservation = await this.repo.findById(tenantId, id);
    if (!reservation || reservation.isDeleted) {
      throw new NotFoundError(`Material Reservation with ID '${id}' not found`);
    }

    if (reservation.status !== 'ACTIVE') {
      throw new BadRequestError(`Cannot release reservation with status '${reservation.status}'`);
    }

    // 1. Rollback Allocation on Target
    if (reservation.targetType === 'HEAT_LOT') {
      const heatLot = await heatLotRepository.findById(tenantId, reservation.targetId);
      if (heatLot) {
        heatLot.allocatedQuantity = Math.max(0, (heatLot.allocatedQuantity || 0) - reservation.reservedQuantity);
        if (heatLot.allocations) {
          const alloc = heatLot.allocations.find((a: any) => a.jobCardNumber === reservation.planNumber);
          if (alloc) (alloc as any).status = 'RELEASED';
        }
        await heatLot.save();
      }
    } else {
      const item = await itemRepository.findById(tenantId, reservation.targetId);
      if (item) {
        await itemRepository.updateStock(tenantId, item.id, 0, -reservation.reservedQuantity);
      }
    }

    // 2. Update Reservation Record
    const previousState = reservation.toJSON();
    reservation.status = 'RELEASED';
    reservation.releasedByActorId = actorId;
    reservation.releaseReason = dto.reason;
    reservation.releasedAt = new Date();

    await reservation.save();

    await auditService.record(tenantId, {
      actorId,
      action: 'RELEASE_MATERIAL_RESERVATION',
      entityType: 'MATERIAL_RESERVATION',
      entityId: reservation.id,
      beforeState: previousState,
      afterState: reservation.toJSON(),
      metadata: { reason: dto.reason }
    });

    return reservation;
  }

  public async releaseAllReservationsForPlan(
    tenantId: string,
    planId: string,
    actorId: string,
    reason: string
  ): Promise<number> {
    const activeReservations = await this.repo.findActiveReservationsByPlan(tenantId, planId);
    for (const res of activeReservations) {
      await this.releaseReservation(tenantId, res.id, actorId, { reason });
    }
    return activeReservations.length;
  }

  public async getReservationsByPlan(
    tenantId: string,
    planId: string
  ): Promise<MaterialReservationDocument[]> {
    return this.repo.findActiveReservationsByPlan(tenantId, planId);
  }
}

export const materialRequirementsService = new MaterialRequirementsService();
