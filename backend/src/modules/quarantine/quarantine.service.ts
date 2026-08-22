import { BaseService } from '../../core/services/base.service.js';
import { IQuarantineRepository, quarantineRepository } from './quarantine.repository.js';
import { IItemRepository, itemRepository } from '../item/item.repository.js';
import { IHeatLotRepository, heatLotRepository } from '../traceability/heat-lot.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  QuarantineRecordDocument,
  PlaceInQuarantineDto,
  ReleaseQuarantineDto,
  DispositionQuarantineDto,
  QuarantineFilterQuery,
  QuarantineTargetType
} from './quarantine.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class QuarantineService extends BaseService {
  constructor(
    private readonly repo: IQuarantineRepository = quarantineRepository,
    private readonly itemRepo: IItemRepository = itemRepository,
    private readonly heatLotRepo: IHeatLotRepository = heatLotRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('QuarantineService');
  }

  /**
   * Places material under controlled quarantine
   */
  public async placeInQuarantine(
    tenantId: string,
    dto: PlaceInQuarantineDto,
    actor?: ActorContext
  ): Promise<QuarantineRecordDocument> {
    const existingActive = await this.repo.findActiveQuarantineForTarget(
      tenantId,
      dto.targetType,
      dto.targetIdentifier
    );
    if (existingActive) {
      throw new ConflictError(
        `Target '${dto.targetIdentifier}' (${dto.targetType}) is already under active quarantine (${existingActive.quarantineNumber})`
      );
    }

    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    // Synchronize status with Heat Lot Master if applicable
    if (dto.targetType === 'HEAT_LOT') {
      const heatLot = await this.heatLotRepo.findByHeatLotNumber(tenantId, dto.targetIdentifier);
      if (heatLot) {
        heatLot.status = 'QUARANTINED';
        heatLot.quarantineReason = `${dto.reasonCode}: ${dto.reasonDescription}`;
        await heatLot.save();
      }
    }

    const quarantineRecord = await this.repo.createQuarantine(tenantId, {
      ...dto,
      itemCode: item.itemCode,
      uom: item.uom,
      initiatedByActorId: actor?.userId || 'SYSTEM',
      initiatedByActorEmail: actor?.email,
      initiatedAt: new Date()
    });

    this.logger.warn(
      `🛡️ Material Quarantined: [${quarantineRecord.quarantineNumber}] Target: [${dto.targetIdentifier}] (${dto.targetType}) Reason: [${dto.reasonCode}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_QUARANTINE_PLACED',
        entityType: 'QuarantineRecord',
        entityId: quarantineRecord.id,
        afterState: quarantineRecord.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_QUARANTINE_PLACED', tenantId, {
      quarantineNumber: quarantineRecord.quarantineNumber,
      targetType: dto.targetType,
      targetIdentifier: dto.targetIdentifier,
      reasonCode: dto.reasonCode
    });

    return quarantineRecord;
  }

  /**
   * Releases quarantined material back to usable inventory stock
   */
  public async releaseFromQuarantine(
    tenantId: string,
    id: string,
    dto: ReleaseQuarantineDto,
    actor?: ActorContext
  ): Promise<QuarantineRecordDocument> {
    const record = await this.repo.findQuarantineById(tenantId, id);
    if (!record) {
      throw new NotFoundError(`Quarantine record with ID '${id}' not found`);
    }

    if (record.status !== 'ACTIVE_QUARANTINE') {
      throw new BadRequestError(
        `Cannot release quarantine record [${record.quarantineNumber}] with status '${record.status}'`
      );
    }

    const beforeState = record.toJSON();

    // Release linked Heat Lot
    if (record.targetType === 'HEAT_LOT') {
      const heatLot = await this.heatLotRepo.findByHeatLotNumber(tenantId, record.targetIdentifier);
      if (heatLot) {
        heatLot.status = 'RELEASED';
        await heatLot.save();
      }
    }

    const updated = await this.repo.updateQuarantine(tenantId, id, {
      status: 'RELEASED_TO_STOCK',
      dispositionNotes: dto.releaseNotes,
      dispositionActorId: actor?.userId || 'SYSTEM',
      dispositionActorEmail: actor?.email,
      dispositionDate: new Date()
    });

    if (!updated) {
      throw new NotFoundError(`Quarantine record with ID '${id}' not found`);
    }

    this.logger.info(`✅ Quarantine Released: [${updated.quarantineNumber}] -> Stock`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_QUARANTINE_RELEASED',
        entityType: 'QuarantineRecord',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_QUARANTINE_RELEASED', tenantId, {
      quarantineNumber: updated.quarantineNumber,
      targetType: updated.targetType,
      targetIdentifier: updated.targetIdentifier
    });

    return updated;
  }

  /**
   * Dispositions quarantined material (Scrap, Return to Supplier, or Rework)
   */
  public async dispositionQuarantine(
    tenantId: string,
    id: string,
    dto: DispositionQuarantineDto,
    actor?: ActorContext
  ): Promise<QuarantineRecordDocument> {
    const record = await this.repo.findQuarantineById(tenantId, id);
    if (!record) {
      throw new NotFoundError(`Quarantine record with ID '${id}' not found`);
    }

    if (record.status !== 'ACTIVE_QUARANTINE') {
      throw new BadRequestError(
        `Cannot disposition quarantine record [${record.quarantineNumber}] with status '${record.status}'`
      );
    }

    const beforeState = record.toJSON();

    if (record.targetType === 'HEAT_LOT') {
      const heatLot = await this.heatLotRepo.findByHeatLotNumber(tenantId, record.targetIdentifier);
      if (heatLot && (dto.dispositionStatus === 'SCRAP_DISPOSITION' || dto.dispositionStatus === 'RETURN_TO_SUPPLIER')) {
        heatLot.status = 'REJECTED';
        await heatLot.save();
      }
    }

    const updated = await this.repo.updateQuarantine(tenantId, id, {
      status: dto.dispositionStatus,
      dispositionNotes: dto.dispositionNotes,
      dispositionActorId: actor?.userId || 'SYSTEM',
      dispositionActorEmail: actor?.email,
      dispositionDate: new Date()
    });

    if (!updated) {
      throw new NotFoundError(`Quarantine record with ID '${id}' not found`);
    }

    this.logger.warn(`🛑 Quarantine Dispositioned: [${updated.quarantineNumber}] -> [${dto.dispositionStatus}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_QUARANTINE_DISPOSITIONED',
        entityType: 'QuarantineRecord',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_QUARANTINE_DISPOSITIONED', tenantId, {
      quarantineNumber: updated.quarantineNumber,
      targetType: updated.targetType,
      targetIdentifier: updated.targetIdentifier,
      dispositionStatus: dto.dispositionStatus
    });

    return updated;
  }

  /**
   * Checks if target is currently quarantined
   */
  public async isTargetQuarantined(
    tenantId: string,
    targetType: QuarantineTargetType,
    targetIdentifier: string
  ): Promise<boolean> {
    const record = await this.repo.findActiveQuarantineForTarget(tenantId, targetType, targetIdentifier);
    return Boolean(record);
  }

  public async getQuarantineById(tenantId: string, id: string): Promise<QuarantineRecordDocument> {
    const record = await this.repo.findQuarantineById(tenantId, id);
    if (!record) {
      throw new NotFoundError(`Quarantine record with ID '${id}' not found`);
    }
    return record;
  }

  public async getQuarantineByNumber(tenantId: string, number: string): Promise<QuarantineRecordDocument> {
    const record = await this.repo.findQuarantineByNumber(tenantId, number);
    if (!record) {
      throw new NotFoundError(`Quarantine record with number '${number}' not found`);
    }
    return record;
  }

  public async searchQuarantines(
    tenantId: string,
    filters: QuarantineFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QuarantineRecordDocument>> {
    return this.repo.searchQuarantines(tenantId, filters, pagination);
  }
}

export const quarantineService = new QuarantineService();
