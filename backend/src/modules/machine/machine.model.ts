import { Schema, model } from 'mongoose';
import { MachineDocument } from './machine.types.js';

const MachineTechnicalSpecsSchema = new Schema(
  {
    manufacturer: { type: String, required: true, trim: true },
    modelNumber: { type: String, required: true, trim: true },
    serialNumber: { type: String, required: true, trim: true },
    yearOfManufacture: { type: Number, default: null },
    commissioningDate: { type: Date, default: null },
    heatingSource: {
      type: String,
      enum: ['GAS_FIRED', 'ELECTRIC_RESISTANCE', 'INDUCTION', 'NONE'],
      required: true
    },
    maxPowerKw: { type: Number, required: true, min: 0 },
    atmosphereTypes: [{ type: String, trim: true }],
    quenchMedia: [{ type: String, trim: true }]
  },
  { _id: false }
);

const MachineThermalLimitsSchema = new Schema(
  {
    minOperatingTempC: { type: Number, required: true, min: -200, max: 3000 },
    maxOperatingTempC: { type: Number, required: true, min: -200, max: 3000 },
    uniformOperatingMinC: { type: Number, required: true, min: -200, max: 3000 },
    uniformOperatingMaxC: { type: Number, required: true, min: -200, max: 3000 },
    maxHeatingRateCPerMin: { type: Number, default: null },
    maxCoolingRateCPerMin: { type: Number, default: null },
    temperatureUniformityToleranceC: { type: Number, default: null }
  },
  { _id: false }
);

const MachineWorkingDimensionsSchema = new Schema(
  {
    lengthMm: { type: Number, required: true, min: 10 },
    widthMm: { type: Number, required: true, min: 10 },
    heightMm: { type: Number, required: true, min: 10 },
    diameterMm: { type: Number, default: null },
    usableVolumeM3: { type: Number, required: true, min: 0.001 },
    maxLoadWeightKg: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const MachineLocationSchema = new Schema(
  {
    plant: { type: String, required: true, trim: true },
    building: { type: String, required: true, trim: true },
    bay: { type: String, required: true, trim: true },
    cell: { type: String, default: null, trim: true },
    coordinates: { type: String, default: null, trim: true }
  },
  { _id: false }
);

const MachineCapabilitiesSchema = new Schema(
  {
    supportedProcessFamilies: [{ type: String, required: true }],
    furnaceClass: {
      type: String,
      enum: ['CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'NON_THERMAL'],
      required: true
    },
    instrumentationType: {
      type: String,
      enum: ['TYPE_A', 'TYPE_B', 'TYPE_C', 'TYPE_D', 'TYPE_E', 'NONE'],
      required: true
    },
    pyrometryStandard: {
      type: String,
      enum: ['AMS_2750G', 'CQI_9', 'BAC_5621', 'STANDARD', 'NON_PYROMETRY'],
      required: true
    },
    hasAgitationControl: { type: Boolean, default: false },
    maxQuenchWeightKg: { type: Number, default: null }
  },
  { _id: false }
);

const MachinePyrometryComplianceSchema = new Schema(
  {
    lastTusDate: { type: Date, default: null },
    nextTusDueDate: { type: Date, default: null },
    lastSatDate: { type: Date, default: null },
    nextSatDueDate: { type: Date, default: null },
    isTusValid: { type: Boolean, default: true },
    isSatValid: { type: Boolean, default: true }
  },
  { _id: false }
);

const MachineCurrentJobSchema = new Schema(
  {
    jobId: { type: String, default: null },
    jobNumber: { type: String, default: null },
    startedAt: { type: Date, default: null },
    expectedCompletionAt: { type: Date, default: null }
  },
  { _id: false }
);

const MachineStatusHistorySchema = new Schema(
  {
    fromStatus: {
      type: String,
      enum: ['IDLE', 'RUNNING', 'MAINTENANCE', 'BREAKDOWN', 'OFFLINE', 'CALIBRATING'],
      required: true
    },
    toStatus: {
      type: String,
      enum: ['IDLE', 'RUNNING', 'MAINTENANCE', 'BREAKDOWN', 'OFFLINE', 'CALIBRATING'],
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    reason: { type: String, default: null },
    workOrderId: { type: String, default: null },
    downtimeDurationMinutes: { type: Number, default: null }
  },
  { _id: false }
);

const MachineNoteSchema = new Schema(
  {
    noteId: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['OPERATIONAL', 'MAINTENANCE', 'CALIBRATION', 'SAFETY', 'HANDOVER'],
      required: true
    },
    authorId: { type: String, required: true },
    authorEmail: { type: String },
    authorRole: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const MachineSchema = new Schema<MachineDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        'FURNACE_VACUUM',
        'FURNACE_ATMOSPHERE_SEALED_QUENCH',
        'FURNACE_PIT',
        'FURNACE_BOX',
        'FURNACE_CONTINUOUS_BELT',
        'FURNACE_INDUCTION',
        'QUENCH_TANK',
        'TEMPERING_OVEN',
        'CRYOGENIC_CHAMBER',
        'WASHING_LINE',
        'SHOT_BLASTER',
        'STRAIGHTENING_PRESS',
        'AUXILIARY_EQUIPMENT'
      ],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['IDLE', 'RUNNING', 'MAINTENANCE', 'BREAKDOWN', 'OFFLINE', 'CALIBRATING'],
      default: 'IDLE',
      index: true
    },
    technicalSpecs: { type: MachineTechnicalSpecsSchema, required: true },
    thermalLimits: { type: MachineThermalLimitsSchema, required: true },
    workingDimensions: { type: MachineWorkingDimensionsSchema, required: true },
    location: { type: MachineLocationSchema, required: true },
    capabilities: { type: MachineCapabilitiesSchema, required: true },
    pyrometryCompliance: { type: MachinePyrometryComplianceSchema, required: true },
    currentJob: { type: MachineCurrentJobSchema, default: null },
    statusHistory: [MachineStatusHistorySchema],
    notes: [MachineNoteSchema],
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

MachineSchema.index({ tenantId: 1, machineCode: 1 }, { unique: true });
MachineSchema.index({ tenantId: 1, status: 1 });
MachineSchema.index({ tenantId: 1, category: 1 });
MachineSchema.index({ tenantId: 1, 'capabilities.supportedProcessFamilies': 1 });
MachineSchema.index({ tenantId: 1, 'location.bay': 1 });

export const MachineModel = model<MachineDocument>('Machine', MachineSchema);
