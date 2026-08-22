import mongoose from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { FurnaceAllocationDocument } from './furnace-capacity.types.js';

const furnaceAllocationSchema = createBaseSchema<FurnaceAllocationDocument>({
  allocationNumber: { type: String, required: true, uppercase: true },
  furnaceId: { type: String, required: true },
  furnaceCode: { type: String, required: true, uppercase: true },
  planId: { type: String, default: null },
  planNumber: { type: String, default: null, uppercase: true },
  jobCardId: { type: String, default: null },
  jobCardNumber: { type: String, default: null, uppercase: true },
  processFamily: { type: String, required: true },
  targetTemperatureC: { type: Number, required: true },
  allocatedWeightKg: { type: Number, required: true, min: 0.1 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  durationHours: { type: Number, required: true, min: 0.1 },
  status: {
    type: String,
    enum: ['BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'BOOKED'
  },
  bookedByActorId: { type: String, required: true },
  notes: { type: String, default: null }
});

furnaceAllocationSchema.index({ tenantId: 1, allocationNumber: 1 }, { unique: true });
furnaceAllocationSchema.index({ tenantId: 1, furnaceId: 1, startTime: 1, endTime: 1 });
furnaceAllocationSchema.index({ tenantId: 1, status: 1 });
furnaceAllocationSchema.index({ tenantId: 1, planId: 1 });

export const FurnaceAllocationModel =
  mongoose.models.FurnaceAllocation ||
  mongoose.model<FurnaceAllocationDocument>('FurnaceAllocation', furnaceAllocationSchema);
