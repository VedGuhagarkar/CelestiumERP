import { Document } from 'mongoose';

export type PlanTriggerType = 'CALENDAR' | 'RUNTIME_HOURS' | 'HYBRID';

export type PlanFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'ANNUAL'
  | 'RUNTIME_INTERVAL';

export type TaskRequirementType = 'PASS_FAIL' | 'NUMERIC_READING' | 'VISUAL_INSPECTION';

export type MaintenanceType =
  | 'PREVENTIVE'
  | 'BREAKDOWN'
  | 'CALIBRATION'
  | 'EMERGENCY_REPAIR'
  | 'OVERHAUL';

export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type WorkOrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PENDING_PARTS'
  | 'COMPLETED'
  | 'CANCELLED';

export type FailureSymptom =
  | 'HEATER_CIRCUIT_TRIP'
  | 'VACUUM_LEAK'
  | 'OIL_AGITATOR_FAILURE'
  | 'THERMOCOUPLE_DRIFT'
  | 'DOOR_SEAL_BLOWOUT'
  | 'PLC_COMM_FAULT'
  | 'HYDRAULIC_LEAK'
  | 'GAS_PRESSURE_DROP'
  | 'TEMPERATURE_OVERSHOOT'
  | 'QUENCH_ELEVATOR_JAM'
  | 'OTHER';

export type RootCauseCategory =
  | 'THERMAL_FATIGUE'
  | 'MECHANICAL_WEAR'
  | 'ELECTRICAL_FAILURE'
  | 'SENSOR_DRIFT'
  | 'OPERATOR_ERROR'
  | 'CONTAMINATION'
  | 'REFRACTORY_DEGRADATION'
  | 'UNKNOWN';

export interface IChecklistTask {
  stepNumber: number;
  taskDescription: string;
  isMandatory: boolean;
  requirementType: TaskRequirementType;
  targetValue?: string | null;
}

export interface IChecklistExecution {
  stepNumber: number;
  taskDescription: string;
  status: 'PASSED' | 'FAILED' | 'COMPLETED';
  measuredValue?: string | null;
  notes?: string | null;
}

export interface IReplacedPart {
  partNumber: string;
  partDescription: string;
  quantity: number;
  unitOfMeasure: string;
  serialNumbers?: string[];
  unitCost?: number | null;
}

export interface ILaborRecord {
  technicianId: string;
  technicianName: string;
  hoursSpent: number;
  date: Date;
  hourlyRate?: number | null;
}

export interface IPreventiveMaintenancePlan {
  tenantId: string;
  planCode: string;
  name: string;
  machineId: string;
  machineCode: string;
  triggerType: PlanTriggerType;
  frequency: PlanFrequency;
  calendarIntervalDays?: number | null;
  lastCompletedDate?: Date | null;
  nextDueDate?: Date | null;
  runtimeIntervalHours?: number | null;
  lastServiceRuntimeHours?: number | null;
  currentRuntimeHours?: number | null;
  nextDueRuntimeHours?: number | null;
  estimatedDurationHours: number;
  checklistTasks: IChecklistTask[];
  isActive: boolean;
  isOverdue: boolean;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PreventiveMaintenancePlanDocument = IPreventiveMaintenancePlan & Document;

export interface IMaintenanceWorkOrder {
  tenantId: string;
  workOrderNumber: string;
  machineId: string;
  machineCode: string;
  workOrderType: MaintenanceType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  
  preventivePlanId?: string | null;
  preventivePlanCode?: string | null;

  // Breakdown Incident Details
  breakdownReportedAt?: Date | null;
  breakdownReportedBy?: {
    userId: string;
    email?: string;
    role?: string;
  } | null;
  failureSymptom?: FailureSymptom | null;
  failureDescription?: string | null;
  productionInterrupted?: boolean;
  affectedJobId?: string | null;
  affectedJobNumber?: string | null;
  rootCause?: string | null;
  rootCauseCategory?: RootCauseCategory | null;

  // Execution & Work Progress
  assignedTechnicians: Array<{
    technicianId: string;
    name: string;
    role: string;
  }>;
  startedAt?: Date | null;
  completedAt?: Date | null;
  downtimeDurationMinutes?: number | null;
  repairActionsTaken?: string | null;
  checklistExecutions: IChecklistExecution[];
  partsReplaced: IReplacedPart[];
  laborRecords: ILaborRecord[];
  totalLaborHours: number;
  
  // Post-maintenance & Testing
  testingResolutionState?: 'CALIBRATING' | 'MAINTENANCE' | 'IDLE' | null;
  postMaintenanceVerifiedBy?: {
    userId: string;
    email?: string;
    role?: string;
    verifiedAt: Date;
    notes?: string;
  } | null;

  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MaintenanceWorkOrderDocument = IMaintenanceWorkOrder & Document;

// --- Metrics & Summary DTOs ---

export interface MaintenanceMetrics {
  totalWorkOrders: number;
  openWorkOrders: number;
  activeBreakdowns: number;
  totalDowntimeHours: number;
  mttrHours: number; // Mean Time to Repair
  mtbfHours: number; // Mean Time Between Failures
  overduePreventivePlansCount: number;
}

// --- Request DTOs ---

export interface CreatePreventivePlanDto {
  planCode: string;
  name: string;
  machineId: string;
  triggerType: PlanTriggerType;
  frequency: PlanFrequency;
  calendarIntervalDays?: number;
  nextDueDate?: string | Date;
  runtimeIntervalHours?: number;
  currentRuntimeHours?: number;
  estimatedDurationHours: number;
  checklistTasks: IChecklistTask[];
  notes?: string;
}

export interface UpdatePreventivePlanDto {
  name?: string;
  calendarIntervalDays?: number;
  nextDueDate?: string | Date;
  runtimeIntervalHours?: number;
  estimatedDurationHours?: number;
  checklistTasks?: IChecklistTask[];
  isActive?: boolean;
  notes?: string;
}

export interface ReportBreakdownDto {
  machineId: string;
  failureSymptom: FailureSymptom;
  failureDescription: string;
  priority?: WorkOrderPriority;
  productionInterrupted?: boolean;
  affectedJobId?: string;
  affectedJobNumber?: string;
}

export interface CreateWorkOrderDto {
  machineId: string;
  workOrderType: MaintenanceType;
  priority: WorkOrderPriority;
  preventivePlanId?: string;
  failureDescription?: string;
  assignedTechnicians?: Array<{
    technicianId: string;
    name: string;
    role: string;
  }>;
  checklistExecutions?: IChecklistExecution[];
  notes?: string;
}

export interface ResolveBreakdownDto {
  rootCause: string;
  rootCauseCategory: RootCauseCategory;
  repairActionsTaken: string;
  partsReplaced?: IReplacedPart[];
  laborRecords?: ILaborRecord[];
  checklistExecutions?: IChecklistExecution[];
  testingResolutionState?: 'CALIBRATING' | 'MAINTENANCE' | 'IDLE';
  verificationNotes?: string;
}

export interface CompleteWorkOrderDto {
  repairActionsTaken: string;
  partsReplaced?: IReplacedPart[];
  laborRecords?: ILaborRecord[];
  checklistExecutions?: IChecklistExecution[];
  testingResolutionState?: 'CALIBRATING' | 'MAINTENANCE' | 'IDLE';
  verificationNotes?: string;
}

export interface QueryMaintenanceWorkOrdersDto {
  machineId?: string;
  workOrderType?: MaintenanceType;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryPreventivePlansDto {
  machineId?: string;
  isActive?: boolean;
  isOverdue?: boolean;
  frequency?: PlanFrequency;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
