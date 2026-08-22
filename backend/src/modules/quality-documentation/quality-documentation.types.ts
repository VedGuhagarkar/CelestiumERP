import { Document } from 'mongoose';
import { ProcessFamily } from '../recipe/recipe.types.js';

export type ReportType =
  | 'TEST_REPORT'
  | 'CERTIFICATE_OF_CONFORMANCE'
  | 'COMBINED_METALLURGICAL_REPORT';

export type DocumentStatus = 'DRAFT' | 'ISSUED' | 'SUPERSEDED' | 'REVOKED';

export type TargetVsActualEvaluation = 'CONFORMING' | 'NON_CONFORMING' | 'CONCESSION' | 'NOT_APPLICABLE';

export interface ITargetVsActualHardness {
  location: string;
  scale: string;
  targetMin?: number | null;
  targetMax?: number | null;
  targetRangeText: string;
  measuredPoints: number[];
  averageMeasured: number;
  evaluation: TargetVsActualEvaluation;
  standardReference?: string;
}

export interface ITargetVsActualCaseDepth {
  targetMinMm?: number | null;
  targetMaxMm?: number | null;
  targetRangeText: string;
  cutoffHardnessText?: string;
  effectiveCaseDepthMm?: number | null;
  totalCaseDepthMm?: number | null;
  evaluation: TargetVsActualEvaluation;
  traverseCurvePoints?: Array<{
    depthMm: number;
    hardness: number;
    scale: string;
  }>;
}

export interface ITargetVsActualMicrostructure {
  characteristicName: string;
  targetRequirement: string;
  actualObservation: string;
  measuredValue?: number | null;
  unit?: string | null;
  evaluation: TargetVsActualEvaluation;
}

export interface ITargetVsActualVisualDimensional {
  inspectionItem: string;
  acceptanceCriteria: string;
  finding: string;
  isConforming: boolean;
}

export interface ITargetVsActualPyrometry {
  furnaceCode: string;
  furnaceClass: string;
  instrumentationType: string;
  operatingRange: string;
  satCompliant: boolean;
  tusCompliant: boolean;
  standardReference: 'AMS_2750G' | 'CQI_9' | 'BAC_5621' | 'STANDARD';
  pyrometryStatus: 'CONFORMING' | 'EXCURSION_RESOLVED' | 'NON_CONFORMING';
}

export interface IDocumentCustomerSnapshot {
  customerId: string;
  customerCode: string;
  customerName: string;
  purchaseOrderNumber?: string | null;
  partNumber?: string | null;
  drawingNumber?: string | null;
  drawingRevision?: string | null;
}

export interface IDocumentItemSnapshot {
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  uom: string;
}

export interface IDocumentHeatLotSnapshot {
  heatLotId?: string | null;
  heatLotNumber?: string | null;
  millHeatNumber?: string | null;
  quantity?: number;
  uom?: string;
}

export interface IDocumentRecipeSnapshot {
  recipeId: string;
  recipeCode: string;
  revisionNumber: number;
  processFamily: ProcessFamily | string;
  name: string;
  stagesCount?: number;
}

export interface IDocumentSpecificationSnapshot {
  specificationId: string;
  specCode: string;
  revisionNumber: number;
  title: string;
  customerCode?: string;
}

export interface IDocumentQualityPlanSnapshot {
  planId?: string | null;
  planCode?: string | null;
  revisionNumber?: number | null;
  title?: string | null;
}

export interface IDocumentSignoff {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  title: string;
  signedAt: Date;
  digitalSignatureHash: string;
}

export interface IDocumentRevocation {
  isRevoked: boolean;
  revokedAt?: Date | null;
  revokedBy?: {
    userId: string;
    email: string;
    role: string;
  } | null;
  reason?: string | null;
}

export interface IQualityDocument {
  tenantId: string;
  documentNumber: string;
  reportType: ReportType;
  status: DocumentStatus;
  versionNumber: number;
  revisionNumber: number;
  previousDocumentId?: string | null;
  
  // Linkages
  inspectionId: string;
  inspectionNumber: string;
  jobId: string;
  jobNumber: string;
  planId?: string | null;
  planNumber?: string | null;

  // Snapshots
  customer: IDocumentCustomerSnapshot;
  item: IDocumentItemSnapshot;
  heatLots: IDocumentHeatLotSnapshot[];
  certifiedQuantity: {
    acceptedQuantity: number;
    sampleQuantity: number;
    totalLotQuantity: number;
    uom: string;
  };
  recipe: IDocumentRecipeSnapshot;
  specification: IDocumentSpecificationSnapshot;
  qualityPlan?: IDocumentQualityPlanSnapshot | null;

  // Compiled Test & Quality Results
  hardnessSurveys: ITargetVsActualHardness[];
  caseDepth?: ITargetVsActualCaseDepth | null;
  microstructure: ITargetVsActualMicrostructure[];
  visualDimensional: ITargetVsActualVisualDimensional[];
  pyrometry?: ITargetVsActualPyrometry | null;

  // Overall Conformance
  overallCompliance: {
    isConforming: boolean;
    disposition: 'CONFORMING' | 'CONCESSION' | 'NON_CONFORMING';
    concessionReference?: string | null;
    summaryStatement: string;
  };

  // Applicable Standards & Statements
  applicableStandards: string[];
  certificationStatement: string;
  remarks?: string | null;

  // Security & Verification
  securityVerificationCode: string;
  tamperProofChecksum: string;
  verificationUrl: string;

  // Signoff & Revocation
  certifiedBy: IDocumentSignoff;
  revocation?: IDocumentRevocation | null;

  // Printable HTML Representation
  printableHtmlTemplate?: string;

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type QualityDocumentDocument = IQualityDocument & Document;

// --- DTOs ---

export interface GenerateQualityDocumentDto {
  inspectionId: string;
  reportType: ReportType;
  purchaseOrderNumber?: string;
  partNumber?: string;
  drawingNumber?: string;
  drawingRevision?: string;
  customRemarks?: string;
  additionalStandards?: string[];
}

export interface RevokeQualityDocumentDto {
  reason: string;
}

export interface ReissueQualityDocumentDto {
  changeDescription: string;
  purchaseOrderNumber?: string;
  partNumber?: string;
  drawingNumber?: string;
  drawingRevision?: string;
  customRemarks?: string;
}

export interface QueryQualityDocumentsDto {
  reportType?: ReportType;
  status?: DocumentStatus;
  jobId?: string;
  inspectionId?: string;
  customerCode?: string;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
