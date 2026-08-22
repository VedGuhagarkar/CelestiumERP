import { BaseService } from '../../core/services/base.service.js';
import { IItemRepository, itemRepository } from './item.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  ItemDocument,
  CreateItemDto,
  UpdateItemDto,
  ItemFilterQuery
} from './item.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class ItemService extends BaseService {
  constructor(
    private readonly repo: IItemRepository = itemRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('ItemService');
  }

  /**
   * Registers a new item or material in the factory item master
   */
  public async createItem(tenantId: string, dto: CreateItemDto, actor?: ActorContext): Promise<ItemDocument> {
    const code = dto.itemCode.toUpperCase();
    const existing = await this.repo.findByCode(tenantId, code);
    if (existing) {
      throw new ConflictError(`Item with code '${code}' already exists in this tenant`);
    }

    const item = await this.repo.create(tenantId, {
      ...dto,
      itemCode: code,
      currentStock: dto.currentStock || 0,
      allocatedStock: 0,
      activeBatchCount: 0,
      totalBatchCount: 0,
      status: 'active'
    } as any);

    this.logger.info(`📦 Material registered: [${item.itemCode}] "${item.name}" (${item.category}) on tenant [${tenantId}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'ITEM_CREATED',
        entityType: 'Item',
        entityId: item.id,
        afterState: item.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('ITEM_CREATED', tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      category: item.category
    });

    return item;
  }

  /**
   * Retrieves item by ID
   */
  public async getItemById(tenantId: string, id: string): Promise<ItemDocument> {
    const item = await this.repo.findById(tenantId, id);
    if (!item) {
      throw new NotFoundError(`Item with ID '${id}' not found`);
    }
    return item;
  }

  /**
   * Retrieves item by unique Item Code
   */
  public async getItemByCode(tenantId: string, code: string): Promise<ItemDocument> {
    const item = await this.repo.findByCode(tenantId, code);
    if (!item) {
      throw new NotFoundError(`Item with code '${code.toUpperCase()}' not found`);
    }
    return item;
  }

  /**
   * Updates item master data while guarding immutable code
   */
  public async updateItem(
    tenantId: string,
    id: string,
    dto: UpdateItemDto,
    actor?: ActorContext
  ): Promise<ItemDocument> {
    const item = await this.getItemById(tenantId, id);

    // Reference Integrity Guard: Item Code is immutable after creation
    if ((dto as any).itemCode && (dto as any).itemCode.toUpperCase() !== item.itemCode) {
      throw new BadRequestError('Item Code is immutable to maintain historical batch and recipe traceability');
    }

    const beforeState = item.toJSON();

    const updated = await this.repo.updateById(tenantId, id, { $set: dto });
    if (!updated) {
      throw new NotFoundError(`Item with ID '${id}' not found`);
    }

    const afterState = updated.toJSON();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'ITEM_UPDATED',
        entityType: 'Item',
        entityId: updated.id,
        beforeState,
        afterState,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('ITEM_UPDATED', tenantId, {
      itemId: updated.id,
      itemCode: updated.itemCode
    });

    return updated;
  }

  /**
   * Updates item active / inactive / archived status
   */
  public async updateItemStatus(
    tenantId: string,
    id: string,
    status: 'active' | 'inactive' | 'archived',
    actor?: ActorContext
  ): Promise<ItemDocument> {
    const item = await this.getItemById(tenantId, id);

    if ((status === 'inactive' || status === 'archived') && item.activeBatchCount > 0) {
      throw new BadRequestError(
        `Cannot set item [${item.itemCode}] to '${status}': ${item.activeBatchCount} active batches currently reference this material.`
      );
    }

    const beforeStatus = item.status;
    item.status = status;
    const updated = await item.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'ITEM_STATUS_CHANGED',
        entityType: 'Item',
        entityId: item.id,
        beforeState: { status: beforeStatus },
        afterState: { status },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('ITEM_STATUS_CHANGED', tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      oldStatus: beforeStatus,
      newStatus: status
    });

    return updated;
  }

  /**
   * Safely archives an item preserving historical traceability
   */
  public async archiveItem(tenantId: string, id: string, actor?: ActorContext): Promise<boolean> {
    const item = await this.getItemById(tenantId, id);

    if (item.activeBatchCount > 0) {
      throw new BadRequestError(
        `Cannot archive item [${item.itemCode}]: Item has ${item.activeBatchCount} active in-progress batches.`
      );
    }

    await this.repo.updateById(tenantId, id, {
      $set: { status: 'archived', isDeleted: true }
    });

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'ITEM_ARCHIVED',
        entityType: 'Item',
        entityId: id,
        beforeState: { isDeleted: false, status: item.status },
        afterState: { isDeleted: true, status: 'archived' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('ITEM_ARCHIVED', tenantId, {
      itemId: item.id,
      itemCode: item.itemCode
    });

    return true;
  }

  /**
   * Search and filter items across the factory inventory master
   */
  public async searchItems(
    tenantId: string,
    filters: ItemFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ItemDocument>> {
    return this.repo.searchItems(tenantId, filters, pagination);
  }
}

export const itemService = new ItemService();
