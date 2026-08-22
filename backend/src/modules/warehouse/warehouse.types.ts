import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';

export type WarehouseType =
  | 'MAIN_PLANT'
  | 'RAW_MATERIAL_YARD'
  | 'GAS_YARD'
  | 'FINISHED_STORE'
  | 'OFFSITE_STORE';

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';

export type StorageZoneType =
  | 'RAW_MATERIAL_YARD'
  | 'QUARANTINE_AREA'
  | 'WIP_STAGE'
  | 'FINISHED_GOODS'
  | 'CONSUMABLES_STORE'
  | 'GAS_STORAGE'
  | 'LAB_ARCHIVE';

export type StorageLocationStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface IWarehouse {
  tenantId: string;
  code: string;
  name: string;
  type: WarehouseType;
  description?: string;
  plantArea?: string;
  status: WarehouseStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseDocument extends IWarehouse, Document {}

export interface IStorageLocation {
  tenantId: string;
  warehouseId: string;
  warehouseCode: string;
  locationCode: string;
  zone: string;
  bay?: string;
  rack?: string;
  bin?: string;
  zoneType: StorageZoneType;
  capacityQuantity?: number;
  capacityUom?: UnitOfMeasure;
  currentOccupancy?: number;
  status: StorageLocationStatus;
  isQuarantineLocation: boolean;
  temperatureControlled: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageLocationDocument extends IStorageLocation, Document {}

export interface CreateWarehouseDto {
  code: string;
  name: string;
  type: WarehouseType;
  description?: string;
  plantArea?: string;
}

export interface UpdateWarehouseDto {
  name?: string;
  type?: WarehouseType;
  description?: string;
  plantArea?: string;
  status?: WarehouseStatus;
}

export interface CreateStorageLocationDto {
  warehouseId: string;
  locationCode: string;
  zone: string;
  bay?: string;
  rack?: string;
  bin?: string;
  zoneType: StorageZoneType;
  capacityQuantity?: number;
  capacityUom?: UnitOfMeasure;
  isQuarantineLocation?: boolean;
  temperatureControlled?: boolean;
}

export interface UpdateStorageLocationDto {
  zone?: string;
  bay?: string;
  rack?: string;
  bin?: string;
  zoneType?: StorageZoneType;
  capacityQuantity?: number;
  capacityUom?: UnitOfMeasure;
  status?: StorageLocationStatus;
  isQuarantineLocation?: boolean;
  temperatureControlled?: boolean;
}

export interface WarehouseFilterQuery {
  search?: string;
  type?: WarehouseType;
  status?: WarehouseStatus;
}

export interface StorageLocationFilterQuery {
  search?: string;
  warehouseId?: string;
  warehouseCode?: string;
  zoneType?: StorageZoneType;
  status?: StorageLocationStatus;
  isQuarantineLocation?: boolean;
}
