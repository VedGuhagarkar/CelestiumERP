import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import {
  QualityPlanDocument,
  IQualityPlan
} from './quality-planning.types.js';

const AcceptanceCriteriaSchema = new Schema(
  {
    targetMin: { type: Number, default: null },
    targetMax: { type: Number, default: null },
    scale: { type: String, default: null },
    unit: { type: String, default: null },
    description: { type: String, default: null },
    testStandardReference: { type: String, default: null }
  },
  { _id: false }
);

const InspectionCharacteristicSchema = new Schema(
  {
    itemCode: { type: String, required: true },
    name: { type: String, required: true },
    characteristicType: {
      type: String,
      enum: [
        'SURFACE_HARDNESS',
        'CORE_HARDNESS',
        'EFFECTIVE_CASE_DEPTH',
        'TOTAL_CASE_DEPTH',
        'MICROSTRUCTURE_MATRIX',
        'RETAINED_AUSTENITE',
        'GRAIN_SIZE',
        'DECARBURIZATION',
        'CARBIDE_MORPHOLOGY',
        'VISUAL_DIMENSIONAL',
        'PYROMETRY_VERIFICATION',
        'TENSILE_MECHANICAL'
      ],
      required: true
    },
    measurementType: {
      type: String,
      enum: [
        'HARDNESS',
        'CASE_DEPTH_TRAVERSE',
        'MICROSTRUCTURE',
        'VISUAL_DIMENSIONAL',
        'PYROMETRY_VERIFICATION',
        'MECHANICAL'
      ],
      required: true
    },
    isMandatory: { type: Boolean, required: true, default: true },
    specLocations: [
      {
        type: String,
        enum: ['SURFACE', 'CORE', 'PITCH_LINE', 'ROOT', 'CASE', 'TRANSITION', 'CROSS_SECTION']
      }
    ],
    sampleCount: { type: Number, required: true, min: 1, default: 1 },
    readingsPerSample: { type: Number, required: true, min: 1, default: 1 },
    samplingFrequency: {
      type: String,
      enum: [
        'PER_CHARGE',
        'PER_PIECE',
        'START_AND_END_OF_HEAT',
        'AQL_NORMAL',
        'AQL_TIGHTENED',
        'ONE_PER_LOT'
      ],
      required: true,
      default: 'PER_CHARGE'
    },
    acceptanceCriteria: { type: AcceptanceCriteriaSchema, required: true },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const QualityPlanRevisionEntrySchema = new Schema(
  {
    revision: { type: Number, required: true },
    changedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    changedAt: { type: Date, required: true, default: Date.now },
    changeDescription: { type: String, required: true }
  },
  { _id: false }
);

const QualityPlanSignoffSchema = new Schema(
  {
    userId: { type: String, required: true },
    email: { type: String },
    role: { type: String },
    approvedAt: { type: Date, required: true, default: Date.now },
    remarks: { type: String, default: null }
  },
  { _id: false }
);

const qualityPlanSchema = createBaseSchema<QualityPlanDocument>({
  planCode: { type: String, required: true, uppercase: true, index: true },
  revisionNumber: { type: Number, required: true, default: 1 },
  title: { type: String, required: true },
  description: { type: String, default: null },
  status: {
    type: String,
    enum: ['DRAFT', 'APPROVED', 'OBSOLETE'],
    default: 'DRAFT',
    index: true
  },
  processFamily: {
    type: String,
    enum: [
      'CARBURIZING',
      'CARBONITRIDING',
      'NITRIDING',
      'NITROCARBURIZING',
      'NEUTRAL_HARDENING',
      'VACUUM_HEAT_TREATMENT',
      'INDUCTION_HARDENING',
      'ANNEALING',
      'NORMALIZING',
      'STRESS_RELIEVING',
      'TEMPERING',
      'SOLUTION_AGE'
    ],
    required: true,
    index: true
  },
  specificationId: { type: String, required: true, index: true },
  specCode: { type: String, required: true, uppercase: true, index: true },
  specRevisionNumber: { type: Number, required: true },
  applicableCustomerCodes: [{ type: String, uppercase: true }],
  applicableItemCategories: [{ type: String, uppercase: true }],
  characteristics: [InspectionCharacteristicSchema],
  authorId: { type: String, required: true },
  approvedBy: { type: QualityPlanSignoffSchema, default: null },
  revisionHistory: [QualityPlanRevisionEntrySchema],
  notes: { type: String, default: null }
});

qualityPlanSchema.index({ tenantId: 1, planCode: 1, revisionNumber: 1 }, { unique: true });
qualityPlanSchema.index({ tenantId: 1, status: 1, processFamily: 1, specCode: 1 });
qualityPlanSchema.index({ tenantId: 1, specificationId: 1 });

export const QualityPlanModel =
  mongoose.models.QualityPlan ||
  mongoose.model<QualityPlanDocument>('QualityPlan', qualityPlanSchema);

export type { QualityPlanDocument, IQualityPlan };
