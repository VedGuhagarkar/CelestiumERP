import { BaseService } from '../../core/services/base.service.js';
import { IInventoryRepository, inventoryRepository } from './inventory.repository.js';
import { IItemRepository, itemRepository } from '../item/item.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  InventoryBalanceDocument,
  InventoryTransactionDocument,
  GoodsReceiptDto,
  GoodsIssueDto,
  StockAdjustmentDto,
  InternalTransferDto,
  ReserveStockDto,
  ReleaseReservationDto,
  InventoryBalanceFilterQuery,
  InventoryTransactionFilterQuery
} from './inventory.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { BadRequestError, NotFoundError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class InventoryService extends BaseService {
  constructor(
    private readonly repo: IInventoryRepository = inventoryRepository,
    private readonly itemRepo: IItemRepository = itemRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('InventoryService');
  }

  /**
   * Records a Goods Receipt transaction, incrementing location on-hand stock and updating Item Master
   */
  public async recordGoodsReceipt(
    tenantId: string,
    dto: GoodsReceiptDto,
    actor?: ActorContext
  ): Promise<InventoryTransactionDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const balance = await this.repo.findOrCreateBalance(tenantId, item, dto.location);
    const beforeBalance = balance.onHandQuantity;
    const afterBalance = beforeBalance + dto.quantity;

    await this.repo.updateBalance(tenantId, item.id, dto.location, dto.quantity, 0);
    await this.itemRepo.updateStock(tenantId, item.id, dto.quantity, 0);

    const transaction = await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type: 'GOODS_RECEIPT',
      quantity: dto.quantity,
      uom: item.uom,
      destinationLocation: dto.location,
      beforeBalance,
      afterBalance,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      referenceNumber: dto.referenceNumber,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    this.logger.info(
      `📥 Goods Receipt: +${dto.quantity} ${item.uom} of [${item.itemCode}] at [${dto.location}] (Ref: ${dto.referenceNumber || dto.referenceType})`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_GOODS_RECEIPT',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        afterState: transaction.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_GOODS_RECEIPT', tenantId, {
      transactionId: transaction.id,
      itemId: item.id,
      itemCode: item.itemCode,
      location: dto.location,
      quantity: dto.quantity
    });

    return transaction;
  }

  /**
   * Records a Goods Issue transaction with strict negative balance prevention
   */
  public async recordGoodsIssue(
    tenantId: string,
    dto: GoodsIssueDto,
    actor?: ActorContext
  ): Promise<InventoryTransactionDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const balance = await this.repo.getBalance(tenantId, item.id, dto.location);
    if (!balance || balance.onHandQuantity < dto.quantity) {
      throw new BadRequestError(
        `Insufficient stock on hand at location [${dto.location}]. Current: ${balance ? balance.onHandQuantity : 0} ${item.uom}, Requested: ${dto.quantity} ${item.uom}`
      );
    }

    const beforeBalance = balance.onHandQuantity;
    const afterBalance = beforeBalance - dto.quantity;

    await this.repo.updateBalance(tenantId, item.id, dto.location, -dto.quantity, 0);
    await this.itemRepo.updateStock(tenantId, item.id, -dto.quantity, 0);

    const transaction = await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type: 'GOODS_ISSUE',
      quantity: dto.quantity,
      uom: item.uom,
      sourceLocation: dto.location,
      beforeBalance,
      afterBalance,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      referenceNumber: dto.referenceNumber,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    this.logger.info(
      `📤 Goods Issue: -${dto.quantity} ${item.uom} of [${item.itemCode}] from [${dto.location}] (Ref: ${dto.referenceNumber || dto.referenceType})`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_GOODS_ISSUE',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        afterState: transaction.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_GOODS_ISSUE', tenantId, {
      transactionId: transaction.id,
      itemId: item.id,
      itemCode: item.itemCode,
      location: dto.location,
      quantity: dto.quantity
    });

    return transaction;
  }

  /**
   * Performs physical stock count adjustments requiring reason codes and justifications
   */
  public async recordStockAdjustment(
    tenantId: string,
    dto: StockAdjustmentDto,
    actor?: ActorContext
  ): Promise<InventoryTransactionDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const balance = await this.repo.findOrCreateBalance(tenantId, item, dto.location);
    const beforeBalance = balance.onHandQuantity;
    const afterBalance = beforeBalance + dto.adjustedQuantity;

    if (afterBalance < 0) {
      throw new BadRequestError(
        `Stock adjustment cannot drive inventory negative at [${dto.location}]. Current: ${beforeBalance} ${item.uom}, Adjustment: ${dto.adjustedQuantity} ${item.uom}`
      );
    }

    await this.repo.updateBalance(tenantId, item.id, dto.location, dto.adjustedQuantity, 0);
    await this.itemRepo.updateStock(tenantId, item.id, dto.adjustedQuantity, 0);

    const type = dto.adjustedQuantity > 0 ? 'STOCK_ADJUSTMENT_ADD' : 'STOCK_ADJUSTMENT_DEDUCT';

    const transaction = await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type,
      quantity: Math.abs(dto.adjustedQuantity),
      uom: item.uom,
      sourceLocation: dto.adjustedQuantity < 0 ? dto.location : undefined,
      destinationLocation: dto.adjustedQuantity > 0 ? dto.location : undefined,
      beforeBalance,
      afterBalance,
      referenceType: 'PHYSICAL_COUNT',
      referenceNumber: dto.referenceNumber,
      reasonCode: dto.reasonCode,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    this.logger.info(
      `⚖️ Stock Adjustment: ${dto.adjustedQuantity > 0 ? '+' : ''}${dto.adjustedQuantity} ${item.uom} of [${item.itemCode}] at [${dto.location}] Reason: [${dto.reasonCode}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_STOCK_ADJUSTMENT',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        beforeState: { onHandQuantity: beforeBalance },
        afterState: { onHandQuantity: afterBalance, reasonCode: dto.reasonCode, comments: dto.comments },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_STOCK_ADJUSTMENT', tenantId, {
      transactionId: transaction.id,
      itemId: item.id,
      itemCode: item.itemCode,
      location: dto.location,
      adjustedQuantity: dto.adjustedQuantity,
      reasonCode: dto.reasonCode
    });

    return transaction;
  }

  /**
   * Transfers stock internally between locations
   */
  public async recordInternalTransfer(
    tenantId: string,
    dto: InternalTransferDto,
    actor?: ActorContext
  ): Promise<InventoryTransactionDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const sourceBalance = await this.repo.getBalance(tenantId, item.id, dto.sourceLocation);
    if (!sourceBalance || sourceBalance.onHandQuantity < dto.quantity) {
      throw new BadRequestError(
        `Insufficient stock at source location [${dto.sourceLocation}]. Available: ${sourceBalance ? sourceBalance.onHandQuantity : 0} ${item.uom}, Requested: ${dto.quantity} ${item.uom}`
      );
    }

    const destBalance = await this.repo.findOrCreateBalance(tenantId, item, dto.destinationLocation);

    // Atomically deduct from source and credit destination
    await this.repo.updateBalance(tenantId, item.id, dto.sourceLocation, -dto.quantity, 0);
    await this.repo.updateBalance(tenantId, item.id, dto.destinationLocation, dto.quantity, 0);

    const transaction = await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type: 'INTERNAL_TRANSFER_OUT',
      quantity: dto.quantity,
      uom: item.uom,
      sourceLocation: dto.sourceLocation,
      destinationLocation: dto.destinationLocation,
      beforeBalance: sourceBalance.onHandQuantity,
      afterBalance: sourceBalance.onHandQuantity - dto.quantity,
      referenceType: 'JOB_CARD',
      referenceNumber: dto.referenceNumber,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type: 'INTERNAL_TRANSFER_IN',
      quantity: dto.quantity,
      uom: item.uom,
      sourceLocation: dto.sourceLocation,
      destinationLocation: dto.destinationLocation,
      beforeBalance: destBalance.onHandQuantity,
      afterBalance: destBalance.onHandQuantity + dto.quantity,
      referenceType: 'JOB_CARD',
      referenceNumber: dto.referenceNumber,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    this.logger.info(
      `🔄 Internal Transfer: ${dto.quantity} ${item.uom} of [${item.itemCode}] from [${dto.sourceLocation}] -> [${dto.destinationLocation}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_INTERNAL_TRANSFER',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        afterState: transaction.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_INTERNAL_TRANSFER', tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      sourceLocation: dto.sourceLocation,
      destinationLocation: dto.destinationLocation,
      quantity: dto.quantity
    });

    return transaction;
  }

  /**
   * Reserves stock for production planning
   */
  public async reserveStock(
    tenantId: string,
    dto: ReserveStockDto,
    actor?: ActorContext
  ): Promise<InventoryTransactionDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const balance = await this.repo.getBalance(tenantId, item.id, dto.location);
    if (!balance || balance.availableQuantity < dto.quantity) {
      throw new BadRequestError(
        `Insufficient available unreserved stock at [${dto.location}]. Available: ${balance ? balance.availableQuantity : 0} ${item.uom}, Requested reservation: ${dto.quantity} ${item.uom}`
      );
    }

    const beforeBalance = balance.onHandQuantity;
    await this.repo.updateBalance(tenantId, item.id, dto.location, 0, dto.quantity);
    await this.itemRepo.updateStock(tenantId, item.id, 0, dto.quantity);

    const transaction = await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type: 'RESERVATION_ALLOCATE',
      quantity: dto.quantity,
      uom: item.uom,
      sourceLocation: dto.location,
      beforeBalance,
      afterBalance: beforeBalance,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      referenceNumber: dto.referenceNumber,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    this.logger.info(
      `🔒 Stock Reserved: ${dto.quantity} ${item.uom} of [${item.itemCode}] at [${dto.location}] for [${dto.referenceNumber || dto.referenceType}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_RESERVATION_ALLOCATED',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        afterState: transaction.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_RESERVATION_ALLOCATED', tenantId, {
      transactionId: transaction.id,
      itemId: item.id,
      itemCode: item.itemCode,
      location: dto.location,
      quantity: dto.quantity
    });

    return transaction;
  }

  /**
   * Releases previously reserved stock
   */
  public async releaseReservation(
    tenantId: string,
    dto: ReleaseReservationDto,
    actor?: ActorContext
  ): Promise<InventoryTransactionDocument> {
    const item = await this.itemRepo.findById(tenantId, dto.itemId);
    if (!item) {
      throw new NotFoundError(`Item master with ID '${dto.itemId}' not found`);
    }

    const balance = await this.repo.getBalance(tenantId, item.id, dto.location);
    if (!balance || balance.reservedQuantity < dto.quantity) {
      throw new BadRequestError(
        `Cannot release reservation: requested ${dto.quantity} ${item.uom}, but currently reserved is only ${balance ? balance.reservedQuantity : 0} ${item.uom}`
      );
    }

    const beforeBalance = balance.onHandQuantity;
    await this.repo.updateBalance(tenantId, item.id, dto.location, 0, -dto.quantity);
    await this.itemRepo.updateStock(tenantId, item.id, 0, -dto.quantity);

    const transaction = await this.repo.recordTransaction(tenantId, {
      itemId: item.id,
      itemCode: item.itemCode,
      type: 'RESERVATION_RELEASE',
      quantity: dto.quantity,
      uom: item.uom,
      sourceLocation: dto.location,
      beforeBalance,
      afterBalance: beforeBalance,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      referenceNumber: dto.referenceNumber,
      comments: dto.comments,
      actorId: actor?.userId || 'SYSTEM',
      actorEmail: actor?.email
    });

    this.logger.info(
      `🔓 Reservation Released: ${dto.quantity} ${item.uom} of [${item.itemCode}] at [${dto.location}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'INVENTORY_RESERVATION_RELEASED',
        entityType: 'InventoryTransaction',
        entityId: transaction.id,
        afterState: transaction.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('INVENTORY_RESERVATION_RELEASED', tenantId, {
      transactionId: transaction.id,
      itemId: item.id,
      itemCode: item.itemCode,
      location: dto.location,
      quantity: dto.quantity
    });

    return transaction;
  }

  /**
   * Queries balance by location
   */
  public async getBalance(
    tenantId: string,
    itemId: string,
    location: string
  ): Promise<InventoryBalanceDocument> {
    const balance = await this.repo.getBalance(tenantId, itemId, location);
    if (!balance) {
      throw new NotFoundError(`No stock balance found for item ID '${itemId}' at location '${location}'`);
    }
    return balance;
  }

  /**
   * Search stock balances
   */
  public async searchBalances(
    tenantId: string,
    filters: InventoryBalanceFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InventoryBalanceDocument>> {
    return this.repo.searchBalances(tenantId, filters, pagination);
  }

  /**
   * Search immutable transaction ledger
   */
  public async searchTransactions(
    tenantId: string,
    filters: InventoryTransactionFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InventoryTransactionDocument>> {
    return this.repo.searchTransactions(tenantId, filters, pagination);
  }
}

export const inventoryService = new InventoryService();
