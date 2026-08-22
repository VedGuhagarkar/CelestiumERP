import { Document } from 'mongoose';

export type ShiftType = 'SHIFT_1_MORNING' | 'SHIFT_2_EVENING' | 'SHIFT_3_NIGHT' | 'GENERAL_DAY';
export type SkillProficiency = 'BASIC' | 'COMPETENT' | 'EXPERT';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type AllocationStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface IEmployeeSkill {
  skillCode: string; // e.g. 'SEALED_QUENCH_FURNACE_OPERATION', 'METALLURGICAL_PYROMETRY_AMS2750'
  skillName: string;
  proficiency: SkillProficiency;
  certifiedDate: Date;
  expiryDate?: Date | null;
  certifiedByActorId: string;
  isCertified: boolean;
}

export interface IApprovedLeave {
  startDate: Date;
  endDate: Date;
  leaveType: string; // 'VACATION', 'SICK', 'TRAINING'
  reason?: string;
}

export interface IWorkforceMember {
  employeeCode: string;
  fullName: string;
  tenantId: string;
  department: string;
  designation: string;
  defaultShift: ShiftType;
  status: EmployeeStatus;
  maxDailyHours: number; // default 8.0
  maxWeeklyOvertimeHours: number; // default 12.0
  skills: IEmployeeSkill[];
  approvedLeaves: IApprovedLeave[];
  notes?: string | null;
  isDeleted: boolean;
}

export interface WorkforceMemberDocument extends IWorkforceMember, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkforceShiftAllocation {
  allocationNumber: string;
  tenantId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: Date;
  shift: ShiftType;
  furnaceId?: string | null;
  furnaceCode?: string | null;
  planId?: string | null;
  planNumber?: string | null;
  jobCardId?: string | null;
  allocatedHours: number;
  isOvertime: boolean;
  requiredSkills: string[];
  status: AllocationStatus;
  assignedByActorId: string;
  notes?: string | null;
  isDeleted: boolean;
}

export interface WorkforceShiftAllocationDocument
  extends IWorkforceShiftAllocation,
    Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluateCoverageRequestDto {
  date: string;
  shift: ShiftType;
  requiredSkills: string[];
  requiredOperatorCount?: number;
  furnaceId?: string;
  planId?: string;
}

export interface EvaluateCoverageResult {
  isSufficient: boolean;
  requiredCount: number;
  availableQualifiedCount: number;
  shortageCount: number;
  qualifiedOperators: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    proficiency: SkillProficiency;
    isAssignedInShift: boolean;
    availableHours: number;
  }[];
  unqualifiedOperatorsInShift: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    missingSkills: string[];
  }[];
  violations: string[];
}

export interface AssignOperatorDto {
  employeeId: string;
  date: string;
  shift: ShiftType;
  allocatedHours: number;
  furnaceId?: string;
  planId?: string;
  jobCardId?: string;
  requiredSkills: string[];
  notes?: string;
}

export interface ShiftCapacitySummaryDto {
  date: Date;
  shift: ShiftType;
  totalScheduledOperators: number;
  onLeaveOperators: number;
  activeOperators: number;
  totalAvailableHours: number;
  bookedHours: number;
  freeHours: number;
  utilizationPercentage: number;
  skillBreakdown: {
    skillCode: string;
    qualifiedCount: number;
    assignedCount: number;
  }[];
}

export interface CreateEmployeeDto {
  employeeCode: string;
  fullName: string;
  department: string;
  designation: string;
  defaultShift?: ShiftType;
  maxDailyHours?: number;
  maxWeeklyOvertimeHours?: number;
  skills?: {
    skillCode: string;
    skillName: string;
    proficiency: SkillProficiency;
    certifiedDate: string;
    expiryDate?: string;
  }[];
  notes?: string;
}

export interface AddSkillDto {
  skillCode: string;
  skillName: string;
  proficiency: SkillProficiency;
  certifiedDate: string;
  expiryDate?: string;
}
