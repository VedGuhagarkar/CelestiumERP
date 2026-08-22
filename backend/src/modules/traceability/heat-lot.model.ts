import { model, Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { HeatLotDocument } from './heat-lot.types.js';

const heatLotAllocationSubSchema = new Schema(
  {
    allocationId: { type: String, required: true },
    jobCardId: { type: String, required: true },
    jobCardNumber: { type: String, required: true, trim: true },
    customerCode: { type: String, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 0 },
    allocatedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['RESERVED', 'ISSUED', 'RELEASED', 'CANCELLED'],
      default: 'RESERVED'
    }
  },
  { _id: false }
);

const heatLotConsumptionSubSchema = new Schema(
  {
    transactionId: { type: String, required: true },
    jobCardId: { type: String, required: true },
    jobCardNumber: { type: String, required: true, trim: true },
    customerCode: { type: String, trim: true, uppercase: true },
    furnaceId: { type: String, trim: true },
    batchNumber: { type: String, trim: true },
    quantityConsumed: { type: Number, required: true, min: 0 },
    consumedAt: { type: Date, default: Date.now },
    operatorId: { type: String, required: true }
  },
  { _id: false }
);

const heatLotLineageSubSchema = new Schema(
  {
    parentHeatLotIds: { type: [String], default: [] },
    childHeatLotIds: { type: [String], default: [] },
    sourceType: {
      type: String,
      enum: ['RAW_MILL_HEAT', 'INGOT_SPLIT', 'RE_MELT', 'INTERNAL_RECLASSIFICATION'],
      default: 'RAW_MILL_HEAT'
    },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const heatLotSchema = createBaseSchema<HeatLotDocument>(
  {
    heatLotNumber: {
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
      uppercase: true
    },
    materialGrade: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    supplierHeatNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    supplierLotNumber: {
      type: String,
      trim: true
    },
    supplierName: {
      type: String,
      trim: true
    },
    mtrNumber: {
      type: String,
      trim: true,
      index: true
    },
    chemicalComposition: {
      type: Map,
      of: Number,
      default: {}
    },
    receivedDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    uom: {
      type: String,
      required: true,
      enum: ['KG', 'MT', 'LTR', 'CU_M', 'CYLINDER', 'PCS', 'ROLL', 'BOX', 'SET', 'DRUM', 'METER']
    },
    currentQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    allocatedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    consumedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    storageLocation: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['INWARDED', 'QUARANTINED', 'RELEASED', 'CONSUMED', 'EXHAUSTED', 'REJECTED'],
      default: 'INWARDED',
      index: true
    },
    quarantineReason: {
      type: String,
      trim: true
    },
    testCertReferences: {
      type: [String],
      default: []
    },
    allocations: {
      type: [heatLotAllocationSubSchema],
      default: []
    },
    consumptionHistory: {
      type: [heatLotConsumptionSubSchema],
      default: []
    },
    lineage: {
      type: heatLotLineageSubSchema,
      default: () => ({ sourceType: 'RAW_MILL_HEAT', parentHeatLotIds: [], childHeatLotIds: [] })
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

// Compound tenant indexes for fast genealogical search and uniqueness
IndexRegistry.addTenantUniqueIndex(heatLotSchema, 'heatLotNumber');
IndexRegistry.addStatusFilterIndex(heatLotSchema, 'status');
heatLotSchema.index({ tenantId: 1, supplierHeatNumber: 1 });
heatLotSchema.index({ tenantId: 1, mtrNumber: 1 });
heatLotSchema.index({ tenantId: 1, itemId: 1, status: 1 });
heatLotSchema.index({ tenantId: 1, materialGrade: 1 });
heatLotSchema.index({ tenantId: 1, 'consumptionHistory.jobCardNumber': 1 });
heatLotSchema.index({ tenantId: 1, 'allocations.jobCardNumber': 1 });

export const HeatLotModel = model<HeatLotDocument>('HeatLot', heatLotSchema);
export type { HeatLotDocument };
