import { Schema, model } from 'mongoose';
import { TenantDocument } from './tenant.types.js';
import { softDeletePlugin } from '../../core/plugins/soft-delete.plugin.js';

const pyrometrySchema = new Schema(
  {
    enableAms2750g: { type: Boolean, default: true },
    enableCqi9: { type: Boolean, default: true },
    defaultThermocoupleCalibrationDays: { type: Number, default: 90 },
    defaultSatIntervalDays: { type: Number, default: 30 },
    defaultTusIntervalDays: { type: Number, default: 180 }
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    defaultTemperatureUnit: { type: String, enum: ['C', 'F'], default: 'C' },
    defaultHardnessScale: { type: String, enum: ['HRC', 'HB', 'HV', 'HRB'], default: 'HRC' },
    pyrometry: { type: pyrometrySchema, default: () => ({}) }
  },
  { _id: false }
);

const tenantSchema = new Schema<TenantDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    legalName: {
      type: String,
      trim: true
    },
    taxId: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['provisioning', 'active', 'suspended', 'archived'],
      default: 'active',
      index: true
    },
    subscriptionPlan: {
      type: String,
      enum: ['standard', 'professional', 'enterprise'],
      default: 'standard'
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    contactPhone: {
      type: String,
      trim: true
    },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    },
    settings: {
      type: settingsSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true,
    versionKey: false,
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

// Apply soft-delete plugin
tenantSchema.plugin(softDeletePlugin);

export const TenantModel = model<TenantDocument>('Tenant', tenantSchema);
export type { TenantDocument };
