import { z } from 'zod';
import { SpecimenLocationEnum, HardnessScaleEnum } from '../metallurgical-lab/metallurgical-lab.validator.js';

export const InspectionCharacteristicTypeEnum = z.enum([
  'SURFACE_HARDNESS',
  'CORE_HARDNESS',
  'EFFECTIVE_CASE_DEPTH',
  'TOTAL_CASE_DEPTH',
  'MICROSTRUCTURE_MATRIX',
  'RETAINED_AUSTENITE',
  'GRAIN_SIZE',
  'DECARBURIZATION',
  'CARBIDE_MORPHOLOGY',
  'VISUAL_DIMENSIONAL',
  'PYROMETRY_VERIFICATION',
  'TENSILE_MECHANICAL'
]);

export const MeasurementTypeEnum = z.enum([
  'HARDNESS',
  'CASE_DEPTH_TRAVERSE',
  'MICROSTRUCTURE',
  'VISUAL_DIMENSIONAL',
  'PYROMETRY_VERIFICATION',
  'MECHANICAL'
]);

export const SamplingFrequencyEnum = z.enum([
  'PER_CHARGE',
  'PER_PIECE',
  'START_AND_END_OF_HEAT',
  'AQL_NORMAL',
  'AQL_TIGHTENED',
  'ONE_PER_LOT'
]);

export const acceptanceCriteriaSchema = z
  .object({
    targetMin: z.number().optional(),
    targetMax: z.number().optional(),
    scale: z.string().optional(),
    unit: z.string().optional(),
    description: z.string().max(500).optional(),
    testStandardReference: z.string().max(100).optional()
  })
  .refine(
    (data) => {
      if (data.targetMin !== undefined && data.targetMax !== undefined) {
        return data.targetMin <= data.targetMax;
      }
      return true;
    },
    {
      message: 'Contradictory criteria: targetMin cannot exceed targetMax'
    }
  );

export const inspectionCharacteristicSchema = z.object({
  itemCode: z.string().min(1, 'Characteristic item code is required').max(30),
  name: z.string().min(1, 'Characteristic name is required').max(100),
  characteristicType: InspectionCharacteristicTypeEnum,
  measurementType: MeasurementTypeEnum,
  isMandatory: z.boolean().default(true),
  specLocations: z.array(SpecimenLocationEnum).min(1, 'At least one specimen location is required'),
  sampleCount: z.number().int().min(1, 'Sample count must be at least 1'),
  readingsPerSample: z.number().int().min(1, 'Readings per sample must be at least 1'),
  samplingFrequency: SamplingFrequencyEnum.default('PER_CHARGE'),
  acceptanceCriteria: acceptanceCriteriaSchema,
  notes: z.string().max(500).optional()
});

export const ProcessFamilyEnum = z.enum([
  'CARBURIZING',
  'CARBONITRIDING',
  'NEUTRAL_HARDENING',
  'TEMPERING',
  'STRESS_RELIEVING',
  'ANNEALING',
  'NORMALIZING',
  'NITRIDING',
  'SOLUTION_TREATING_AGING',
  'INDUCTION_HARDENING',
  'VACUUM_HEAT_TREATMENT',
  'NITROCARBURIZING',
  'SOLUTION_AGE'
]);

export const createQualityPlanSchema = z.object({
  planCode: z.string().min(2).max(50).optional(),
  title: z.string().min(3, 'Plan title is required').max(150),
  description: z.string().max(1000).optional(),
  processFamily: ProcessFamilyEnum,
  specificationId: z.string().min(1, 'Authoritative Specification ID is required'),
  applicableCustomerCodes: z.array(z.string().min(1)).optional(),
  applicableItemCategories: z.array(z.string().min(1)).optional(),
  characteristics: z
    .array(inspectionCharacteristicSchema)
    .min(1, 'Quality plan must contain at least one inspection characteristic'),
  notes: z.string().max(1000).optional()
});

export const updateQualityPlanSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().max(1000).optional(),
  applicableCustomerCodes: z.array(z.string().min(1)).optional(),
  applicableItemCategories: z.array(z.string().min(1)).optional(),
  characteristics: z
    .array(inspectionCharacteristicSchema)
    .min(1, 'Quality plan must contain at least one inspection characteristic')
    .optional(),
  notes: z.string().max(1000).optional()
});

export const approveQualityPlanSchema = z.object({
  remarks: z.string().max(500).optional()
});

export const createQualityPlanRevisionSchema = z.object({
  changeDescription: z.string().min(5, 'Detailed change description is required for new revision').max(500),
  updatedCharacteristics: z.array(inspectionCharacteristicSchema).min(1).optional(),
  notes: z.string().max(1000).optional()
});

export const queryQualityPlansSchema = z.object({
  status: z.enum(['DRAFT', 'APPROVED', 'OBSOLETE']).optional(),
  processFamily: ProcessFamilyEnum.optional(),
  specCode: z.string().optional(),
  specificationId: z.string().optional(),
  customerCode: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
