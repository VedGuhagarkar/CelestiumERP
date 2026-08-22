import { model, Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { CustomerDocument } from './customer.types.js';

const contactSubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false }
  },
  { _id: false }
);

const addressSubSchema = new Schema(
  {
    plantName: { type: String, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    gstNumber: { type: String, trim: true }
  },
  { _id: false }
);

const processingDefaultsSubSchema = new Schema(
  {
    defaultHardnessInspectionRequirement: { type: String, trim: true },
    defaultMicrostructureRequired: { type: Boolean, default: false },
    defaultCocRequired: { type: Boolean, default: true },
    defaultPackagingInstructions: { type: String, trim: true },
    defaultRustPreventiveRequired: { type: Boolean, default: true }
  },
  { _id: false }
);

const customerSchema = createBaseSchema<CustomerDocument>(
  {
    customerCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    tradeName: {
      type: String,
      trim: true
    },
    industrySegment: {
      type: String,
      required: true,
      enum: [
        'Aerospace',
        'Automotive',
        'Heavy Engineering',
        'Tool & Die',
        'Oil & Gas',
        'Defense',
        'General',
        'Other'
      ],
      default: 'General',
      index: true
    },
    qualityApprovals: {
      type: [String],
      default: []
    },
    qualityStatus: {
      type: String,
      enum: ['approved', 'conditional', 'suspended', 'blacklisted', 'inactive'],
      default: 'approved',
      index: true
    },
    contacts: {
      type: [contactSubSchema],
      required: true,
      default: []
    },
    billingAddress: {
      type: addressSubSchema,
      required: true
    },
    shippingAddresses: {
      type: [addressSubSchema],
      default: []
    },
    taxDetails: {
      gstin: { type: String, trim: true },
      pan: { type: String, trim: true },
      taxId: { type: String, trim: true }
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: 'Net 30'
    },
    processingDefaults: {
      type: processingDefaultsSubSchema,
      default: () => ({})
    },
    activeJobCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalJobCount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
      index: true
    },
    notes: {
      type: String,
      trim: true
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

// Compound tenant index enforcement
IndexRegistry.addTenantUniqueIndex(customerSchema, 'customerCode');
IndexRegistry.addStatusFilterIndex(customerSchema, 'status');
customerSchema.index({ tenantId: 1, companyName: 1 });
customerSchema.index({ tenantId: 1, industrySegment: 1, qualityStatus: 1 });

export const CustomerModel = model<CustomerDocument>('Customer', customerSchema);
export type { CustomerDocument };
