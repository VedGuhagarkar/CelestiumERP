import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';

export type InventoryTransactionType =
  | 'GOODS_RECEIPT'
  | 'GOODS_ISSUE'
  | 'STOCK_ADJUSTMENT_ADD'
  | 'STOCK_ADJUSTMENT_DEDUCT'
  | 'INTERNAL_TRANSFER_OUT'
  | 'INTERNAL_TRANSFER_IN'
  | 'RESERVATION_ALLOCATE'
  | 'RESERVATION_RELEASE';

export type AdjustmentReasonCode =
  | 'PHYSICAL_COUNT_DISCREPANCY'
  | 'DAMAGED_IN_STORAGE'
  | 'SAMPLE_DESTRUCTIVE_TESTING'
  | 'EXPIRED_SHELF_LIFE'
  | 'SCRAP_DISPOSAL'
  | 'SYSTEM_INITIALIZATION'
  | 'OTHER';

export type ReferenceType =
  | 'JOB_CARD'
  | 'HEAT_LOT'
  | 'PURCHASE_ORDER'
  | 'PHYSICAL_COUNT'
  | 'MAINTENANCE_WORKORDER'
  | 'SCRAP'
  | 'DISPATCH';

export interface IInventoryBalance {
  tenantId: string;
  itemId: string;
  itemCode: string;
  materialGrade?: string;
  location: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  uom: UnitOfMeasure;
  version: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryBalanceDocument extends IInventoryBalance, Document {}

export interface IInventoryTransaction {
  transactionNumber: string;
  tenantId: string;
  itemId: string;
  itemCode: string;
  type: InventoryTransactionType;
  quantity: number;
  uom: UnitOfMeasure;
  sourceLocation?: string;
  destinationLocation?: string;
  beforeBalance: number;
  afterBalance: number;
  referenceType: ReferenceType;
  referenceId?: string;
  referenceNumber?: string;
  reasonCode?: AdjustmentReasonCode;
  comments?: string;
  actorId: string;
  actorEmail?: string;
  timestamp: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryTransactionDocument extends IInventoryTransaction, Document {}

export interface GoodsReceiptDto {
  itemId: string;
  location: string;
  quantity: number;
  referenceType: ReferenceType;
  referenceId?: string;
  referenceNumber?: string;
  comments?: string;
}

export interface GoodsIssueDto {
  itemId: string;
  location: string;
  quantity: number;
  referenceType: ReferenceType;
  referenceId?: string;
  referenceNumber?: string;
  comments?: string;
}

export interface StockAdjustmentDto {
  itemId: string;
  location: string;
  adjustedQuantity: number; // positive = increase, negative = decrease
  reasonCode: AdjustmentReasonCode;
  comments: string;
  referenceNumber?: string;
}

export interface InternalTransferDto {
  itemId: string;
  sourceLocation: string;
  destinationLocation: string;
  quantity: number;
  referenceNumber?: string;
  comments?: string;
}

export interface ReserveStockDto {
  itemId: string;
  location: string;
  quantity: number;
  referenceType: ReferenceType;
  referenceId?: string;
  referenceNumber?: string;
  comments?: string;
}

export interface ReleaseReservationDto {
  itemId: string;
  location: string;
  quantity: number;
  referenceType: ReferenceType;
  referenceId?: string;
  referenceNumber?: string;
  comments?: string;
}

export interface InventoryBalanceFilterQuery {
  search?: string;
  itemId?: string;
  itemCode?: string;
  location?: string;
}

export interface InventoryTransactionFilterQuery {
  search?: string;
  itemId?: string;
  itemCode?: string;
  type?: InventoryTransactionType;
  location?: string;
  referenceType?: ReferenceType;
  referenceNumber?: string;
  startDate?: string;
  endDate?: string;
}
