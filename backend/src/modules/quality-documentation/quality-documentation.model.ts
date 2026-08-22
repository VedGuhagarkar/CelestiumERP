import { Schema, model } from 'mongoose';
import { QualityDocumentDocument } from './quality-documentation.types.js';

const TargetVsActualHardnessSchema = new Schema(
  {
    location: { type: String, required: true },
    scale: { type: String, required: true },
    targetMin: { type: Number, default: null },
    targetMax: { type: Number, default: null },
    targetRangeText: { type: String, required: true },
    measuredPoints: [{ type: Number }],
    averageMeasured: { type: Number, required: true },
    evaluation: {
      type: String,
      enum: ['CONFORMING', 'NON_CONFORMING', 'CONCESSION', 'NOT_APPLICABLE'],
      required: true
    },
    standardReference: { type: String }
  },
  { _id: false }
);

const TargetVsActualCaseDepthSchema = new Schema(
  {
    targetMinMm: { type: Number, default: null },
    targetMaxMm: { type: Number, default: null },
    targetRangeText: { type: String, required: true },
    cutoffHardnessText: { type: String },
    effectiveCaseDepthMm: { type: Number, default: null },
    totalCaseDepthMm: { type: Number, default: null },
    evaluation: {
      type: String,
      enum: ['CONFORMING', 'NON_CONFORMING', 'CONCESSION', 'NOT_APPLICABLE'],
      required: true
    },
    traverseCurvePoints: [
      {
        depthMm: { type: Number, required: true },
        hardness: { type: Number, required: true },
        scale: { type: String, required: true }
      }
    ]
  },
  { _id: false }
);

const TargetVsActualMicrostructureSchema = new Schema(
  {
    characteristicName: { type: String, required: true },
    targetRequirement: { type: String, required: true },
    actualObservation: { type: String, required: true },
    measuredValue: { type: Number, default: null },
    unit: { type: String, default: null },
    evaluation: {
      type: String,
      enum: ['CONFORMING', 'NON_CONFORMING', 'CONCESSION', 'NOT_APPLICABLE'],
      required: true
    }
  },
  { _id: false }
);

const TargetVsActualVisualDimensionalSchema = new Schema(
  {
    inspectionItem: { type: String, required: true },
    acceptanceCriteria: { type: String, required: true },
    finding: { type: String, required: true },
    isConforming: { type: Boolean, required: true }
  },
  { _id: false }
);

const TargetVsActualPyrometrySchema = new Schema(
  {
    furnaceCode: { type: String, required: true },
    furnaceClass: { type: String, required: true },
    instrumentationType: { type: String, required: true },
    operatingRange: { type: String, required: true },
    satCompliant: { type: Boolean, required: true },
    tusCompliant: { type: Boolean, required: true },
    standardReference: {
      type: String,
      enum: ['AMS_2750G', 'CQI_9', 'BAC_5621', 'STANDARD'],
      required: true
    },
    pyrometryStatus: {
      type: String,
      enum: ['CONFORMING', 'EXCURSION_RESOLVED', 'NON_CONFORMING'],
      required: true
    }
  },
  { _id: false }
);

const DocumentSignoffSchema = new Schema(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true },
    fullName: { type: String, required: true },
    title: { type: String, required: true },
    signedAt: { type: Date, default: Date.now },
    digitalSignatureHash: { type: String, required: true }
  },
  { _id: false }
);

const DocumentRevocationSchema = new Schema(
  {
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    reason: { type: String, default: null }
  },
  { _id: false }
);

const QualityDocumentSchema = new Schema<QualityDocumentDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    documentNumber: { type: String, required: true, index: true },
    reportType: {
      type: String,
      enum: ['TEST_REPORT', 'CERTIFICATE_OF_CONFORMANCE', 'COMBINED_METALLURGICAL_REPORT'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'SUPERSEDED', 'REVOKED'],
      default: 'ISSUED',
      index: true
    },
    versionNumber: { type: Number, default: 1 },
    revisionNumber: { type: Number, default: 0 },
    previousDocumentId: { type: String, default: null },

    inspectionId: { type: String, required: true, index: true },
    inspectionNumber: { type: String, required: true, index: true },
    jobId: { type: String, required: true, index: true },
    jobNumber: { type: String, required: true, index: true },
    planId: { type: String, default: null },
    planNumber: { type: String, default: null },

    customer: {
      customerId: { type: String, required: true },
      customerCode: { type: String, required: true, index: true },
      customerName: { type: String, required: true },
      purchaseOrderNumber: { type: String, default: null },
      partNumber: { type: String, default: null },
      drawingNumber: { type: String, default: null },
      drawingRevision: { type: String, default: null }
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
        millHeatNumber: { type: String, default: null },
        quantity: { type: Number },
        uom: { type: String }
      }
    ],

    certifiedQuantity: {
      acceptedQuantity: { type: Number, required: true },
      sampleQuantity: { type: Number, required: true },
      totalLotQuantity: { type: Number, required: true },
      uom: { type: String, required: true }
    },

    recipe: {
      recipeId: { type: String, required: true },
      recipeCode: { type: String, required: true },
      revisionNumber: { type: Number, required: true },
      processFamily: { type: String, required: true },
      name: { type: String, required: true },
      stagesCount: { type: Number }
    },

    specification: {
      specificationId: { type: String, required: true },
      specCode: { type: String, required: true },
      revisionNumber: { type: Number, required: true },
      title: { type: String, required: true },
      customerCode: { type: String }
    },

    qualityPlan: {
      planId: { type: String, default: null },
      planCode: { type: String, default: null },
      revisionNumber: { type: Number, default: null },
      title: { type: String, default: null }
    },

    hardnessSurveys: [TargetVsActualHardnessSchema],
    caseDepth: { type: TargetVsActualCaseDepthSchema, default: null },
    microstructure: [TargetVsActualMicrostructureSchema],
    visualDimensional: [TargetVsActualVisualDimensionalSchema],
    pyrometry: { type: TargetVsActualPyrometrySchema, default: null },

    overallCompliance: {
      isConforming: { type: Boolean, required: true },
      disposition: {
        type: String,
        enum: ['CONFORMING', 'CONCESSION', 'NON_CONFORMING'],
        required: true
      },
      concessionReference: { type: String, default: null },
      summaryStatement: { type: String, required: true }
    },

    applicableStandards: [{ type: String }],
    certificationStatement: { type: String, required: true },
    remarks: { type: String, default: null },

    securityVerificationCode: { type: String, required: true, index: true },
    tamperProofChecksum: { type: String, required: true },
    verificationUrl: { type: String, required: true },

    certifiedBy: { type: DocumentSignoffSchema, required: true },
    revocation: { type: DocumentRevocationSchema, default: null },

    printableHtmlTemplate: { type: String },

    isDeleted: { type: Boolean, default: false }
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

QualityDocumentSchema.index({ tenantId: 1, documentNumber: 1, versionNumber: 1 }, { unique: true });
QualityDocumentSchema.index({ tenantId: 1, inspectionId: 1 });
QualityDocumentSchema.index({ tenantId: 1, jobId: 1 });
QualityDocumentSchema.index({ tenantId: 1, securityVerificationCode: 1 });

export const QualityDocumentModel = model<QualityDocumentDocument>(
  'QualityDocument',
  QualityDocumentSchema
);
