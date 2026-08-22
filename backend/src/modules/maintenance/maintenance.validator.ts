import { z } from 'zod';

export const PlanTriggerTypeEnum = z.enum(['CALENDAR', 'RUNTIME_HOURS', 'HYBRID']);

export const PlanFrequencyEnum = z.enum([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUAL',
  'RUNTIME_INTERVAL'
]);

export const TaskRequirementTypeEnum = z.enum([
  'PASS_FAIL',
  'NUMERIC_READING',
  'VISUAL_INSPECTION'
]);

export const MaintenanceTypeEnum = z.enum([
  'PREVENTIVE',
  'BREAKDOWN',
  'CALIBRATION',
  'EMERGENCY_REPAIR',
  'OVERHAUL'
]);

export const WorkOrderPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const WorkOrderStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'PENDING_PARTS',
  'COMPLETED',
  'CANCELLED'
]);

export const FailureSymptomEnum = z.enum([
  'HEATER_CIRCUIT_TRIP',
  'VACUUM_LEAK',
  'OIL_AGITATOR_FAILURE',
  'THERMOCOUPLE_DRIFT',
  'DOOR_SEAL_BLOWOUT',
  'PLC_COMM_FAULT',
  'HYDRAULIC_LEAK',
  'GAS_PRESSURE_DROP',
  'TEMPERATURE_OVERSHOOT',
  'QUENCH_ELEVATOR_JAM',
  'OTHER'
]);

export const RootCauseCategoryEnum = z.enum([
  'THERMAL_FATIGUE',
  'MECHANICAL_WEAR',
  'ELECTRICAL_FAILURE',
  'SENSOR_DRIFT',
  'OPERATOR_ERROR',
  'CONTAMINATION',
  'REFRACTORY_DEGRADATION',
  'UNKNOWN'
]);

const checklistTaskSchema = z.object({
  stepNumber: z.number().int().min(1),
  taskDescription: z.string().min(2).max(300).trim(),
  isMandatory: z.boolean().default(true),
  requirementType: TaskRequirementTypeEnum,
  targetValue: z.string().max(100).optional()
});

const checklistExecutionSchema = z.object({
  stepNumber: z.number().int().min(1),
  taskDescription: z.string().min(2).max(300).trim(),
  status: z.enum(['PASSED', 'FAILED', 'COMPLETED']),
  measuredValue: z.string().max(100).optional(),
  notes: z.string().max(300).optional()
});

const replacedPartSchema = z.object({
  partNumber: z.string().min(1).max(100).trim(),
  partDescription: z.string().min(1).max(200).trim(),
  quantity: z.number().min(1),
  unitOfMeasure: z.string().min(1).max(20).trim(),
  serialNumbers: z.array(z.string()).optional(),
  unitCost: z.number().min(0).optional()
});

const laborRecordSchema = z.object({
  technicianId: z.string().min(1).max(100).trim(),
  technicianName: z.string().min(1).max(100).trim(),
  hoursSpent: z.number().min(0.1),
  date: z.string().or(z.date()).optional(),
  hourlyRate: z.number().min(0).optional()
});

export const createPreventivePlanSchema = z.object({
  planCode: z.string().min(2).max(50).trim(),
  name: z.string().min(2).max(100).trim(),
  machineId: z.string().min(1, 'Machine ID is required'),
  triggerType: PlanTriggerTypeEnum,
  frequency: PlanFrequencyEnum,
  calendarIntervalDays: z.number().int().min(1).optional(),
  nextDueDate: z.string().or(z.date()).optional(),
  runtimeIntervalHours: z.number().min(1).optional(),
  currentRuntimeHours: z.number().min(0).optional(),
  estimatedDurationHours: z.number().min(0.1),
  checklistTasks: z.array(checklistTaskSchema).min(1, 'At least one checklist task is required'),
  notes: z.string().max(1000).optional()
});

export const updatePreventivePlanSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  calendarIntervalDays: z.number().int().min(1).optional(),
  nextDueDate: z.string().or(z.date()).optional(),
  runtimeIntervalHours: z.number().min(1).optional(),
  estimatedDurationHours: z.number().min(0.1).optional(),
  checklistTasks: z.array(checklistTaskSchema).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional()
});

export const reportBreakdownSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  failureSymptom: FailureSymptomEnum,
  failureDescription: z.string().min(5, 'Failure description is required').max(1000).trim(),
  priority: WorkOrderPriorityEnum.optional(),
  productionInterrupted: z.boolean().optional(),
  affectedJobId: z.string().optional(),
  affectedJobNumber: z.string().optional()
});

export const createWorkOrderSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  workOrderType: MaintenanceTypeEnum,
  priority: WorkOrderPriorityEnum.default('MEDIUM'),
  preventivePlanId: z.string().optional(),
  failureDescription: z.string().max(1000).optional(),
  assignedTechnicians: z
    .array(
      z.object({
        technicianId: z.string().min(1),
        name: z.string().min(1),
        role: z.string().min(1)
      })
    )
    .optional(),
  checklistExecutions: z.array(checklistExecutionSchema).optional(),
  notes: z.string().max(1000).optional()
});

export const resolveBreakdownSchema = z.object({
  rootCause: z.string().min(5, 'Root cause description is required').max(1000).trim(),
  rootCauseCategory: RootCauseCategoryEnum,
  repairActionsTaken: z.string().min(5, 'Repair actions taken is required').max(1000).trim(),
  partsReplaced: z.array(replacedPartSchema).optional(),
  laborRecords: z.array(laborRecordSchema).optional(),
  checklistExecutions: z.array(checklistExecutionSchema).optional(),
  testingResolutionState: z.enum(['CALIBRATING', 'MAINTENANCE', 'IDLE']).default('IDLE'),
  verificationNotes: z.string().max(500).optional()
});

export const completeWorkOrderSchema = z.object({
  repairActionsTaken: z.string().min(3).max(1000).trim(),
  partsReplaced: z.array(replacedPartSchema).optional(),
  laborRecords: z.array(laborRecordSchema).optional(),
  checklistExecutions: z.array(checklistExecutionSchema).optional(),
  testingResolutionState: z.enum(['CALIBRATING', 'MAINTENANCE', 'IDLE']).default('IDLE'),
  verificationNotes: z.string().max(500).optional()
});

export const queryMaintenanceWorkOrdersSchema = z.object({
  machineId: z.string().optional(),
  workOrderType: MaintenanceTypeEnum.optional(),
  status: WorkOrderStatusEnum.optional(),
  priority: WorkOrderPriorityEnum.optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const queryPreventivePlansSchema = z.object({
  machineId: z.string().optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
  isOverdue: z.string().transform((v) => v === 'true').optional(),
  frequency: PlanFrequencyEnum.optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
