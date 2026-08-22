import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { InventoryTransactionDocument } from './inventory.types.js';

const inventoryTransactionSchema = createBaseSchema<InventoryTransactionDocument>(
  {
    transactionNumber: {
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
    type: {
      type: String,
      required: true,
      enum: [
        'GOODS_RECEIPT',
        'GOODS_ISSUE',
        'STOCK_ADJUSTMENT_ADD',
        'STOCK_ADJUSTMENT_DEDUCT',
        'INTERNAL_TRANSFER_OUT',
        'INTERNAL_TRANSFER_IN',
        'RESERVATION_ALLOCATE',
        'RESERVATION_RELEASE'
      ],
      index: true
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
    sourceLocation: {
      type: String,
      trim: true
    },
    destinationLocation: {
      type: String,
      trim: true
    },
    beforeBalance: {
      type: Number,
      required: true
    },
    afterBalance: {
      type: Number,
      required: true
    },
    referenceType: {
      type: String,
      required: true,
      enum: [
        'JOB_CARD',
        'HEAT_LOT',
        'PURCHASE_ORDER',
        'PHYSICAL_COUNT',
        'MAINTENANCE_WORKORDER',
        'SCRAP',
        'DISPATCH'
      ],
      index: true
    },
    referenceId: {
      type: String,
      trim: true
    },
    referenceNumber: {
      type: String,
      trim: true,
      index: true
    },
    reasonCode: {
      type: String,
      enum: [
        'PHYSICAL_COUNT_DISCREPANCY',
        'DAMAGED_IN_STORAGE',
        'SAMPLE_DESTRUCTIVE_TESTING',
        'EXPIRED_SHELF_LIFE',
        'SCRAP_DISPOSAL',
        'SYSTEM_INITIALIZATION',
        'OTHER'
      ]
    },
    comments: {
      type: String,
      trim: true
    },
    actorId: {
      type: String,
      required: true
    },
    actorEmail: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
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

IndexRegistry.addTenantUniqueIndex(inventoryTransactionSchema, 'transactionNumber');
inventoryTransactionSchema.index({ tenantId: 1, itemId: 1, timestamp: -1 });
inventoryTransactionSchema.index({ tenantId: 1, referenceNumber: 1 });

export const InventoryTransactionModel = model<InventoryTransactionDocument>(
  'InventoryTransaction',
  inventoryTransactionSchema
);
export type { InventoryTransactionDocument };
