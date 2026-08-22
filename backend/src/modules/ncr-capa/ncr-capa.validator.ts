import { z } from 'zod';

export const DefectTypeEnum = z.enum([
  'HARDNESS_OUT_OF_TOLERANCE',
  'CASE_DEPTH_DEFICIENT',
  'CASE_DEPTH_EXCESSIVE',
  'MICROSTRUCTURE_NON_CONFORMING',
  'RETAINED_AUSTENITE_EXCESSIVE',
  'EXCESSIVE_DECARBURIZATION',
  'GRAIN_COARSENING',
  'CARBIDE_NETWORK_DEFECT',
  'DISTORTION_WARPAGE',
  'QUENCH_CRACKING',
  'SURFACE_OXIDATION_SCALING',
  'PYROMETRY_EXCURSION_OVERTEMP',
  'PYROMETRY_EXCURSION_UNDERTEMP',
  'ATMOSPHERE_FAILURE',
  'PROCESS_INTERRUPTION',
  'CUSTOMER_COMPLAINT_RETURN',
  'OTHER'
]);

export const DefectSeverityEnum = z.enum(['MINOR', 'MAJOR', 'CRITICAL']);

export const NcrStatusEnum = z.enum([
  'OPEN',
  'UNDER_INVESTIGATION',
  'DISPOSITIONED',
  'CAPA_PENDING',
  'CLOSED',
  'CANCELLED'
]);

export const NcrDispositionTypeEnum = z.enum([
  'SCRAP',
  'REWORK_REHEAT_TREAT',
  'REWORK_TEMPER_ONLY',
  'USE_AS_IS_CONCESSION',
  'RETURN_TO_CUSTOMER',
  'DE_RATE'
]);

export const RootCauseCategoryEnum = z.enum([
  'MAN_OPERATOR',
  'MACHINE_FURNACE',
  'METHOD_RECIPE',
  'MATERIAL_RAW',
  'MEASUREMENT_GAUGE',
  'ENVIRONMENT'
]);

export const InvestigationMethodEnum = z.enum([
  '5_WHY',
  'FISHBONE_ISHIKAWA',
  'METALLURGICAL_FAILURE_ANALYSIS',
  'THERMAL_CYCLE_AUDIT'
]);

export const CapaTypeEnum = z.enum([
  'CORRECTIVE',
  'PREVENTIVE',
  'CORRECTIVE_AND_PREVENTIVE'
]);

export const CapaStatusEnum = z.enum([
  'OPEN',
  'ACTION_PLANNING',
  'IN_PROGRESS',
  'VERIFICATION',
  'EFFECTIVE',
  'CLOSED',
  'VOID'
]);

export const CapaActionTypeEnum = z.enum([
  'RECIPE_MODIFICATION',
  'EQUIPMENT_CALIBRATION',
  'MAINTENANCE_OVERHAUL',
  'OPERATOR_RETRAINING',
  'SPECIFICATION_REVISION',
  'QUALITY_PLAN_UPDATE',
  'SUPPLIER_CAR',
  'SOP_UPDATE'
]);

export const CapaActionStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELLED'
]);

export const VerificationMethodEnum = z.enum([
  'SUBSEQUENT_LOT_AUDIT',
  'PYROMETRY_TUS_VALIDATION',
  'TRAINING_ASSESSMENT',
  'SPC_TREND_ANALYSIS'
]);

export const createNcrSchema = z.object({
  inspectionId: z.string().optional(),
  jobId: z.string().min(1, 'Production Job ID is required'),
  defectType: DefectTypeEnum,
  defectSeverity: DefectSeverityEnum,
  defectDescription: z.string().min(5, 'Detailed defect description is required').max(2000),
  defectLocations: z.array(z.string().min(1)).optional(),
  totalAffectedQuantity: z.number().positive('Total affected quantity must be positive'),
  rejectedQuantity: z.number().positive('Rejected quantity must be positive'),
  uom: z.string().min(1).optional(),
  containmentAction: z.string().min(3, 'Containment action statement is required').max(1000),
  quarantineRequired: z.boolean().optional(),
  quarantineBay: z.string().optional(),
  requiresCapa: z.boolean().optional(),
  evidence: z
    .array(
      z.object({
        title: z.string().min(2),
        evidenceType: z.enum(['MICROGRAPH', 'HARDNESS_REPORT', 'PYROMETRY_CHART', 'PHOTO', 'LAB_TEST_RECORD', 'DOC']),
        fileUrl: z.string().min(3),
        description: z.string().optional()
      })
    )
    .optional(),
  notes: z.string().max(1000).optional()
});

export const recordNcrRootCauseSchema = z.object({
  category: RootCauseCategoryEnum,
  investigationMethod: InvestigationMethodEnum,
  investigationDetails: z.string().min(10, 'Investigation details required').max(3000),
  fiveWhys: z.array(z.string().min(1)).optional(),
  fishboneCategories: z
    .object({
      man: z.array(z.string()).optional(),
      machine: z.array(z.string()).optional(),
      method: z.array(z.string()).optional(),
      material: z.array(z.string()).optional(),
      measurement: z.array(z.string()).optional(),
      environment: z.array(z.string()).optional()
    })
    .optional()
});

export const recordNcrDispositionSchema = z.object({
  dispositionType: NcrDispositionTypeEnum,
  instructions: z.string().min(5, 'Specific disposition instructions required').max(2000),
  concessionNumber: z.string().optional(),
  customerConcessionApproved: z.boolean().optional(),
  customerApprovalReference: z.string().optional(),
  remarks: z.string().max(1000).optional(),
  quarantineAction: z.enum(['RELEASE_FOR_REWORK', 'SCRAP_HANDOFF', 'MAINTAIN_QUARANTINE']).optional()
});

export const closeNcrSchema = z.object({
  remarks: z.string().max(1000).optional()
});

export const createCapaSchema = z.object({
  type: CapaTypeEnum,
  title: z.string().min(3, 'Title is required').max(200),
  problemStatement: z.string().min(10, 'Problem statement is required').max(2000),
  rootCauseSummary: z.string().min(10, 'Root cause summary is required').max(2000),
  actionItems: z
    .array(
      z.object({
        actionType: CapaActionTypeEnum,
        description: z.string().min(5).max(1000),
        assignedToUserId: z.string().min(1),
        assignedToEmail: z.string().email().optional(),
        assignedToName: z.string().optional(),
        targetCompletionDate: z.string().or(z.date())
      })
    )
    .optional(),
  notes: z.string().max(1000).optional()
});

export const updateCapaActionItemSchema = z.object({
  itemNumber: z.number().int().positive(),
  status: CapaActionStatusEnum,
  completionNotes: z.string().max(1000).optional(),
  actualCompletionDate: z.string().or(z.date()).optional()
});

export const verifyCapaEffectivenessSchema = z.object({
  verificationMethod: VerificationMethodEnum,
  verificationPeriodDays: z.number().int().positive(),
  isEffective: z.boolean(),
  notes: z.string().min(5, 'Verification notes required').max(2000)
});

export const closeCapaSchema = z.object({
  remarks: z.string().max(1000).optional()
});

export const queryNcrsSchema = z.object({
  status: NcrStatusEnum.optional(),
  defectType: DefectTypeEnum.optional(),
  defectSeverity: DefectSeverityEnum.optional(),
  jobId: z.string().optional(),
  inspectionId: z.string().optional(),
  customerCode: z.string().optional(),
  requiresCapa: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const queryCapasSchema = z.object({
  status: CapaStatusEnum.optional(),
  type: CapaTypeEnum.optional(),
  ncrId: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
