import { Document } from 'mongoose';
import { JobPriority } from '../production-job/production-job.types.js';

export type ScheduleStatus =
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'UNSCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type ScheduleAction = 'SCHEDULE' | 'RESCHEDULE' | 'UNSCHEDULE' | 'OVERRIDE_SCHEDULE';

export interface IScheduleHistoryEntry {
  action: ScheduleAction;
  previousFurnaceId?: string | null;
  previousFurnaceCode?: string | null;
  previousOperatorId?: string | null;
  previousOperatorCode?: string | null;
  previousStartTime?: Date | null;
  previousEndTime?: Date | null;
  newFurnaceId?: string | null;
  newFurnaceCode?: string | null;
  newOperatorId?: string | null;
  newOperatorCode?: string | null;
  newStartTime?: Date | null;
  newEndTime?: Date | null;
  performedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  timestamp: Date;
  reason?: string | null;
  notes?: string | null;
}

export interface IProductionSchedule {
  scheduleNumber: string;
  tenantId: string;
  jobId: string;
  jobNumber: string;
  planId?: string | null;
  planNumber?: string | null;
  customerName: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  processFamily: string;
  furnaceId: string;
  furnaceCode: string;
  operatorId?: string | null;
  operatorCode?: string | null;
  operatorName?: string | null;
  shift?: string | null;
  startTime: Date;
  endTime: Date;
  durationHours: number;
  status: ScheduleStatus;
  priority: JobPriority;
  overrideApplied: boolean;
  overrideReason?: string | null;
  history: IScheduleHistoryEntry[];
  notes?: string | null;
  isDeleted: boolean;
}

export interface ProductionScheduleDocument extends IProductionSchedule, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleJobDto {
  jobId: string;
  furnaceId: string;
  operatorId?: string;
  shift?: 'SHIFT_1_MORNING' | 'SHIFT_2_EVENING' | 'SHIFT_3_NIGHT' | 'GENERAL_DAY';
  plannedStartTime: string | Date;
  plannedEndTime: string | Date;
  overrideConstraints?: boolean;
  overrideReason?: string;
  notes?: string;
}

export interface RescheduleJobDto {
  newFurnaceId?: string;
  newOperatorId?: string;
  newShift?: 'SHIFT_1_MORNING' | 'SHIFT_2_EVENING' | 'SHIFT_3_NIGHT' | 'GENERAL_DAY';
  newPlannedStartTime: string | Date;
  newPlannedEndTime: string | Date;
  overrideConstraints?: boolean;
  overrideReason?: string;
  reason: string;
  notes?: string;
}

export interface UnscheduleJobDto {
  reason: string;
  notes?: string;
}

export interface QueryScheduleDto {
  furnaceId?: string;
  operatorId?: string;
  status?: ScheduleStatus;
  priority?: JobPriority;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}
