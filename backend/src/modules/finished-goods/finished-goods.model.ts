import { Schema, model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { FinishedGoodsDocument } from './finished-goods.types.js';

const qualityReleaseSchema = new Schema(
  {
    isReleased: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    },
    releasedAt: {
      type: Date
    },
    releasedByActorId: {
      type: String
    },
    releasedByActorEmail: {
      type: String,
      trim: true
    },
    cocNumber: {
      type: String,
      trim: true,
      index: true
    },
    inspectionReportId: {
      type: String,
      trim: true
    },
    releaseNotes: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const movementHistorySchema = new Schema(
  {
    fromLocation: {
      type: String,
      required: true,
      trim: true
    },
    toLocation: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true
    },
    movedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    movedByActorId: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const finishedGoodsSchema = createBaseSchema<FinishedGoodsDocument>(
  {
    fgLotNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    jobCardId: {
      type: String,
      required: true,
      index: true
    },
    jobCardNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    heatLotNumber: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    customerCode: {
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
    description: {
      type: String,
      trim: true
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    availableQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    dispatchedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    uom: {
      type: String,
      required: true,
      enum: ['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']
    },
    location: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: [
        'AWAITING_QC_RELEASE',
        'RELEASED_FOR_DISPATCH',
        'QUARANTINED',
        'RESERVED_FOR_DISPATCH',
        'FULLY_DISPATCHED'
      ],
      default: 'AWAITING_QC_RELEASE',
      index: true
    },
    qualityRelease: {
      type: qualityReleaseSchema,
      required: true,
      default: () => ({ isReleased: false })
    },
    movementHistory: {
      type: [movementHistorySchema],
      default: []
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

IndexRegistry.addTenantUniqueIndex(finishedGoodsSchema, 'fgLotNumber');
finishedGoodsSchema.index({ tenantId: 1, customerCode: 1, status: 1 });
finishedGoodsSchema.index({ tenantId: 1, heatLotNumber: 1 });

export const FinishedGoodsModel = model<FinishedGoodsDocument>('FinishedGoods', finishedGoodsSchema);
export type { FinishedGoodsDocument };
