import { BaseService } from '../../core/services/base.service.js';
import { IFinishedGoodsRepository, finishedGoodsRepository } from './finished-goods.repository.js';
import { IItemRepository, itemRepository } from '../item/item.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  FinishedGoodsDocument,
  InwardFinishedGoodsDto,
  ReleaseFinishedGoodsDto,
  ReserveFinishedGoodsDto,
  ReleaseReservationDto,
  MoveFinishedGoodsLocationDto,
  FinishedGoodsFilterQuery
} from './finished-goods.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class FinishedGoodsService extends BaseService {
  constructor(
    private readonly repo: IFinishedGoodsRepository = finishedGoodsRepository,
    private readonly itemRepo: IItemRepository = itemRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('FinishedGoodsService');
  }

  /**
   * Inwards production output into Finished Goods storage (Default: AWAITING_QC_RELEASE)
   */
  public async inwardFinishedGoods(
    tenantId: string,
    dto: InwardFinishedGoodsDto,
    actor?: ActorContext
  ): Promise<FinishedGoodsDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const finishedGoods = await this.repo.create(tenantId, {
      ...dto,
      itemCode: item.itemCode,
      uom: item.uom,
      status: 'AWAITING_QC_RELEASE',
      availableQuantity: 0,
      reservedQuantity: 0,
      dispatchedQuantity: 0,
      qualityRelease: {
        isReleased: false
      },
      movementHistory: [
        {
          fromLocation: 'PRODUCTION_FLOOR',
          toLocation: dto.location,
          quantity: dto.totalQuantity,
          movedAt: new Date(),
          movedByActorId: actor?.userId || 'SYSTEM',
          reason: 'Initial production output inwarding'
        }
      ]
    });

    this.logger.info(
      `📦 Finished Goods Inwarded: [${finishedGoods.fgLotNumber}] for Job Card [${dto.jobCardNumber}] (${dto.totalQuantity} ${item.uom}) -> [${dto.location}] (Awaiting QC Release)`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FINISHED_GOODS_INWARDED',
        entityType: 'FinishedGoods',
        entityId: finishedGoods.id,
        afterState: finishedGoods.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('FINISHED_GOODS_INWARDED', tenantId, {
      fgLotNumber: finishedGoods.fgLotNumber,
      jobCardNumber: dto.jobCardNumber,
      quantity: dto.totalQuantity
    });

    return finishedGoods;
  }

  /**
   * Quality Release Gate: Authorizes finished goods for customer dispatch (CoC required)
   */
  public async releaseFinishedGoods(
    tenantId: string,
    id: string,
    dto: ReleaseFinishedGoodsDto,
    actor?: ActorContext
  ): Promise<FinishedGoodsDocument> {
    const fg = await this.repo.findById(tenantId, id);
    if (!fg) {
      throw new NotFoundError(`Finished goods lot with ID '${id}' not found`);
    }

    if (fg.qualityRelease.isReleased) {
      throw new BadRequestError(`Finished goods lot [${fg.fgLotNumber}] is already released for dispatch`);
    }

    if (fg.status === 'QUARANTINED') {
      throw new BadRequestError(`Cannot release finished goods lot [${fg.fgLotNumber}] under active quarantine`);
    }

    const beforeState = fg.toJSON();
    const availableQuantity = fg.totalQuantity - fg.reservedQuantity - fg.dispatchedQuantity;

    fg.status = 'RELEASED_FOR_DISPATCH';
    fg.availableQuantity = availableQuantity;
    fg.qualityRelease = {
      isReleased: true,
      releasedAt: new Date(),
      releasedByActorId: actor?.userId || 'SYSTEM',
      releasedByActorEmail: actor?.email,
      cocNumber: dto.cocNumber,
      inspectionReportId: dto.inspectionReportId,
      releaseNotes: dto.releaseNotes
    };

    const updated = await fg.save();

    this.logger.info(
      `✅ Finished Goods QC Released: [${updated.fgLotNumber}] (CoC: ${dto.cocNumber || 'N/A'}) - Available: ${availableQuantity} ${updated.uom}`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FINISHED_GOODS_QC_RELEASED',
        entityType: 'FinishedGoods',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('FINISHED_GOODS_QC_RELEASED', tenantId, {
      fgLotNumber: updated.fgLotNumber,
      jobCardNumber: updated.jobCardNumber,
      cocNumber: dto.cocNumber
    });

    return updated;
  }

  /**
   * Reserves finished goods for dispatch / delivery challan preparation
   */
  public async reserveForDispatch(
    tenantId: string,
    id: string,
    dto: ReserveFinishedGoodsDto,
    actor?: ActorContext
  ): Promise<FinishedGoodsDocument> {
    const fg = await this.repo.findById(tenantId, id);
    if (!fg) {
      throw new NotFoundError(`Finished goods lot with ID '${id}' not found`);
    }

    if (!fg.qualityRelease.isReleased || fg.status === 'AWAITING_QC_RELEASE' || fg.status === 'QUARANTINED') {
      throw new BadRequestError(
        `Finished goods lot [${fg.fgLotNumber}] is not released by QC (Status: ${fg.status}) and cannot be reserved for dispatch`
      );
    }

    if (fg.availableQuantity < dto.quantity) {
      throw new BadRequestError(
        `Insufficient available finished goods for reservation. Available: ${fg.availableQuantity} ${fg.uom}, Requested: ${dto.quantity} ${fg.uom}`
      );
    }

    const beforeState = fg.toJSON();

    fg.availableQuantity -= dto.quantity;
    fg.reservedQuantity += dto.quantity;
    if (fg.availableQuantity === 0) {
      fg.status = 'RESERVED_FOR_DISPATCH';
    }

    const updated = await fg.save();

    this.logger.info(
      `🔒 Finished Goods Reserved: ${dto.quantity} ${updated.uom} of [${updated.fgLotNumber}] for Dispatch (Ref: ${dto.deliveryChallanNumber || 'N/A'})`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FINISHED_GOODS_RESERVED',
        entityType: 'FinishedGoods',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    return updated;
  }

  /**
   * Releases previously reserved finished goods back to available stock
   */
  public async releaseDispatchReservation(
    tenantId: string,
    id: string,
    dto: ReleaseReservationDto,
    actor?: ActorContext
  ): Promise<FinishedGoodsDocument> {
    const fg = await this.repo.findById(tenantId, id);
    if (!fg) {
      throw new NotFoundError(`Finished goods lot with ID '${id}' not found`);
    }

    if (fg.reservedQuantity < dto.quantity) {
      throw new BadRequestError(
        `Cannot release reservation: requested ${dto.quantity} ${fg.uom}, but currently reserved is ${fg.reservedQuantity} ${fg.uom}`
      );
    }

    const beforeState = fg.toJSON();

    fg.reservedQuantity -= dto.quantity;
    fg.availableQuantity += dto.quantity;
    fg.status = 'RELEASED_FOR_DISPATCH';

    const updated = await fg.save();

    this.logger.info(
      `🔓 Finished Goods Reservation Released: ${dto.quantity} ${updated.uom} of [${updated.fgLotNumber}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FINISHED_GOODS_RESERVATION_RELEASED',
        entityType: 'FinishedGoods',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    return updated;
  }

  /**
   * Moves finished goods between storage locations
   */
  public async moveLocation(
    tenantId: string,
    id: string,
    dto: MoveFinishedGoodsLocationDto,
    actor?: ActorContext
  ): Promise<FinishedGoodsDocument> {
    const fg = await this.repo.findById(tenantId, id);
    if (!fg) {
      throw new NotFoundError(`Finished goods lot with ID '${id}' not found`);
    }

    const fromLocation = fg.location;
    const toLocation = dto.destinationLocation;

    if (fromLocation === toLocation) {
      throw new BadRequestError('Destination location must be different from current storage location');
    }

    const beforeState = fg.toJSON();

    fg.location = toLocation;
    fg.movementHistory.push({
      fromLocation,
      toLocation,
      quantity: fg.totalQuantity - fg.dispatchedQuantity,
      movedAt: new Date(),
      movedByActorId: actor?.userId || 'SYSTEM',
      reason: dto.reason || 'Storage relocation'
    });

    const updated = await fg.save();

    this.logger.info(
      `🔄 Finished Goods Relocated: [${updated.fgLotNumber}] from [${fromLocation}] -> [${toLocation}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FINISHED_GOODS_RELOCATED',
        entityType: 'FinishedGoods',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    return updated;
  }

  public async getById(tenantId: string, id: string): Promise<FinishedGoodsDocument> {
    const fg = await this.repo.findById(tenantId, id);
    if (!fg) {
      throw new NotFoundError(`Finished goods lot with ID '${id}' not found`);
    }
    return fg;
  }

  public async getByLotNumber(tenantId: string, fgLotNumber: string): Promise<FinishedGoodsDocument> {
    const fg = await this.repo.findByLotNumber(tenantId, fgLotNumber);
    if (!fg) {
      throw new NotFoundError(`Finished goods lot with number '${fgLotNumber}' not found`);
    }
    return fg;
  }

  public async search(
    tenantId: string,
    filters: FinishedGoodsFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<FinishedGoodsDocument>> {
    return this.repo.search(tenantId, filters, pagination);
  }
}

export const finishedGoodsService = new FinishedGoodsService();
