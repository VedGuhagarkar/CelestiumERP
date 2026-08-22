import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { StorageLocationDocument } from './warehouse.types.js';

const storageLocationSchema = createBaseSchema<StorageLocationDocument>(
  {
    warehouseId: {
      type: String,
      required: true,
      index: true
    },
    warehouseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    locationCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    zone: {
      type: String,
      required: true,
      trim: true
    },
    bay: {
      type: String,
      trim: true
    },
    rack: {
      type: String,
      trim: true
    },
    bin: {
      type: String,
      trim: true
    },
    zoneType: {
      type: String,
      required: true,
      enum: [
        'RAW_MATERIAL_YARD',
        'QUARANTINE_AREA',
        'WIP_STAGE',
        'FINISHED_GOODS',
        'CONSUMABLES_STORE',
        'GAS_STORAGE',
        'LAB_ARCHIVE'
      ],
      index: true
    },
    capacityQuantity: {
      type: Number,
      min: 0
    },
    capacityUom: {
      type: String,
      enum: ['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
      index: true
    },
    isQuarantineLocation: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    },
    temperatureControlled: {
      type: Boolean,
      required: true,
      default: false
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

IndexRegistry.addTenantUniqueIndex(storageLocationSchema, 'locationCode');
storageLocationSchema.index({ tenantId: 1, warehouseId: 1, zoneType: 1 });

export const StorageLocationModel = model<StorageLocationDocument>(
  'StorageLocation',
  storageLocationSchema
);
export type { StorageLocationDocument };
