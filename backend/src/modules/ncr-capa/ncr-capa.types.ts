import { Document } from 'mongoose';
import { ProcessFamily } from '../recipe/recipe.types.js';

export type DefectType =
  | 'HARDNESS_OUT_OF_TOLERANCE'
  | 'CASE_DEPTH_DEFICIENT'
  | 'CASE_DEPTH_EXCESSIVE'
  | 'MICROSTRUCTURE_NON_CONFORMING'
  | 'RETAINED_AUSTENITE_EXCESSIVE'
  | 'EXCESSIVE_DECARBURIZATION'
  | 'GRAIN_COARSENING'
  | 'CARBIDE_NETWORK_DEFECT'
  | 'DISTORTION_WARPAGE'
  | 'QUENCH_CRACKING'
  | 'SURFACE_OXIDATION_SCALING'
  | 'PYROMETRY_EXCURSION_OVERTEMP'
  | 'PYROMETRY_EXCURSION_UNDERTEMP'
  | 'ATMOSPHERE_FAILURE'
  | 'PROCESS_INTERRUPTION'
  | 'CUSTOMER_COMPLAINT_RETURN'
  | 'OTHER';

export type DefectSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export type NcrStatus =
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'DISPOSITIONED'
  | 'CAPA_PENDING'
  | 'CLOSED'
  | 'CANCELLED';

export type NcrDispositionType =
  | 'SCRAP'
  | 'REWORK_REHEAT_TREAT'
  | 'REWORK_TEMPER_ONLY'
  | 'USE_AS_IS_CONCESSION'
  | 'RETURN_TO_CUSTOMER'
  | 'DE_RATE';

export type RootCauseCategory =
  | 'MAN_OPERATOR'
  | 'MACHINE_FURNACE'
  | 'METHOD_RECIPE'
  | 'MATERIAL_RAW'
  | 'MEASUREMENT_GAUGE'
  | 'ENVIRONMENT';

export type InvestigationMethod =
  | '5_WHY'
  | 'FISHBONE_ISHIKAWA'
  | 'METALLURGICAL_FAILURE_ANALYSIS'
  | 'THERMAL_CYCLE_AUDIT';

export type CapaType = 'CORRECTIVE' | 'PREVENTIVE' | 'CORRECTIVE_AND_PREVENTIVE';

export type CapaStatus =
  | 'OPEN'
  | 'ACTION_PLANNING'
  | 'IN_PROGRESS'
  | 'VERIFICATION'
  | 'EFFECTIVE'
  | 'CLOSED'
  | 'VOID';

export type CapaActionType =
  | 'RECIPE_MODIFICATION'
  | 'EQUIPMENT_CALIBRATION'
  | 'MAINTENANCE_OVERHAUL'
  | 'OPERATOR_RETRAINING'
  | 'SPECIFICATION_REVISION'
  | 'QUALITY_PLAN_UPDATE'
  | 'SUPPLIER_CAR'
  | 'SOP_UPDATE';

export type CapaActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export type VerificationMethod =
  | 'SUBSEQUENT_LOT_AUDIT'
  | 'PYROMETRY_TUS_VALIDATION'
  | 'TRAINING_ASSESSMENT'
  | 'SPC_TREND_ANALYSIS';

export interface INcrCustomerSnapshot {
  customerId: string;
  customerCode: string;
  customerName: string;
}

export interface INcrItemSnapshot {
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade?: string;
  uom: string;
}

export interface INcrHeatLotReference {
  heatLotId?: string | null;
  heatLotNumber?: string | null;
  quantity?: number;
  uom?: string;
}

export interface INcrEvidence {
  evidenceId: string;
  title: string;
  evidenceType: 'MICROGRAPH' | 'HARDNESS_REPORT' | 'PYROMETRY_CHART' | 'PHOTO' | 'LAB_TEST_RECORD' | 'DOC';
  fileUrl: string;
  description?: string;
  uploadedAt: Date;
  uploadedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
}

export interface INcrAffectedQuantity {
  totalAffectedQuantity: number;
  rejectedQuantity: number;
  scrappedQuantity?: number;
  reworkedQuantity?: number;
  uom: string;
}

export interface INcrContainment {
  containmentAction: string;
  isQuarantined: boolean;
  quarantineId?: string | null;
  quarantineNumber?: string | null;
  quarantineBay?: string | null;
  quarantineStatus?: 'ACTIVE' | 'RELEASED' | 'DISPOSITIONED';
  containedAt: Date;
  containedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
}

export interface INcrRootCause {
  category: RootCauseCategory;
  investigationMethod: InvestigationMethod;
  investigationDetails: string;
  fiveWhys?: string[];
  fishboneCategories?: {
    man?: string[];
    machine?: string[];
    method?: string[];
    material?: string[];
    measurement?: string[];
    environment?: string[];
  };
  investigatedBy: {
    userId: string;
    email?: string;
    role?: string;
    date: Date;
  };
}

export interface INcrDisposition {
  dispositionType: NcrDispositionType;
  instructions: string;
  concessionNumber?: string | null;
  customerConcessionApproved?: boolean;
  customerApprovalReference?: string | null;
  customerApprovedAt?: Date | null;
  dispositionSignoff: {
    userId: string;
    email?: string;
    role?: string;
    timestamp: Date;
    remarks?: string | null;
  };
}

export interface INcrTransitionRecord {
  fromStatus: NcrStatus;
  toStatus: NcrStatus;
  timestamp: Date;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  reason: string;
}

export interface INonConformanceReport {
  tenantId: string;
  ncrNumber: string;
  status: NcrStatus;
  inspectionId?: string | null;
  inspectionNumber?: string | null;
  jobId: string;
  jobNumber: string;
  planId?: string | null;
  planNumber?: string | null;
  customer: INcrCustomerSnapshot;
  item: INcrItemSnapshot;
  heatLots: INcrHeatLotReference[];
  processFamily?: ProcessFamily | string;
  defectType: DefectType;
  defectSeverity: DefectSeverity;
  defectDescription: string;
  defectLocations?: string[];
  affectedQuantity: INcrAffectedQuantity;
  evidence: INcrEvidence[];
  containment: INcrContainment;
  rootCause?: INcrRootCause | null;
  disposition?: INcrDisposition | null;
  requiresCapa: boolean;
  capaIds: string[];
  capaNumbers: string[];
  raisedAt: Date;
  raisedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  closedAt?: Date | null;
  closedBy?: {
    userId: string;
    email?: string;
    role?: string;
    remarks?: string | null;
  } | null;
  transitionHistory: INcrTransitionRecord[];
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NonConformanceReportDocument = INonConformanceReport & Document;

export interface ICapaActionItem {
  itemNumber: number;
  actionType: CapaActionType;
  description: string;
  assignedTo: {
    userId: string;
    email?: string;
    name?: string;
  };
  targetCompletionDate: Date;
  actualCompletionDate?: Date | null;
  status: CapaActionStatus;
  completionNotes?: string | null;
}

export interface ICapaEffectivenessVerification {
  verificationMethod: VerificationMethod;
  verificationPeriodDays: number;
  verifiedAt: Date;
  verifiedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  isEffective: boolean;
  notes: string;
}

export interface ICapaTransitionRecord {
  fromStatus: CapaStatus;
  toStatus: CapaStatus;
  timestamp: Date;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  reason: string;
}

export interface ICorrectivePreventiveAction {
  tenantId: string;
  capaNumber: string;
  ncrId: string;
  ncrNumber: string;
  type: CapaType;
  status: CapaStatus;
  title: string;
  problemStatement: string;
  rootCauseSummary: string;
  actionItems: ICapaActionItem[];
  effectivenessVerification?: ICapaEffectivenessVerification | null;
  raisedAt: Date;
  raisedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  closedAt?: Date | null;
  closedBy?: {
    userId: string;
    email?: string;
    role?: string;
    remarks?: string | null;
  } | null;
  transitionHistory: ICapaTransitionRecord[];
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CorrectivePreventiveActionDocument = ICorrectivePreventiveAction & Document;

// --- DTOs ---

export interface CreateNcrDto {
  inspectionId?: string;
  jobId: string;
  defectType: DefectType;
  defectSeverity: DefectSeverity;
  defectDescription: string;
  defectLocations?: string[];
  totalAffectedQuantity: number;
  rejectedQuantity: number;
  uom?: string;
  containmentAction: string;
  quarantineRequired?: boolean;
  quarantineBay?: string;
  requiresCapa?: boolean;
  evidence?: Array<{
    title: string;
    evidenceType: 'MICROGRAPH' | 'HARDNESS_REPORT' | 'PYROMETRY_CHART' | 'PHOTO' | 'LAB_TEST_RECORD' | 'DOC';
    fileUrl: string;
    description?: string;
  }>;
  notes?: string;
}

export interface RecordNcrRootCauseDto {
  category: RootCauseCategory;
  investigationMethod: InvestigationMethod;
  investigationDetails: string;
  fiveWhys?: string[];
  fishboneCategories?: {
    man?: string[];
    machine?: string[];
    method?: string[];
    material?: string[];
    measurement?: string[];
    environment?: string[];
  };
}

export interface RecordNcrDispositionDto {
  dispositionType: NcrDispositionType;
  instructions: string;
  concessionNumber?: string;
  customerConcessionApproved?: boolean;
  customerApprovalReference?: string;
  remarks?: string;
  quarantineAction?: 'RELEASE_FOR_REWORK' | 'SCRAP_HANDOFF' | 'MAINTAIN_QUARANTINE';
}

export interface CloseNcrDto {
  remarks?: string;
}

export interface CreateCapaDto {
  type: CapaType;
  title: string;
  problemStatement: string;
  rootCauseSummary: string;
  actionItems?: Array<{
    actionType: CapaActionType;
    description: string;
    assignedToUserId: string;
    assignedToEmail?: string;
    assignedToName?: string;
    targetCompletionDate: string | Date;
  }>;
  notes?: string;
}

export interface UpdateCapaActionItemDto {
  itemNumber: number;
  status: CapaActionStatus;
  completionNotes?: string;
  actualCompletionDate?: string | Date;
}

export interface VerifyCapaEffectivenessDto {
  verificationMethod: VerificationMethod;
  verificationPeriodDays: number;
  isEffective: boolean;
  notes: string;
}

export interface CloseCapaDto {
  remarks?: string;
}

export interface QueryNcrsDto {
  status?: NcrStatus;
  defectType?: DefectType;
  defectSeverity?: DefectSeverity;
  jobId?: string;
  inspectionId?: string;
  customerCode?: string;
  requiresCapa?: boolean;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryCapasDto {
  status?: CapaStatus;
  type?: CapaType;
  ncrId?: string;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
