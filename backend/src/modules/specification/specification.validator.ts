import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const processFamilyEnum = z.enum([
  'CARBURIZING',
  'CARBONITRIDING',
  'NEUTRAL_HARDENING',
  'TEMPERING',
  'STRESS_RELIEVING',
  'ANNEALING',
  'NORMALIZING',
  'NITRIDING',
  'SOLUTION_TREATING_AGING',
  'INDUCTION_HARDENING'
]);

const hardnessScaleEnum = z.enum(['HRC', 'HRB', 'HRA', 'HV1', 'HV5', 'HV10', 'HV30', 'HBW']);

const hardnessRequirementSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
  scale: hardnessScaleEnum,
  testMethodReference: z.string().trim().max(100).optional(),
  testLocations: z.array(z.string().trim()).optional()
});

const caseDepthRequirementSchema = z.object({
  effectiveCaseDepthMinMm: z.number().min(0).optional(),
  effectiveCaseDepthMaxMm: z.number().min(0).optional(),
  caseDepthCutoffHRC: z.number().min(0).optional(),
  totalCaseDepthMinMm: z.number().min(0).optional(),
  totalCaseDepthMaxMm: z.number().min(0).optional(),
  testMethodReference: z.string().trim().max(100).optional()
});

const microstructuralCriteriaSchema = z.object({
  matrixStructure: z.string().trim().min(2, 'Matrix structure is required').max(200),
  maxRetainedAustenitePercent: z.number().min(0).max(100).optional(),
  maxCarbideNetworkRating: z.string().trim().max(100).optional(),
  decarburizationLimitMm: z.number().min(0).optional(),
  intergranularOxidationLimitMm: z.number().min(0).optional()
});

const customerAcceptanceCriteriaSchema = z.object({
  samplingPlan: z.string().trim().min(2, 'Sampling plan is required').max(200),
  cocRequired: z.boolean().default(true),
  micrographRequired: z.boolean().default(false),
  destructiveCouponRequired: z.boolean().default(false),
  testStandardReferences: z.array(z.string().trim()).min(1, 'At least one test standard reference is required')
});

export const createSpecificationSchema: ValidationSchema = {
  body: z.object({
    specCode: z
      .string()
      .trim()
      .min(2, 'Specification code must be at least 2 characters')
      .max(30, 'Specification code must not exceed 30 characters')
      .regex(/^[A-Z0-9_-]+$/, 'Specification code must contain only uppercase letters, numbers, hyphens, and underscores')
      .toUpperCase(),
    title: z.string().trim().min(2, 'Specification title is required').max(150),
    description: z.string().trim().max(1000).optional(),
    customerId: z.string().trim().optional(),
    customerCode: z.string().trim().toUpperCase().optional(),
    applicableMaterialGrades: z.array(z.string().trim()).min(1, 'At least one applicable material grade is required'),
    processFamily: processFamilyEnum,
    surfaceHardness: hardnessRequirementSchema,
    coreHardness: hardnessRequirementSchema.optional(),
    caseDepth: caseDepthRequirementSchema.optional(),
    microstructure: microstructuralCriteriaSchema.optional(),
    customerAcceptance: customerAcceptanceCriteriaSchema
  })
};

export const updateSpecificationSchema: ValidationSchema = {
  body: z.object({
    specCode: z.string().trim().optional(),
    title: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    customerId: z.string().trim().optional(),
    customerCode: z.string().trim().toUpperCase().optional(),
    applicableMaterialGrades: z.array(z.string().trim()).min(1).optional(),
    processFamily: processFamilyEnum.optional(),
    surfaceHardness: hardnessRequirementSchema.optional(),
    coreHardness: hardnessRequirementSchema.optional(),
    caseDepth: caseDepthRequirementSchema.optional(),
    microstructure: microstructuralCriteriaSchema.optional(),
    customerAcceptance: customerAcceptanceCriteriaSchema.optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Specification ID is required')
  })
};

export const approveSpecificationSchema: ValidationSchema = {
  body: z.object({
    comments: z.string().trim().max(500).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Specification ID is required')
  })
};

export const rejectSpecificationSchema: ValidationSchema = {
  body: z.object({
    rejectionReason: z.string().trim().min(3, 'Rejection reason is required').max(500)
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Specification ID is required')
  })
};

export const querySpecificationSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    customerId: z.string().trim().optional(),
    customerCode: z.string().trim().optional(),
    processFamily: processFamilyEnum.optional(),
    materialGrade: z.string().trim().optional(),
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
