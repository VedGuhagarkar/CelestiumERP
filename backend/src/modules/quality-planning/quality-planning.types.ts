import { Document } from 'mongoose';
import { ProcessFamily } from '../recipe/recipe.types.js';
import { SpecimenLocation, HardnessScale } from '../metallurgical-lab/metallurgical-lab.types.js';

export type QualityPlanStatus = 'DRAFT' | 'APPROVED' | 'OBSOLETE';

export type InspectionCharacteristicType =
  | 'SURFACE_HARDNESS'
  | 'CORE_HARDNESS'
  | 'EFFECTIVE_CASE_DEPTH'
  | 'TOTAL_CASE_DEPTH'
  | 'MICROSTRUCTURE_MATRIX'
  | 'RETAINED_AUSTENITE'
  | 'GRAIN_SIZE'
  | 'DECARBURIZATION'
  | 'CARBIDE_MORPHOLOGY'
  | 'VISUAL_DIMENSIONAL'
  | 'PYROMETRY_VERIFICATION'
  | 'TENSILE_MECHANICAL';

export type MeasurementType =
  | 'HARDNESS'
  | 'CASE_DEPTH_TRAVERSE'
  | 'MICROSTRUCTURE'
  | 'VISUAL_DIMENSIONAL'
  | 'PYROMETRY_VERIFICATION'
  | 'MECHANICAL';

export type SamplingFrequency =
  | 'PER_CHARGE'
  | 'PER_PIECE'
  | 'START_AND_END_OF_HEAT'
  | 'AQL_NORMAL'
  | 'AQL_TIGHTENED'
  | 'ONE_PER_LOT';

export interface IAcceptanceCriteria {
  targetMin?: number | null;
  targetMax?: number | null;
  scale?: HardnessScale | string | null;
  unit?: string | null;
  description?: string | null;
  testStandardReference?: string | null;
}

export interface IInspectionCharacteristic {
  itemCode: string;
  name: string;
  characteristicType: InspectionCharacteristicType;
  measurementType: MeasurementType;
  isMandatory: boolean;
  specLocations: SpecimenLocation[];
  sampleCount: number;
  readingsPerSample: number;
  samplingFrequency: SamplingFrequency;
  acceptanceCriteria: IAcceptanceCriteria;
  notes?: string | null;
}

export interface IQualityPlanRevisionEntry {
  revision: number;
  changedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  changedAt: Date;
  changeDescription: string;
}

export interface IQualityPlanSignoff {
  userId: string;
  email?: string;
  role?: string;
  approvedAt: Date;
  remarks?: string | null;
}

export interface IQualityPlan {
  id: string;
  tenantId: string;
  planCode: string;
  revisionNumber: number;
  title: string;
  description?: string | null;
  status: QualityPlanStatus;
  processFamily: ProcessFamily;
  specificationId: string;
  specCode: string;
  specRevisionNumber: number;
  applicableCustomerCodes?: string[];
  applicableItemCategories?: string[];
  characteristics: IInspectionCharacteristic[];
  authorId: string;
  approvedBy?: IQualityPlanSignoff | null;
  revisionHistory: IQualityPlanRevisionEntry[];
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type QualityPlanDocument = Document & IQualityPlan;

export interface IQualityPlanSnapshot {
  planId: string;
  planCode: string;
  revisionNumber: number;
  title: string;
  processFamily: string;
  specCode: string;
  specRevisionNumber: number;
  characteristics: IInspectionCharacteristic[];
  snapshottedAt: Date;
}

// --- Compliance Evaluation Interface ---
export interface IQualityPlanComplianceResult {
  compliant: boolean;
  totalChecks: number;
  mandatoryChecksCount: number;
  passedChecksCount: number;
  missingMandatoryChecks: string[];
  nonConformingChecks: string[];
  evaluationSummary: string;
}

// --- DTOs ---

export interface CreateQualityPlanDto {
  planCode?: string;
  title: string;
  description?: string;
  processFamily: ProcessFamily;
  specificationId: string;
  applicableCustomerCodes?: string[];
  applicableItemCategories?: string[];
  characteristics: IInspectionCharacteristic[];
  notes?: string;
}

export interface UpdateQualityPlanDto {
  title?: string;
  description?: string;
  applicableCustomerCodes?: string[];
  applicableItemCategories?: string[];
  characteristics?: IInspectionCharacteristic[];
  notes?: string;
}

export interface ApproveQualityPlanDto {
  remarks?: string;
}

export interface CreateQualityPlanRevisionDto {
  changeDescription: string;
  updatedCharacteristics?: IInspectionCharacteristic[];
  notes?: string;
}

export interface QueryQualityPlansDto {
  status?: QualityPlanStatus;
  processFamily?: ProcessFamily;
  specCode?: string;
  specificationId?: string;
  customerCode?: string;
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
