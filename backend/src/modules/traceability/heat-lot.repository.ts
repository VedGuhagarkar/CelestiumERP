import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { HeatLotModel, HeatLotDocument } from './heat-lot.model.js';
import { HeatLotFilterQuery } from './heat-lot.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IHeatLotRepository extends IBaseRepository<HeatLotDocument> {
  findByHeatLotNumber(tenantId: string, heatLotNumber: string): Promise<HeatLotDocument | null>;
  findBySupplierHeatNumber(tenantId: string, supplierHeatNumber: string): Promise<HeatLotDocument[]>;
  findByJobCardNumber(tenantId: string, jobCardNumber: string): Promise<HeatLotDocument[]>;
  findChildLots(tenantId: string, parentHeatLotId: string): Promise<HeatLotDocument[]>;
  searchHeatLots(
    tenantId: string,
    filters: HeatLotFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<HeatLotDocument>>;
  generateNextHeatLotNumber(tenantId: string): Promise<string>;
}

export class HeatLotRepository extends BaseRepository<HeatLotDocument> implements IHeatLotRepository {
  constructor() {
    super(HeatLotModel);
  }

  public async findByHeatLotNumber(tenantId: string, heatLotNumber: string): Promise<HeatLotDocument | null> {
    return this.findOne(tenantId, {
      heatLotNumber: heatLotNumber.toUpperCase()
    });
  }

  public async findBySupplierHeatNumber(tenantId: string, supplierHeatNumber: string): Promise<HeatLotDocument[]> {
    return this.find(tenantId, {
      supplierHeatNumber: new RegExp(supplierHeatNumber, 'i')
    });
  }

  public async findByJobCardNumber(tenantId: string, jobCardNumber: string): Promise<HeatLotDocument[]> {
    return this.find(tenantId, {
      $or: [
        { 'consumptionHistory.jobCardNumber': jobCardNumber.toUpperCase() },
        { 'allocations.jobCardNumber': jobCardNumber.toUpperCase() }
      ]
    });
  }

  public async findChildLots(tenantId: string, parentHeatLotId: string): Promise<HeatLotDocument[]> {
    return this.find(tenantId, {
      'lineage.parentHeatLotIds': parentHeatLotId
    });
  }

  public async searchHeatLots(
    tenantId: string,
    filters: HeatLotFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<HeatLotDocument>> {
    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { heatLotNumber: searchRegex },
        { supplierHeatNumber: searchRegex },
        { mtrNumber: searchRegex },
        { materialGrade: searchRegex },
        { itemCode: searchRegex },
        { storageLocation: searchRegex }
      ];
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.itemCode) {
      query.itemCode = filters.itemCode.toUpperCase();
    }

    if (filters.materialGrade) {
      query.materialGrade = new RegExp(filters.materialGrade, 'i');
    }

    if (filters.supplierHeatNumber) {
      query.supplierHeatNumber = new RegExp(filters.supplierHeatNumber, 'i');
    }

    if (filters.mtrNumber) {
      query.mtrNumber = new RegExp(filters.mtrNumber, 'i');
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.storageLocation) {
      query.storageLocation = new RegExp(filters.storageLocation, 'i');
    }

    return this.findPaginated(tenantId, query, pagination);
  }

  public async generateNextHeatLotNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `HL-${yearMonth}-`;

    const count = await this.count(tenantId, {
      heatLotNumber: new RegExp(`^${prefix}`)
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}${sequence}`;
  }
}

export const heatLotRepository = new HeatLotRepository();
