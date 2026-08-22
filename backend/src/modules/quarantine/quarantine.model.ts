import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { QuarantineRecordDocument } from './quarantine.types.js';

const quarantineSchema = createBaseSchema<QuarantineRecordDocument>(
  {
    quarantineNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    targetType: {
      type: String,
      required: true,
      enum: ['ITEM', 'HEAT_LOT', 'JOB_CARD', 'FINISHED_GOODS'],
      index: true
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    targetIdentifier: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    itemId: {
      type: String,
      required: true,
      index: true
    },
    itemCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    originalLocation: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    uom: {
      type: String,
      required: true,
      enum: ['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']
    },
    reasonCode: {
      type: String,
      required: true,
      enum: [
        'SPECTROMETRY_CHEMISTRY_FAIL',
        'SURFACE_HARDNESS_FAIL',
        'CORE_HARDNESS_FAIL',
        'EFFECTIVE_CASE_DEPTH_FAIL',
        'MICROSTRUCTURE_NON_CONFORMANCE',
        'CRACK_OR_DISTORTION',
        'CUSTOMER_RETURN_NCR',
        'DOCUMENTATION_DISCREPANCY',
        'GENERAL_SUSPECT_HOLD'
      ],
      index: true
    },
    reasonDescription: {
      type: String,
      required: true,
      trim: true
    },
    triggerSource: {
      type: String,
      required: true,
      enum: [
        'INSPECTION_FAILURE',
        'NCR',
        'RECEIVING_INSPECTION',
        'FURNACE_ABORT',
        'CUSTOMER_COMPLAINT',
        'MANUAL_HOLD'
      ],
      index: true
    },
    triggerReferenceNumber: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: [
        'ACTIVE_QUARANTINE',
        'RELEASED_TO_STOCK',
        'SCRAP_DISPOSITION',
        'RETURN_TO_SUPPLIER',
        'REWORK_APPROVED'
      ],
      default: 'ACTIVE_QUARANTINE',
      index: true
    },
    dispositionNotes: {
      type: String,
      trim: true
    },
    dispositionActorId: {
      type: String
    },
    dispositionActorEmail: {
      type: String,
      trim: true
    },
    dispositionDate: {
      type: Date
    },
    initiatedByActorId: {
      type: String,
      required: true
    },
    initiatedByActorEmail: {
      type: String,
      trim: true
    },
    initiatedAt: {
      type: Date,
      required: true,
      default: Date.now
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

IndexRegistry.addTenantUniqueIndex(quarantineSchema, 'quarantineNumber');
quarantineSchema.index({ tenantId: 1, targetType: 1, targetIdentifier: 1, status: 1 });
quarantineSchema.index({ tenantId: 1, itemId: 1, status: 1 });

export const QuarantineRecordModel = model<QuarantineRecordDocument>(
  'QuarantineRecord',
  quarantineSchema
);
export type { QuarantineRecordDocument };
