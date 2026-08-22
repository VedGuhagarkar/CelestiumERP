import { Document } from 'mongoose';

export type HardnessScale = 'HRC' | 'HRB' | 'HRA' | 'HV' | 'HBW' | 'HK';

export type MicrohardnessLoad =
  | 'HV0.01'
  | 'HV0.025'
  | 'HV0.05'
  | 'HV0.1'
  | 'HV0.2'
  | 'HV0.3'
  | 'HV0.5'
  | 'HV1'
  | 'HV2'
  | 'HV3'
  | 'HV5'
  | 'HV10'
  | 'HV30'
  | 'HK0.1'
  | 'HK0.3'
  | 'HK0.5'
  | 'HK1';

export type BrinellBallLoad =
  | 'HBW_10_3000'
  | 'HBW_5_750'
  | 'HBW_2.5_187.5'
  | 'HBW_1_30';

export type SpecimenLocation =
  | 'SURFACE'
  | 'CORE'
  | 'PITCH_LINE'
  | 'ROOT'
  | 'CASE'
  | 'TRANSITION'
  | 'CROSS_SECTION';

export type DecarbType = 'COMPLETE' | 'PARTIAL' | 'TOTAL' | 'NONE';

export type CarbideRating =
  | 'TYPE_A_FINE'
  | 'TYPE_B_MEDIUM'
  | 'TYPE_C_COARSE'
  | 'CONTINUOUS_NETWORK'
  | 'DISPERSED_SPHEROIDAL'
  | 'INTERGRANULAR';

export type LabRecordStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

export interface IHardnessMeasurement {
  measurementId: string;
  sampleTag: string;
  location: SpecimenLocation;
  scale: HardnessScale;
  readings: number[];
  averageValue: number;
  testEquipmentCode?: string | null;
  calibrationDueDate?: Date | null;
  targetMin?: number | null;
  targetMax?: number | null;
  passed?: boolean | null;
  measuredBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
  notes?: string | null;
}

export interface IHardnessTraversePoint {
  depthMm: number;
  measuredHardness: number;
  scale: HardnessScale;
  load?: MicrohardnessLoad | null;
  xCoordMicrons?: number | null;
  yCoordMicrons?: number | null;
}

export interface IHardnessTraverse {
  traverseId: string;
  sampleTag: string;
  location: SpecimenLocation;
  scale: HardnessScale;
  load?: MicrohardnessLoad | null;
  cutoffHardness: number;
  points: IHardnessTraversePoint[];
  calculatedEffectiveCaseDepthMm: number;
  calculatedTotalCaseDepthMm?: number | null;
  coreHardnessBaseline?: number | null;
  targetCaseDepthMinMm?: number | null;
  targetCaseDepthMaxMm?: number | null;
  passed?: boolean | null;
  testEquipmentCode?: string | null;
  measuredBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
  notes?: string | null;
}

export interface IMicrostructureObservation {
  observationId: string;
  sampleTag: string;
  location: SpecimenLocation;
  magnification: number;
  matrixStructure: string;
  retainedAustenite?: {
    measuredPercent: number;
    testMethod: 'XRD' | 'OPTICAL_METALLOGRAPHY' | 'MAGNETIC';
    acceptableMaxPercent?: number | null;
    passed?: boolean | null;
  } | null;
  grainSize?: {
    astmNumber: number;
    method: 'COMPARISON' | 'PLANIMETRIC' | 'INTERCEPT';
    targetMin?: number | null;
    targetMax?: number | null;
    passed?: boolean | null;
  } | null;
  decarburization?: {
    type: DecarbType;
    completeDecarbDepthMm?: number | null;
    partialDecarbDepthMm?: number | null;
    totalDecarbDepthMm: number;
    maxAllowedDepthMm?: number | null;
    passed?: boolean | null;
  } | null;
  carbideMorphology?: {
    rating: CarbideRating;
    networkPresent: boolean;
    grainBoundaryPrecipitation: boolean;
    description?: string | null;
    passed?: boolean | null;
  } | null;
  inclusionsAstmE45?: {
    typeA_Sulfides?: { thin: number; heavy: number } | null;
    typeB_Aluminates?: { thin: number; heavy: number } | null;
    typeC_Silicates?: { thin: number; heavy: number } | null;
    typeD_Oxides?: { thin: number; heavy: number } | null;
  } | null;
  micrographPhotoUrls?: string[];
  observedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
  notes?: string | null;
}

export interface ILabRecordAuditHistory {
  action: 'CREATE' | 'ADD_HARDNESS' | 'ADD_TRAVERSE' | 'ADD_MICRO' | 'LOCK' | 'UPDATE';
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
  details?: string | null;
}

export interface ILaboratoryTestRecord {
  id: string;
  tenantId: string;
  recordNumber: string;
  inspectionId: string;
  inspectionNumber: string;
  jobId: string;
  jobNumber: string;
  heatLotNumber?: string | null;
  materialGrade?: string | null;
  status: LabRecordStatus;
  hardnessMeasurements: IHardnessMeasurement[];
  hardnessTraverses: IHardnessTraverse[];
  microstructureObservations: IMicrostructureObservation[];
  lockedAt?: Date | null;
  lockedBy?: {
    userId: string;
    email?: string;
    role?: string;
  } | null;
  lockReason?: string | null;
  revision: number;
  auditHistory: ILabRecordAuditHistory[];
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LaboratoryTestRecordDocument = Document & ILaboratoryTestRecord;

// --- DTOs ---

export interface CreateLabTestRecordDto {
  inspectionId: string;
  heatLotNumber?: string;
  notes?: string;
}

export interface AddHardnessMeasurementDto {
  sampleTag: string;
  location: SpecimenLocation;
  scale: HardnessScale;
  readings: number[];
  testEquipmentCode?: string;
  calibrationDueDate?: string;
  targetMin?: number;
  targetMax?: number;
  notes?: string;
}

export interface AddHardnessTraverseDto {
  sampleTag: string;
  location: SpecimenLocation;
  scale: HardnessScale;
  load?: MicrohardnessLoad;
  cutoffHardness: number;
  points: Array<{
    depthMm: number;
    measuredHardness: number;
    scale?: HardnessScale;
    load?: MicrohardnessLoad;
    xCoordMicrons?: number;
    yCoordMicrons?: number;
  }>;
  coreHardnessBaseline?: number;
  targetCaseDepthMinMm?: number;
  targetCaseDepthMaxMm?: number;
  testEquipmentCode?: string;
  notes?: string;
}

export interface AddMicrostructureObservationDto {
  sampleTag: string;
  location: SpecimenLocation;
  magnification: number;
  matrixStructure: string;
  retainedAustenite?: {
    measuredPercent: number;
    testMethod: 'XRD' | 'OPTICAL_METALLOGRAPHY' | 'MAGNETIC';
    acceptableMaxPercent?: number;
  };
  grainSize?: {
    astmNumber: number;
    method: 'COMPARISON' | 'PLANIMETRIC' | 'INTERCEPT';
    targetMin?: number;
    targetMax?: number;
  };
  decarburization?: {
    type: DecarbType;
    completeDecarbDepthMm?: number;
    partialDecarbDepthMm?: number;
    totalDecarbDepthMm: number;
    maxAllowedDepthMm?: number;
  };
  carbideMorphology?: {
    rating: CarbideRating;
    networkPresent: boolean;
    grainBoundaryPrecipitation: boolean;
    description?: string;
  };
  inclusionsAstmE45?: {
    typeA_Sulfides?: { thin: number; heavy: number };
    typeB_Aluminates?: { thin: number; heavy: number };
    typeC_Silicates?: { thin: number; heavy: number };
    typeD_Oxides?: { thin: number; heavy: number };
  };
  micrographPhotoUrls?: string[];
  notes?: string;
}

export interface LockLabTestRecordDto {
  lockReason: string;
}

export interface QueryLabTestRecordsDto {
  inspectionId?: string;
  inspectionNumber?: string;
  jobId?: string;
  jobNumber?: string;
  heatLotNumber?: string;
  status?: LabRecordStatus;
  search?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
