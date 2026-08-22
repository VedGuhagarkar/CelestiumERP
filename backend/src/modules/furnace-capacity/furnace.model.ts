import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { FurnaceDocument } from './furnace-capacity.types.js';

const furnaceDimensionsSchema = new Schema(
  {
    lengthMm: { type: Number, required: true, min: 100 },
    widthMm: { type: Number, required: true, min: 100 },
    heightMm: { type: Number, required: true, min: 100 },
    usableVolumeM3: { type: Number, required: true, min: 0.01 },
    maxGrossWeightKg: { type: Number, required: true, min: 10 }
  },
  { _id: false }
);

const furnaceThermalCapabilitiesSchema = new Schema(
  {
    minOperatingTempC: { type: Number, required: true, min: 0 },
    maxOperatingTempC: { type: Number, required: true, max: 2000 },
    temperatureUniformityToleranceC: { type: Number, required: true, min: 1 },
    pyrometryClass: {
      type: String,
      enum: ['CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5'],
      required: true
    },
    instrumentationType: {
      type: String,
      enum: ['TYPE_A', 'TYPE_B', 'TYPE_C', 'TYPE_D', 'TYPE_E'],
      required: true
    },
    lastTusDate: { type: Date, default: null },
    nextTusDueDate: { type: Date, default: null },
    lastSatDate: { type: Date, default: null },
    nextSatDueDate: { type: Date, default: null }
  },
  { _id: false }
);

const furnaceProcessCapabilitiesSchema = new Schema(
  {
    supportedProcessFamilies: { type: [String], required: true },
    supportedAtmospheres: { type: [String], default: [] },
    supportedQuenchMedia: { type: [String], default: [] },
    maxQuenchWeightKg: { type: Number, default: null },
    hasAgitationControl: { type: Boolean, default: false }
  },
  { _id: false }
);

const furnaceSchema = createBaseSchema<FurnaceDocument>({
  furnaceCode: { type: String, required: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  furnaceType: { type: String, required: true, trim: true },
  manufacturer: { type: String, default: null },
  modelNumber: { type: String, default: null },
  serialNumber: { type: String, default: null },
  locationBay: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['OPERATIONAL', 'MAINTENANCE_SCHEDULED', 'BREAKDOWN', 'CALIBRATION_OVERDUE', 'OFFLINE'],
    default: 'OPERATIONAL'
  },
  dimensions: { type: furnaceDimensionsSchema, required: true },
  thermalCapabilities: { type: furnaceThermalCapabilitiesSchema, required: true },
  processCapabilities: { type: furnaceProcessCapabilitiesSchema, required: true },
  nominalDailyOperatingHours: { type: Number, default: 24.0, min: 1, max: 24 },
  notes: { type: String, default: null }
});

furnaceSchema.index({ tenantId: 1, furnaceCode: 1 }, { unique: true });
furnaceSchema.index({ tenantId: 1, status: 1 });
furnaceSchema.index({ tenantId: 1, furnaceType: 1 });
furnaceSchema.index({ tenantId: 1, 'processCapabilities.supportedProcessFamilies': 1 });

export const FurnaceModel =
  mongoose.models.Furnace || mongoose.model<FurnaceDocument>('Furnace', furnaceSchema);
