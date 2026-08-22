import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import {
  QualityInspectionDocument,
  IQualityInspection
} from './quality-inspection.types.js';

const HardnessTestPointSchema = new Schema(
  {
    pointIdentifier: { type: String, required: true },
    location: {
      type: String,
      enum: ['SURFACE', 'CORE', 'CASE', 'TRANSITION'],
      required: true
    },
    measuredValue: { type: Number, required: true },
    scale: {
      type: String,
      enum: ['HRC', 'HRB', 'HV', 'HBW'],
      required: true
    },
    targetMin: { type: Number },
    targetMax: { type: Number },
    passed: { type: Boolean, required: true }
  },
  { _id: false }
);

const CaseDepthTestResultSchema = new Schema(
  {
    effectiveCaseDepthMm: { type: Number, required: true },
    totalCaseDepthMm: { type: Number },
    cutoffHardnessHrc: { type: Number },
    targetMinMm: { type: Number },
    targetMaxMm: { type: Number },
    passed: { type: Boolean, required: true }
  },
  { _id: false }
);

const MicrostructureTestResultSchema = new Schema(
  {
    observedStructure: { type: String, required: true },
    grainSizeAstm: { type: Number },
    retainedAustenitePercent: { type: Number },
    decarburizationDepthMm: { type: Number },
    carbideDistributionRating: { type: String },
    passed: { type: Boolean, required: true },
    photoUrls: [{ type: String }],
    notes: { type: String }
  },
  { _id: false }
);

const MechanicalTestResultSchema = new Schema(
  {
    tensileStrengthMpa: { type: Number },
    yieldStrengthMpa: { type: Number },
    elongationPercent: { type: Number },
    reductionOfAreaPercent: { type: Number },
    impactEnergyJoules: { type: Number },
    passed: { type: Boolean, required: true },
    notes: { type: String }
  },
  { _id: false }
);

const VisualDimensionalResultSchema = new Schema(
  {
    distortionMm: { type: Number },
    maxAllowedDistortionMm: { type: Number },
    surfaceOxidationAcceptable: { type: Boolean, required: true },
    quenchCracksPresent: { type: Boolean, required: true },
    dimensionsWithinTolerance: { type: Boolean, required: true },
    passed: { type: Boolean, required: true },
    notes: { type: String }
  },
  { _id: false }
);

const PyrometryVerificationSchema = new Schema(
  {
    pyrometryArchiveId: { type: String },
    soakTemperatureCompliant: { type: Boolean, required: true },
    soakTimeCompliant: { type: Boolean, required: true },
    quenchDelayCompliant: { type: Boolean, required: true },
    coolingRateCompliant: { type: Boolean, required: true },
    passed: { type: Boolean, required: true },
    verifiedBy: { type: String },
    notes: { type: String }
  },
  { _id: false }
);

const QualityTestResultsSchema = new Schema(
  {
    hardnessTests: [HardnessTestPointSchema],
    caseDepth: CaseDepthTestResultSchema,
    microstructure: MicrostructureTestResultSchema,
    mechanical: MechanicalTestResultSchema,
    visualDimensional: VisualDimensionalResultSchema,
    pyrometry: PyrometryVerificationSchema,
    evaluatedAt: { type: Date },
    evaluatedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    overallTestPassed: { type: Boolean }
  },
  { _id: false }
);

const NonConformanceReportSchema = new Schema(
  {
    ncrNumber: { type: String },
    defectCode: { type: String },
    defectDescription: { type: String, required: true },
    severity: {
      type: String,
      enum: ['MINOR', 'MAJOR', 'CRITICAL'],
      required: true
    },
    rootCauseCategory: { type: String },
    dispositionRecommendation: {
      type: String,
      enum: ['SCRAP', 'REWORK_REHEAT', 'REWORK_TEMPER', 'CONCESSION', 'RETURN_TO_VENDOR', 'NONE'],
      default: 'NONE'
    },
    quarantineRequired: { type: Boolean, default: false },
    quarantineLocationBay: { type: String },
    correctiveActionPlan: { type: String },
    raisedAt: { type: Date },
    raisedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    }
  },
  { _id: false }
);

const InspectorAssignmentSchema = new Schema(
  {
    inspectorId: { type: String, default: null },
    inspectorCode: { type: String, default: null },
    inspectorName: { type: String, default: null },
    assignedAt: { type: Date, default: null },
    assignedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    }
  },
  { _id: false }
);

const InspectionAssignmentHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: ['ASSIGN', 'REALLOCATE', 'REMOVE'],
      required: true
    },
    previousInspectorId: { type: String, default: null },
    previousInspectorCode: { type: String, default: null },
    newInspectorId: { type: String, default: null },
    newInspectorCode: { type: String, default: null },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    timestamp: { type: Date, required: true, default: Date.now },
    reason: { type: String, default: null }
  },
  { _id: false }
);

const InspectionStateTransitionSchema = new Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    reason: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const InspectionSignoffSchema = new Schema(
  {
    userId: { type: String, required: true },
    email: { type: String },
    role: { type: String },
    timestamp: { type: Date, required: true, default: Date.now },
    remarks: { type: String, default: null }
  },
  { _id: false }
);

const qualityInspectionSchema = createBaseSchema<QualityInspectionDocument>({
  inspectionNumber: { type: String, required: true, index: true },
  jobId: { type: String, required: true, index: true },
  jobNumber: { type: String, required: true, index: true },
  planId: { type: String, default: null },
  planNumber: { type: String, default: null },
  status: {
    type: String,
    enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REINSPECTION'],
    default: 'PENDING',
    index: true
  },
  disposition: {
    type: String,
    enum: ['PENDING', 'CONFORMING', 'NON_CONFORMING', 'CONCESSION_GRANTED', 'SCRAP', 'REWORK'],
    default: 'PENDING',
    index: true
  },
  customer: {
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true },
    customerName: { type: String, required: true }
  },
  item: {
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    materialGrade: { type: String, required: true },
    uom: { type: String, required: true }
  },
  heatLots: [
    {
      heatLotId: { type: String, default: null },
      heatLotNumber: { type: String, default: null },
      allocatedQuantity: { type: Number, required: true },
      uom: { type: String, required: true }
    }
  ],
  recipeSnapshot: {
    recipeId: { type: String, required: true },
    recipeCode: { type: String, required: true },
    revisionNumber: { type: Number, required: true },
    processFamily: { type: String, required: true },
    name: { type: String },
    applicableMaterialGrades: [{ type: String }],
    stages: { type: Schema.Types.Mixed },
    metallurgicalTargets: { type: Schema.Types.Mixed },
    machineRequirements: { type: Schema.Types.Mixed }
  },
  specificationSnapshot: {
    specificationId: { type: String, required: true },
    specCode: { type: String, required: true },
    revisionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    customerCode: { type: String },
    surfaceHardness: { type: Schema.Types.Mixed, required: true },
    coreHardness: { type: Schema.Types.Mixed },
    caseDepth: { type: Schema.Types.Mixed },
    microstructure: { type: Schema.Types.Mixed },
    customerAcceptance: { type: Schema.Types.Mixed }
  },
  qualityPlanSnapshot: { type: Schema.Types.Mixed, default: null },
  inspectionQuantity: {
    sampleSize: { type: Number, required: true, default: 5 },
    totalLotQuantity: { type: Number, required: true },
    unitOfMeasure: { type: String, required: true }
  },
  assignedInspector: { type: InspectorAssignmentSchema, default: null },
  testResults: {
    type: QualityTestResultsSchema,
    default: () => ({ hardnessTests: [] })
  },
  nonConformance: { type: NonConformanceReportSchema, default: null },
  reinspection: {
    reinspectionCount: { type: Number, default: 0 },
    parentInspectionId: { type: String, default: null },
    reinspectionReason: { type: String, default: null }
  },
  approvedBy: { type: InspectionSignoffSchema, default: null },
  rejectedBy: { type: InspectionSignoffSchema, default: null },
  assignmentHistory: [InspectionAssignmentHistorySchema],
  transitionHistory: [InspectionStateTransitionSchema],
  notes: { type: String, default: null }
});

qualityInspectionSchema.index({ tenantId: 1, inspectionNumber: 1 }, { unique: true });
qualityInspectionSchema.index({ tenantId: 1, jobId: 1 });
qualityInspectionSchema.index({ tenantId: 1, status: 1 });
qualityInspectionSchema.index({ tenantId: 1, disposition: 1 });
qualityInspectionSchema.index({ tenantId: 1, 'assignedInspector.inspectorId': 1 });

export const QualityInspectionModel =
  mongoose.models.QualityInspection ||
  mongoose.model<QualityInspectionDocument>(
    'QualityInspection',
    qualityInspectionSchema
  );

export type { QualityInspectionDocument, IQualityInspection };
