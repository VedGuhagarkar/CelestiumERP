import { Document } from 'mongoose';

export type ItemCategory =
  | 'RAW_MATERIAL'
  | 'PROCESS_GAS'
  | 'QUENCH_MEDIA'
  | 'HEAT_TREAT_CONSUMABLE'
  | 'LABORATORY_CONSUMABLE'
  | 'FINISHED_TREATED_GOODS'
  | 'PACKAGING_MATERIAL';

export type UnitOfMeasure =
  | 'KG'
  | 'MT'
  | 'LTR'
  | 'CU_M'
  | 'CYLINDER'
  | 'PCS'
  | 'ROLL'
  | 'BOX'
  | 'SET'
  | 'DRUM'
  | 'METER';

export interface IItem {
  tenantId: string;
  itemCode: string;
  name: string;
  description?: string;
  category: ItemCategory;
  materialGrade?: string;
  uom: UnitOfMeasure;
  secondaryUom?: UnitOfMeasure;
  conversionFactor?: number;
  minStockLevel: number;
  reorderPoint: number;
  maxStockLevel?: number;
  safetyStock?: number;
  currentStock: number;
  allocatedStock: number;
  storageLocation?: string;
  isHazardous: boolean;
  unNumber?: string;
  msdsReference?: string;
  shelfLifeDays?: number;
  isShelfLifeTracked: boolean;
  activeBatchCount: number;
  totalBatchCount: number;
  status: 'active' | 'inactive' | 'archived';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemDocument extends IItem, Document {}

export interface CreateItemDto {
  itemCode: string;
  name: string;
  description?: string;
  category: ItemCategory;
  materialGrade?: string;
  uom: UnitOfMeasure;
  secondaryUom?: UnitOfMeasure;
  conversionFactor?: number;
  minStockLevel?: number;
  reorderPoint?: number;
  maxStockLevel?: number;
  safetyStock?: number;
  currentStock?: number;
  storageLocation?: string;
  isHazardous?: boolean;
  unNumber?: string;
  msdsReference?: string;
  shelfLifeDays?: number;
  isShelfLifeTracked?: boolean;
}

export interface UpdateItemDto {
  name?: string;
  description?: string;
  category?: ItemCategory;
  materialGrade?: string;
  uom?: UnitOfMeasure;
  secondaryUom?: UnitOfMeasure;
  conversionFactor?: number;
  minStockLevel?: number;
  reorderPoint?: number;
  maxStockLevel?: number;
  safetyStock?: number;
  storageLocation?: string;
  isHazardous?: boolean;
  unNumber?: string;
  msdsReference?: string;
  shelfLifeDays?: number;
  isShelfLifeTracked?: boolean;
  status?: 'active' | 'inactive' | 'archived';
}

export interface ItemFilterQuery {
  search?: string;
  category?: ItemCategory;
  materialGrade?: string;
  isHazardous?: boolean;
  isBelowReorderPoint?: boolean;
  status?: 'active' | 'inactive' | 'archived';
}
