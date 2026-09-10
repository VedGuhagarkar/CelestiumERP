import { Document } from 'mongoose';
import { RecipeStage, MetallurgicalTargets, MachineRequirements } from '../recipe/recipe.types.js';
import {
  HardnessRequirement,
  CaseDepthRequirement,
  MicrostructuralCriteria,
  CustomerAcceptanceCriteria
} from '../specification/specification.types.js';

export type JobStatus =
  | 'WAITING_FOR_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'WAITING_FOR_INSPECTION'
  | 'IN_INSPECTION'
  | 'WAITING_FOR_DISPATCH'
  | 'INSPECTION'
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

export type ResourceAssignmentAction = 'ASSIGN' | 'REALLOCATE' | 'REMOVE';
export type ResourceType = 'OPERATOR' | 'FURNACE';

export type ProcessRowStatus = 'BLANK' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';

export interface IProcessDetailRow {
  serialNumber: number; // Strictly sequential 1 to 15
  partId?: string | null;
  partCode?: string | null;
  partName?: string | null;
  process?: string | null;
  recipeId?: string | null;
  recipeCode?: string | null;
  minhardness?: number | null;
  maxhardness?: number | null;
  userId?: string | null;
  userName?: string | null;
  status: ProcessRowStatus;
  notes?: string | null;
}

export type StageProgressType = 'PREHEAT' | 'SOAK' | 'QUENCH' | 'TEMPER' | 'OTHER';

export type DowntimeCategory =
  | 'MECHANICAL_FAILURE'
  | 'ELECTRICAL_FAILURE'
  | 'ATMOSPHERE_LOSS'
  | 'POWER_OUTAGE'
  | 'OPERATOR_BREAK'
  | 'PLANNED_STOP'
  | 'UNPLANNED_STOP'
  | 'PROCESS_ABORT'
  | 'OTHER';

export type ProductionLogType =
  | 'SHIFT_HANDOVER'
  | 'OPERATOR_NOTE'
  | 'PYROMETRY_READING'
  | 'ATMOSPHERE_ADJUSTMENT'
  | 'ANOMALY_REPORT';

export const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  AOG_CRITICAL: 1,
  URGENT: 2,
  HIGH: 3,
  NORMAL: 4,
  LOW: 5
};

export const ALLOWED_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  WAITING_FOR_PRODUCTION: ['IN_PRODUCTION', 'IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  IN_PRODUCTION: ['WAITING_FOR_INSPECTION', 'PAUSED', 'QUALITY_CHECK', 'IN_PROGRESS', 'CANCELLED'],
  WAITING_FOR_INSPECTION: ['IN_INSPECTION', 'QUALITY_CHECK', 'CANCELLED'],
  IN_INSPECTION: ['WAITING_FOR_DISPATCH', 'INSPECTION', 'CANCELLED'],
  WAITING_FOR_DISPATCH: ['DISPATCHED', 'READY_FOR_DISPATCH', 'CANCELLED'],
  INSPECTION: ['CANCELLED'],
  DRAFT: ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'IN_PROGRESS', 'IN_PRODUCTION', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'IN_PRODUCTION', 'APPROVED', 'CANCELLED'],
  IN_PROGRESS: ['PAUSED', 'QUALITY_CHECK', 'WAITING_FOR_INSPECTION', 'CANCELLED'],
  PAUSED: ['IN_PROGRESS', 'IN_PRODUCTION', 'CANCELLED'],
  QUALITY_CHECK: ['STORAGE', 'IN_PROGRESS', 'WAITING_FOR_INSPECTION', 'CANCELLED'],
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

export interface IJobResourceAssignmentHistory {
  resourceType: ResourceType;
  action: ResourceAssignmentAction;
  previousResourceId?: string | null;
  previousResourceCode?: string | null;
  newResourceId?: string | null;
  newResourceCode?: string | null;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
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

export interface IFurnaceCharge {
  chargeNumber: string;
  loadedWeightKg: number;
  loadedPieceCount: number;
  loadedPieces?: number;
  furnaceId?: string | null;
  furnaceCode?: string | null;
  operatorId?: string | null;
  shift?: string | null;
  notes?: string | null;
  atmosphereType?: string | null;
  fixtureId?: string | null;
  initialFurnaceTempC: number;
  initialAtmosphereLevel?: number | null;
  thermocoupleLocations?: string[];
  startedAt: Date;
  startedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
}

export interface IJobCycleTimer {
  cycleStartTime: Date;
  cycleEndTime?: Date | null;
  totalRunDurationMinutes: number;
  totalDowntimeDurationMinutes: number;
}

export interface IJobStageProgress {
  stageSequence: number;
  stageName: string;
  stageType: StageProgressType;
  targetTemperatureC: number;
  actualTemperatureC: number;
  targetDurationMinutes: number;
  actualDurationMinutes: number;
  temperatureDeviationC?: number;
  durationDeviationMinutes?: number;
  isCompliant?: boolean;
  deviationWarning?: string | null;
  quenchMedium?: string | null;
  quenchAgitationSpeedRpm?: number | null;
  quenchMediaInitialTempC?: number | null;
  quenchMediaFinalTempC?: number | null;
  quenchParameters?: {
    mediumTemperatureC?: number;
    quenchDurationSeconds?: number;
    agitationSpeedPercent?: number;
    mediaInitialTempC?: number;
  } | null;
  atmosphereLevel?: string | null;
  atmosphereDetails?: {
    carbonPotential?: number;
    nitrogenFlow?: number;
    vacuumPressureMbar?: number;
  } | null;
  operatorNotes?: string | null;
  notes?: string | null;
  loggedAt?: Date;
  loggedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  recordedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp?: Date;
}

export interface IJobDowntimeLog {
  downtimeId: string;
  category: DowntimeCategory;
  reason: string;
  startTime: Date;
  endTime?: Date | null;
  durationMinutes?: number | null;
  impactOnCycle?: string | null;
  actionTaken?: string | null;
  loggedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  notes?: string | null;
}

export interface IJobProductionLog {
  logId: string;
  type: ProductionLogType;
  shift?: string | null;
  message: string;
  recordedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
}

export interface IJobQualityHandoff {
  inspectionRequestId: string;
  status: 'PENDING_INSPECTION' | 'INSPECTING' | 'APPROVED' | 'REJECTED';
  requestedAt: Date;
  pyrometryArchiveId: string;
  completedQuantity: number;
  scrappedQuantity: number;
  notes?: string | null;
}

export interface IJobStoragePlacement {
  warehouseId: string;
  locationBay: string;
  palletId?: string | null;
  placedAt: Date;
  placedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  notes?: string | null;
}

export interface IHardnessTestPoint {
  pointIdentifier: string;
  location?: 'SURFACE' | 'CORE' | 'CASE' | 'TRANSITION';
  measuredValue: number;
  scale: 'HRC' | 'HRB' | 'HV' | 'HBW';
  passed: boolean;
}

export interface IInspectionEquipment {
  furnaceId: string;
  furnaceCode: string;
  equipmentNotes?: string | null;
}

export interface IHardnessSpecification {
  minHardness: number;
  maxHardness: number;
  scale: 'HRC' | 'HRB' | 'HV' | 'HBW' | string;
}

export interface IActualHardness {
  measuredAverage: number;
  scale: 'HRC' | 'HRB' | 'HV' | 'HBW' | string;
  isCompliant: boolean;
  testPoints?: IHardnessTestPoint[];
}

export interface IInspectionCaseDepth {
  effectiveCaseDepthMm: number;
  targetMinMm?: number | null;
  targetMaxMm?: number | null;
  isCompliant: boolean;
  method?: string | null;
}

export interface IInspectionQuantities {
  quantityReceived: number;
  quantityDelivered: number;
  quantityRejected: number;
}

export interface IHeatTreatmentInspectionData {
  // 1. Furnace / Equipment
  furnaceId: string;
  furnaceCode: string;
  equipmentNotes?: string | null;
  equipment?: IInspectionEquipment;

  // 2. Hardness Specification (Required Planned Limits)
  minHardness?: number;
  maxHardness?: number;
  scale?: string;
  specificationNotes?: string | null;
  hardnessSpecification?: IHardnessSpecification;

  // 3. Actual Hardness (Measured Results)
  measuredAverage?: number;
  testPoints?: IHardnessTestPoint[];
  isHardnessCompliant?: boolean;
  actualHardness?: IActualHardness;

  // 4. Case Depth (Actual and Target Limits)
  effectiveCaseDepthMm?: number;
  targetCaseDepthMinMm?: number | null;
  targetCaseDepthMaxMm?: number | null;
  isCaseDepthCompliant?: boolean;
  caseDepthMethod?: string | null;
  caseDepth?: IInspectionCaseDepth;

  // 5 & 6. Quantities (Received, Delivered, and Rejected)
  quantityReceived: number;
  quantityDelivered: number;
  quantityRejected?: number;
  quantities?: IInspectionQuantities;

  // Quality sign-off metadata
  visualInspection?: {
    surfaceOxidationAcceptable: boolean;
    quenchCracksPresent: boolean;
    dimensionsWithinTolerance: boolean;
    passed: boolean;
  };
  microstructure?: {
    observedStructure: string;
    grainSizeAstm?: number;
    passed: boolean;
  };
  inspectorId?: string;
  inspectorName?: string;
  inspectedAt?: Date;
  inspectedBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  inspectorNotes?: string | null;
  disposition?: 'CONFORMING' | 'NON_CONFORMING' | 'APPROVED' | 'REJECTED' | 'PENDING' | string;
  failureReason?: string | null;
  defectCategory?: string | null;
  defectReason?: string | null;
  correctiveAction?: string | null;
  notes?: string | null;
  remarks?: string | null;
}

export interface IJobExecution {
  furnaceCharge?: IFurnaceCharge | null;
  cycleTimer?: IJobCycleTimer | null;
  stageProgress: IJobStageProgress[];
  downtimeLog: IJobDowntimeLog[];
  productionLogs: IJobProductionLog[];
  qualityHandoff?: IJobQualityHandoff | null;
  storagePlacement?: IJobStoragePlacement | null;
  inspectionData?: IHeatTreatmentInspectionData | null;
}

export interface IBatchOrderGenealogy {
  whichPo: {
    poId: string;
    poNumber: string;
    supplierName: string;
    supplierCode?: string;
    orderDate?: Date;
  };
  whichGrn: {
    grnId: string;
    grnNumber: string;
    supplierName: string;
    supplierCode?: string;
    receivedDate?: Date;
  };
  whichPart: {
    itemId: string;
    itemCode: string;
    itemName: string;
    materialGrade: string;
    uom: string;
  };
  whichRecipe: {
    recipeId: string;
    recipeCode: string;
    recipeName: string;
    revisionNumber: number;
    processFamily: string;
  };
  lockedAt: Date;
  lockedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  isImmutable: boolean;
}

export interface IBatchOrderWorkflowState {
  waitingForProduction: boolean;
  inProduction: boolean;
  waitingForInspection: boolean;
  inInspection: boolean;
  waitingForDispatch: boolean;
  dispatched: boolean;
  inspection: boolean;
  completed?: boolean;
}

export interface IProductionJob {
  jobNumber: string;
  tenantId: string;
  poId?: string | null;
  poNumber?: string | null;
  grnId?: string | null;
  grnNumber?: string | null;
  boNumber?: string | null;
  batchOrderNumber?: string | null;
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
  weightKg?: number;
  weight?: number;
  dueDate?: Date | null;
  status: JobStatus;
  waitingForProduction?: boolean;
  inProduction?: boolean;
  waitingForInspection?: boolean;
  inInspection?: boolean;
  waitingForDispatch?: boolean;
  dispatched?: boolean;
  inspection?: boolean;
  workflowState?: IBatchOrderWorkflowState;
  claimedBy?: string | null;
  claimedAt?: Date | null;
  claimedByEmail?: string | null;
  claimedByRole?: string | null;
  priority: JobPriority;
  recipeSnapshot: IJobRecipeSnapshot;
  specificationSnapshot: IJobSpecificationSnapshot;
  materialAllocations: IJobMaterialAllocation[];
  equipmentAssignment: IJobEquipmentAssignment;
  operatorAssignment: IJobOperatorAssignment;
  assignedFurnaceId?: string | null;
  assignedFurnaceCode?: string | null;
  assignedOperatorId?: string | null;
  furnaceId?: string | null;
  timeline: {
    plannedStartDate: Date;
    targetCompletionDate: Date;
    actualStartDate?: Date | null;
    actualCompletionDate?: Date | null;
    dueDate?: Date | null;
  };
  execution?: IJobExecution;
  processDetails: IProcessDetailRow[];
  genealogy?: IBatchOrderGenealogy | null;
  transitionHistory: IJobStateTransition[];
  assignmentHistory: IJobResourceAssignmentHistory[];
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

export interface CreateBatchOrderDto {
  poId: string;
  grnId: string;
  itemId: string;
  recipeId?: string;
  specificationId?: string;
  targetQuantity?: number;
  quantity?: number;
  weight?: number;
  weightKg?: number;
  dueDate?: string | Date;
  priority?: JobPriority;
  plannedStartDate?: string | Date;
  targetCompletionDate?: string | Date;
  assignedFurnaceId?: string;
  assignedOperatorId?: string;
  shift?: string;
  notes?: string;
  idempotencyKey?: string;
  processDetails?: Partial<IProcessDetailRow>[];
  customer?: {
    customerId?: string;
    customerCode?: string;
    customerName?: string;
  };
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  materialGrade?: string;
  waitingForProduction?: boolean;
  inProduction?: boolean;
  waitingForInspection?: boolean;
  inInspection?: boolean;
  waitingForDispatch?: boolean;
  dispatched?: boolean;
  inspection?: boolean;
  workflowState?: Partial<IBatchOrderWorkflowState>;
  status?: JobStatus;
}

export interface UpdateProcessDetailsDto {
  processDetails: Partial<IProcessDetailRow>[];
}

export interface CreateDirectJobDto {
  customerId?: string;
  itemId: string;
  recipeId?: string;
  specificationId?: string;
  targetQuantity: number;
  poId?: string;
  grnId?: string;
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

export interface AssignOperatorDto {
  operatorId: string;
  shift?: string;
  reason?: string;
  notes?: string;
}

export interface RemoveOperatorDto {
  reason: string;
  notes?: string;
}

export interface AssignFurnaceDto {
  furnaceId: string;
  reason?: string;
  notes?: string;
}

export interface RemoveFurnaceDto {
  reason: string;
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

export interface StartJobExecutionDto {
  chargeNumber: string;
  loadedWeightKg: number;
  loadedPieceCount: number;
  fixtureId?: string;
  initialFurnaceTempC: number;
  initialAtmosphereLevel?: number;
  thermocoupleLocations?: string[];
  furnaceId?: string;
  operatorId?: string;
  shift?: string;
  notes?: string;
}

export interface RecordStageProgressDto {
  stageSequence: number;
  stageName: string;
  stageType: StageProgressType;
  targetTemperatureC: number;
  actualTemperatureC: number;
  targetDurationMinutes: number;
  actualDurationMinutes: number;
  quenchMedium?: string;
  quenchAgitationSpeedRpm?: number;
  quenchMediaInitialTempC?: number;
  quenchMediaFinalTempC?: number;
  atmosphereDetails?: {
    carbonPotential?: number;
    nitrogenFlow?: number;
    vacuumPressureMbar?: number;
  };
  notes?: string;
}

export interface PauseJobExecutionDto {
  category: DowntimeCategory;
  reason: string;
  impactOnCycle?: string;
  notes?: string;
}

export interface ResumeJobExecutionDto {
  actionTaken: string;
  notes?: string;
}

export interface AddProductionLogDto {
  type: ProductionLogType;
  shift?: string;
  message: string;
}

export interface CompleteJobExecutionDto {
  completedQuantity: number;
  scrappedQuantity?: number;
  operatorNotes?: string;
}

export interface TakeForProductionDto {
  furnaceId?: string;
  assignedFurnaceId?: string;
  operatorId?: string;
  assignedOperatorId?: string;
  shift?: string;
  chargeNumber?: string;
  loadedWeightKg?: number;
  loadedPieceCount?: number;
  fixtureId?: string;
  initialFurnaceTempC?: number;
  initialAtmosphereLevel?: number;
  thermocoupleLocations?: string[];
  notes?: string;
}

export interface RecordRecipeStageProgressDto {
  stageSequence: number;
  stageName?: string;
  actualTemperatureC: number;
  actualDurationMinutes: number;
  quenchMedium?: string;
  quenchAgitationSpeedRpm?: number;
  quenchMediaInitialTempC?: number;
  quenchMediaFinalTempC?: number;
  quenchParameters?: {
    mediumTemperatureC?: number;
    quenchDurationSeconds?: number;
    agitationSpeedPercent?: number;
  };
  atmosphereLevel?: string;
  atmosphereDetails?: {
    carbonPotential?: number;
    nitrogenFlow?: number;
    vacuumPressureMbar?: number;
  };
  operatorNotes?: string;
  notes?: string;
}

export interface RecordFurnaceChargeDto {
  furnaceId?: string;
  chargeNumber: string;
  loadedWeightKg: number;
  loadedPieceCount: number;
  fixtureId?: string | null;
  initialFurnaceTempC: number;
  initialAtmosphereLevel?: number | null;
  thermocoupleLocations?: string[];
  shift?: string | null;
  notes?: string | null;
}

export interface SaveProductionDataDto {
  furnaceCharge?: RecordFurnaceChargeDto;
  stageProgress?: RecordRecipeStageProgressDto;
  operatorNotes?: string | null;
  notes?: string | null;
}

export interface ApproveForInspectionDto {
  completedQuantity?: number;
  scrappedQuantity?: number;
  notes?: string;
  operatorNotes?: string;
  concessionApproved?: boolean;
  concessionReason?: string;
}

export interface IProductionExecutionReadiness {
  isReadyForInspection: boolean;
  jobId: string;
  jobNumber: string;
  boNumber?: string;
  status: string;
  allRecipeStagesCompleted: boolean;
  totalRecipeStages: number;
  completedStagesCount: number;
  chargeRecorded: boolean;
  equipmentAssigned: boolean;
  operatorAssigned: boolean;
  cycleTimerRecorded: boolean;
  pieceCountBalanced: boolean;
  loadedPieceCount: number;
  completedQuantity: number;
  scrappedQuantity: number;
  missingRequirements: string[];
  errors: string[];
}

export interface TransitionToStorageDto {
  warehouseId: string;
  locationBay: string;
  palletId?: string;
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

export interface IBatchOrderProductionReadiness {
  isReadyForProduction: boolean;
  jobId?: string;
  boNumber?: string;
  jobNumber?: string;
  status?: string;
  hasAuthoritativePo?: boolean;
  hasAuthoritativeGrn?: boolean;
  hasCustomer?: boolean;
  hasPart?: boolean;
  hasValidQuantity?: boolean;
  hasValidWeight?: boolean;
  hasRecipe?: boolean;
  has15ProcessDetails?: boolean;
  hasValidWorkflowState?: boolean;
  missingFields: string[];
  errors: string[];
  validationErrors?: string[];
  readinessSummary: string;
}

export const PRODUCTION_ONLY_FIELDS = [
  'execution',
  'actualStartTime',
  'actualEndTime',
  'temperatureLogs',
  'furnaceCharge',
  'cycleTimer',
  'stageProgress',
  'actualSoakMinutes',
  'productionLogs',
  'downtimeLog',
  'loadedQuantity',
  'completedQuantity',
  'scrappedQuantity'
] as const;

/**
 * Single Authoritative Inspection Detector
 * Celestium ERP Inspection Phase Invariant
 */
export function isJobInInspection(job: any): boolean {
  if (!job) return false;
  return Boolean(
    job.inInspection === true ||
    job.workflowState?.inInspection === true ||
    job.status === 'IN_INSPECTION'
  );
}
