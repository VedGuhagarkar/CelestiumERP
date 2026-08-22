import { Document } from 'mongoose';
import { RecipeStage, MetallurgicalTargets, MachineRequirements } from '../recipe/recipe.types.js';
import {
  HardnessRequirement,
  CaseDepthRequirement,
  MicrostructuralCriteria,
  CustomerAcceptanceCriteria
} from '../specification/specification.types.js';

export type JobStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'QUALITY_CHECK'
  | 'STORAGE'
  | 'READY_FOR_DISPATCH'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'CANCELLED';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'AOG_CRITICAL';

export const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  AOG_CRITICAL: 1,
  URGENT: 2,
  HIGH: 3,
  NORMAL: 4,
  LOW: 5
};

export const ALLOWED_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'APPROVED', 'CANCELLED'],
  IN_PROGRESS: ['PAUSED', 'QUALITY_CHECK', 'CANCELLED'],
  PAUSED: ['IN_PROGRESS', 'CANCELLED'],
  QUALITY_CHECK: ['STORAGE', 'IN_PROGRESS', 'CANCELLED'],
  STORAGE: ['READY_FOR_DISPATCH', 'QUALITY_CHECK', 'CANCELLED'],
  READY_FOR_DISPATCH: ['DISPATCHED', 'STORAGE', 'CANCELLED'],
  DISPATCHED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

export interface IJobStateTransition {
  fromStatus: JobStatus;
  toStatus: JobStatus;
  timestamp: Date;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  reason?: string | null;
  notes?: string | null;
}

export interface IJobRecipeSnapshot {
  recipeId: string;
  recipeCode: string;
  revisionNumber: number;
  processFamily: string;
  name: string;
  applicableMaterialGrades: string[];
  stages: RecipeStage[];
  metallurgicalTargets: MetallurgicalTargets;
  machineRequirements: MachineRequirements;
  snapshottedAt: Date;
}

export interface IJobSpecificationSnapshot {
  specificationId: string;
  specCode: string;
  revisionNumber: number;
  title: string;
  customerCode?: string;
  surfaceHardness: HardnessRequirement;
  coreHardness?: HardnessRequirement;
  caseDepth?: CaseDepthRequirement;
  microstructure?: MicrostructuralCriteria;
  customerAcceptance: CustomerAcceptanceCriteria;
  snapshottedAt: Date;
}

export interface IJobMaterialAllocation {
  reservationId?: string | null;
  heatLotId?: string | null;
  heatLotNumber?: string | null;
  supplierHeatNumber?: string | null;
  allocatedQuantity: number;
  uom: string;
}

export interface IJobEquipmentAssignment {
  furnaceId?: string | null;
  furnaceCode?: string | null;
  locationBay?: string | null;
  pyrometryClass?: string | null;
}

export interface IJobOperatorAssignment {
  operatorId?: string | null;
  operatorCode?: string | null;
  operatorName?: string | null;
  shift?: string | null;
}

export interface IProductionJob {
  jobNumber: string;
  tenantId: string;
  planId?: string | null;
  planNumber?: string | null;
  customer: {
    customerId: string;
    customerCode: string;
    customerName: string;
  };
  item: {
    itemId: string;
    itemCode: string;
    itemName: string;
    materialGrade: string;
    uom: string;
  };
  quantity: {
    targetQuantity: number;
    loadedQuantity: number;
    completedQuantity: number;
    scrappedQuantity: number;
  };
  status: JobStatus;
  priority: JobPriority;
  recipeSnapshot: IJobRecipeSnapshot;
  specificationSnapshot: IJobSpecificationSnapshot;
  materialAllocations: IJobMaterialAllocation[];
  equipmentAssignment: IJobEquipmentAssignment;
  operatorAssignment: IJobOperatorAssignment;
  timeline: {
    plannedStartDate: Date;
    targetCompletionDate: Date;
    actualStartDate?: Date | null;
    actualCompletionDate?: Date | null;
  };
  transitionHistory: IJobStateTransition[];
  idempotencyKey?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
  isDeleted: boolean;
}

export interface ProductionJobDocument extends IProductionJob, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDirectJobDto {
  customerId: string;
  itemId: string;
  recipeId: string;
  specificationId: string;
  targetQuantity: number;
  priority?: JobPriority;
  plannedStartDate: string | Date;
  targetCompletionDate: string | Date;
  assignedFurnaceId?: string;
  assignedOperatorId?: string;
  shift?: string;
  materialAllocations?: {
    heatLotId?: string;
    heatLotNumber?: string;
    allocatedQuantity: number;
    uom: string;
  }[];
  notes?: string;
}

export interface UpdateJobDto {
  targetQuantity?: number;
  priority?: JobPriority;
  plannedStartDate?: string | Date;
  targetCompletionDate?: string | Date;
  assignedFurnaceId?: string;
  assignedOperatorId?: string;
  shift?: string;
  notes?: string;
}

export interface TransitionJobDto {
  toStatus: JobStatus;
  reason?: string;
  notes?: string;
}

export interface CancelJobDto {
  reason: string;
  notes?: string;
}

export interface ConvertPlanToJobDto {
  assignedFurnaceId?: string;
  assignedOperatorId?: string;
  shift?: 'SHIFT_1_MORNING' | 'SHIFT_2_EVENING' | 'SHIFT_3_NIGHT' | 'GENERAL_DAY';
  targetQuantity?: number;
  idempotencyKey?: string;
  notes?: string;
}

export interface QueryJobsDto {
  status?: JobStatus;
  furnaceId?: string;
  itemCode?: string;
  planId?: string;
  priority?: JobPriority;
  search?: string;
  page?: number;
  limit?: number;
}
