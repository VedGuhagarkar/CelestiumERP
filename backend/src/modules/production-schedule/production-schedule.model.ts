import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { ProductionScheduleDocument } from './production-schedule.types.js';

const scheduleHistoryEntrySchema = new Schema(
  {
    action: {
      type: String,
      enum: ['SCHEDULE', 'RESCHEDULE', 'UNSCHEDULE', 'OVERRIDE_SCHEDULE'],
      required: true
    },
    previousFurnaceId: { type: String, default: null },
    previousFurnaceCode: { type: String, default: null },
    previousOperatorId: { type: String, default: null },
    previousOperatorCode: { type: String, default: null },
    previousStartTime: { type: Date, default: null },
    previousEndTime: { type: Date, default: null },
    newFurnaceId: { type: String, default: null },
    newFurnaceCode: { type: String, default: null },
    newOperatorId: { type: String, default: null },
    newOperatorCode: { type: String, default: null },
    newStartTime: { type: Date, default: null },
    newEndTime: { type: Date, default: null },
    performedBy: {
      userId: { type: String, required: true },
      email: { type: String, default: null },
      role: { type: String, default: null }
    },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { _id: false }
);

const productionScheduleSchema = createBaseSchema<ProductionScheduleDocument>({
  scheduleNumber: { type: String, required: true, uppercase: true },
  jobId: { type: String, required: true },
  jobNumber: { type: String, required: true, uppercase: true },
  planId: { type: String, default: null },
  planNumber: { type: String, default: null, uppercase: true },
  customerName: { type: String, required: true },
  itemCode: { type: String, required: true, uppercase: true },
  itemName: { type: String, required: true },
  materialGrade: { type: String, required: true },
  processFamily: { type: String, required: true },
  furnaceId: { type: String, required: true },
  furnaceCode: { type: String, required: true, uppercase: true },
  operatorId: { type: String, default: null },
  operatorCode: { type: String, default: null, uppercase: true },
  operatorName: { type: String, default: null },
  shift: { type: String, default: null },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  durationHours: { type: Number, required: true, min: 0.1 },
  status: {
    type: String,
    enum: [
      'SCHEDULED',
      'RESCHEDULED',
      'UNSCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED'
    ],
    default: 'SCHEDULED'
  },
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL'],
    default: 'NORMAL'
  },
  overrideApplied: { type: Boolean, default: false },
  overrideReason: { type: String, default: null },
  history: { type: [scheduleHistoryEntrySchema], default: [] },
  notes: { type: String, default: null }
});

productionScheduleSchema.index({ tenantId: 1, scheduleNumber: 1 }, { unique: true });
productionScheduleSchema.index({ tenantId: 1, jobId: 1 });
productionScheduleSchema.index({ tenantId: 1, furnaceId: 1, startTime: 1, endTime: 1 });
productionScheduleSchema.index({ tenantId: 1, operatorId: 1, startTime: 1, endTime: 1 });
productionScheduleSchema.index({ tenantId: 1, status: 1 });
productionScheduleSchema.index({ tenantId: 1, priority: 1, startTime: 1 });

export const ProductionScheduleModel =
  mongoose.models.ProductionSchedule ||
  mongoose.model<ProductionScheduleDocument>('ProductionSchedule', productionScheduleSchema);
