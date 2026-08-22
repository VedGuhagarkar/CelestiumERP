import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import {
  LaboratoryTestRecordDocument,
  ILaboratoryTestRecord
} from './metallurgical-lab.types.js';

const HardnessMeasurementSchema = new Schema(
  {
    measurementId: { type: String, required: true },
    sampleTag: { type: String, required: true },
    location: {
      type: String,
      enum: ['SURFACE', 'CORE', 'PITCH_LINE', 'ROOT', 'CASE', 'TRANSITION', 'CROSS_SECTION'],
      required: true
    },
    scale: {
      type: String,
      enum: ['HRC', 'HRB', 'HRA', 'HV', 'HBW', 'HK'],
      required: true
    },
    readings: [{ type: Number, required: true }],
    averageValue: { type: Number, required: true },
    testEquipmentCode: { type: String, default: null },
    calibrationDueDate: { type: Date, default: null },
    targetMin: { type: Number, default: null },
    targetMax: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    measuredBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    timestamp: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const HardnessTraversePointSchema = new Schema(
  {
    depthMm: { type: Number, required: true },
    measuredHardness: { type: Number, required: true },
    scale: {
      type: String,
      enum: ['HRC', 'HRB', 'HRA', 'HV', 'HBW', 'HK'],
      required: true
    },
    load: { type: String, default: null },
    xCoordMicrons: { type: Number, default: null },
    yCoordMicrons: { type: Number, default: null }
  },
  { _id: false }
);

const HardnessTraverseSchema = new Schema(
  {
    traverseId: { type: String, required: true },
    sampleTag: { type: String, required: true },
    location: {
      type: String,
      enum: ['SURFACE', 'CORE', 'PITCH_LINE', 'ROOT', 'CASE', 'TRANSITION', 'CROSS_SECTION'],
      required: true
    },
    scale: {
      type: String,
      enum: ['HRC', 'HRB', 'HRA', 'HV', 'HBW', 'HK'],
      required: true
    },
    load: { type: String, default: null },
    cutoffHardness: { type: Number, required: true },
    points: [HardnessTraversePointSchema],
    calculatedEffectiveCaseDepthMm: { type: Number, required: true },
    calculatedTotalCaseDepthMm: { type: Number, default: null },
    coreHardnessBaseline: { type: Number, default: null },
    targetCaseDepthMinMm: { type: Number, default: null },
    targetCaseDepthMaxMm: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    testEquipmentCode: { type: String, default: null },
    measuredBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    timestamp: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const MicrostructureObservationSchema = new Schema(
  {
    observationId: { type: String, required: true },
    sampleTag: { type: String, required: true },
    location: {
      type: String,
      enum: ['SURFACE', 'CORE', 'PITCH_LINE', 'ROOT', 'CASE', 'TRANSITION', 'CROSS_SECTION'],
      required: true
    },
    magnification: { type: Number, required: true },
    matrixStructure: { type: String, required: true },
    retainedAustenite: {
      measuredPercent: { type: Number },
      testMethod: { type: String, enum: ['XRD', 'OPTICAL_METALLOGRAPHY', 'MAGNETIC'] },
      acceptableMaxPercent: { type: Number },
      passed: { type: Boolean }
    },
    grainSize: {
      astmNumber: { type: Number },
      method: { type: String, enum: ['COMPARISON', 'PLANIMETRIC', 'INTERCEPT'] },
      targetMin: { type: Number },
      targetMax: { type: Number },
      passed: { type: Boolean }
    },
    decarburization: {
      type: { type: String, enum: ['COMPLETE', 'PARTIAL', 'TOTAL', 'NONE'] },
      completeDecarbDepthMm: { type: Number },
      partialDecarbDepthMm: { type: Number },
      totalDecarbDepthMm: { type: Number },
      maxAllowedDepthMm: { type: Number },
      passed: { type: Boolean }
    },
    carbideMorphology: {
      rating: {
        type: String,
        enum: [
          'TYPE_A_FINE',
          'TYPE_B_MEDIUM',
          'TYPE_C_COARSE',
          'CONTINUOUS_NETWORK',
          'DISPERSED_SPHEROIDAL',
          'INTERGRANULAR'
        ]
      },
      networkPresent: { type: Boolean },
      grainBoundaryPrecipitation: { type: Boolean },
      description: { type: String },
      passed: { type: Boolean }
    },
    inclusionsAstmE45: {
      typeA_Sulfides: { thin: Number, heavy: Number },
      typeB_Aluminates: { thin: Number, heavy: Number },
      typeC_Silicates: { thin: Number, heavy: Number },
      typeD_Oxides: { thin: Number, heavy: Number }
    },
    micrographPhotoUrls: [{ type: String }],
    observedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    timestamp: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const LabRecordAuditHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: ['CREATE', 'ADD_HARDNESS', 'ADD_TRAVERSE', 'ADD_MICRO', 'LOCK', 'UPDATE'],
      required: true
    },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    timestamp: { type: Date, required: true, default: Date.now },
    details: { type: String, default: null }
  },
  { _id: false }
);

const laboratoryTestRecordSchema = createBaseSchema<LaboratoryTestRecordDocument>({
  recordNumber: { type: String, required: true, index: true },
  inspectionId: { type: String, required: true, index: true },
  inspectionNumber: { type: String, required: true, index: true },
  jobId: { type: String, required: true, index: true },
  jobNumber: { type: String, required: true, index: true },
  heatLotNumber: { type: String, default: null },
  materialGrade: { type: String, default: null },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'LOCKED'],
    default: 'DRAFT',
    index: true
  },
  hardnessMeasurements: [HardnessMeasurementSchema],
  hardnessTraverses: [HardnessTraverseSchema],
  microstructureObservations: [MicrostructureObservationSchema],
  lockedAt: { type: Date, default: null },
  lockedBy: {
    userId: { type: String },
    email: { type: String },
    role: { type: String }
  },
  lockReason: { type: String, default: null },
  revision: { type: Number, default: 1 },
  auditHistory: [LabRecordAuditHistorySchema],
  notes: { type: String, default: null }
});

laboratoryTestRecordSchema.index({ tenantId: 1, recordNumber: 1 }, { unique: true });
laboratoryTestRecordSchema.index({ tenantId: 1, inspectionId: 1 });
laboratoryTestRecordSchema.index({ tenantId: 1, jobId: 1 });
laboratoryTestRecordSchema.index({ tenantId: 1, status: 1 });

export const LaboratoryTestRecordModel =
  mongoose.models.LaboratoryTestRecord ||
  mongoose.model<LaboratoryTestRecordDocument>(
    'LaboratoryTestRecord',
    laboratoryTestRecordSchema
  );

export type { LaboratoryTestRecordDocument, ILaboratoryTestRecord };
