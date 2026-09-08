import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';
import { ProcessFamily } from '../recipe/recipe.types.js';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export interface IPurchaseOrderItem {
  lineItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily: ProcessFamily;
  processingRequirement?: string;
  recipeId: string;
  recipeCode: string;
  recipeRevision: number;
  orderedQuantity: number;
  receivedQuantity: number;
  balanceQuantity?: number;
  uom: UnitOfMeasure;
  unitPrice: number;
  lineTotal: number;
  lineNotes?: string;
}

export interface IPurchaseOrder {
  tenantId: string;
  poNumber: string;
  idempotencyKey?: string;
  supplierName: string;
  supplierCode?: string;
  vendorAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  orderDate: Date;
  expectedDeliveryDate: Date;
  status: PurchaseOrderStatus;
  items: IPurchaseOrderItem[];
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  currency: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  subtotalAmount: number;
  taxAmount?: number;
  totalAmount: number;
  notes?: string;
  createdById: string;
  createdByName?: string;
  approvedBy?: {
    userId: string;
    userName?: string;
    approvedAt: Date;
    comments?: string;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderDocument extends IPurchaseOrder, Document {}

export interface CreatePurchaseOrderItemDto {
  itemId: string;
  recipeId: string;
  orderedQuantity: number;
  processingRequirement?: string;
  unitPrice?: number;
  lineNotes?: string;
}

export interface CreatePurchaseOrderDto {
  supplierName: string;
  supplierCode?: string;
  vendorAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  orderDate?: string;
  expectedDeliveryDate: string;
  items: CreatePurchaseOrderItemDto[];
  currency?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  taxAmount?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface UpdatePurchaseOrderDto {
  supplierName?: string;
  supplierCode?: string;
  vendorAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  expectedDeliveryDate?: string;
  currency?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  taxAmount?: number;
  notes?: string;
  status?: PurchaseOrderStatus;
}

export interface QueryPurchaseOrderDto {
  search?: string;
  status?: PurchaseOrderStatus;
  supplierName?: string;
  supplierCode?: string;
  itemCode?: string;
  recipeCode?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
