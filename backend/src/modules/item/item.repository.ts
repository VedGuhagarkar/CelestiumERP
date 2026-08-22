import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { ItemModel, ItemDocument } from './item.model.js';
import { ItemFilterQuery } from './item.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IItemRepository extends IBaseRepository<ItemDocument> {
  findByCode(tenantId: string, itemCode: string): Promise<ItemDocument | null>;
  searchItems(
    tenantId: string,
    filters: ItemFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ItemDocument>>;
  updateStock(
    tenantId: string,
    itemId: string,
    deltaCurrent: number,
    deltaAllocated: number
  ): Promise<ItemDocument | null>;
  incrementBatchCounters(
    tenantId: string,
    itemId: string,
    deltaActive: number,
    deltaTotal: number
  ): Promise<ItemDocument | null>;
}

export class ItemRepository extends BaseRepository<ItemDocument> implements IItemRepository {
  constructor() {
    super(ItemModel);
  }

  public async findByCode(tenantId: string, itemCode: string): Promise<ItemDocument | null> {
    return this.findOne(tenantId, { itemCode: itemCode.toUpperCase() });
  }

  public async searchItems(
    tenantId: string,
    filters: ItemFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ItemDocument>> {
    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { itemCode: searchRegex },
        { name: searchRegex },
        { description: searchRegex },
        { materialGrade: searchRegex },
        { storageLocation: searchRegex }
      ];
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.materialGrade) {
      query.materialGrade = new RegExp(filters.materialGrade, 'i');
    }

    if (filters.isHazardous !== undefined) {
      query.isHazardous = filters.isHazardous;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.isBelowReorderPoint) {
      query.$expr = { $lte: ['$currentStock', '$reorderPoint'] };
    }

    return this.findPaginated(tenantId, query, pagination);
  }

  public async updateStock(
    tenantId: string,
    itemId: string,
    deltaCurrent: number,
    deltaAllocated: number
  ): Promise<ItemDocument | null> {
    return this.updateById(tenantId, itemId, {
      $inc: {
        currentStock: deltaCurrent,
        allocatedStock: deltaAllocated
      }
    });
  }

  public async incrementBatchCounters(
    tenantId: string,
    itemId: string,
    deltaActive: number,
    deltaTotal: number
  ): Promise<ItemDocument | null> {
    return this.updateById(tenantId, itemId, {
      $inc: {
        activeBatchCount: deltaActive,
        totalBatchCount: deltaTotal
      }
    });
  }
}

export const itemRepository = new ItemRepository();
