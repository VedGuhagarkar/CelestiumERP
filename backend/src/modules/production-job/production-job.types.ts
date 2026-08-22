import { Document } from 'mongoose';
import { RecipeStage, MetallurgicalTargets, MachineRequirements } from '../recipe/recipe.types.js';
import {
  HardnessRequirement,
  CaseDepthRequirement,
  MicrostructuralCriteria,
  CustomerAcceptanceCriteria
} from '../specification/specification.types.js';

export type JobStatus =
  | 'PENDING_RELEASE'
  | 'RELEASED'
  | 'STAGED'
  | 'LOADED'
  | 'HEATING'
  | 'SOAKING'
  | 'QUENCHING'
  | 'TEMPERING'
  | 'COOLING'
  | 'UNLOADED'
  | 'AWAITING_QC'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'AOG_CRITICAL';

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
  planId: string;
  planNumber: string;
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
  idempotencyKey?: string | null;
  notes?: string | null;
  isDeleted: boolean;
}

export interface ProductionJobDocument extends IProductionJob, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
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
