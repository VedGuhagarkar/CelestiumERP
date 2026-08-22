import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { WorkforceMemberDocument } from './workforce-capacity.types.js';

const employeeSkillSchema = new Schema(
  {
    skillCode: { type: String, required: true, uppercase: true },
    skillName: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: ['BASIC', 'COMPETENT', 'EXPERT'],
      default: 'COMPETENT'
    },
    certifiedDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null },
    certifiedByActorId: { type: String, required: true },
    isCertified: { type: Boolean, default: true }
  },
  { _id: false }
);

const approvedLeaveSchema = new Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    leaveType: { type: String, required: true, trim: true },
    reason: { type: String, default: null }
  },
  { _id: false }
);

const workforceMemberSchema = createBaseSchema<WorkforceMemberDocument>({
  employeeCode: { type: String, required: true, uppercase: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  defaultShift: {
    type: String,
    enum: ['SHIFT_1_MORNING', 'SHIFT_2_EVENING', 'SHIFT_3_NIGHT', 'GENERAL_DAY'],
    default: 'SHIFT_1_MORNING'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'],
    default: 'ACTIVE'
  },
  maxDailyHours: { type: Number, default: 8.0, min: 4, max: 16 },
  maxWeeklyOvertimeHours: { type: Number, default: 12.0, min: 0, max: 30 },
  skills: { type: [employeeSkillSchema], default: [] },
  approvedLeaves: { type: [approvedLeaveSchema], default: [] },
  notes: { type: String, default: null }
});

workforceMemberSchema.index({ tenantId: 1, employeeCode: 1 }, { unique: true });
workforceMemberSchema.index({ tenantId: 1, status: 1 });
workforceMemberSchema.index({ tenantId: 1, defaultShift: 1 });
workforceMemberSchema.index({ tenantId: 1, 'skills.skillCode': 1 });

export const WorkforceMemberModel =
  mongoose.models.WorkforceMember ||
  mongoose.model<WorkforceMemberDocument>('WorkforceMember', workforceMemberSchema);
