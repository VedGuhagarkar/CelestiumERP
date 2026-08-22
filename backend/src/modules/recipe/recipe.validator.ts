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

const furnaceClassEnum = z.enum(['CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5']);

const atmosphereTypeEnum = z.enum([
  'CARBON_POTENTIAL',
  'NITRIDING_POTENTIAL_KN',
  'ENDOTHERMIC',
  'NITROGEN_PURGE',
  'VACUUM',
  'HYDROGEN'
]);

const quenchMediumEnum = z.enum([
  'FAST_QUENCH_OIL',
  'MARTEMPERING_OIL',
  'POLYMER_QUENCH',
  'WATER',
  'BRINE',
  'HIGH_PRESSURE_GAS_N2',
  'HIGH_PRESSURE_GAS_HE',
  'AIR_COOL',
  'FURNACE_COOL'
]);

const recipeStageSchema = z.object({
  sequence: z.number().int().min(1, 'Stage sequence must be positive'),
  stageName: z.string().trim().min(2, 'Stage name is required').max(100),
  targetTemperatureC: z.number().min(0, 'Temperature must be non-negative').max(1600),
  temperatureToleranceMinusC: z.number().min(0).default(5),
  temperatureTolerancePlusC: z.number().min(0).default(5),
  rampRateCPerMin: z.number().positive().optional(),
  soakTimeMinutes: z.number().min(0, 'Soak time must be non-negative'),
  soakCriteria: z.enum(['LOAD_THERMOCOUPLE_REACHED', 'FURNACE_ZONE_REACHED', 'FIXED_TIME']).default('FIXED_TIME'),
  atmosphereControl: z
    .object({
      type: atmosphereTypeEnum,
      setpoint: z.number(),
      tolerance: z.number().optional()
    })
    .optional(),
  quenchParameters: z
    .object({
      medium: quenchMediumEnum,
      targetTemperatureC: z.number().min(-50).max(300),
      agitationSpeedPercent: z.number().min(0).max(100).optional(),
      quenchDurationSeconds: z.number().min(0).optional(),
      gasQuenchPressureBar: z.number().min(0).max(30).optional()
    })
    .optional()
});

const metallurgicalTargetsSchema = z.object({
  targetHardnessMin: z.number().min(0),
  targetHardnessMax: z.number().min(0),
  hardnessScale: hardnessScaleEnum,
  effectiveCaseDepthMinMm: z.number().min(0).optional(),
  effectiveCaseDepthMaxMm: z.number().min(0).optional(),
  caseDepthCutoffHRC: z.number().min(0).optional(),
  totalCaseDepthMinMm: z.number().min(0).optional(),
  totalCaseDepthMaxMm: z.number().min(0).optional(),
  coreHardnessMin: z.number().min(0).optional(),
  coreHardnessMax: z.number().min(0).optional(),
  coreHardnessScale: hardnessScaleEnum.optional(),
  microstructureRequirements: z.string().trim().max(500).optional()
});

const machineRequirementsSchema = z.object({
  compatibleFurnaceTypes: z.array(z.string().trim()).min(1, 'At least one compatible furnace type is required'),
  minimumFurnaceClass: furnaceClassEnum.optional(),
  maxOperatingTempRequiredC: z.number().min(0).max(1600)
});

export const createRecipeSchema: ValidationSchema = {
  body: z.object({
    recipeCode: z
      .string()
      .trim()
      .min(2, 'Recipe code must be at least 2 characters')
      .max(30, 'Recipe code must not exceed 30 characters')
      .regex(/^[A-Z0-9_-]+$/, 'Recipe code must contain only uppercase letters, numbers, hyphens, and underscores')
      .toUpperCase(),
    name: z.string().trim().min(2, 'Recipe name is required').max(150),
    description: z.string().trim().max(1000).optional(),
    processFamily: processFamilyEnum,
    applicableMaterialGrades: z.array(z.string().trim()).min(1, 'At least one material grade is required'),
    stages: z.array(recipeStageSchema).min(1, 'At least one recipe thermal stage is required'),
    metallurgicalTargets: metallurgicalTargetsSchema,
    machineRequirements: machineRequirementsSchema
  })
};

export const updateRecipeSchema: ValidationSchema = {
  body: z.object({
    recipeCode: z.string().trim().optional(),
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    processFamily: processFamilyEnum.optional(),
    applicableMaterialGrades: z.array(z.string().trim()).min(1).optional(),
    stages: z.array(recipeStageSchema).min(1).optional(),
    metallurgicalTargets: metallurgicalTargetsSchema.optional(),
    machineRequirements: machineRequirementsSchema.optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Recipe ID is required')
  })
};

export const approveRecipeSchema: ValidationSchema = {
  body: z.object({
    comments: z.string().trim().max(500).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Recipe ID is required')
  })
};

export const rejectRecipeSchema: ValidationSchema = {
  body: z.object({
    rejectionReason: z.string().trim().min(3, 'Rejection reason is required').max(500)
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Recipe ID is required')
  })
};

export const queryRecipeSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    processFamily: processFamilyEnum.optional(),
    materialGrade: z.string().trim().optional(),
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
};
