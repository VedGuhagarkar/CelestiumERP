import { Document } from 'mongoose';

export type ProductionPlanStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

export type ProductionPlanPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'AOG_CRITICAL';

export type MaterialAvailabilityStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_AVAILABLE'
  | 'PENDING_INWARD'
  | 'BLOCKED_QUARANTINE';

export interface IPlanCustomerRef {
  customerId: string;
  customerCode: string;
  customerName: string;
}

export interface IPlanItemRef {
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  uom: string;
}

export interface IPlanRecipeRef {
  recipeId: string;
  recipeCode: string;
  recipeRevision: number;
  processFamily: string;
}

export interface IPlanSpecificationRef {
  specificationId: string;
  specCode: string;
  specRevision: number;
}

export interface IPlanQuantityTargets {
  plannedQuantity: number;
  scheduledQuantity: number;
  inProgressQuantity: number;
  completedQuantity: number;
  scrappedQuantity: number;
  completionPercentage: number;
}

export interface IPlanTimeline {
  plannedStartDate: Date;
  targetCompletionDate: Date;
  actualStartDate?: Date | null;
  actualCompletionDate?: Date | null;
}

export interface IPlanConstraints {
  materialAvailability: MaterialAvailabilityStatus;
  availableStockQuantity: number;
  requiredHeatLotNumber?: string | null;
  compatibleFurnaceTypes: string[];
  estimatedFurnaceHours: number;
  operatorCertificationsRequired: string[];
  maxBatchWeightKg?: number | null;
}

export interface IProductionPlan {
  planNumber: string;
  tenantId: string;
  title: string;
  status: ProductionPlanStatus;
  priority: ProductionPlanPriority;
  customer: IPlanCustomerRef;
  item: IPlanItemRef;
  recipe: IPlanRecipeRef;
  specification: IPlanSpecificationRef;
  quantityTargets: IPlanQuantityTargets;
  timeline: IPlanTimeline;
  constraints: IPlanConstraints;
  assignedJobCardIds: string[];
  notes?: string | null;
  statusReason?: string | null;
  createdByActorId: string;
  updatedByActorId?: string;
  isDeleted: boolean;
}

export interface ProductionPlanDocument extends IProductionPlan, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductionPlanDto {
  title: string;
  priority?: ProductionPlanPriority;
  customerId: string;
  itemId: string;
  recipeId: string;
  specificationId: string;
  plannedQuantity: number;
  plannedStartDate: string;
  targetCompletionDate: string;
  requiredHeatLotNumber?: string;
  compatibleFurnaceTypes?: string[];
  estimatedFurnaceHours?: number;
  operatorCertificationsRequired?: string[];
  maxBatchWeightKg?: number;
  notes?: string;
}

export interface UpdateProductionPlanDto {
  title?: string;
  priority?: ProductionPlanPriority;
  plannedQuantity?: number;
  plannedStartDate?: string;
  targetCompletionDate?: string;
  requiredHeatLotNumber?: string | null;
  compatibleFurnaceTypes?: string[];
  estimatedFurnaceHours?: number;
  operatorCertificationsRequired?: string[];
  maxBatchWeightKg?: number | null;
  notes?: string | null;
}

export interface UpdatePlanStatusDto {
  status: ProductionPlanStatus;
  reason?: string;
}

export interface QueryProductionPlanDto {
  search?: string;
  status?: ProductionPlanStatus;
  priority?: ProductionPlanPriority;
  customerCode?: string;
  itemCode?: string;
  materialGrade?: string;
  processFamily?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
