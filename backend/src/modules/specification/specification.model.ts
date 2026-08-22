import { model, Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { SpecificationDocument } from './specification.types.js';

const hardnessRequirementSubSchema = new Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    scale: {
      type: String,
      required: true,
      enum: ['HRC', 'HRB', 'HRA', 'HV1', 'HV5', 'HV10', 'HV30', 'HBW']
    },
    testMethodReference: { type: String, trim: true },
    testLocations: { type: [String], default: [] }
  },
  { _id: false }
);

const caseDepthRequirementSubSchema = new Schema(
  {
    effectiveCaseDepthMinMm: { type: Number },
    effectiveCaseDepthMaxMm: { type: Number },
    caseDepthCutoffHRC: { type: Number },
    totalCaseDepthMinMm: { type: Number },
    totalCaseDepthMaxMm: { type: Number },
    testMethodReference: { type: String, trim: true }
  },
  { _id: false }
);

const microstructuralCriteriaSubSchema = new Schema(
  {
    matrixStructure: { type: String, required: true, trim: true },
    maxRetainedAustenitePercent: { type: Number },
    maxCarbideNetworkRating: { type: String, trim: true },
    decarburizationLimitMm: { type: Number },
    intergranularOxidationLimitMm: { type: Number }
  },
  { _id: false }
);

const customerAcceptanceCriteriaSubSchema = new Schema(
  {
    samplingPlan: { type: String, required: true, trim: true },
    cocRequired: { type: Boolean, default: true },
    micrographRequired: { type: Boolean, default: false },
    destructiveCouponRequired: { type: Boolean, default: false },
    testStandardReferences: { type: [String], required: true }
  },
  { _id: false }
);

const specificationSchema = createBaseSchema<SpecificationDocument>(
  {
    specCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    revision: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    customerId: {
      type: String,
      trim: true,
      index: true
    },
    customerCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    applicableMaterialGrades: {
      type: [String],
      required: true,
      index: true
    },
    processFamily: {
      type: String,
      required: true,
      enum: [
        'CARBURIZING',
        'CARBONITRIDING',
        'NEUTRAL_HARDENING',
        'TEMPERING',
        'STRESS_RELIEVING',
        'ANNEALING',
        'NORMALIZING',
        'NITRIDING',
        'SOLUTION_TREATING_AGING',
        'INDUCTION_HARDENING'
      ],
      index: true
    },
    surfaceHardness: {
      type: hardnessRequirementSubSchema,
      required: true
    },
    coreHardness: {
      type: hardnessRequirementSubSchema
    },
    caseDepth: {
      type: caseDepthRequirementSubSchema
    },
    microstructure: {
      type: microstructuralCriteriaSubSchema
    },
    customerAcceptance: {
      type: customerAcceptanceCriteriaSubSchema,
      required: true
    },
    authorId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED'],
      default: 'DRAFT',
      index: true
    },
    approvedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      approvedAt: { type: Date },
      comments: { type: String }
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    effectiveFrom: {
      type: Date
    },
    effectiveTo: {
      type: Date
    },
    referencedJobCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret && typeof ret === 'object') {
          if (ret._id) {
            ret.id = ret._id.toString();
          }
          delete ret._id;
          delete ret.__v;
        }
        return ret;
      }
    }
  }
);

// Compound tenant index: Unique on (tenantId, specCode, revision)
IndexRegistry.addCompoundIndex(specificationSchema, { specCode: 1, revision: 1 }, { unique: true });
IndexRegistry.addStatusFilterIndex(specificationSchema, 'status');
specificationSchema.index({ tenantId: 1, customerId: 1, status: 1 });
specificationSchema.index({ tenantId: 1, customerCode: 1, status: 1 });
specificationSchema.index({ tenantId: 1, processFamily: 1, status: 1 });
specificationSchema.index({ tenantId: 1, applicableMaterialGrades: 1 });

export const SpecificationModel = model<SpecificationDocument>('Specification', specificationSchema);
export type { SpecificationDocument };
