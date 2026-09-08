import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';
import { ProcessFamily } from '../recipe/recipe.types.js';

export type MaterialReceiptStatus = 'RECEIVED' | 'STORED' | 'GRN_CREATED';
export type GRNStatus = 'ISSUED' | 'PRINTED' | 'AVAILABLE_FOR_PLANNING';
export type GRNUnitStatus = 'AVAILABLE_FOR_PLANNING' | 'ALLOCATED_TO_PLAN' | 'IN_PRODUCTION' | 'CONSUMED';

export interface IMaterialReceiptItem {
  poLineItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily: ProcessFamily;
  recipeId: string;
  recipeCode: string;
  recipeRevision: number;
  receivedQuantity: number;
  uom: UnitOfMeasure;
  supplierHeatNumber: string;
  supplierLotNumber?: string;
  mtrNumber?: string;
  chemicalComposition?: Record<string, number>;
  lineNotes?: string;
}

export interface IMaterialReceipt {
  tenantId: string;
  receiptNumber: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  supplierChallanNumber: string;
  supplierInvoiceNumber?: string;
  carrierVehicle?: string;
  driverName?: string;
  receivedDate: Date;
  receivedBy: string;
  warehouseId?: string;
  warehouseCode?: string;
  storageLocationCode?: string;
  items: IMaterialReceiptItem[];
  status: MaterialReceiptStatus;
  storedAt?: Date;
  storedBy?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialReceiptDocument extends IMaterialReceipt, Document {}

export interface IGRNItem {
  poLineItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily: ProcessFamily;
  recipeId: string;
  recipeCode: string;
  recipeRevision: number;
  acceptedQuantity: number;
  uom: UnitOfMeasure;
  unitCount: number;
  supplierHeatNumber: string;
  mtrNumber?: string;
  unitIdentifiers: string[];
}

export interface IGRN {
  tenantId: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  materialReceiptId: string;
  receiptNumber: string;
  supplierName: string;
  supplierChallanNumber: string;
  supplierInvoiceNumber?: string;
  carrierVehicle?: string;
  warehouseId: string;
  warehouseCode: string;
  storageLocationCode: string;
  items: IGRNItem[];
  totalUnitsGenerated: number;
  status: GRNStatus;
  receivedBy: string;
  inspectedBy?: string;
  approvedBy?: string;
  grnDate: Date;
  printedAt?: Date;
  printedBy?: string;
  printCount: number;
  remarks?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GRNDocument extends IGRN, Document {}

export interface IGRNUnit {
  tenantId: string;
  unitIdentifier: string;
  poId: string;
  poNumber: string;
  grnId: string;
  grnNumber: string;
  materialReceiptId: string;
  receiptNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily: ProcessFamily;
  recipeId: string;
  recipeCode: string;
  recipeRevision: number;
  warehouseId: string;
  warehouseCode: string;
  storageLocationCode: string;
  supplierHeatNumber: string;
  supplierLotNumber?: string;
  mtrNumber?: string;
  supplierChallanNumber: string;
  chemicalComposition?: Record<string, number>;
  quantity: number;
  uom: UnitOfMeasure;
  status: GRNUnitStatus;
  allocatedPlanId?: string;
  allocatedPlanNumber?: string;
  allocatedJobId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GRNUnitDocument extends IGRNUnit, Document {}

// DTOs
export interface RecordMaterialReceiptItemDto {
  poLineItemId: string;
  itemId: string;
  receivedQuantity: number;
  supplierHeatNumber: string;
  supplierLotNumber?: string;
  mtrNumber?: string;
  chemicalComposition?: Record<string, number>;
  lineNotes?: string;
}

export interface RecordMaterialReceiptDto {
  poId: string;
  supplierChallanNumber: string;
  supplierInvoiceNumber?: string;
  carrierVehicle?: string;
  driverName?: string;
  receivedDate?: string;
  items: RecordMaterialReceiptItemDto[];
  notes?: string;
}

export interface StoreMaterialDto {
  warehouseId: string;
  storageLocationCode: string;
  storageNotes?: string;
}

export interface CreateGrnDto {
  materialReceiptId: string;
  inspectedBy?: string;
  approvedBy?: string;
  remarks?: string;
  unitGenerationMode?: 'BY_PCS' | 'BY_LOT';
}

export interface QueryGrnDto {
  search?: string;
  poNumber?: string;
  status?: GRNStatus;
  supplierName?: string;
  supplierChallanNumber?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryGrnUnitDto {
  search?: string;
  poNumber?: string;
  grnNumber?: string;
  itemCode?: string;
  recipeId?: string;
  recipeCode?: string;
  status?: GRNUnitStatus;
  supplierHeatNumber?: string;
  page?: number;
  limit?: number;
}
