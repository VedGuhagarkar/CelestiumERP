import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const pyrometryClassEnum = z.enum(['CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5']);
const instrumentationTypeEnum = z.enum(['TYPE_A', 'TYPE_B', 'TYPE_C', 'TYPE_D', 'TYPE_E']);
const furnaceStatusEnum = z.enum([
  'OPERATIONAL',
  'MAINTENANCE_SCHEDULED',
  'BREAKDOWN',
  'CALIBRATION_OVERDUE',
  'OFFLINE'
]);

export const createFurnaceSchema: ValidationSchema = {
  body: z.object({
    furnaceCode: z
      .string()
      .trim()
      .min(2, 'Furnace code must be at least 2 characters')
      .max(30, 'Furnace code must not exceed 30 characters')
      .regex(/^[A-Z0-9_-]+$/, 'Furnace code must be uppercase alphanumeric with hyphens/underscores')
      .toUpperCase(),
    name: z.string().trim().min(2, 'Furnace name is required').max(100),
    furnaceType: z.string().trim().min(2, 'Furnace type is required').max(50),
    manufacturer: z.string().trim().max(100).optional(),
    modelNumber: z.string().trim().max(50).optional(),
    serialNumber: z.string().trim().max(50).optional(),
    locationBay: z.string().trim().min(1, 'Location bay is required').max(50),
    dimensions: z.object({
      lengthMm: z.number().min(100),
      widthMm: z.number().min(100),
      heightMm: z.number().min(100),
      usableVolumeM3: z.number().min(0.01),
      maxGrossWeightKg: z.number().min(10)
    }),
    thermalCapabilities: z.object({
      minOperatingTempC: z.number().min(0),
      maxOperatingTempC: z.number().max(2000),
      temperatureUniformityToleranceC: z.number().min(1),
      pyrometryClass: pyrometryClassEnum,
      instrumentationType: instrumentationTypeEnum,
      lastTusDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
      nextTusDueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
      lastSatDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
      nextSatDueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
    }),
    processCapabilities: z.object({
      supportedProcessFamilies: z.array(z.string().trim()).min(1, 'At least one process family is required'),
      supportedAtmospheres: z.array(z.string().trim()).optional(),
      supportedQuenchMedia: z.array(z.string().trim()).optional(),
      maxQuenchWeightKg: z.number().positive().optional(),
      hasAgitationControl: z.boolean().default(false)
    }),
    nominalDailyOperatingHours: z.number().min(1).max(24).default(24.0),
    notes: z.string().trim().max(500).optional()
  })
};

export const updateFurnaceSchema: ValidationSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    furnaceType: z.string().trim().max(50).optional(),
    locationBay: z.string().trim().max(50).optional(),
    status: furnaceStatusEnum.optional(),
    dimensions: z
      .object({
        lengthMm: z.number().min(100),
        widthMm: z.number().min(100),
        heightMm: z.number().min(100),
        usableVolumeM3: z.number().min(0.01),
        maxGrossWeightKg: z.number().min(10)
      })
      .optional(),
    thermalCapabilities: z
      .object({
        minOperatingTempC: z.number().min(0),
        maxOperatingTempC: z.number().max(2000),
        temperatureUniformityToleranceC: z.number().min(1),
        pyrometryClass: pyrometryClassEnum,
        instrumentationType: instrumentationTypeEnum,
        lastTusDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
        nextTusDueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
        lastSatDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
        nextSatDueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
      })
      .optional(),
    processCapabilities: z
      .object({
        supportedProcessFamilies: z.array(z.string().trim()).min(1),
        supportedAtmospheres: z.array(z.string().trim()).optional(),
        supportedQuenchMedia: z.array(z.string().trim()).optional(),
        maxQuenchWeightKg: z.number().positive().optional(),
        hasAgitationControl: z.boolean().optional()
      })
      .optional(),
    notes: z.string().trim().max(500).optional()
  }),
  params: z.object({
    id: z.string().trim().min(1, 'Furnace ID is required')
  })
};

export const compatibilityCheckSchema: ValidationSchema = {
  body: z.object({
    furnaceId: z.string().trim().min(1, 'Furnace ID is required'),
    recipeId: z.string().trim().optional(),
    targetTemperatureC: z.number().min(0).max(2000),
    processFamily: z.string().trim().min(1, 'Process family is required'),
    requiredFurnaceClass: pyrometryClassEnum.optional(),
    requiredAtmosphere: z.string().trim().optional(),
    requiredQuenchMedium: z.string().trim().optional(),
    totalBatchWeightKg: z.number().positive('Total batch weight must be positive'),
    requestedStartTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    requestedEndTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    durationHours: z.number().positive().optional()
  })
};

export const bookFurnaceCapacitySchema: ValidationSchema = {
  body: z.object({
    furnaceId: z.string().trim().min(1, 'Furnace ID is required'),
    planId: z.string().trim().optional(),
    jobCardId: z.string().trim().optional(),
    processFamily: z.string().trim().min(1, 'Process family is required'),
    targetTemperatureC: z.number().min(0).max(2000),
    allocatedWeightKg: z.number().positive('Allocated weight must be positive'),
    startTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    endTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    notes: z.string().trim().max(500).optional()
  })
};

export const queryFurnaceSchema: ValidationSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    furnaceType: z.string().trim().optional(),
    processFamily: z.string().trim().optional(),
    status: furnaceStatusEnum.optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
};

export const queryUtilizationSchema: ValidationSchema = {
  query: z.object({
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    furnaceType: z.string().trim().optional()
  })
};
