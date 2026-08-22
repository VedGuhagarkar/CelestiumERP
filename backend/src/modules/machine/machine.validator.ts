import { z } from 'zod';

export const MachineCategoryEnum = z.enum([
  'FURNACE_VACUUM',
  'FURNACE_ATMOSPHERE_SEALED_QUENCH',
  'FURNACE_PIT',
  'FURNACE_BOX',
  'FURNACE_CONTINUOUS_BELT',
  'FURNACE_INDUCTION',
  'QUENCH_TANK',
  'TEMPERING_OVEN',
  'CRYOGENIC_CHAMBER',
  'WASHING_LINE',
  'SHOT_BLASTER',
  'STRAIGHTENING_PRESS',
  'AUXILIARY_EQUIPMENT'
]);

export const MachineStatusEnum = z.enum([
  'IDLE',
  'RUNNING',
  'MAINTENANCE',
  'BREAKDOWN',
  'OFFLINE',
  'CALIBRATING'
]);

export const HeatingSourceEnum = z.enum([
  'GAS_FIRED',
  'ELECTRIC_RESISTANCE',
  'INDUCTION',
  'NONE'
]);

export const AtmosphereTypeEnum = z.enum([
  'VACUUM',
  'ENDOTHERMIC_GAS',
  'NITROGEN',
  'ARGON',
  'HYDROGEN',
  'AIR',
  'CARBON_DIOXIDE',
  'AMMONIA'
]);

export const QuenchMediumEnum = z.enum([
  'OIL',
  'WATER',
  'POLYMER',
  'GAS_HIGH_PRESSURE_N2',
  'SALT_BATH',
  'NONE'
]);

export const PyrometryClassEnum = z.enum([
  'CLASS_1',
  'CLASS_2',
  'CLASS_3',
  'CLASS_4',
  'CLASS_5',
  'NON_THERMAL'
]);

export const InstrumentationTypeEnum = z.enum([
  'TYPE_A',
  'TYPE_B',
  'TYPE_C',
  'TYPE_D',
  'TYPE_E',
  'NONE'
]);

export const PyrometryStandardEnum = z.enum([
  'AMS_2750G',
  'CQI_9',
  'BAC_5621',
  'STANDARD',
  'NON_PYROMETRY'
]);

export const NoteCategoryEnum = z.enum([
  'OPERATIONAL',
  'MAINTENANCE',
  'CALIBRATION',
  'SAFETY',
  'HANDOVER'
]);

export const createMachineSchema = z.object({
  machineCode: z.string().min(2).max(50).trim(),
  name: z.string().min(2).max(100).trim(),
  category: MachineCategoryEnum,
  status: MachineStatusEnum.optional(),
  technicalSpecs: z.object({
    manufacturer: z.string().min(1).max(100).trim(),
    modelNumber: z.string().min(1).max(100).trim(),
    serialNumber: z.string().min(1).max(100).trim(),
    yearOfManufacture: z.number().int().min(1950).max(2100).optional(),
    commissioningDate: z.string().or(z.date()).optional(),
    heatingSource: HeatingSourceEnum,
    maxPowerKw: z.number().min(0),
    atmosphereTypes: z.array(AtmosphereTypeEnum).default([]),
    quenchMedia: z.array(QuenchMediumEnum).default([])
  }),
  thermalLimits: z.object({
    minOperatingTempC: z.number().min(-200).max(3000),
    maxOperatingTempC: z.number().min(-200).max(3000),
    uniformOperatingMinC: z.number().min(-200).max(3000),
    uniformOperatingMaxC: z.number().min(-200).max(3000),
    maxHeatingRateCPerMin: z.number().min(0).optional(),
    maxCoolingRateCPerMin: z.number().min(0).optional(),
    temperatureUniformityToleranceC: z.number().min(0).optional()
  }),
  workingDimensions: z.object({
    lengthMm: z.number().min(10),
    widthMm: z.number().min(10),
    heightMm: z.number().min(10),
    diameterMm: z.number().min(10).optional(),
    usableVolumeM3: z.number().min(0.001),
    maxLoadWeightKg: z.number().min(1)
  }),
  location: z.object({
    plant: z.string().min(1).max(100).trim(),
    building: z.string().min(1).max(100).trim(),
    bay: z.string().min(1).max(100).trim(),
    cell: z.string().max(100).optional(),
    coordinates: z.string().max(100).optional()
  }),
  capabilities: z.object({
    supportedProcessFamilies: z.array(z.string()).min(1),
    furnaceClass: PyrometryClassEnum,
    instrumentationType: InstrumentationTypeEnum,
    pyrometryStandard: PyrometryStandardEnum,
    hasAgitationControl: z.boolean().optional(),
    maxQuenchWeightKg: z.number().min(0).optional()
  }),
  pyrometryCompliance: z
    .object({
      lastTusDate: z.string().or(z.date()).optional(),
      nextTusDueDate: z.string().or(z.date()).optional(),
      lastSatDate: z.string().or(z.date()).optional(),
      nextSatDueDate: z.string().or(z.date()).optional()
    })
    .optional(),
  initialNote: z.string().max(1000).optional()
});

export const updateMachineSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  technicalSpecs: z
    .object({
      manufacturer: z.string().min(1).max(100).trim().optional(),
      modelNumber: z.string().min(1).max(100).trim().optional(),
      serialNumber: z.string().min(1).max(100).trim().optional(),
      yearOfManufacture: z.number().int().min(1950).max(2100).optional(),
      commissioningDate: z.string().or(z.date()).optional(),
      heatingSource: HeatingSourceEnum.optional(),
      maxPowerKw: z.number().min(0).optional(),
      atmosphereTypes: z.array(AtmosphereTypeEnum).optional(),
      quenchMedia: z.array(QuenchMediumEnum).optional()
    })
    .optional(),
  thermalLimits: z
    .object({
      minOperatingTempC: z.number().min(-200).max(3000).optional(),
      maxOperatingTempC: z.number().min(-200).max(3000).optional(),
      uniformOperatingMinC: z.number().min(-200).max(3000).optional(),
      uniformOperatingMaxC: z.number().min(-200).max(3000).optional(),
      maxHeatingRateCPerMin: z.number().min(0).optional(),
      maxCoolingRateCPerMin: z.number().min(0).optional(),
      temperatureUniformityToleranceC: z.number().min(0).optional()
    })
    .optional(),
  workingDimensions: z
    .object({
      lengthMm: z.number().min(10).optional(),
      widthMm: z.number().min(10).optional(),
      heightMm: z.number().min(10).optional(),
      diameterMm: z.number().min(10).optional(),
      usableVolumeM3: z.number().min(0.001).optional(),
      maxLoadWeightKg: z.number().min(1).optional()
    })
    .optional(),
  location: z
    .object({
      plant: z.string().min(1).max(100).trim().optional(),
      building: z.string().min(1).max(100).trim().optional(),
      bay: z.string().min(1).max(100).trim().optional(),
      cell: z.string().max(100).optional(),
      coordinates: z.string().max(100).optional()
    })
    .optional(),
  capabilities: z
    .object({
      supportedProcessFamilies: z.array(z.string()).optional(),
      furnaceClass: PyrometryClassEnum.optional(),
      instrumentationType: InstrumentationTypeEnum.optional(),
      pyrometryStandard: PyrometryStandardEnum.optional(),
      hasAgitationControl: z.boolean().optional(),
      maxQuenchWeightKg: z.number().min(0).optional()
    })
    .optional(),
  pyrometryCompliance: z
    .object({
      lastTusDate: z.string().or(z.date()).optional(),
      nextTusDueDate: z.string().or(z.date()).optional(),
      lastSatDate: z.string().or(z.date()).optional(),
      nextSatDueDate: z.string().or(z.date()).optional(),
      isTusValid: z.boolean().optional(),
      isSatValid: z.boolean().optional()
    })
    .optional()
});

export const changeMachineStatusSchema = z.object({
  status: MachineStatusEnum,
  reason: z.string().max(500).optional(),
  workOrderId: z.string().max(100).optional(),
  jobId: z.string().optional(),
  jobNumber: z.string().optional()
});

export const addMachineNoteSchema = z.object({
  content: z.string().min(1).max(1000).trim(),
  category: NoteCategoryEnum
});

export const queryMachinesSchema = z.object({
  category: MachineCategoryEnum.optional(),
  status: MachineStatusEnum.optional(),
  processFamily: z.string().optional(),
  targetTemperatureC: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
  requiredLoadWeightKg: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  plant: z.string().optional(),
  bay: z.string().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
