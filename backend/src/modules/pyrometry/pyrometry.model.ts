import { Schema, model } from 'mongoose';
import {
  ThermocoupleChannelDocument,
  CalibrationRecordDocument,
  TemperatureTelemetrySampleDocument
} from './pyrometry.types.js';

// --- Thermocouple Channel Model ---

const CorrectionOffsetSchema = new Schema(
  {
    setpointTempC: { type: Number, required: true },
    rawReadingC: { type: Number, required: true },
    correctedOffsetC: { type: Number, required: true }
  },
  { _id: false }
);

const ThermocoupleChannelSchema = new Schema<ThermocoupleChannelDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, uppercase: true, trim: true },
    machineId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    furnaceZoneNumber: { type: Number, required: true, min: 1 },
    channelType: {
      type: String,
      enum: [
        'CONTROL',
        'OVERTEMPERATURE',
        'RECORDING',
        'LOAD_SURFACE',
        'LOAD_CORE',
        'TUS_SURVEY',
        'SAT_TEST'
      ],
      required: true,
      index: true
    },
    thermocoupleType: {
      type: String,
      enum: ['TYPE_K', 'TYPE_N', 'TYPE_R', 'TYPE_S', 'TYPE_B', 'TYPE_J', 'TYPE_T'],
      required: true
    },
    locationDescription: { type: String, required: true, trim: true },
    sensorSerialNumber: { type: String, required: true, trim: true },
    wireSpoolNumber: { type: String, default: null },
    calibrationOffsetC: { type: Number, default: 0.0 },
    correctionOffsets: [CorrectionOffsetSchema],
    maxAllowedUsageCount: { type: Number, default: null },
    currentUsageCount: { type: Number, default: 0 },
    calibratedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    isCalibrated: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
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

ThermocoupleChannelSchema.index({ tenantId: 1, channelId: 1 }, { unique: true });
ThermocoupleChannelSchema.index({ tenantId: 1, machineId: 1, channelType: 1 });

export const ThermocoupleChannelModel = model<ThermocoupleChannelDocument>(
  'ThermocoupleChannel',
  ThermocoupleChannelSchema
);

// --- Calibration Record Model ---

const SensorCalibrationTestPointSchema = new Schema(
  {
    nominalTempC: { type: Number, required: true },
    instrumentReadingC: { type: Number, required: true },
    standardReadingC: { type: Number, required: true },
    errorC: { type: Number, required: true },
    maxAllowedErrorC: { type: Number, required: true },
    correctionOffsetC: { type: Number, required: true },
    passed: { type: Boolean, required: true }
  },
  { _id: false }
);

const TusSurveyTemperatureSchema = new Schema(
  {
    setpointC: { type: Number, required: true },
    minObservedC: { type: Number, required: true },
    maxObservedC: { type: Number, required: true },
    uniformitySpreadC: { type: Number, required: true },
    maxAllowedSpreadC: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    passed: { type: Boolean, required: true }
  },
  { _id: false }
);

const TusRecordSchema = new Schema(
  {
    furnaceClass: {
      type: String,
      enum: ['CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'NON_THERMAL'],
      required: true
    },
    operatingRangeMinC: { type: Number, required: true },
    operatingRangeMaxC: { type: Number, required: true },
    surveyTemperatures: [TusSurveyTemperatureSchema],
    surveySensorCount: { type: Number, required: true },
    overallPassed: { type: Boolean, required: true },
    reportDocumentUrl: { type: String, default: null }
  },
  { _id: false }
);

const SatRecordSchema = new Schema(
  {
    satMethod: {
      type: String,
      enum: ['COMPARISON_PORTABLE_STANDARD', 'RESIDENT_STANDARD', 'ALTERNATE_SAT'],
      required: true
    },
    targetSetpointC: { type: Number, required: true },
    furnaceControlReadingC: { type: Number, required: true },
    testStandardReadingC: { type: Number, required: true },
    observedDifferenceC: { type: Number, required: true },
    maxAllowedDifferenceC: { type: Number, required: true },
    passed: { type: Boolean, required: true }
  },
  { _id: false }
);

const CalibrationRecordSchema = new Schema<CalibrationRecordDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    calibrationNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    calibrationType: {
      type: String,
      enum: ['SENSOR_CALIBRATION', 'INSTRUMENT_CALIBRATION', 'TUS_SURVEY', 'SAT_TEST'],
      required: true,
      index: true
    },
    machineId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    channelId: { type: String, default: null },
    standardReference: {
      type: String,
      enum: ['AMS_2750G', 'CQI_9', 'BAC_5621', 'STANDARD', 'NON_PYROMETRY'],
      required: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED'],
      default: 'DRAFT',
      index: true
    },

    instrumentModel: { type: String, default: null },
    instrumentSerial: { type: String, default: null },
    calibratedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String },
      technicianName: { type: String, required: true },
      externalAgency: { type: String, default: null }
    },
    masterStandardSerial: { type: String, required: true },
    masterStandardExpiry: { type: Date, required: true },
    testPoints: [SensorCalibrationTestPointSchema],
    overallPassed: { type: Boolean, required: true },

    tusRecord: { type: TusRecordSchema, default: null },
    satRecord: { type: SatRecordSchema, default: null },

    testDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    approvedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      approvedAt: { type: Date },
      comments: { type: String }
    },
    certificateNumber: { type: String, default: null },
    notes: { type: String, default: null },
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

CalibrationRecordSchema.index({ tenantId: 1, calibrationNumber: 1 }, { unique: true });
CalibrationRecordSchema.index({ tenantId: 1, machineId: 1, calibrationType: 1 });

export const CalibrationRecordModel = model<CalibrationRecordDocument>(
  'CalibrationRecord',
  CalibrationRecordSchema
);

// --- Temperature Telemetry Sample Model ---

const ChannelReadingSchema = new Schema(
  {
    channelId: { type: String, required: true },
    channelType: { type: String, required: true },
    setpointC: { type: Number, default: null },
    rawReadingC: { type: Number, required: true },
    correctedReadingC: { type: Number, required: true },
    isOvertempAlert: { type: Boolean, default: false }
  },
  { _id: false }
);

const TemperatureTelemetrySampleSchema = new Schema<TemperatureTelemetrySampleDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    machineId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    jobId: { type: String, default: null, index: true },
    jobNumber: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
    channelReadings: [ChannelReadingSchema],
    vacuumLevelMbar: { type: Number, default: null },
    carbonPotentialPercent: { type: Number, default: null },
    atmosphereGasFlowScmh: { type: Number, default: null },
    isExcursionAlert: { type: Boolean, default: false, index: true },
    excursionDetails: { type: String, default: null }
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

TemperatureTelemetrySampleSchema.index({ tenantId: 1, machineId: 1, timestamp: -1 });

export const TemperatureTelemetrySampleModel = model<TemperatureTelemetrySampleDocument>(
  'TemperatureTelemetrySample',
  TemperatureTelemetrySampleSchema
);
