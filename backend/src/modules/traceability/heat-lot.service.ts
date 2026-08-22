import { randomUUID } from 'crypto';
import { BaseService } from '../../core/services/base.service.js';
import { IHeatLotRepository, heatLotRepository } from './heat-lot.repository.js';
import { IItemRepository, itemRepository } from '../item/item.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  IHeatLot,
  HeatLotDocument,
  InwardHeatLotDto,
  AllocateHeatLotDto,
  ConsumeHeatLotDto,
  QuarantineHeatLotDto,
  ReleaseHeatLotDto,
  HeatLotFilterQuery,
  ForwardTraceResult,
  BackwardTraceResult
} from './heat-lot.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class HeatLotService extends BaseService {
  constructor(
    private readonly repo: IHeatLotRepository = heatLotRepository,
    private readonly itemRepo: IItemRepository = itemRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('HeatLotService');
  }

  /**
   * Inwards a new heat lot, links it with Item Master, and generates unique identifier
   */
  public async inwardHeatLot(
    tenantId: string,
    dto: InwardHeatLotDto,
    actor?: ActorContext
  ): Promise<HeatLotDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const heatLotNumber =
      dto.heatLotNumber ? dto.heatLotNumber.toUpperCase() : await this.repo.generateNextHeatLotNumber(tenantId);

    const existing = await this.repo.findByHeatLotNumber(tenantId, heatLotNumber);
    if (existing) {
      throw new ConflictError(`Heat lot with number '${heatLotNumber}' already exists in this tenant`);
    }

    const heatLot = await this.repo.create(tenantId, {
      ...dto,
      heatLotNumber,
      itemCode: item.itemCode,
      currentQuantity: dto.receivedQuantity,
      allocatedQuantity: 0,
      consumedQuantity: 0,
      receivedDate: dto.receivedDate || new Date(),
      status: dto.status || 'INWARDED',
      allocations: [],
      consumptionHistory: [],
      lineage: dto.lineage || { sourceType: 'RAW_MILL_HEAT', parentHeatLotIds: [], childHeatLotIds: [] }
    } as any);

    // Update parent Item master stock and batch counters
    await this.itemRepo.updateStock(tenantId, item.id, dto.receivedQuantity, 0);
    await this.itemRepo.incrementBatchCounters(tenantId, item.id, 1, 1);

    this.logger.info(
      `🔗 Heat lot inwarded: [${heatLot.heatLotNumber}] Supplier Heat: [${heatLot.supplierHeatNumber}] Grade: [${heatLot.materialGrade}] (${heatLot.receivedQuantity} ${heatLot.uom})`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'HEAT_LOT_INWARDED',
        entityType: 'HeatLot',
        entityId: heatLot.id,
        afterState: heatLot.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('HEAT_LOT_INWARDED', tenantId, {
      heatLotId: heatLot.id,
      heatLotNumber: heatLot.heatLotNumber,
      supplierHeatNumber: heatLot.supplierHeatNumber,
      materialGrade: heatLot.materialGrade
    });

    return heatLot;
  }

  /**
   * Retrieves heat lot by ID
   */
  public async getHeatLotById(tenantId: string, id: string): Promise<HeatLotDocument> {
    const heatLot = await this.repo.findById(tenantId, id);
    if (!heatLot) {
      throw new NotFoundError(`Heat lot with ID '${id}' not found`);
    }
    return heatLot;
  }

  /**
   * Retrieves heat lot by Heat Lot Number
   */
  public async getHeatLotByNumber(tenantId: string, heatLotNumber: string): Promise<HeatLotDocument> {
    const heatLot = await this.repo.findByHeatLotNumber(tenantId, heatLotNumber);
    if (!heatLot) {
      throw new NotFoundError(`Heat lot '${heatLotNumber.toUpperCase()}' not found`);
    }
    return heatLot;
  }

  /**
   * Quarantines a heat lot (e.g. pending chemical test cert or OOS inspection)
   */
  public async quarantineHeatLot(
    tenantId: string,
    id: string,
    dto: QuarantineHeatLotDto,
    actor?: ActorContext
  ): Promise<HeatLotDocument> {
    const heatLot = await this.getHeatLotById(tenantId, id);

    const beforeState = { status: heatLot.status, quarantineReason: heatLot.quarantineReason };

    heatLot.status = 'QUARANTINED';
    heatLot.quarantineReason = dto.quarantineReason;
    const updated = await heatLot.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'HEAT_LOT_QUARANTINED',
        entityType: 'HeatLot',
        entityId: heatLot.id,
        beforeState,
        afterState: { status: 'QUARANTINED', quarantineReason: dto.quarantineReason },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('HEAT_LOT_QUARANTINED', tenantId, {
      heatLotId: heatLot.id,
      heatLotNumber: heatLot.heatLotNumber,
      quarantineReason: dto.quarantineReason
    });

    return updated;
  }

  /**
   * Releases a heat lot for production allocation
   */
  public async releaseHeatLot(
    tenantId: string,
    id: string,
    dto: ReleaseHeatLotDto,
    actor?: ActorContext
  ): Promise<HeatLotDocument> {
    const heatLot = await this.getHeatLotById(tenantId, id);

    const beforeState = { status: heatLot.status, quarantineReason: heatLot.quarantineReason };

    heatLot.status = 'RELEASED';
    heatLot.quarantineReason = undefined;
    const updated = await heatLot.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'HEAT_LOT_RELEASED',
        entityType: 'HeatLot',
        entityId: heatLot.id,
        beforeState,
        afterState: { status: 'RELEASED', releaseNotes: dto.releaseNotes },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('HEAT_LOT_RELEASED', tenantId, {
      heatLotId: heatLot.id,
      heatLotNumber: heatLot.heatLotNumber
    });

    return updated;
  }

  /**
   * Allocates/reserves heat lot quantity for a specific production Job Card
   */
  public async allocateHeatLot(
    tenantId: string,
    id: string,
    dto: AllocateHeatLotDto,
    actor?: ActorContext
  ): Promise<HeatLotDocument> {
    const heatLot = await this.getHeatLotById(tenantId, id);

    if (heatLot.status === 'QUARANTINED' || heatLot.status === 'REJECTED') {
      throw new BadRequestError(
        `Cannot allocate from heat lot [${heatLot.heatLotNumber}] with status '${heatLot.status}'`
      );
    }

    const availableQuantity = heatLot.currentQuantity - heatLot.allocatedQuantity;
    if (availableQuantity < dto.quantity) {
      throw new BadRequestError(
        `Insufficient available quantity in heat lot [${heatLot.heatLotNumber}]. Requested: ${dto.quantity} ${heatLot.uom}, Available unallocated: ${availableQuantity} ${heatLot.uom}`
      );
    }

    const allocation = {
      allocationId: randomUUID(),
      jobCardId: dto.jobCardId,
      jobCardNumber: dto.jobCardNumber.toUpperCase(),
      customerCode: dto.customerCode?.toUpperCase(),
      quantity: dto.quantity,
      allocatedAt: new Date(),
      status: 'RESERVED' as const
    };

    heatLot.allocations.push(allocation);
    heatLot.allocatedQuantity += dto.quantity;
    const updated = await heatLot.save();

    // Update parent Item master allocated stock
    await this.itemRepo.updateStock(tenantId, heatLot.itemId, 0, dto.quantity);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'HEAT_LOT_ALLOCATED',
        entityType: 'HeatLot',
        entityId: heatLot.id,
        afterState: { allocation, allocatedQuantity: updated.allocatedQuantity },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('HEAT_LOT_ALLOCATED', tenantId, {
      heatLotId: heatLot.id,
      heatLotNumber: heatLot.heatLotNumber,
      jobCardNumber: dto.jobCardNumber,
      quantity: dto.quantity
    });

    return updated;
  }

  /**
   * Consumes heat lot material for furnace batch execution
   */
  public async consumeHeatLot(
    tenantId: string,
    id: string,
    dto: ConsumeHeatLotDto,
    actor?: ActorContext
  ): Promise<HeatLotDocument> {
    const heatLot = await this.getHeatLotById(tenantId, id);

    if (heatLot.status === 'QUARANTINED' || heatLot.status === 'REJECTED') {
      throw new BadRequestError(
        `Cannot consume material from heat lot [${heatLot.heatLotNumber}] with status '${heatLot.status}'`
      );
    }

    if (heatLot.currentQuantity < dto.quantity) {
      throw new BadRequestError(
        `Insufficient current quantity in heat lot [${heatLot.heatLotNumber}]. Current: ${heatLot.currentQuantity} ${heatLot.uom}, Requested consumption: ${dto.quantity} ${heatLot.uom}`
      );
    }

    const consumption = {
      transactionId: randomUUID(),
      jobCardId: dto.jobCardId,
      jobCardNumber: dto.jobCardNumber.toUpperCase(),
      customerCode: dto.customerCode?.toUpperCase(),
      furnaceId: dto.furnaceId,
      batchNumber: dto.batchNumber,
      quantityConsumed: dto.quantity,
      consumedAt: new Date(),
      operatorId: dto.operatorId
    };

    heatLot.consumptionHistory.push(consumption);
    heatLot.currentQuantity -= dto.quantity;
    heatLot.consumedQuantity += dto.quantity;

    // Relieve allocation if previously reserved
    const matchingAllocation = heatLot.allocations.find(
      (a) => a.jobCardNumber === dto.jobCardNumber.toUpperCase() && a.status === 'RESERVED'
    );
    let deltaAllocated = 0;
    if (matchingAllocation) {
      matchingAllocation.status = 'ISSUED';
      const relieveQty = Math.min(matchingAllocation.quantity, dto.quantity);
      heatLot.allocatedQuantity = Math.max(0, heatLot.allocatedQuantity - relieveQty);
      deltaAllocated = -relieveQty;
    }

    if (heatLot.currentQuantity === 0) {
      heatLot.status = 'EXHAUSTED';
    } else if (heatLot.status === 'INWARDED') {
      heatLot.status = 'CONSUMED';
    }

    const updated = await heatLot.save();

    // Update parent Item master stock
    await this.itemRepo.updateStock(tenantId, heatLot.itemId, -dto.quantity, deltaAllocated);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'HEAT_LOT_CONSUMED',
        entityType: 'HeatLot',
        entityId: heatLot.id,
        afterState: { consumption, currentQuantity: updated.currentQuantity, status: updated.status },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('HEAT_LOT_CONSUMED', tenantId, {
      heatLotId: heatLot.id,
      heatLotNumber: heatLot.heatLotNumber,
      jobCardNumber: dto.jobCardNumber,
      quantityConsumed: dto.quantity
    });

    return updated;
  }

  /**
   * Forward Traceability: Traces heat lot to downstream Job Cards, batches, and customers
   */
  public async forwardTrace(tenantId: string, heatLotNumber: string): Promise<ForwardTraceResult> {
    const heatLot = await this.getHeatLotByNumber(tenantId, heatLotNumber);
    const childLots = await this.repo.findChildLots(tenantId, heatLot.id);

    const downstreamJobs = heatLot.consumptionHistory.map((c) => ({
      jobCardId: c.jobCardId,
      jobCardNumber: c.jobCardNumber,
      customerCode: c.customerCode,
      furnaceId: c.furnaceId,
      batchNumber: c.batchNumber,
      quantityConsumed: c.quantityConsumed,
      consumedAt: c.consumedAt
    }));

    return {
      heatLot: heatLot.toJSON() as unknown as IHeatLot,
      downstreamJobs,
      childHeatLots: childLots.map((c) => c.toJSON() as unknown as IHeatLot)
    };
  }

  /**
   * Backward Traceability: Traces Job Card back to authoritative Heat Lot, supplier heat, and MTR
   */
  public async backwardTrace(tenantId: string, jobCardNumber: string): Promise<BackwardTraceResult> {
    const heatLots = await this.repo.findByJobCardNumber(tenantId, jobCardNumber);

    const matchedHeatLots = heatLots.map((hl) => {
      const consumption = hl.consumptionHistory.find(
        (c) => c.jobCardNumber === jobCardNumber.toUpperCase()
      );
      return {
        heatLotNumber: hl.heatLotNumber,
        supplierHeatNumber: hl.supplierHeatNumber,
        supplierName: hl.supplierName,
        mtrNumber: hl.mtrNumber,
        materialGrade: hl.materialGrade,
        chemicalComposition: hl.chemicalComposition ? Object.fromEntries((hl.chemicalComposition as any).entries?.() || Object.entries(hl.chemicalComposition)) : undefined,
        receivedDate: hl.receivedDate,
        quantityConsumed: consumption ? consumption.quantityConsumed : 0,
        consumedAt: consumption ? consumption.consumedAt : hl.receivedDate
      };
    });

    return {
      jobCardNumber: jobCardNumber.toUpperCase(),
      matchedHeatLots
    };
  }

  /**
   * Search and filter heat lots
   */
  public async searchHeatLots(
    tenantId: string,
    filters: HeatLotFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<HeatLotDocument>> {
    return this.repo.searchHeatLots(tenantId, filters, pagination);
  }
}

export const heatLotService = new HeatLotService();
