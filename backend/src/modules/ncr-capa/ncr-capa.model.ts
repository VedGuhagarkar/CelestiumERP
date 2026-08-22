import { Schema, model } from 'mongoose';
import {
  NonConformanceReportDocument,
  CorrectivePreventiveActionDocument
} from './ncr-capa.types.js';

const NcrEvidenceSchema = new Schema(
  {
    evidenceId: { type: String, required: true },
    title: { type: String, required: true },
    evidenceType: {
      type: String,
      enum: ['MICROGRAPH', 'HARDNESS_REPORT', 'PYROMETRY_CHART', 'PHOTO', 'LAB_TEST_RECORD', 'DOC'],
      required: true
    },
    fileUrl: { type: String, required: true },
    description: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    }
  },
  { _id: false }
);

const NcrTransitionSchema = new Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    reason: { type: String, required: true }
  },
  { _id: false }
);

const CapaActionItemSchema = new Schema(
  {
    itemNumber: { type: Number, required: true },
    actionType: {
      type: String,
      enum: [
        'RECIPE_MODIFICATION',
        'EQUIPMENT_CALIBRATION',
        'MAINTENANCE_OVERHAUL',
        'OPERATOR_RETRAINING',
        'SPECIFICATION_REVISION',
        'QUALITY_PLAN_UPDATE',
        'SUPPLIER_CAR',
        'SOP_UPDATE'
      ],
      required: true
    },
    description: { type: String, required: true },
    assignedTo: {
      userId: { type: String, required: true },
      email: { type: String },
      name: { type: String }
    },
    targetCompletionDate: { type: Date, required: true },
    actualCompletionDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
      default: 'PENDING'
    },
    completionNotes: { type: String }
  },
  { _id: false }
);

const CapaEffectivenessVerificationSchema = new Schema(
  {
    verificationMethod: {
      type: String,
      enum: [
        'SUBSEQUENT_LOT_AUDIT',
        'PYROMETRY_TUS_VALIDATION',
        'TRAINING_ASSESSMENT',
        'SPC_TREND_ANALYSIS'
      ],
      required: true
    },
    verificationPeriodDays: { type: Number, required: true },
    verifiedAt: { type: Date, default: Date.now },
    verifiedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    isEffective: { type: Boolean, required: true },
    notes: { type: String, required: true }
  },
  { _id: false }
);

const CapaTransitionSchema = new Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    reason: { type: String, required: true }
  },
  { _id: false }
);

// --- NonConformanceReport Schema ---

const NonConformanceReportSchema = new Schema<NonConformanceReportDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    ncrNumber: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_INVESTIGATION', 'DISPOSITIONED', 'CAPA_PENDING', 'CLOSED', 'CANCELLED'],
      default: 'OPEN',
      index: true
    },
    inspectionId: { type: String, default: null, index: true },
    inspectionNumber: { type: String, default: null },
    jobId: { type: String, required: true, index: true },
    jobNumber: { type: String, required: true, index: true },
    planId: { type: String, default: null },
    planNumber: { type: String, default: null },
    customer: {
      customerId: { type: String, required: true },
      customerCode: { type: String, required: true, index: true },
      customerName: { type: String, required: true }
    },
    item: {
      itemId: { type: String, required: true },
      itemCode: { type: String, required: true },
      itemName: { type: String, required: true },
      materialGrade: { type: String },
      uom: { type: String, required: true }
    },
    heatLots: [
      {
        heatLotId: { type: String, default: null },
        heatLotNumber: { type: String, default: null },
        quantity: { type: Number },
        uom: { type: String }
      }
    ],
    processFamily: { type: String },
    defectType: {
      type: String,
      enum: [
        'HARDNESS_OUT_OF_TOLERANCE',
        'CASE_DEPTH_DEFICIENT',
        'CASE_DEPTH_EXCESSIVE',
        'MICROSTRUCTURE_NON_CONFORMING',
        'RETAINED_AUSTENITE_EXCESSIVE',
        'EXCESSIVE_DECARBURIZATION',
        'GRAIN_COARSENING',
        'CARBIDE_NETWORK_DEFECT',
        'DISTORTION_WARPAGE',
        'QUENCH_CRACKING',
        'SURFACE_OXIDATION_SCALING',
        'PYROMETRY_EXCURSION_OVERTEMP',
        'PYROMETRY_EXCURSION_UNDERTEMP',
        'ATMOSPHERE_FAILURE',
        'PROCESS_INTERRUPTION',
        'CUSTOMER_COMPLAINT_RETURN',
        'OTHER'
      ],
      required: true,
      index: true
    },
    defectSeverity: {
      type: String,
      enum: ['MINOR', 'MAJOR', 'CRITICAL'],
      required: true,
      index: true
    },
    defectDescription: { type: String, required: true },
    defectLocations: [{ type: String }],
    affectedQuantity: {
      totalAffectedQuantity: { type: Number, required: true },
      rejectedQuantity: { type: Number, required: true },
      scrappedQuantity: { type: Number, default: 0 },
      reworkedQuantity: { type: Number, default: 0 },
      uom: { type: String, required: true }
    },
    evidence: [NcrEvidenceSchema],
    containment: {
      containmentAction: { type: String, required: true },
      isQuarantined: { type: Boolean, default: false },
      quarantineId: { type: String, default: null },
      quarantineNumber: { type: String, default: null },
      quarantineBay: { type: String, default: null },
      quarantineStatus: {
        type: String,
        enum: ['ACTIVE', 'RELEASED', 'DISPOSITIONED'],
        default: 'ACTIVE'
      },
      containedAt: { type: Date, default: Date.now },
      containedBy: {
        userId: { type: String, required: true },
        email: { type: String },
        role: { type: String }
      }
    },
    rootCause: {
      category: {
        type: String,
        enum: [
          'MAN_OPERATOR',
          'MACHINE_FURNACE',
          'METHOD_RECIPE',
          'MATERIAL_RAW',
          'MEASUREMENT_GAUGE',
          'ENVIRONMENT'
        ]
      },
      investigationMethod: {
        type: String,
        enum: [
          '5_WHY',
          'FISHBONE_ISHIKAWA',
          'METALLURGICAL_FAILURE_ANALYSIS',
          'THERMAL_CYCLE_AUDIT'
        ]
      },
      investigationDetails: { type: String },
      fiveWhys: [{ type: String }],
      fishboneCategories: {
        man: [{ type: String }],
        machine: [{ type: String }],
        method: [{ type: String }],
        material: [{ type: String }],
        measurement: [{ type: String }],
        environment: [{ type: String }]
      },
      investigatedBy: {
        userId: { type: String },
        email: { type: String },
        role: { type: String },
        date: { type: Date }
      }
    },
    disposition: {
      dispositionType: {
        type: String,
        enum: [
          'SCRAP',
          'REWORK_REHEAT_TREAT',
          'REWORK_TEMPER_ONLY',
          'USE_AS_IS_CONCESSION',
          'RETURN_TO_CUSTOMER',
          'DE_RATE'
        ]
      },
      instructions: { type: String },
      concessionNumber: { type: String, default: null },
      customerConcessionApproved: { type: Boolean, default: false },
      customerApprovalReference: { type: String, default: null },
      customerApprovedAt: { type: Date, default: null },
      dispositionSignoff: {
        userId: { type: String },
        email: { type: String },
        role: { type: String },
        timestamp: { type: Date },
        remarks: { type: String }
      }
    },
    requiresCapa: { type: Boolean, default: false, index: true },
    capaIds: [{ type: String }],
    capaNumbers: [{ type: String }],
    raisedAt: { type: Date, default: Date.now },
    raisedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    closedAt: { type: Date, default: null },
    closedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      remarks: { type: String }
    },
    transitionHistory: [NcrTransitionSchema],
    notes: { type: String, default: null },
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

NonConformanceReportSchema.index({ tenantId: 1, ncrNumber: 1 }, { unique: true });
NonConformanceReportSchema.index({ tenantId: 1, status: 1 });
NonConformanceReportSchema.index({ tenantId: 1, jobId: 1 });
NonConformanceReportSchema.index({ tenantId: 1, inspectionId: 1 });

export const NonConformanceReportModel = model<NonConformanceReportDocument>(
  'NonConformanceReport',
  NonConformanceReportSchema
);

// --- CorrectivePreventiveAction Schema ---

const CorrectivePreventiveActionSchema = new Schema<CorrectivePreventiveActionDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    capaNumber: { type: String, required: true, index: true },
    ncrId: { type: String, required: true, index: true },
    ncrNumber: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['CORRECTIVE', 'PREVENTIVE', 'CORRECTIVE_AND_PREVENTIVE'],
      required: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACTION_PLANNING', 'IN_PROGRESS', 'VERIFICATION', 'EFFECTIVE', 'CLOSED', 'VOID'],
      default: 'OPEN',
      index: true
    },
    title: { type: String, required: true },
    problemStatement: { type: String, required: true },
    rootCauseSummary: { type: String, required: true },
    actionItems: [CapaActionItemSchema],
    effectivenessVerification: { type: CapaEffectivenessVerificationSchema, default: null },
    raisedAt: { type: Date, default: Date.now },
    raisedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    closedAt: { type: Date, default: null },
    closedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      remarks: { type: String }
    },
    transitionHistory: [CapaTransitionSchema],
    notes: { type: String, default: null },
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

CorrectivePreventiveActionSchema.index({ tenantId: 1, capaNumber: 1 }, { unique: true });
CorrectivePreventiveActionSchema.index({ tenantId: 1, ncrId: 1 });
CorrectivePreventiveActionSchema.index({ tenantId: 1, status: 1 });

export const CorrectivePreventiveActionModel = model<CorrectivePreventiveActionDocument>(
  'CorrectivePreventiveAction',
  CorrectivePreventiveActionSchema
);
