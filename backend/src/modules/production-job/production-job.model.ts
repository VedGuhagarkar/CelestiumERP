import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { ProductionJobDocument } from './production-job.types.js';

const jobCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true, uppercase: true },
    customerName: { type: String, required: true }
  },
  { _id: false }
);

const jobItemSchema = new Schema(
  {
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true, uppercase: true },
    itemName: { type: String, required: true },
    materialGrade: { type: String, required: true },
    uom: { type: String, required: true }
  },
  { _id: false }
);

const jobQuantitySchema = new Schema(
  {
    targetQuantity: { type: Number, required: true, min: 0.001 },
    loadedQuantity: { type: Number, default: 0, min: 0 },
    completedQuantity: { type: Number, default: 0, min: 0 },
    scrappedQuantity: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const jobRecipeSnapshotSchema = new Schema(
  {
    recipeId: { type: String, required: true },
    recipeCode: { type: String, required: true, uppercase: true },
    revisionNumber: { type: Number, required: true },
    processFamily: { type: String, required: true },
    name: { type: String, required: true },
    applicableMaterialGrades: { type: [String], default: [] },
    stages: { type: [Schema.Types.Mixed], default: [] },
    metallurgicalTargets: { type: Schema.Types.Mixed, default: {} },
    machineRequirements: { type: Schema.Types.Mixed, default: {} },
    snapshottedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const jobSpecificationSnapshotSchema = new Schema(
  {
    specificationId: { type: String, required: true },
    specCode: { type: String, required: true, uppercase: true },
    revisionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    customerCode: { type: String, default: null },
    surfaceHardness: { type: Schema.Types.Mixed, default: {} },
    coreHardness: { type: Schema.Types.Mixed, default: null },
    caseDepth: { type: Schema.Types.Mixed, default: null },
    microstructure: { type: Schema.Types.Mixed, default: null },
    customerAcceptance: { type: Schema.Types.Mixed, default: {} },
    snapshottedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const jobMaterialAllocationSchema = new Schema(
  {
    reservationId: { type: String, default: null },
    heatLotId: { type: String, default: null },
    heatLotNumber: { type: String, default: null, uppercase: true },
    supplierHeatNumber: { type: String, default: null },
    allocatedQuantity: { type: Number, required: true, min: 0.001 },
    uom: { type: String, required: true }
  },
  { _id: false }
);

const jobEquipmentAssignmentSchema = new Schema(
  {
    furnaceId: { type: String, default: null },
    furnaceCode: { type: String, default: null, uppercase: true },
    locationBay: { type: String, default: null },
    pyrometryClass: { type: String, default: null }
  },
  { _id: false }
);

const jobOperatorAssignmentSchema = new Schema(
  {
    operatorId: { type: String, default: null },
    operatorCode: { type: String, default: null, uppercase: true },
    operatorName: { type: String, default: null },
    shift: { type: String, default: null }
  },
  { _id: false }
);

const jobTimelineSchema = new Schema(
  {
    plannedStartDate: { type: Date, required: true },
    targetCompletionDate: { type: Date, required: true },
    actualStartDate: { type: Date, default: null },
    actualCompletionDate: { type: Date, default: null },
    dueDate: { type: Date, default: null }
  },
  { _id: false }
);

const jobStateTransitionSchema = new Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    reason: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const jobResourceAssignmentHistorySchema = new Schema(
  {
    resourceType: { type: String, enum: ['OPERATOR', 'FURNACE'], required: true },
    action: { type: String, enum: ['ASSIGN', 'REALLOCATE', 'REMOVE'], required: true },
    previousResourceId: { type: String, default: null },
    previousResourceCode: { type: String, default: null },
    newResourceId: { type: String, default: null },
    newResourceCode: { type: String, default: null },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const furnaceChargeSchema = new Schema(
  {
    chargeNumber: { type: String, required: true, uppercase: true },
    loadedWeightKg: { type: Number, required: true, min: 0.1 },
    loadedPieceCount: { type: Number, required: true, min: 1 },
    fixtureId: { type: String, default: null },
    initialFurnaceTempC: { type: Number, required: true },
    initialAtmosphereLevel: { type: Number, default: null },
    thermocoupleLocations: { type: [String], default: [] },
    startedAt: { type: Date, default: Date.now },
    startedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    }
  },
  { _id: false }
);

const cycleTimerSchema = new Schema(
  {
    cycleStartTime: { type: Date, required: true },
    cycleEndTime: { type: Date, default: null },
    totalRunDurationMinutes: { type: Number, default: 0, min: 0 },
    totalDowntimeDurationMinutes: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const stageProgressSchema = new Schema(
  {
    stageSequence: { type: Number, required: true },
    stageName: { type: String, required: true },
    stageType: {
      type: String,
      enum: ['PREHEAT', 'SOAK', 'QUENCH', 'TEMPER', 'OTHER'],
      required: true
    },
    targetTemperatureC: { type: Number, required: true },
    actualTemperatureC: { type: Number, required: true },
    targetDurationMinutes: { type: Number, required: true },
    actualDurationMinutes: { type: Number, required: true },
    quenchMedium: { type: String, default: null },
    quenchAgitationSpeedRpm: { type: Number, default: null },
    quenchMediaInitialTempC: { type: Number, default: null },
    quenchMediaFinalTempC: { type: Number, default: null },
    atmosphereDetails: {
      carbonPotential: { type: Number, default: null },
      nitrogenFlow: { type: Number, default: null },
      vacuumPressureMbar: { type: Number, default: null }
    },
    recordedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const downtimeLogSchema = new Schema(
  {
    downtimeId: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'MECHANICAL_FAILURE',
        'ELECTRICAL_FAILURE',
        'ATMOSPHERE_LOSS',
        'POWER_OUTAGE',
        'OPERATOR_BREAK',
        'PLANNED_STOP',
        'UNPLANNED_STOP',
        'PROCESS_ABORT',
        'OTHER'
      ],
      required: true
    },
    reason: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
    impactOnCycle: { type: String, default: null },
    actionTaken: { type: String, default: null },
    loggedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const productionLogSchema = new Schema(
  {
    logId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'SHIFT_HANDOVER',
        'OPERATOR_NOTE',
        'PYROMETRY_READING',
        'ATMOSPHERE_ADJUSTMENT',
        'ANOMALY_REPORT'
      ],
      required: true
    },
    shift: { type: String, default: null },
    message: { type: String, required: true },
    recordedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const qualityHandoffSchema = new Schema(
  {
    inspectionRequestId: { type: String, required: true, uppercase: true },
    status: {
      type: String,
      enum: ['PENDING_INSPECTION', 'INSPECTING', 'APPROVED', 'REJECTED'],
      default: 'PENDING_INSPECTION'
    },
    requestedAt: { type: Date, default: Date.now },
    pyrometryArchiveId: { type: String, required: true, uppercase: true },
    completedQuantity: { type: Number, required: true },
    scrappedQuantity: { type: Number, default: 0 },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const storagePlacementSchema = new Schema(
  {
    warehouseId: { type: String, required: true },
    locationBay: { type: String, required: true },
    palletId: { type: String, default: null },
    placedAt: { type: Date, default: Date.now },
    placedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const jobExecutionSchema = new Schema(
  {
    furnaceCharge: { type: furnaceChargeSchema, default: null },
    cycleTimer: { type: cycleTimerSchema, default: null },
    stageProgress: { type: [stageProgressSchema], default: [] },
    downtimeLog: { type: [downtimeLogSchema], default: [] },
    productionLogs: { type: [productionLogSchema], default: [] },
    qualityHandoff: { type: qualityHandoffSchema, default: null },
    storagePlacement: { type: storagePlacementSchema, default: null }
  },
  { _id: false }
);

const productionJobSchema = createBaseSchema<ProductionJobDocument>({
  jobNumber: { type: String, required: true, uppercase: true },
  poId: { type: String, default: null },
  poNumber: { type: String, default: null, uppercase: true },
  grnId: { type: String, default: null },
  grnNumber: { type: String, default: null, uppercase: true },
  boNumber: { type: String, default: null, uppercase: true },
  batchOrderNumber: { type: String, default: null, uppercase: true },
  planId: { type: String, default: null },
  planNumber: { type: String, default: null, uppercase: true },
  customer: { type: jobCustomerSchema, required: true },
  item: { type: jobItemSchema, required: true },
  quantity: { type: jobQuantitySchema, required: true },
  weightKg: { type: Number, default: 0, min: 0 },
  weight: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: [
      'WAITING_FOR_PRODUCTION',
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'SCHEDULED',
      'IN_PROGRESS',
      'PAUSED',
      'QUALITY_CHECK',
      'STORAGE',
      'READY_FOR_DISPATCH',
      'DISPATCHED',
      'COMPLETED',
      'CANCELLED'
    ],
    default: 'WAITING_FOR_PRODUCTION'
  },
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL'],
    default: 'NORMAL'
  },
  recipeSnapshot: { type: jobRecipeSnapshotSchema, required: true },
  specificationSnapshot: { type: jobSpecificationSnapshotSchema, required: true },
  materialAllocations: { type: [jobMaterialAllocationSchema], default: [] },
  equipmentAssignment: { type: jobEquipmentAssignmentSchema, default: () => ({}) },
  operatorAssignment: { type: jobOperatorAssignmentSchema, default: () => ({}) },
  timeline: { type: jobTimelineSchema, required: true },
  execution: { type: jobExecutionSchema, default: () => ({ stageProgress: [], downtimeLog: [], productionLogs: [] }) },
  transitionHistory: { type: [jobStateTransitionSchema], default: [] },
  assignmentHistory: { type: [jobResourceAssignmentHistorySchema], default: [] },
  idempotencyKey: { type: String, default: null },
  cancellationReason: { type: String, default: null },
  notes: { type: String, default: null }
});

productionJobSchema.index({ tenantId: 1, jobNumber: 1 }, { unique: true });
productionJobSchema.index({ tenantId: 1, poId: 1 });
productionJobSchema.index({ tenantId: 1, grnId: 1 });
productionJobSchema.index({ tenantId: 1, boNumber: 1 });
productionJobSchema.index({ tenantId: 1, planId: 1 });
productionJobSchema.index({ tenantId: 1, status: 1 });
productionJobSchema.index({ tenantId: 1, priority: 1, 'timeline.targetCompletionDate': 1 });
productionJobSchema.index({ tenantId: 1, 'item.itemCode': 1 });
productionJobSchema.index({ tenantId: 1, 'equipmentAssignment.furnaceId': 1 });
productionJobSchema.index({ tenantId: 1, idempotencyKey: 1 }, { sparse: true });

export const ProductionJobModel =
  mongoose.models.ProductionJob ||
  mongoose.model<ProductionJobDocument>('ProductionJob', productionJobSchema);
