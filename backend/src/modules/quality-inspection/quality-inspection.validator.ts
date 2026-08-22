import { z } from 'zod';

export const createQualityInspectionSchema = z.object({
  jobId: z.string().min(1, 'Production Job ID is required'),
  sampleSize: z.number().int().positive('Sample size must be a positive integer').optional(),
  assignedInspectorId: z.string().optional(),
  notes: z.string().optional()
});

export const assignInspectorSchema = z.object({
  inspectorId: z.string().min(1, 'Inspector ID is required'),
  reason: z.string().optional()
});

const HardnessTestPointSchema = z.object({
  pointIdentifier: z.string().min(1, 'Point identifier is required'),
  location: z.enum(['SURFACE', 'CORE', 'CASE', 'TRANSITION']),
  measuredValue: z.number(),
  scale: z.enum(['HRC', 'HRB', 'HV', 'HBW']),
  targetMin: z.number().optional(),
  targetMax: z.number().optional(),
  passed: z.boolean()
});

const CaseDepthTestResultSchema = z.object({
  effectiveCaseDepthMm: z.number().nonnegative(),
  totalCaseDepthMm: z.number().nonnegative().optional(),
  cutoffHardnessHrc: z.number().optional(),
  targetMinMm: z.number().optional(),
  targetMaxMm: z.number().optional(),
  passed: z.boolean()
});

const MicrostructureTestResultSchema = z.object({
  observedStructure: z.string().min(1, 'Observed structure description is required'),
  grainSizeAstm: z.number().optional(),
  retainedAustenitePercent: z.number().optional(),
  decarburizationDepthMm: z.number().optional(),
  carbideDistributionRating: z.string().optional(),
  passed: z.boolean(),
  photoUrls: z.array(z.string()).optional(),
  notes: z.string().optional()
});

const MechanicalTestResultSchema = z.object({
  tensileStrengthMpa: z.number().optional(),
  yieldStrengthMpa: z.number().optional(),
  elongationPercent: z.number().optional(),
  reductionOfAreaPercent: z.number().optional(),
  impactEnergyJoules: z.number().optional(),
  passed: z.boolean(),
  notes: z.string().optional()
});

const VisualDimensionalResultSchema = z.object({
  distortionMm: z.number().optional(),
  maxAllowedDistortionMm: z.number().optional(),
  surfaceOxidationAcceptable: z.boolean(),
  quenchCracksPresent: z.boolean(),
  dimensionsWithinTolerance: z.boolean(),
  passed: z.boolean(),
  notes: z.string().optional()
});

const PyrometryVerificationSchema = z.object({
  pyrometryArchiveId: z.string().optional(),
  soakTemperatureCompliant: z.boolean(),
  soakTimeCompliant: z.boolean(),
  quenchDelayCompliant: z.boolean(),
  coolingRateCompliant: z.boolean(),
  passed: z.boolean(),
  verifiedBy: z.string().optional(),
  notes: z.string().optional()
});

export const recordTestResultsSchema = z.object({
  hardnessTests: z.array(HardnessTestPointSchema).optional(),
  caseDepth: CaseDepthTestResultSchema.optional(),
  microstructure: MicrostructureTestResultSchema.optional(),
  mechanical: MechanicalTestResultSchema.optional(),
  visualDimensional: VisualDimensionalResultSchema.optional(),
  pyrometry: PyrometryVerificationSchema.optional(),
  notes: z.string().optional()
});

export const approveInspectionSchema = z.object({
  disposition: z.enum(['CONFORMING', 'CONCESSION_GRANTED']).optional().default('CONFORMING'),
  remarks: z.string().optional()
});

export const rejectInspectionSchema = z.object({
  defectCode: z.string().optional(),
  defectDescription: z.string().min(3, 'Defect description is mandatory when rejecting'),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
  rootCauseCategory: z.string().optional(),
  dispositionRecommendation: z
    .enum(['SCRAP', 'REWORK_REHEAT', 'REWORK_TEMPER', 'CONCESSION', 'RETURN_TO_VENDOR', 'NONE'])
    .optional()
    .default('SCRAP'),
  quarantineRequired: z.boolean().optional().default(false),
  quarantineLocationBay: z.string().optional(),
  correctiveActionPlan: z.string().optional(),
  remarks: z.string().optional()
});

export const requestReinspectionSchema = z.object({
  reinspectionReason: z.string().min(5, 'Reinspection reason is required and must be detailed'),
  revisedSampleSize: z.number().int().positive().optional(),
  assignedInspectorId: z.string().optional(),
  notes: z.string().optional()
});

export const queryQualityInspectionsSchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REINSPECTION']).optional(),
  disposition: z
    .enum(['PENDING', 'CONFORMING', 'NON_CONFORMING', 'CONCESSION_GRANTED', 'SCRAP', 'REWORK'])
    .optional(),
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  inspectorId: z.string().optional(),
  heatLotNumber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
