import { Schema, model } from 'mongoose';
import {
  PreventiveMaintenancePlanDocument,
  MaintenanceWorkOrderDocument
} from './maintenance.types.js';

const ChecklistTaskSchema = new Schema(
  {
    stepNumber: { type: Number, required: true },
    taskDescription: { type: String, required: true },
    isMandatory: { type: Boolean, default: true },
    requirementType: {
      type: String,
      enum: ['PASS_FAIL', 'NUMERIC_READING', 'VISUAL_INSPECTION'],
      required: true
    },
    targetValue: { type: String, default: null }
  },
  { _id: false }
);

const ChecklistExecutionSchema = new Schema(
  {
    stepNumber: { type: Number, required: true },
    taskDescription: { type: String, required: true },
    status: {
      type: String,
      enum: ['PASSED', 'FAILED', 'COMPLETED'],
      required: true
    },
    measuredValue: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const ReplacedPartSchema = new Schema(
  {
    partNumber: { type: String, required: true },
    partDescription: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitOfMeasure: { type: String, required: true },
    serialNumbers: [{ type: String }],
    unitCost: { type: Number, default: null }
  },
  { _id: false }
);

const LaborRecordSchema = new Schema(
  {
    technicianId: { type: String, required: true },
    technicianName: { type: String, required: true },
    hoursSpent: { type: Number, required: true, min: 0.1 },
    date: { type: Date, default: Date.now },
    hourlyRate: { type: Number, default: null }
  },
  { _id: false }
);

// --- Preventive Maintenance Plan Schema ---

const PreventiveMaintenancePlanSchema = new Schema<PreventiveMaintenancePlanDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    planCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    machineId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    triggerType: {
      type: String,
      enum: ['CALENDAR', 'RUNTIME_HOURS', 'HYBRID'],
      required: true
    },
    frequency: {
      type: String,
      enum: [
        'DAILY',
        'WEEKLY',
        'MONTHLY',
        'QUARTERLY',
        'SEMI_ANNUAL',
        'ANNUAL',
        'RUNTIME_INTERVAL'
      ],
      required: true
    },
    calendarIntervalDays: { type: Number, default: null },
    lastCompletedDate: { type: Date, default: null },
    nextDueDate: { type: Date, default: null, index: true },
    runtimeIntervalHours: { type: Number, default: null },
    lastServiceRuntimeHours: { type: Number, default: null },
    currentRuntimeHours: { type: Number, default: null },
    nextDueRuntimeHours: { type: Number, default: null },
    estimatedDurationHours: { type: Number, required: true, min: 0.1 },
    checklistTasks: [ChecklistTaskSchema],
    isActive: { type: Boolean, default: true, index: true },
    isOverdue: { type: Boolean, default: false, index: true },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

PreventiveMaintenancePlanSchema.index({ tenantId: 1, planCode: 1 }, { unique: true });
PreventiveMaintenancePlanSchema.index({ tenantId: 1, machineId: 1, isActive: 1 });

export const PreventiveMaintenancePlanModel = model<PreventiveMaintenancePlanDocument>(
  'PreventiveMaintenancePlan',
  PreventiveMaintenancePlanSchema
);

// --- Maintenance Work Order Schema ---

const MaintenanceWorkOrderSchema = new Schema<MaintenanceWorkOrderDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    workOrderNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    machineId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    workOrderType: {
      type: String,
      enum: ['PREVENTIVE', 'BREAKDOWN', 'CALIBRATION', 'EMERGENCY_REPAIR', 'OVERHAUL'],
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'PENDING_PARTS', 'COMPLETED', 'CANCELLED'],
      default: 'OPEN',
      index: true
    },

    preventivePlanId: { type: String, default: null },
    preventivePlanCode: { type: String, default: null },

    breakdownReportedAt: { type: Date, default: null },
    breakdownReportedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    failureSymptom: {
      type: String,
      enum: [
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
      ],
      default: null
    },
    failureDescription: { type: String, default: null },
    productionInterrupted: { type: Boolean, default: false },
    affectedJobId: { type: String, default: null },
    affectedJobNumber: { type: String, default: null },
    rootCause: { type: String, default: null },
    rootCauseCategory: {
      type: String,
      enum: [
        'THERMAL_FATIGUE',
        'MECHANICAL_WEAR',
        'ELECTRICAL_FAILURE',
        'SENSOR_DRIFT',
        'OPERATOR_ERROR',
        'CONTAMINATION',
        'REFRACTORY_DEGRADATION',
        'UNKNOWN'
      ],
      default: null
    },

    assignedTechnicians: [
      {
        technicianId: { type: String, required: true },
        name: { type: String, required: true },
        role: { type: String, required: true }
      }
    ],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    downtimeDurationMinutes: { type: Number, default: null },
    repairActionsTaken: { type: String, default: null },
    checklistExecutions: [ChecklistExecutionSchema],
    partsReplaced: [ReplacedPartSchema],
    laborRecords: [LaborRecordSchema],
    totalLaborHours: { type: Number, default: 0 },

    testingResolutionState: {
      type: String,
      enum: ['CALIBRATING', 'MAINTENANCE', 'IDLE'],
      default: null
    },
    postMaintenanceVerifiedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      verifiedAt: { type: Date },
      notes: { type: String }
    },

    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

MaintenanceWorkOrderSchema.index({ tenantId: 1, workOrderNumber: 1 }, { unique: true });
MaintenanceWorkOrderSchema.index({ tenantId: 1, machineId: 1, status: 1 });
MaintenanceWorkOrderSchema.index({ tenantId: 1, workOrderType: 1 });

export const MaintenanceWorkOrderModel = model<MaintenanceWorkOrderDocument>(
  'MaintenanceWorkOrder',
  MaintenanceWorkOrderSchema
);
