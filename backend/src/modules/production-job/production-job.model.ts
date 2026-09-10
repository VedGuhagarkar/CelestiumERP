import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { ProductionJobDocument, IProcessDetailRow, IBatchOrderWorkflowState } from './production-job.types.js';

const workflowStateSchema = new Schema<IBatchOrderWorkflowState>(
  {
    waitingForProduction: { type: Boolean, default: true },
    inProduction: { type: Boolean, default: false },
    waitingForInspection: { type: Boolean, default: false },
    inInspection: { type: Boolean, default: false },
    waitingForDispatch: { type: Boolean, default: false },
    dispatched: { type: Boolean, default: false },
    inspection: { type: Boolean, default: false }
  },
  { _id: false }
);

const processDetailRowSchema = new Schema<IProcessDetailRow>(
  {
    serialNumber: { type: Number, required: true, min: 1, max: 15 },
    partId: { type: String, default: null },
    partCode: { type: String, default: null },
    partName: { type: String, default: null },
    process: { type: String, default: null },
    recipeId: { type: String, default: null },
    recipeCode: { type: String, default: null },
    minhardness: { type: Number, default: null, min: 0 },
    maxhardness: { type: Number, default: null, min: 0 },
    userId: { type: String, default: null },
    userName: { type: String, default: null },
    status: {
      type: String,
      enum: ['BLANK', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'],
      default: 'BLANK'
    },
    notes: { type: String, default: null }
  },
  { _id: false }
);

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
    temperatureDeviationC: { type: Number, default: 0 },
    durationDeviationMinutes: { type: Number, default: 0 },
    isCompliant: { type: Boolean, default: true },
    deviationWarning: { type: String, default: null },
    quenchMedium: { type: String, default: null },
    quenchAgitationSpeedRpm: { type: Number, default: null },
    quenchMediaInitialTempC: { type: Number, default: null },
    quenchMediaFinalTempC: { type: Number, default: null },
    quenchParameters: { type: Schema.Types.Mixed, default: null },
    atmosphereLevel: { type: String, default: null },
    atmosphereDetails: {
      carbonPotential: { type: Number, default: null },
      nitrogenFlow: { type: Number, default: null },
      vacuumPressureMbar: { type: Number, default: null }
    },
    operatorNotes: { type: String, default: null },
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

const hardnessTestPointSchema = new Schema(
  {
    pointNumber: { type: Number, required: true },
    location: { type: String, default: null },
    value: { type: Number, required: true }
  },
  { _id: false }
);

const heatTreatmentInspectionDataSchema = new Schema(
  {
    furnaceId: { type: String, required: true },
    furnaceCode: { type: String, required: true, uppercase: true },
    equipmentNotes: { type: String, default: null },
    minHardness: { type: Number, required: true },
    maxHardness: { type: Number, required: true },
    scale: { type: String, required: true, default: 'HRC' },
    specificationNotes: { type: String, default: null },
    measuredAverage: { type: Number, required: true },
    testPoints: { type: [hardnessTestPointSchema], default: [] },
    isHardnessCompliant: { type: Boolean, required: true },
    targetCaseDepthMinMm: { type: Number, default: null },
    targetCaseDepthMaxMm: { type: Number, default: null },
    effectiveCaseDepthMm: { type: Number, required: true },
    isCaseDepthCompliant: { type: Boolean, required: true },
    caseDepthMethod: { type: String, default: null },
    quantityReceived: { type: Number, required: true, min: 0.001 },
    quantityDelivered: { type: Number, required: true, min: 0.001 },
    quantityRejected: { type: Number, default: 0, min: 0 },
    inspectorId: { type: String, required: true },
    inspectorName: { type: String, required: true },
    inspectedAt: { type: Date, default: Date.now },
    disposition: {
      type: String,
      enum: ['APPROVED', 'REJECTED', 'PENDING'],
      default: 'PENDING'
    },
    defectCategory: { type: String, default: null },
    defectReason: { type: String, default: null },
    correctiveAction: { type: String, default: null },
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
    storagePlacement: { type: storagePlacementSchema, default: null },
    inspectionData: { type: heatTreatmentInspectionDataSchema, default: null }
  },
  { _id: false }
);

const batchOrderGenealogySchema = new Schema(
  {
    whichPo: {
      poId: { type: String, required: true },
      poNumber: { type: String, required: true, uppercase: true },
      supplierName: { type: String, required: true },
      supplierCode: { type: String, default: null },
      orderDate: { type: Date, default: null }
    },
    whichGrn: {
      grnId: { type: String, required: true },
      grnNumber: { type: String, required: true, uppercase: true },
      supplierName: { type: String, required: true },
      supplierCode: { type: String, default: null },
      receivedDate: { type: Date, default: null }
    },
    whichPart: {
      itemId: { type: String, required: true },
      itemCode: { type: String, required: true, uppercase: true },
      itemName: { type: String, required: true },
      materialGrade: { type: String, required: true },
      uom: { type: String, required: true }
    },
    whichRecipe: {
      recipeId: { type: String, required: true },
      recipeCode: { type: String, required: true, uppercase: true },
      recipeName: { type: String, required: true },
      revisionNumber: { type: Number, default: 1 },
      processFamily: { type: String, required: true }
    },
    lockedAt: { type: Date, default: Date.now },
    lockedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    isImmutable: { type: Boolean, default: true }
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
      'IN_PRODUCTION',
      'WAITING_FOR_INSPECTION',
      'IN_INSPECTION',
      'WAITING_FOR_DISPATCH',
      'INSPECTION',
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
  waitingForProduction: { type: Boolean, default: true },
  inProduction: { type: Boolean, default: false },
  waitingForInspection: { type: Boolean, default: false },
  inInspection: { type: Boolean, default: false },
  waitingForDispatch: { type: Boolean, default: false },
  dispatched: { type: Boolean, default: false },
  inspection: { type: Boolean, default: false },
  workflowState: {
    type: workflowStateSchema,
    default: () => ({
      waitingForProduction: true,
      inProduction: false,
      waitingForInspection: false,
      inInspection: false,
      waitingForDispatch: false,
      dispatched: false,
      inspection: false
    })
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
  processDetails: { type: [processDetailRowSchema], default: [] },
  genealogy: { type: batchOrderGenealogySchema, default: null },
  transitionHistory: { type: [jobStateTransitionSchema], default: [] },
  assignmentHistory: { type: [jobResourceAssignmentHistorySchema], default: [] },
  idempotencyKey: { type: String, default: null },
  cancellationReason: { type: String, default: null },
  notes: { type: String, default: null }
});

productionJobSchema.pre('save', function (next) {
  // If status was changed but workflow flags were not explicitly modified, keep them synchronized
  const anyFlagModified =
    this.isModified('waitingForProduction') ||
    this.isModified('inProduction') ||
    this.isModified('waitingForInspection') ||
    this.isModified('inInspection') ||
    this.isModified('waitingForDispatch') ||
    this.isModified('dispatched') ||
    this.isModified('inspection') ||
    this.isModified('workflowState');

  if (this.isModified('status') && !anyFlagModified) {
    const s = this.status;
    this.waitingForProduction = false;
    this.inProduction = false;
    this.waitingForInspection = false;
    this.inInspection = false;
    this.waitingForDispatch = false;
    this.dispatched = false;
    this.inspection = false;

    if (s === 'WAITING_FOR_PRODUCTION' || s === 'DRAFT' || s === 'PENDING_REVIEW') {
      this.waitingForProduction = true;
    } else if (s === 'IN_PRODUCTION' || s === 'IN_PROGRESS' || s === 'SCHEDULED' || s === 'APPROVED' || s === 'PAUSED') {
      this.inProduction = true;
    } else if (s === 'WAITING_FOR_INSPECTION' || s === 'QUALITY_CHECK') {
      this.waitingForInspection = true;
    } else if (s === 'IN_INSPECTION') {
      this.inInspection = true;
    } else if (s === 'WAITING_FOR_DISPATCH' || s === 'STORAGE' || s === 'READY_FOR_DISPATCH') {
      this.waitingForDispatch = true;
    } else if (s === 'DISPATCHED' || s === 'COMPLETED' || s === 'CANCELLED') {
      this.dispatched = true;
    } else if (s === 'INSPECTION') {
      this.inspection = true;
    } else {
      this.waitingForProduction = true;
    }
  }

  // Synchronize workflowState subdocument with top-level flags
  if (this.workflowState) {
    if (this.isModified('workflowState') && !this.isModified('waitingForProduction')) {
      this.waitingForProduction = !!this.workflowState.waitingForProduction;
      this.inProduction = !!this.workflowState.inProduction;
      this.waitingForInspection = !!this.workflowState.waitingForInspection;
      this.inInspection = !!this.workflowState.inInspection;
      this.waitingForDispatch = !!this.workflowState.waitingForDispatch;
      this.dispatched = !!this.workflowState.dispatched;
      this.inspection = !!this.workflowState.inspection;
    } else {
      this.workflowState.waitingForProduction = !!this.waitingForProduction;
      this.workflowState.inProduction = !!this.inProduction;
      this.workflowState.waitingForInspection = !!this.waitingForInspection;
      this.workflowState.inInspection = !!this.inInspection;
      this.workflowState.waitingForDispatch = !!this.waitingForDispatch;
      this.workflowState.dispatched = !!this.dispatched;
      this.workflowState.inspection = !!this.inspection;
    }
  }

  // Enforce Mutual Exclusivity Invariant: Exactly one workflow flag must be true at any moment
  const activeFlags = [
    this.waitingForProduction,
    this.inProduction,
    this.waitingForInspection,
    this.inInspection,
    this.waitingForDispatch,
    this.dispatched,
    this.inspection
  ].filter(Boolean).length;

  if (activeFlags !== 1) {
    return next(
      new Error(
        `Mutual Exclusivity Violation: Exactly one BO workflow state flag must be true at any moment (received ${activeFlags} active flags).`
      )
    );
  }

  if (!this.isNew) {
    if (this.isModified('genealogy')) {
      return next(new Error('Genealogy Violation: Batch Order source genealogy is strictly immutable once established.'));
    }

    if (this.isModified('recipeSnapshot')) {
      return next(
        new Error(
          'Recipe Protection Violation: Recipe snapshot and revision governing the Batch Order are immutable and cannot be rewritten.'
        )
      );
    }

    if (this.inProduction) {
      if (
        this.isModified('processDetails') ||
        this.isModified('customer') ||
        this.isModified('item') ||
        this.isModified('poId') ||
        this.isModified('poNumber') ||
        this.isModified('grnId') ||
        this.isModified('grnNumber') ||
        this.isModified('boNumber') ||
        this.isModified('batchOrderNumber') ||
        this.isModified('specificationSnapshot') ||
        this.isModified('materialAllocations') ||
        this.isModified('planId') ||
        this.isModified('planNumber') ||
        this.isModified('timeline.plannedStartDate') ||
        this.isModified('timeline.targetCompletionDate') ||
        this.isModified('quantity.targetQuantity') ||
        this.isModified('quantity.allocatedQuantity') ||
        (this.isModified('isDeleted') && this.isDeleted)
      ) {
        return next(
          new Error('In-Production Lock Violation: Batch Order is locked against unrelated modifications while in production.')
        );
      }
    }

    const isPostProduction =
      this.waitingForInspection ||
      (this.workflowState && this.workflowState.waitingForInspection) ||
      this.inInspection ||
      (this.workflowState && this.workflowState.inInspection) ||
      this.waitingForDispatch ||
      (this.workflowState && this.workflowState.waitingForDispatch) ||
      this.dispatched ||
      (this.workflowState && this.workflowState.dispatched) ||
      this.inspection ||
      (this.workflowState && this.workflowState.inspection) ||
      this.status === 'WAITING_FOR_INSPECTION' ||
      this.status === 'IN_INSPECTION' ||
      this.status === 'WAITING_FOR_DISPATCH' ||
      this.status === 'INSPECTION' ||
      this.status === 'QUALITY_CHECK' ||
      this.status === 'STORAGE' ||
      this.status === 'READY_FOR_DISPATCH' ||
      this.status === 'DISPATCHED' ||
      this.status === 'COMPLETED';

    if (isPostProduction) {
      if (
        this.isModified('execution.furnaceCharge') ||
        this.isModified('execution.stageProgress') ||
        this.isModified('processDetails') ||
        this.isModified('customer') ||
        this.isModified('item') ||
        this.isModified('poId') ||
        this.isModified('poNumber') ||
        this.isModified('grnId') ||
        this.isModified('grnNumber') ||
        this.isModified('boNumber') ||
        this.isModified('batchOrderNumber') ||
        this.isModified('specificationSnapshot') ||
        this.isModified('materialAllocations') ||
        this.isModified('planId') ||
        this.isModified('planNumber') ||
        this.isModified('timeline.plannedStartDate') ||
        this.isModified('timeline.targetCompletionDate') ||
        this.isModified('quantity.loadedQuantity') ||
        this.isModified('quantity.completedQuantity') ||
        this.isModified('quantity.scrappedQuantity') ||
        this.isModified('quantity.targetQuantity') ||
        this.isModified('quantity.allocatedQuantity') ||
        this.isModified('assignedFurnaceId') ||
        this.isModified('assignedOperatorId') ||
        this.isModified('equipmentAssignment') ||
        this.isModified('operatorAssignment') ||
        (this.isModified('isDeleted') && this.isDeleted)
      ) {
        return next(
          new Error(
            'Post-Production Lock Violation: Production record, piece counts, and historical telemetry are locked once Batch Order has completed production and entered Quality Inspection.'
          )
        );
      }
    }
  }
  next();
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
