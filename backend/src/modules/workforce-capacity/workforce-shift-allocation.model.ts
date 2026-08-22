import mongoose from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { WorkforceShiftAllocationDocument } from './workforce-capacity.types.js';

const workforceShiftAllocationSchema =
  createBaseSchema<WorkforceShiftAllocationDocument>({
    allocationNumber: { type: String, required: true, uppercase: true },
    employeeId: { type: String, required: true },
    employeeCode: { type: String, required: true, uppercase: true },
    employeeName: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    shift: {
      type: String,
      enum: ['SHIFT_1_MORNING', 'SHIFT_2_EVENING', 'SHIFT_3_NIGHT', 'GENERAL_DAY'],
      required: true
    },
    furnaceId: { type: String, default: null },
    furnaceCode: { type: String, default: null, uppercase: true },
    planId: { type: String, default: null },
    planNumber: { type: String, default: null, uppercase: true },
    jobCardId: { type: String, default: null },
    allocatedHours: { type: Number, required: true, min: 0.5, max: 16 },
    isOvertime: { type: Boolean, default: false },
    requiredSkills: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'ASSIGNED'
    },
    assignedByActorId: { type: String, required: true },
    notes: { type: String, default: null }
  });

workforceShiftAllocationSchema.index(
  { tenantId: 1, allocationNumber: 1 },
  { unique: true }
);
workforceShiftAllocationSchema.index({
  tenantId: 1,
  employeeId: 1,
  date: 1,
  shift: 1,
  status: 1
});
workforceShiftAllocationSchema.index({ tenantId: 1, date: 1, shift: 1 });
workforceShiftAllocationSchema.index({ tenantId: 1, planId: 1 });

export const WorkforceShiftAllocationModel =
  mongoose.models.WorkforceShiftAllocation ||
  mongoose.model<WorkforceShiftAllocationDocument>(
    'WorkforceShiftAllocation',
    workforceShiftAllocationSchema
  );
