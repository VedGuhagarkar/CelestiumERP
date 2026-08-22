import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { InventoryBalanceDocument } from './inventory.types.js';

const inventoryBalanceSchema = createBaseSchema<InventoryBalanceDocument>(
  {
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
    materialGrade: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    onHandQuantity: {
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
    availableQuantity: {
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
    version: {
      type: Number,
      required: true,
      default: 0
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

// Compound Unique Index: Single balance entry per tenant, item, and physical storage location
IndexRegistry.addCompoundIndex(inventoryBalanceSchema, { itemId: 1, location: 1 }, { unique: true });
inventoryBalanceSchema.index({ tenantId: 1, itemCode: 1, location: 1 });

export const InventoryBalanceModel = model<InventoryBalanceDocument>('InventoryBalance', inventoryBalanceSchema);
export type { InventoryBalanceDocument };
