import { WarehouseModel, WarehouseDocument } from './warehouse.model.js';
import { StorageLocationModel, StorageLocationDocument } from './storage-location.model.js';
import {
  IWarehouse,
  IStorageLocation,
  WarehouseFilterQuery,
  StorageLocationFilterQuery
} from './warehouse.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IWarehouseRepository {
  createWarehouse(tenantId: string, data: Partial<IWarehouse>): Promise<WarehouseDocument>;
  findWarehouseById(tenantId: string, id: string): Promise<WarehouseDocument | null>;
  findWarehouseByCode(tenantId: string, code: string): Promise<WarehouseDocument | null>;
  updateWarehouse(tenantId: string, id: string, data: Partial<IWarehouse>): Promise<WarehouseDocument | null>;
  searchWarehouses(
    tenantId: string,
    filters: WarehouseFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<WarehouseDocument>>;

  createLocation(tenantId: string, data: Partial<IStorageLocation>): Promise<StorageLocationDocument>;
  findLocationById(tenantId: string, id: string): Promise<StorageLocationDocument | null>;
  findLocationByCode(tenantId: string, locationCode: string): Promise<StorageLocationDocument | null>;
  updateLocation(
    tenantId: string,
    id: string,
    data: Partial<IStorageLocation>
  ): Promise<StorageLocationDocument | null>;
  searchLocations(
    tenantId: string,
    filters: StorageLocationFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<StorageLocationDocument>>;
  findLocationsByWarehouse(tenantId: string, warehouseId: string): Promise<StorageLocationDocument[]>;
}

export class WarehouseRepository implements IWarehouseRepository {
  public async createWarehouse(
    tenantId: string,
    data: Partial<IWarehouse>
  ): Promise<WarehouseDocument> {
    return WarehouseModel.create({
      ...data,
      tenantId,
      code: data.code?.toUpperCase(),
      status: data.status || 'ACTIVE',
      isDeleted: false
    });
  }

  public async findWarehouseById(
    tenantId: string,
    id: string
  ): Promise<WarehouseDocument | null> {
    return WarehouseModel.findOne({ tenantId, _id: id, isDeleted: false });
  }

  public async findWarehouseByCode(
    tenantId: string,
    code: string
  ): Promise<WarehouseDocument | null> {
    return WarehouseModel.findOne({
      tenantId,
      code: code.toUpperCase(),
      isDeleted: false
    });
  }

  public async updateWarehouse(
    tenantId: string,
    id: string,
    data: Partial<IWarehouse>
  ): Promise<WarehouseDocument | null> {
    return WarehouseModel.findOneAndUpdate(
      { tenantId, _id: id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  public async searchWarehouses(
    tenantId: string,
    filters: WarehouseFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<WarehouseDocument>> {
    const query: Record<string, any> = { tenantId, isDeleted: false };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { code: searchRegex },
        { name: searchRegex },
        { plantArea: searchRegex },
        { description: searchRegex }
      ];
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      WarehouseModel.find(query).skip(skip).limit(limit).exec(),
      WarehouseModel.countDocuments(query).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async createLocation(
    tenantId: string,
    data: Partial<IStorageLocation>
  ): Promise<StorageLocationDocument> {
    return StorageLocationModel.create({
      ...data,
      tenantId,
      locationCode: data.locationCode?.toUpperCase(),
      warehouseCode: data.warehouseCode?.toUpperCase(),
      status: data.status || 'ACTIVE',
      isQuarantineLocation: Boolean(data.isQuarantineLocation),
      temperatureControlled: Boolean(data.temperatureControlled),
      currentOccupancy: 0,
      isDeleted: false
    });
  }

  public async findLocationById(
    tenantId: string,
    id: string
  ): Promise<StorageLocationDocument | null> {
    return StorageLocationModel.findOne({ tenantId, _id: id, isDeleted: false });
  }

  public async findLocationByCode(
    tenantId: string,
    locationCode: string
  ): Promise<StorageLocationDocument | null> {
    return StorageLocationModel.findOne({
      tenantId,
      locationCode: locationCode.toUpperCase(),
      isDeleted: false
    });
  }

  public async updateLocation(
    tenantId: string,
    id: string,
    data: Partial<IStorageLocation>
  ): Promise<StorageLocationDocument | null> {
    return StorageLocationModel.findOneAndUpdate(
      { tenantId, _id: id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  public async searchLocations(
    tenantId: string,
    filters: StorageLocationFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<StorageLocationDocument>> {
    const query: Record<string, any> = { tenantId, isDeleted: false };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { locationCode: searchRegex },
        { warehouseCode: searchRegex },
        { zone: searchRegex },
        { bay: searchRegex },
        { rack: searchRegex },
        { bin: searchRegex }
      ];
    }

    if (filters.warehouseId) {
      query.warehouseId = filters.warehouseId;
    }

    if (filters.warehouseCode) {
      query.warehouseCode = filters.warehouseCode.toUpperCase();
    }

    if (filters.zoneType) {
      query.zoneType = filters.zoneType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.isQuarantineLocation !== undefined) {
      query.isQuarantineLocation = filters.isQuarantineLocation;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      StorageLocationModel.find(query).skip(skip).limit(limit).exec(),
      StorageLocationModel.countDocuments(query).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async findLocationsByWarehouse(
    tenantId: string,
    warehouseId: string
  ): Promise<StorageLocationDocument[]> {
    return StorageLocationModel.find({ tenantId, warehouseId, isDeleted: false }).exec();
  }
}

export const warehouseRepository = new WarehouseRepository();
