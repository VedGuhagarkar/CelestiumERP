import { z } from 'zod';

export const SpecimenLocationEnum = z.enum([
  'SURFACE',
  'CORE',
  'PITCH_LINE',
  'ROOT',
  'CASE',
  'TRANSITION',
  'CROSS_SECTION'
]);

export const HardnessScaleEnum = z.enum(['HRC', 'HRB', 'HRA', 'HV', 'HBW', 'HK']);

export const MicrohardnessLoadEnum = z.enum([
  'HV0.01',
  'HV0.025',
  'HV0.05',
  'HV0.1',
  'HV0.2',
  'HV0.3',
  'HV0.5',
  'HV1',
  'HV2',
  'HV3',
  'HV5',
  'HV10',
  'HV30',
  'HK0.1',
  'HK0.3',
  'HK0.5',
  'HK1'
]);

export const DecarbTypeEnum = z.enum(['COMPLETE', 'PARTIAL', 'TOTAL', 'NONE']);

export const CarbideRatingEnum = z.enum([
  'TYPE_A_FINE',
  'TYPE_B_MEDIUM',
  'TYPE_C_COARSE',
  'CONTINUOUS_NETWORK',
  'DISPERSED_SPHEROIDAL',
  'INTERGRANULAR'
]);

// Helper for physical range checks on hardness values
export function validateHardnessReading(value: number, scale: string): boolean {
  switch (scale) {
    case 'HRC':
      return value >= 20 && value <= 70;
    case 'HRB':
      return value >= 0 && value <= 130;
    case 'HRA':
      return value >= 40 && value <= 95;
    case 'HV':
    case 'HK':
      return value >= 10 && value <= 3000;
    case 'HBW':
      return value >= 20 && value <= 750;
    default:
      return true;
  }
}

export const createLabTestRecordSchema = z.object({
  inspectionId: z.string().min(1, 'Inspection ID is required'),
  heatLotNumber: z.string().optional(),
  notes: z.string().max(1000).optional()
});

export const addHardnessMeasurementSchema = z
  .object({
    sampleTag: z.string().min(1, 'Sample Tag is required').max(50),
    location: SpecimenLocationEnum,
    scale: HardnessScaleEnum,
    readings: z
      .array(z.number().positive('Hardness reading must be positive'))
      .min(1, 'At least one hardness reading is required')
      .max(20, 'Maximum 20 readings per measurement set'),
    testEquipmentCode: z.string().max(50).optional(),
    calibrationDueDate: z.string().datetime().optional(),
    targetMin: z.number().positive().optional(),
    targetMax: z.number().positive().optional(),
    notes: z.string().max(500).optional()
  })
  .refine(
    (data) => data.readings.every((r) => validateHardnessReading(r, data.scale)),
    {
      message: 'One or more hardness readings exceed the valid ASTM scale limits'
    }
  );

export const hardnessTraversePointSchema = z
  .object({
    depthMm: z.number().min(0, 'Traverse depth must be non-negative (>= 0 mm)'),
    measuredHardness: z.number().positive('Measured hardness must be positive'),
    scale: HardnessScaleEnum.optional().default('HV'),
    load: MicrohardnessLoadEnum.optional(),
    xCoordMicrons: z.number().optional(),
    yCoordMicrons: z.number().optional()
  })
  .refine((p) => validateHardnessReading(p.measuredHardness, p.scale || 'HV'), {
    message: 'Traverse point hardness value is out of physical scale limits'
  });

export const addHardnessTraverseSchema = z
  .object({
    sampleTag: z.string().min(1, 'Sample Tag is required').max(50),
    location: SpecimenLocationEnum,
    scale: HardnessScaleEnum.default('HV'),
    load: MicrohardnessLoadEnum.optional(),
    cutoffHardness: z.number().positive('Cutoff hardness must be a positive value'),
    points: z
      .array(hardnessTraversePointSchema)
      .min(3, 'At least 3 traverse points are required to compute case depth profile')
      .max(50, 'Maximum 50 traverse points allowed per traverse'),
    coreHardnessBaseline: z.number().positive().optional(),
    targetCaseDepthMinMm: z.number().positive().optional(),
    targetCaseDepthMaxMm: z.number().positive().optional(),
    testEquipmentCode: z.string().max(50).optional(),
    notes: z.string().max(500).optional()
  })
  .refine((data) => validateHardnessReading(data.cutoffHardness, data.scale), {
    message: 'Cutoff hardness exceeds valid scale bounds'
  });

export const addMicrostructureObservationSchema = z.object({
  sampleTag: z.string().min(1, 'Sample Tag is required').max(50),
  location: SpecimenLocationEnum,
  magnification: z
    .number()
    .min(10, 'Magnification must be at least 10x')
    .max(50000, 'Magnification exceeds optical/SEM limit (50000x)'),
  matrixStructure: z.string().min(2, 'Matrix structure description is required').max(200),
  retainedAustenite: z
    .object({
      measuredPercent: z
        .number()
        .min(0, 'Retained austenite percent must be >= 0%')
        .max(100, 'Retained austenite percent cannot exceed 100%'),
      testMethod: z.enum(['XRD', 'OPTICAL_METALLOGRAPHY', 'MAGNETIC']),
      acceptableMaxPercent: z.number().min(0).max(100).optional()
    })
    .optional(),
  grainSize: z
    .object({
      astmNumber: z
        .number()
        .min(1, 'ASTM grain size minimum is 1 (coarse)')
        .max(14, 'ASTM grain size maximum is 14 (ultrafine)'),
      method: z.enum(['COMPARISON', 'PLANIMETRIC', 'INTERCEPT']),
      targetMin: z.number().min(1).max(14).optional(),
      targetMax: z.number().min(1).max(14).optional()
    })
    .optional(),
  decarburization: z
    .object({
      type: DecarbTypeEnum,
      completeDecarbDepthMm: z.number().min(0).optional(),
      partialDecarbDepthMm: z.number().min(0).optional(),
      totalDecarbDepthMm: z.number().min(0, 'Total decarb depth must be >= 0 mm'),
      maxAllowedDepthMm: z.number().min(0).optional()
    })
    .optional(),
  carbideMorphology: z
    .object({
      rating: CarbideRatingEnum,
      networkPresent: z.boolean(),
      grainBoundaryPrecipitation: z.boolean(),
      description: z.string().max(300).optional()
    })
    .optional(),
  inclusionsAstmE45: z
    .object({
      typeA_Sulfides: z.object({ thin: z.number().min(0).max(5), heavy: z.number().min(0).max(5) }).optional(),
      typeB_Aluminates: z.object({ thin: z.number().min(0).max(5), heavy: z.number().min(0).max(5) }).optional(),
      typeC_Silicates: z.object({ thin: z.number().min(0).max(5), heavy: z.number().min(0).max(5) }).optional(),
      typeD_Oxides: z.object({ thin: z.number().min(0).max(5), heavy: z.number().min(0).max(5) }).optional()
    })
    .optional(),
  micrographPhotoUrls: z.array(z.string().url()).max(10).optional(),
  notes: z.string().max(500).optional()
});

export const lockLabTestRecordSchema = z.object({
  lockReason: z.string().min(3, 'Lock reason must be provided').max(500)
});

export const queryLabTestRecordsSchema = z.object({
  inspectionId: z.string().optional(),
  inspectionNumber: z.string().optional(),
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  heatLotNumber: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'LOCKED']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
