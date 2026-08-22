import { Document } from 'mongoose';
import {
  HardnessRequirement,
  CaseDepthRequirement,
  MicrostructuralCriteria,
  CustomerAcceptanceCriteria
} from '../specification/specification.types.js';
import { RecipeStage, MetallurgicalTargets, MachineRequirements } from '../recipe/recipe.types.js';

export type QualityInspectionStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REINSPECTION';

export type QualityDisposition =
  | 'PENDING'
  | 'CONFORMING'
  | 'NON_CONFORMING'
  | 'CONCESSION_GRANTED'
  | 'SCRAP'
  | 'REWORK';

export type HardnessScale = 'HRC' | 'HRB' | 'HV' | 'HBW';

export type DefectSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export type DispositionRecommendation =
  | 'SCRAP'
  | 'REWORK_REHEAT'
  | 'REWORK_TEMPER'
  | 'CONCESSION'
  | 'RETURN_TO_VENDOR'
  | 'NONE';

export const ALLOWED_QUALITY_STATUS_TRANSITIONS: Record<QualityInspectionStatus, QualityInspectionStatus[]> = {
  PENDING: ['IN_REVIEW', 'APPROVED', 'REJECTED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'REINSPECTION', 'PENDING'],
  APPROVED: [],
  REJECTED: ['REINSPECTION'],
  REINSPECTION: ['IN_REVIEW', 'APPROVED', 'REJECTED']
};

export interface IHardnessTestPoint {
  pointIdentifier: string;
  location: 'SURFACE' | 'CORE' | 'CASE' | 'TRANSITION';
  measuredValue: number;
  scale: HardnessScale;
  targetMin?: number;
  targetMax?: number;
  passed: boolean;
}

export interface ICaseDepthTestResult {
  effectiveCaseDepthMm: number;
  totalCaseDepthMm?: number;
  cutoffHardnessHrc?: number;
  targetMinMm?: number;
  targetMaxMm?: number;
  passed: boolean;
}

export interface IMicrostructureTestResult {
  observedStructure: string;
  grainSizeAstm?: number;
  retainedAustenitePercent?: number;
  decarburizationDepthMm?: number;
  carbideDistributionRating?: string;
  passed: boolean;
  photoUrls?: string[];
  notes?: string;
}

export interface IMechanicalTestResult {
  tensileStrengthMpa?: number;
  yieldStrengthMpa?: number;
  elongationPercent?: number;
  reductionOfAreaPercent?: number;
  impactEnergyJoules?: number;
  passed: boolean;
  notes?: string;
}

export interface IVisualDimensionalResult {
  distortionMm?: number;
  maxAllowedDistortionMm?: number;
  surfaceOxidationAcceptable: boolean;
  quenchCracksPresent: boolean;
  dimensionsWithinTolerance: boolean;
  passed: boolean;
  notes?: string;
}

export interface IPyrometryVerification {
  pyrometryArchiveId?: string;
  soakTemperatureCompliant: boolean;
  soakTimeCompliant: boolean;
  quenchDelayCompliant: boolean;
  coolingRateCompliant: boolean;
  passed: boolean;
  verifiedBy?: string;
  notes?: string;
}

export interface IQualityTestResults {
  hardnessTests: IHardnessTestPoint[];
  caseDepth?: ICaseDepthTestResult;
  microstructure?: IMicrostructureTestResult;
  mechanical?: IMechanicalTestResult;
  visualDimensional?: IVisualDimensionalResult;
  pyrometry?: IPyrometryVerification;
  evaluatedAt?: Date;
  evaluatedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  overallTestPassed?: boolean;
}

export interface INonConformanceReport {
  ncrNumber?: string;
  defectCode?: string;
  defectDescription?: string;
  severity: DefectSeverity;
  rootCauseCategory?: string;
  dispositionRecommendation?: DispositionRecommendation;
  quarantineRequired: boolean;
  quarantineLocationBay?: string;
  correctiveActionPlan?: string;
  raisedAt?: Date;
  raisedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
}

export interface IInspectorAssignment {
  inspectorId: string | null;
  inspectorCode: string | null;
  inspectorName: string | null;
  assignedAt?: Date | null;
  assignedBy?: {
    userId: string;
    email?: string;
    role?: string;
  } | null;
}

export interface IInspectionAssignmentHistory {
  action: 'ASSIGN' | 'REALLOCATE' | 'REMOVE';
  previousInspectorId?: string | null;
  previousInspectorCode?: string | null;
  newInspectorId?: string | null;
  newInspectorCode?: string | null;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
  reason?: string | null;
}

export interface IInspectionStateTransition {
  fromStatus: QualityInspectionStatus;
  toStatus: QualityInspectionStatus;
  timestamp: Date;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  reason?: string | null;
  notes?: string | null;
}

export interface IInspectionSignoff {
  userId: string;
  email?: string;
  role?: string;
  timestamp: Date;
  remarks?: string | null;
}

export interface IQualityInspection {
  id: string;
  tenantId: string;
  inspectionNumber: string;
  jobId: string;
  jobNumber: string;
  planId?: string | null;
  planNumber?: string | null;
  status: QualityInspectionStatus;
  disposition: QualityDisposition;
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
  heatLots: Array<{
    heatLotId?: string | null;
    heatLotNumber?: string | null;
    allocatedQuantity: number;
    uom: string;
  }>;
  recipeSnapshot: {
    recipeId: string;
    recipeCode: string;
    revisionNumber: number;
    processFamily: string;
    name?: string;
    applicableMaterialGrades?: string[];
    stages?: RecipeStage[];
    metallurgicalTargets?: MetallurgicalTargets;
    machineRequirements?: MachineRequirements;
  };
  specificationSnapshot: {
    specificationId: string;
    specCode: string;
    revisionNumber: number;
    title: string;
    customerCode?: string;
    surfaceHardness: HardnessRequirement;
    coreHardness?: HardnessRequirement;
    caseDepth?: CaseDepthRequirement;
    microstructure?: MicrostructuralCriteria;
    customerAcceptance?: CustomerAcceptanceCriteria;
  };
  inspectionQuantity: {
    sampleSize: number;
    totalLotQuantity: number;
    unitOfMeasure: string;
  };
  assignedInspector?: IInspectorAssignment | null;
  testResults: IQualityTestResults;
  nonConformance?: INonConformanceReport | null;
  reinspection?: {
    reinspectionCount: number;
    parentInspectionId?: string | null;
    reinspectionReason?: string | null;
  };
  approvedBy?: IInspectionSignoff | null;
  rejectedBy?: IInspectionSignoff | null;
  assignmentHistory: IInspectionAssignmentHistory[];
  transitionHistory: IInspectionStateTransition[];
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type QualityInspectionDocument = Document & IQualityInspection;

// --- DTOs ---

export interface CreateQualityInspectionDto {
  jobId: string;
  sampleSize?: number;
  assignedInspectorId?: string;
  notes?: string;
}

export interface AssignInspectorDto {
  inspectorId: string;
  reason?: string;
}

export interface RecordTestResultsDto {
  hardnessTests?: IHardnessTestPoint[];
  caseDepth?: ICaseDepthTestResult;
  microstructure?: IMicrostructureTestResult;
  mechanical?: IMechanicalTestResult;
  visualDimensional?: IVisualDimensionalResult;
  pyrometry?: IPyrometryVerification;
  notes?: string;
}

export interface ApproveInspectionDto {
  disposition?: 'CONFORMING' | 'CONCESSION_GRANTED';
  remarks?: string;
}

export interface RejectInspectionDto {
  defectCode?: string;
  defectDescription: string;
  severity: DefectSeverity;
  rootCauseCategory?: string;
  dispositionRecommendation?: DispositionRecommendation;
  quarantineRequired?: boolean;
  quarantineLocationBay?: string;
  correctiveActionPlan?: string;
  remarks?: string;
}

export interface RequestReinspectionDto {
  reinspectionReason: string;
  revisedSampleSize?: number;
  assignedInspectorId?: string;
  notes?: string;
}

export interface QueryQualityInspectionsDto {
  status?: QualityInspectionStatus;
  disposition?: QualityDisposition;
  jobId?: string;
  jobNumber?: string;
  inspectorId?: string;
  heatLotNumber?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
