export type ConstraintCategory =
  | 'MATERIAL'
  | 'HEAT_LOT_AVAILABILITY'
  | 'FURNACE_CAPABILITY'
  | 'FURNACE_CAPACITY'
  | 'MACHINE_AVAILABILITY'
  | 'OPERATOR_AVAILABILITY'
  | 'OPERATOR_QUALIFICATION'
  | 'RECIPE_VALIDITY'
  | 'SPECIFICATION_VALIDITY';

export type ConstraintSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface IConstraintViolation {
  category: ConstraintCategory;
  severity: ConstraintSeverity;
  code: string;
  message: string;
  impactedEntityId?: string;
  impactedEntityIdentifier?: string;
  earliestResolutionDate?: Date | null;
  details?: Record<string, any>;
}

export type FeasibilityStatus = 'FULLY_FEASIBLE' | 'FEASIBLE_WITH_WARNINGS' | 'BLOCKED';

export interface PlanFeasibilityReport {
  planId: string;
  planNumber: string;
  customerCode: string;
  itemCode: string;
  materialGrade: string;
  status: FeasibilityStatus;
  isFeasible: boolean;
  isBlocked: boolean;
  blockingViolationsCount: number;
  warningsCount: number;
  violations: IConstraintViolation[];
  bottleneckCategories: ConstraintCategory[];
  earliestFeasibleStart?: Date | null;
  evaluatedAt: Date;
}

export interface AdHocBatchEvaluationDto {
  itemId: string;
  itemCode: string;
  materialGrade: string;
  plannedQuantity: number;
  recipeId?: string;
  specificationId?: string;
  assignedFurnaceId?: string;
  assignedEmployeeIds?: string[];
  targetDate?: string;
  shift?: 'SHIFT_1_MORNING' | 'SHIFT_2_EVENING' | 'SHIFT_3_NIGHT' | 'GENERAL_DAY';
  targetTemperatureC?: number;
  processFamily?: string;
  totalBatchWeightKg?: number;
}

export interface FactoryConstraintAuditSummary {
  totalPlansEvaluated: number;
  fullyFeasiblePlansCount: number;
  plansWithWarningsCount: number;
  blockedPlansCount: number;
  overallReadinessPercentage: number;
  categoryBreakdown: {
    category: ConstraintCategory;
    blockingCount: number;
    warningCount: number;
  }[];
  topBottlenecks: {
    category: ConstraintCategory;
    affectedPlansCount: number;
    description: string;
  }[];
  planReports: PlanFeasibilityReport[];
  auditedAt: Date;
}
