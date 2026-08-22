import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { WarehouseDocument } from './warehouse.types.js';

const warehouseSchema = createBaseSchema<WarehouseDocument>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: ['MAIN_PLANT', 'RAW_MATERIAL_YARD', 'GAS_YARD', 'FINISHED_STORE', 'OFFSITE_STORE'],
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    plantArea: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
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

IndexRegistry.addTenantUniqueIndex(warehouseSchema, 'code');

export const WarehouseModel = model<WarehouseDocument>('Warehouse', warehouseSchema);
export type { WarehouseDocument };
