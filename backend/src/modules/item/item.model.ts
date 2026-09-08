import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { ItemDocument } from './item.types.js';

const itemSchema = createBaseSchema<ItemDocument>(
  {
    itemCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: [
        'RAW_MATERIAL',
        'PROCESS_GAS',
        'QUENCH_MEDIA',
        'HEAT_TREAT_CONSUMABLE',
        'LABORATORY_CONSUMABLE',
        'FINISHED_TREATED_GOODS',
        'PACKAGING_MATERIAL'
      ],
      index: true
    },
    materialGrade: {
      type: String,
      trim: true,
      index: true
    },
    hsnCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    uom: {
      type: String,
      required: true,
      enum: ['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']
    },
    secondaryUom: {
      type: String,
      enum: ['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']
    },
    conversionFactor: {
      type: Number,
      min: 0
    },
    minStockLevel: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    reorderPoint: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      index: true
    },
    maxStockLevel: {
      type: Number,
      min: 0
    },
    safetyStock: {
      type: Number,
      min: 0
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    allocatedStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    storageLocation: {
      type: String,
      trim: true
    },
    isHazardous: {
      type: Boolean,
      default: false,
      index: true
    },
    unNumber: {
      type: String,
      trim: true
    },
    msdsReference: {
      type: String,
      trim: true
    },
    shelfLifeDays: {
      type: Number,
      min: 0
    },
    isShelfLifeTracked: {
      type: Boolean,
      default: false
    },
    activeBatchCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalBatchCount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
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

// Compound tenant index enforcement
IndexRegistry.addTenantUniqueIndex(itemSchema, 'itemCode');
IndexRegistry.addStatusFilterIndex(itemSchema, 'status');
itemSchema.index({ tenantId: 1, category: 1, status: 1 });
itemSchema.index({ tenantId: 1, materialGrade: 1 });
itemSchema.index({ tenantId: 1, name: 1 });

export const ItemModel = model<ItemDocument>('Item', itemSchema);
export type { ItemDocument };
