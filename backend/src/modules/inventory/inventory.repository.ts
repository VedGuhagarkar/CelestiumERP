import { InventoryBalanceModel, InventoryBalanceDocument } from './inventory-balance.model.js';
import { InventoryTransactionModel, InventoryTransactionDocument } from './inventory-transaction.model.js';
import {
  IInventoryTransaction,
  InventoryBalanceFilterQuery,
  InventoryTransactionFilterQuery
} from './inventory.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import { ItemDocument } from '../item/item.types.js';

export interface IInventoryRepository {
  getBalance(tenantId: string, itemId: string, location: string): Promise<InventoryBalanceDocument | null>;
  findOrCreateBalance(
    tenantId: string,
    item: ItemDocument,
    location: string
  ): Promise<InventoryBalanceDocument>;
  updateBalance(
    tenantId: string,
    itemId: string,
    location: string,
    deltaOnHand: number,
    deltaReserved: number
  ): Promise<InventoryBalanceDocument | null>;
  searchBalances(
    tenantId: string,
    filters: InventoryBalanceFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InventoryBalanceDocument>>;
  recordTransaction(
    tenantId: string,
    data: Partial<IInventoryTransaction>
  ): Promise<InventoryTransactionDocument>;
  searchTransactions(
    tenantId: string,
    filters: InventoryTransactionFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InventoryTransactionDocument>>;
  generateTransactionNumber(tenantId: string): Promise<string>;
}

export class InventoryRepository implements IInventoryRepository {
  public async getBalance(
    tenantId: string,
    itemId: string,
    location: string
  ): Promise<InventoryBalanceDocument | null> {
    return InventoryBalanceModel.findOne({
      tenantId,
      itemId,
      location,
      isDeleted: false
    });
  }

  public async findOrCreateBalance(
    tenantId: string,
    item: ItemDocument,
    location: string
  ): Promise<InventoryBalanceDocument> {
    let balance = await this.getBalance(tenantId, item.id, location);
    if (!balance) {
      balance = await InventoryBalanceModel.create({
        tenantId,
        itemId: item.id,
        itemCode: item.itemCode,
        materialGrade: item.materialGrade,
        location,
        onHandQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        uom: item.uom,
        version: 0,
        isDeleted: false
      });
    }
    return balance;
  }

  public async updateBalance(
    tenantId: string,
    itemId: string,
    location: string,
    deltaOnHand: number,
    deltaReserved: number
  ): Promise<InventoryBalanceDocument | null> {
    const balance = await this.getBalance(tenantId, itemId, location);
    if (!balance) return null;

    balance.onHandQuantity = Math.max(0, balance.onHandQuantity + deltaOnHand);
    balance.reservedQuantity = Math.max(0, balance.reservedQuantity + deltaReserved);
    balance.availableQuantity = Math.max(0, balance.onHandQuantity - balance.reservedQuantity);
    balance.version += 1;

    return balance.save();
  }

  public async searchBalances(
    tenantId: string,
    filters: InventoryBalanceFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InventoryBalanceDocument>> {
    const query: Record<string, any> = { tenantId, isDeleted: false };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { itemCode: searchRegex },
        { location: searchRegex },
        { materialGrade: searchRegex }
      ];
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.itemCode) {
      query.itemCode = filters.itemCode.toUpperCase();
    }

    if (filters.location) {
      query.location = new RegExp(filters.location, 'i');
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryBalanceModel.find(query).skip(skip).limit(limit).exec(),
      InventoryBalanceModel.countDocuments(query).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async recordTransaction(
    tenantId: string,
    data: Partial<IInventoryTransaction>
  ): Promise<InventoryTransactionDocument> {
    const transactionNumber = data.transactionNumber || (await this.generateTransactionNumber(tenantId));

    return InventoryTransactionModel.create({
      ...data,
      tenantId,
      transactionNumber,
      timestamp: data.timestamp || new Date(),
      isDeleted: false
    });
  }

  public async searchTransactions(
    tenantId: string,
    filters: InventoryTransactionFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<InventoryTransactionDocument>> {
    const query: Record<string, any> = { tenantId, isDeleted: false };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { transactionNumber: searchRegex },
        { itemCode: searchRegex },
        { referenceNumber: searchRegex },
        { sourceLocation: searchRegex },
        { destinationLocation: searchRegex },
        { comments: searchRegex }
      ];
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.itemCode) {
      query.itemCode = filters.itemCode.toUpperCase();
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.referenceType) {
      query.referenceType = filters.referenceType;
    }

    if (filters.referenceNumber) {
      query.referenceNumber = new RegExp(filters.referenceNumber, 'i');
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryTransactionModel.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      InventoryTransactionModel.countDocuments(query).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateTransactionNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const prefix = `TXN-INV-${year}-`;

    const count = await InventoryTransactionModel.countDocuments({
      tenantId,
      transactionNumber: new RegExp(`^${prefix}`)
    }).exec();

    const sequence = String(count + 1).padStart(5, '0');
    return `${prefix}${sequence}`;
  }
}

export const inventoryRepository = new InventoryRepository();
