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
    actualCompletionDate: { type: Date, default: null }
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

const productionJobSchema = createBaseSchema<ProductionJobDocument>({
  jobNumber: { type: String, required: true, uppercase: true },
  planId: { type: String, default: null },
  planNumber: { type: String, default: null, uppercase: true },
  customer: { type: jobCustomerSchema, required: true },
  item: { type: jobItemSchema, required: true },
  quantity: { type: jobQuantitySchema, required: true },
  status: {
    type: String,
    enum: [
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
    default: 'DRAFT'
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
  transitionHistory: { type: [jobStateTransitionSchema], default: [] },
  assignmentHistory: { type: [jobResourceAssignmentHistorySchema], default: [] },
  idempotencyKey: { type: String, default: null },
  cancellationReason: { type: String, default: null },
  notes: { type: String, default: null }
});

productionJobSchema.index({ tenantId: 1, jobNumber: 1 }, { unique: true });
productionJobSchema.index({ tenantId: 1, planId: 1 });
productionJobSchema.index({ tenantId: 1, status: 1 });
productionJobSchema.index({ tenantId: 1, priority: 1, 'timeline.targetCompletionDate': 1 });
productionJobSchema.index({ tenantId: 1, 'item.itemCode': 1 });
productionJobSchema.index({ tenantId: 1, 'equipmentAssignment.furnaceId': 1 });

export const ProductionJobModel =
  mongoose.models.ProductionJob ||
  mongoose.model<ProductionJobDocument>('ProductionJob', productionJobSchema);
