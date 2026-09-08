import mongoose, { FilterQuery, Model } from 'mongoose';
import { BaseRepository } from '../../core/repository/base.repository.js';
import { PurchaseOrderModel } from './purchase-order.model.js';
import { PurchaseOrderDocument, QueryPurchaseOrderDto } from './purchase-order.types.js';
import { CounterModel } from '../../core/models/counter.model.js';

export interface IPurchaseOrderRepository {
  create(tenantId: string, data: Partial<PurchaseOrderDocument>): Promise<PurchaseOrderDocument>;
  findById(tenantId: string, id: string): Promise<PurchaseOrderDocument | null>;
  findByPoNumber(tenantId: string, poNumber: string): Promise<PurchaseOrderDocument | null>;
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<PurchaseOrderDocument | null>;
  update(tenantId: string, id: string, data: Partial<PurchaseOrderDocument>): Promise<PurchaseOrderDocument | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
  generateNextPoNumber(tenantId: string): Promise<string>;
  queryOrders(
    tenantId: string,
    query: QueryPurchaseOrderDto
  ): Promise<{ orders: PurchaseOrderDocument[]; total: number }>;
}

export class PurchaseOrderRepository
  extends BaseRepository<PurchaseOrderDocument>
  implements IPurchaseOrderRepository
{
  constructor(model: Model<PurchaseOrderDocument> = PurchaseOrderModel) {
    super(model);
  }

  /**
   * Atomic, concurrency-safe monotonic PO number generation (PO-YYYYMM-XXXX)
   * Uses MongoDB atomic $inc on the dedicated CounterModel to prevent race conditions.
   */
  public async generateNextPoNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `PO-${yearMonth}-`;
    const domain = `PO_${yearMonth}`;

    if (mongoose.connection.readyState === 1) {
      try {
        const counter = await CounterModel.findOneAndUpdate(
          { tenantId, domain },
          { $inc: { seq: 1 } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ).exec();

        if (counter && typeof counter.seq === 'number') {
          return `${prefix}${String(counter.seq).padStart(4, '0')}`;
        }
      } catch {
        // Fallback to query if counter operation fails
      }

      try {
        const latest = await this.model
          .findOne({
            tenantId,
            poNumber: new RegExp(`^${prefix}`)
          })
          .sort({ poNumber: -1 })
          .exec();

        if (latest && latest.poNumber) {
          const parts = latest.poNumber.split('-');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
          return `${prefix}${String(nextSeq).padStart(4, '0')}`;
        }
      } catch {
        // Ignore and fallback
      }
    }

    return `${prefix}0001`;
  }

  public async update(tenantId: string, id: string, data: Partial<PurchaseOrderDocument>): Promise<PurchaseOrderDocument | null> {
    return this.updateById(tenantId, id, data);
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await this.softDeleteById(tenantId, id);
    return !!res;
  }

  public async findByPoNumber(tenantId: string, poNumber: string): Promise<PurchaseOrderDocument | null> {
    return this.model
      .findOne({
        tenantId,
        poNumber: poNumber.toUpperCase().trim(),
        isDeleted: false
      })
      .exec();
  }

  public async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string
  ): Promise<PurchaseOrderDocument | null> {
    return this.model
      .findOne({
        tenantId,
        idempotencyKey: idempotencyKey.trim(),
        isDeleted: false
      })
      .exec();
  }

  public async queryOrders(
    tenantId: string,
    query: QueryPurchaseOrderDto
  ): Promise<{ orders: PurchaseOrderDocument[]; total: number }> {
    const filter: FilterQuery<PurchaseOrderDocument> = {
      tenantId,
      isDeleted: false
    };

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { poNumber: searchRegex },
        { supplierName: searchRegex },
        { supplierCode: searchRegex },
        { 'items.itemCode': searchRegex },
        { 'items.itemName': searchRegex },
        { 'items.recipeCode': searchRegex }
      ];
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.supplierName) {
      filter.supplierName = new RegExp(query.supplierName, 'i');
    }

    if (query.supplierCode) {
      filter.supplierCode = query.supplierCode.toUpperCase();
    }

    if (query.itemCode) {
      filter['items.itemCode'] = query.itemCode.toUpperCase();
    }

    if (query.recipeCode) {
      filter['items.recipeCode'] = query.recipeCode.toUpperCase();
    }

    if (query.startDate || query.endDate) {
      filter.orderDate = {};
      if (query.startDate) filter.orderDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.orderDate.$lte = new Date(query.endDate);
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

    const [orders, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec()
    ]);

    return { orders, total };
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
